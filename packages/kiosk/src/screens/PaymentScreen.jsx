import { useState, useEffect, useRef, useCallback } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import './PaymentScreen.css';

const BACKEND       = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const DEFAULT_BRAND = import.meta.env.VITE_BRAND       || 'smashme';
const DEFAULT_ORG   = import.meta.env.VITE_ORG_ID      || '';
const LOCATION_NAME = import.meta.env.VITE_LOCATION_NAME || '';

const STATE = {
  IDLE:         'idle',
  INITIATING:   'initiating',
  WAITING_CARD: 'waiting_card',
  PIN_ENTRY:    'pin_entry',
  AUTHORIZING:  'authorizing',

  APPROVED:     'approved',
  DECLINED:     'declined',
  ERROR:        'error',
  CASH_SUCCESS: 'cash_success',
};

export default function PaymentScreen() {
  useInactivityTimeout(180);

  const goTo           = useKioskStore((s) => s.goTo);
  const getCartTotal   = useKioskStore((s) => s.getCartTotal);
  const cartItems      = useKioskStore((s) => s.cartItems);
  const orderType      = useKioskStore((s) => s.orderType);
  const tableNumber    = useKioskStore((s) => s.tableNumber);
  const lang           = useKioskStore((s) => s.lang);
  const resetOrder     = useKioskStore((s) => s.resetOrder);
  const locationData   = useKioskStore((s) => s.locationData);
  const activeBrandId  = useKioskStore((s) => s.activeBrandId);
  const setPaymentMethod = useKioskStore((s) => s.setPaymentMethod);
  const setLastOrderNumber = useKioskStore((s) => s.setLastOrderNumber);

  const total      = getCartTotal();
  const orderIdRef = useRef(null);
  const socketRef  = useRef(null);

  const [payState, setPayState] = useState(STATE.IDLE);
  const [errorMsg, setErrorMsg] = useState('');
  const [txInfo,   setTxInfo]   = useState(null);

  const [showPosInstructions, setShowPosInstructions] = useState(false);
  const [posTimer, setPosTimer] = useState(30);

  useEffect(() => {
    let timeout;
    if (payState === STATE.WAITING_CARD) {
      timeout = setTimeout(() => {
        setShowPosInstructions(true);
      }, 7000);
    } else {
      setShowPosInstructions(false);
      setPosTimer(30);
    }
    return () => clearTimeout(timeout);
  }, [payState]);

  useEffect(() => {
    let interval;
    if (showPosInstructions && posTimer > 0) {
      interval = setInterval(() => {
        setPosTimer(p => p - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showPosInstructions, posTimer]);
  useEffect(() => {
    // cleanup card socket on unmount
    return () => {
      socketRef.current?.disconnect?.();
    };
  }, []);



  const sendOrder = useCallback(async (paymentResult, pMethod = 'card') => {
    try {
      // ⚠️ CRITICAL: Use location-specific orgId to ensure orders go to the correct kitchen
      // Priority: locationData.orgIds[brand] > URL param > DEFAULT_ORG
      const urlBrand   = new URLSearchParams(window.location.search).get('brand');
      const urlOrg     = new URLSearchParams(window.location.search).get('orgId');
      const effectiveBrand = activeBrandId || urlBrand || DEFAULT_BRAND;
      const locationOrgId  = locationData?.orgIds?.[effectiveBrand];
      const effectiveOrgId = locationOrgId || urlOrg || DEFAULT_ORG;
      const locationName   = locationData?.name || LOCATION_NAME;

      console.log(`[PaymentScreen] Order → brand: ${effectiveBrand}, org: ${effectiveOrgId}, loc: ${locationName}, method: ${pMethod}`);

      const res = await fetch(`${BACKEND}/api/orders`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand:        effectiveBrand,
          orgId:        effectiveOrgId,
          locationId:   locationData?.id,
          locationName: locationName,
          orderType, tableNumber,
          items: cartItems.map(i => ({
            productId: i.productId, name: i.name, quantity: i.quantity,
            unitPrice: i.unitPrice, totalPrice: i.totalPrice,
            brandId: i.brandId,
            imageUrl: i.image || null,
            selectedModifiers: i.selectedModifiers || [],
          })),
          totalAmount: total, channel: 'kiosk', paymentMethod: pMethod,
          paymentRef: { authCode: paymentResult?.authCode, receiptNo: paymentResult?.receiptNo,
                        cardNo: paymentResult?.cardNo, refNum: paymentResult?.refNum,
                        extraFields: paymentResult?.extraFields },
        }),
      });
      const data = await res.json();
      return data.order;
    } catch (err) { console.error('[PaymentScreen] sendOrder failed:', err); return null; }
  }, [cartItems, total, orderType, tableNumber, activeBrandId, locationData]);

  const handlePayCash = async () => {
    setPayState(STATE.INITIATING);
    setErrorMsg('');
    setPaymentMethod('cash');
    const orderData = await sendOrder(null, 'cash');
    if (orderData) {
      setTxInfo({ orderNumber: orderData.orderNumber });
      setLastOrderNumber(orderData.orderNumber);
      setPayState(STATE.CASH_SUCCESS);
      setTimeout(() => goTo('confirmation'), 8000); // allow time to read
    } else {
      setPayState(STATE.ERROR);
      setErrorMsg('Eroare la trimiterea comenzii. Vă rugăm încercați din nou.');
    }
  };

  const handlePay = useCallback(async () => {
    setPayState(STATE.INITIATING);
    setErrorMsg('');
    try {
      const orderId = `kiosk-${Date.now()}`;
      orderIdRef.current = orderId;

      const { io } = await import('socket.io-client');
      const socket = io(BACKEND, { transports: ['websocket'], reconnection: false });
      socketRef.current = socket;

      socket.on(`payment_status_${orderId}`, ({ message }) => {
        const lower = (message || '').toLowerCase();
        if (lower.includes('pin'))   setPayState(STATE.PIN_ENTRY);
        if (lower.includes('banc') || lower.includes('auth')) setPayState(STATE.AUTHORIZING);
      });

      socket.on(`payment_confirmed_${orderId}`, async (result) => {
        socket.disconnect(); socketRef.current = null;
        if (result.paid) {
          setTxInfo(result);
          setPayState(STATE.APPROVED);
          const orderData = await sendOrder(result);
          if (orderData?.orderNumber) setLastOrderNumber(orderData.orderNumber);
          setTimeout(() => goTo('confirmation'), 2200);
        } else {
          setPayState(STATE.DECLINED);
          setErrorMsg(result.error || 'Plată refuzată de bancă');
        }
      });

      const res = await fetch(`${BACKEND}/api/payment/initiate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: total,
          paymentGateway: locationData?.paymentGateway || 'none',
          locationId: locationData?.kioskUrl || locationData?.id || '',
          channel: 'kiosk',
        }),
      });
      if (!res.ok) throw new Error(`Backend ${res.status}`);
      setPayState(STATE.WAITING_CARD);
    } catch (err) {
      setPayState(STATE.ERROR);
      setErrorMsg(err.message || 'Eroare conexiune terminal');
    }
  }, [total, sendOrder, goTo]);

  const handleCancel      = () => { socketRef.current?.disconnect(); goTo('cart'); };
  const handleCancelOrder = () => { socketRef.current?.disconnect(); resetOrder(); };
  const handleRetry       = () => { setPayState(STATE.IDLE); setErrorMsg(''); setTxInfo(null); };

  const canGoBack = [STATE.IDLE, STATE.ERROR, STATE.DECLINED].includes(payState);

  return (
    <div className="payment-screen screen">
      {canGoBack && (
        <button className="back-btn-abs" onClick={handleCancel}>{t('back_to_cart', lang)}</button>
      )}

      <div className="payment-content fade-in">
        <div className="payment-amount">
          <span className="pa-label">{t('total_to_pay', lang)}</span>
          <span className="pa-amount">{total.toFixed(2)} {t('lei', lang)}</span>
        </div>

        {payState === STATE.IDLE && (
          <>
            {/* ── Iconul cardului ── */}
            <div className="payment-icons-row" style={{justifyContent:'center'}}>
              <div className="pir-card">
                <div className="payment-pos-icon">
                  <span className="pos-emoji">💳</span>
                  <div className="pos-waves"><div className="wave"/><div className="wave"/><div className="wave"/></div>
                </div>
                <p className="pir-label">{t('payment_card_title', lang)}</p>
              </div>
            </div>

            {/* ── Instructiuni + buton ── */}
            <div className="payment-instruction" style={{marginTop:12}}>
              <div className="pi-step"><span className="pi-num">1</span><span>{t('payment_step_1', lang)}</span></div>
              <div className="pi-step"><span className="pi-num">2</span><span>{t('payment_step_2', lang)}</span></div>
              <div className="pi-step"><span className="pi-num">3</span><span>{t('payment_step_3', lang)}</span></div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexDirection: 'column' }}>
              <button className="btn btn-success btn-xl pay-btn" onClick={handlePay}>
                Plată Card ({total.toFixed(2)} {t('lei', lang)})
              </button>
              <button className="btn btn-outline btn-xl pay-btn" style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)', borderWidth: '2px' }} onClick={handlePayCash}>
                Plată Cash la Casierie
              </button>
            </div>

            {/* Metode acceptate */}
            <div className="payment-methods-row">
              <span className="pm-label">{t('accepted_methods', lang) || 'Metode acceptate'}:</span>
              <div className="pm-badges">
                <span className="pm-badge"><svg viewBox="0 0 50 20" width="46" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="20" rx="3" fill="#000"/><path d="M7 5.5 C7 3.8 8.2 3 9 3 C9.7 2.5 10.3 2 11 2 C11.7 2 12.2 2.5 12.7 2.5 C13.2 2.5 13.7 2 14.4 2 C15.4 2 16.5 3 16.5 4.5 C16.5 6.5 14.8 8.5 13.5 9 C13 9.5 12.3 9 11.8 9 C11.2 9 10.8 9.5 10.2 9.5 C9.6 9.5 9 9 8.3 8.3 C7.4 7.5 7 6.2 7 5.5Z" fill="white"/><text x="18" y="13" fontFamily="Arial" fontSize="8" fontWeight="600" fill="white">Pay</text></svg></span>
                <span className="pm-badge"><svg viewBox="0 0 60 20" width="56" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="20" rx="3" fill="#fff" stroke="#d1d5db" strokeWidth="1"/><text x="6" y="14" fontFamily="Arial" fontSize="9" fontWeight="900" fill="#4285F4">G</text><text x="15" y="14" fontFamily="Arial" fontSize="9" fontWeight="400" fill="#5f6368">Pay</text></svg></span>
                <span className="pm-badge"><svg viewBox="0 0 62 20" width="58" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="62" height="20" rx="3" fill="#0666EB"/><text x="7" y="14" fontFamily="Arial" fontSize="8" fontWeight="700" fill="white">Revolut</text></svg></span>
                <span className="pm-badge"><svg viewBox="0 0 50 20" width="46" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="20" rx="3" fill="#1A1F71"/><text x="6" y="15" fontFamily="Arial" fontSize="13" fontWeight="800" fontStyle="italic" fill="#F7B600">VISA</text></svg></span>
                <span className="pm-badge"><svg viewBox="0 0 50 20" width="46" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="20" rx="3" fill="#fff" stroke="#d1d5db" strokeWidth="1"/><circle cx="19" cy="10" r="7.5" fill="#EB001B"/><circle cx="31" cy="10" r="7.5" fill="#F79E1B"/><path d="M25 4.3A7.5 7.5 0 0 1 25 15.7 7.5 7.5 0 0 1 25 4.3Z" fill="#FF5F00"/></svg></span>
              </div>
            </div>

            <button className="btn btn-danger btn-lg pay-cancel-btn" onClick={handleCancelOrder}>{t('cancel_order', lang)}</button>
          </>
        )}

        {payState === STATE.INITIATING && (
          <div className="payment-processing">
            <div className="processing-spinner"/>
            <p className="processing-step">Se pregateste plata...</p>
          </div>
        )}



        {payState === STATE.WAITING_CARD && (
          <div className="payment-processing">
            {!showPosInstructions ? (
              <>
                <div className="pos-nfc-anim">
                  <span className="pos-emoji" style={{fontSize:'4rem'}}>📱</span>
                  <div className="nfc-ring nfc-ring-1"/><div className="nfc-ring nfc-ring-2"/><div className="nfc-ring nfc-ring-3"/>
                </div>
                <h2 className="processing-title">{t('payment_card_subtitle', lang) || 'Apropiați sau introduceți cardul'}</h2>
                <p className="processing-step">{t('payment_card_methods', lang) || 'Card fizic • Contactless • Apple Pay • Google Pay'}</p>
              </>
            ) : (
              <div className="pos-instructions-alert fade-in" style={{ backgroundColor: 'var(--brand-surface)', padding: '24px', borderRadius: '16px', border: '2px solid var(--brand-primary)', marginBottom: '24px' }}>
                <div style={{fontSize:'3rem', marginBottom: '8px'}}>⚠️</div>
                <h2 className="processing-title" style={{color: 'var(--brand-primary)'}}>{t('pos_instructions_title', lang) || 'Verificați ecranul POS-ului'}</h2>
                <p className="processing-step" style={{fontSize: '1.2rem'}}>{t('pos_instructions_desc', lang) || 'Dacă tranzacția durează, vă rugăm urmați instrucțiunile de pe ecranul aparatului de plată (ex: Introduceți PIN sau apăsați butonul Verde pentru confirmare)'}</p>
                <div style={{fontSize: '2.5rem', fontWeight: 'bold', marginTop: '16px', color: posTimer < 10 ? 'red' : 'inherit'}}>
                  {posTimer > 0 ? `${posTimer}s` : (t('timeout', lang) || 'Timp expirat')}
                </div>
              </div>
            )}
            <div className="payment-cancel-actions">
              <button className="btn btn-outline btn-lg" onClick={handleCancel}>{t('back_to_cart', lang)}</button>
              <button className="btn btn-danger btn-lg" onClick={handleCancelOrder}>{t('cancel_order', lang)}</button>
            </div>
          </div>
        )}

        {payState === STATE.PIN_ENTRY && (
          <div className="payment-processing">
            <div style={{fontSize:'4rem', marginBottom:16}}>🔒</div>
            <h2 className="processing-title">Introduceți PIN-ul</h2>
            <p className="processing-step">Urmați instrucțiunile de pe terminal</p>
            <div className="pin-dots">
              <span className="pin-dot active"/><span className="pin-dot active"/>
              <span className="pin-dot"/><span className="pin-dot"/>
            </div>
            <div className="payment-cancel-actions">
              <button className="btn btn-outline btn-lg" onClick={handleCancel}>{t('back_to_cart', lang)}</button>
              <button className="btn btn-danger btn-lg" onClick={handleCancelOrder}>{t('cancel_order', lang)}</button>
            </div>
          </div>
        )}

        {payState === STATE.AUTHORIZING && (
          <div className="payment-processing">
            <div className="processing-spinner"/>
            <h2 className="processing-title">Comunicare cu banca...</h2>
            <p className="processing-step">Vă rugăm așteptați</p>
          </div>
        )}

        {payState === STATE.APPROVED && (
          <div className="payment-result success fade-in">
            <div className="result-icon-wrapper"><span className="result-icon success-icon">✅</span></div>
            <h2 className="approved-title">Plata aprobata</h2>
            {txInfo?.authCode && <p className="auth-code">Auth: {txInfo.authCode}</p>}
            <p className="success-msg">Comanda a fost trimisa spre preparare!</p>
          </div>
        )}

        {payState === STATE.CASH_SUCCESS && (
          <div className="payment-result success fade-in">
            <div className="result-icon-wrapper" style={{background: '#f59e0b'}}><span className="result-icon success-icon" style={{color: 'white'}}>💵</span></div>
            <h2 className="approved-title" style={{color: '#d97706'}}>NEACHITAT</h2>
            <h1 style={{fontSize: '4rem', fontWeight: 900, margin: '16px 0', color: '#1e293b'}}>#{txInfo?.orderNumber}</h1>
            <p className="success-msg" style={{fontSize: '1.5rem', fontWeight: 700}}>ACHITAȚI LA CASĂ</p>
            <p style={{marginTop: '16px', color: 'var(--text-muted)'}}>Prezentați acest număr la casierie pentru a finaliza comanda.</p>
          </div>
        )}

        {(payState === STATE.DECLINED || payState === STATE.ERROR) && (
          <div className="payment-declined fade-in">
            <div className="declined-circle">{payState === STATE.ERROR ? '!' : 'x'}</div>
            <h2 className="declined-title">{payState === STATE.ERROR ? 'Eroare terminal' : 'Plata refuzata'}</h2>
            <p className="declined-msg">Va rugam incercati din nou sau contactati personalul.</p>
            <div className="payment-cancel-actions">
              <button className="btn btn-outline btn-lg" onClick={handleRetry}>Incearca din nou</button>
              <button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={handleCancel}>{t('back_to_cart', lang)}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


