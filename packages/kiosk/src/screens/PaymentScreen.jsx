import { useState, useEffect, useRef, useCallback } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import FiscalModal from '../components/FiscalModal.jsx';
import './PaymentScreen.css';

const BACKEND       = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';
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
  const fiscalData     = useKioskStore((s) => s.fiscalData);
  const setFiscalData  = useKioskStore((s) => s.setFiscalData);
  const clearFiscalData = useKioskStore((s) => s.clearFiscalData);

  const [showFiscalModal, setShowFiscalModal] = useState(false);

  const total      = getCartTotal();
  const orderIdRef = useRef(null);
  const socketRef  = useRef(null);

  const [payState, setPayState] = useState(STATE.IDLE);
  const [errorMsg, setErrorMsg] = useState('');
  const [txInfo,   setTxInfo]   = useState(null);
  const [retryNotice, setRetryNotice] = useState('');
  const autoRetryCountRef = useRef(0);
  const handlePayRef = useRef(null);

  const [posTimer, setPosTimer] = useState(60);

  useEffect(() => {
    let interval;
    if (payState === STATE.WAITING_CARD || payState === STATE.PIN_ENTRY) {
      setPosTimer(60);
      interval = setInterval(() => {
        setPosTimer(p => (p > 0 ? p - 1 : 0));
      }, 1000);
    } else {
      setPosTimer(60);
    }
    return () => clearInterval(interval);
  }, [payState]);
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
      const urlKiosk   = new URLSearchParams(window.location.search).get('kiosk') || '1';
      const effectiveBrand = activeBrandId || urlBrand || DEFAULT_BRAND;
      const locationOrgId  = locationData?.orgIds?.[effectiveBrand];
      const effectiveOrgId = locationOrgId || urlOrg || DEFAULT_ORG;
      const locationName   = locationData?.name || LOCATION_NAME;

      console.log(`[PaymentScreen] Order → brand: ${effectiveBrand}, org: ${effectiveOrgId}, loc: ${locationName}, kiosk: ${urlKiosk}, method: ${pMethod}`);

      const res = await fetch(`${BACKEND}/api/orders`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand:        effectiveBrand,
          orgId:        effectiveOrgId,
          locationId:   locationData?.id,
          locationName: locationName,
          kioskId:      urlKiosk,
          orderType, tableNumber,
          items: cartItems.map(i => ({
            productId: i.productId, name: i.name, quantity: i.quantity,
            basePrice: i.basePrice !== undefined ? i.basePrice : null,
            unitPrice: i.unitPrice, totalPrice: i.totalPrice,
            brandId: i.brandId,
            imageUrl: i.image || null,
            selectedModifiers: i.selectedModifiers || [],
            comment: i.comment || (i.selectedModifiers?.find(m => m.modId === 'custom_comment')?.optionName) || null,
          })),
          totalAmount: total, channel: 'kiosk', paymentMethod: pMethod,
          fiscal: fiscalData || null,
          paymentRef: { authCode: paymentResult?.authCode, receiptNo: paymentResult?.receiptNo,
                        cardNo: paymentResult?.cardNo, refNum: paymentResult?.refNum,
                        extraFields: paymentResult?.extraFields },
        }),
      });
      const data = await res.json();
      return data.order;
    } catch (err) { console.error('[PaymentScreen] sendOrder failed:', err); return null; }
  }, [cartItems, total, orderType, tableNumber, activeBrandId, locationData, fiscalData]);

  const handlePayCash = async () => {
    if (payState !== STATE.IDLE) return;
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
          autoRetryCountRef.current = 0;
          setRetryNotice('');
          setTxInfo(result);
          setPayState(STATE.APPROVED);
          const orderData = await sendOrder(result);
          if (orderData?.orderNumber) setLastOrderNumber(orderData.orderNumber);
          setTimeout(() => goTo('confirmation'), 2200);
        } else {
          const isRetryable = result.code === 'A0' || 
            (result.error && (result.error.includes('A0') || result.error.includes('resetat manual') || result.error.includes('Refusal')));

          if (isRetryable && autoRetryCountRef.current < 1) {
            autoRetryCountRef.current += 1;
            setRetryNotice('Se reinițializează conexiunea cu POS-ul, vă rugăm așteptați...');
            setPayState(STATE.INITIATING);
            setTimeout(() => {
              handlePayRef.current?.();
            }, 1500);
          } else {
            autoRetryCountRef.current = 0;
            setRetryNotice('');
            setPayState(STATE.DECLINED);
            setErrorMsg(result.error || 'Plată refuzată de bancă');
          }
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

  handlePayRef.current = handlePay;

  const handleCancel = () => {
    autoRetryCountRef.current = 0;
    setRetryNotice('');
    if (socketRef.current) {
      socketRef.current.emit('cancel_pos_payment', {
        locationId: locationData?.kioskUrl || locationData?.id || '',
        orderId: orderIdRef.current,
      });
      socketRef.current.disconnect();
    }
    goTo('cart');
  };

  const handleCancelOrder = () => {
    autoRetryCountRef.current = 0;
    setRetryNotice('');
    if (socketRef.current) {
      socketRef.current.emit('cancel_pos_payment', {
        locationId: locationData?.kioskUrl || locationData?.id || '',
        orderId: orderIdRef.current,
      });
      socketRef.current.disconnect();
    }
    resetOrder();
  };

  const handleRetry = () => {
    autoRetryCountRef.current = 0;
    setRetryNotice('');
    setPayState(STATE.IDLE);
    setErrorMsg('');
    setTxInfo(null);
  };

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
            {/* ── Solicitare CUI / Persoană Juridică (Deasupra la Card) ── */}
            <div className="payment-fiscal-container">
              {!fiscalData ? (
                <button
                  type="button"
                  className="ps-fiscal-trigger-card"
                  onClick={() => setShowFiscalModal(true)}
                >
                  <div className="ps-fiscal-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="2" width="16" height="20" rx="2" />
                      <line x1="9" y1="6" x2="15" y2="6" />
                      <line x1="9" y1="10" x2="15" y2="10" />
                      <line x1="9" y1="14" x2="15" y2="14" />
                      <line x1="9" y1="18" x2="11" y2="18" />
                    </svg>
                  </div>
                  <div className="ps-fiscal-text-group">
                    <span className="ps-fiscal-title">Doriți bon fiscal cu CUI?</span>
                    <span className="ps-fiscal-subtitle">Persoană Juridică / Factură fiscală</span>
                  </div>
                  <div className="ps-fiscal-plus-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                </button>
              ) : (
                <div className="ps-fiscal-active-card">
                  <div className="ps-fiscal-active-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="ps-fiscal-active-info">
                    <span className="ps-fiscal-active-name">{fiscalData.name}</span>
                    <span className="ps-fiscal-active-cui">
                      CUI: {fiscalData.rawCui || fiscalData.cui} {fiscalData.isVatPayer ? '• Plătitor TVA' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ps-fiscal-remove-btn"
                    onClick={() => clearFiscalData()}
                    title="Elimină CUI"
                    aria-label="Elimină date firmă"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* ── Iconul cardului ── */}
            <div className="payment-icons-row" style={{justifyContent:'center'}}>
              <div className="pir-card">
                <div className="payment-pos-icon">
                  <div className="pos-card-wrapper">
                    <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pos-card-vector">
                      <rect x="2" y="5" width="20" height="14" rx="3" />
                      <line x1="2" y1="10" x2="22" y2="10" strokeWidth="2" />
                      <line x1="6" y1="15" x2="10" y2="15" strokeWidth="2.2" />
                      <circle cx="17" cy="15" r="1.5" fill="var(--primary)" stroke="none" />
                    </svg>
                  </div>
                  <div className="pos-waves"><div className="wave"/><div className="wave"/><div className="wave"/></div>
                </div>
                <p className="pir-label">{t('payment_card_title', lang)}</p>
              </div>
            </div>


            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexDirection: 'column' }}>
              <button 
                className="btn btn-success btn-xl pay-btn" 
                onClick={handlePay}
                disabled={payState !== STATE.IDLE}
              >
                Plată Card ({total.toFixed(2)} {t('lei', lang)})
              </button>
              <button 
                className="btn btn-outline btn-xl pay-btn" 
                style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)', borderWidth: '2px' }} 
                onClick={handlePayCash}
                disabled={payState !== STATE.IDLE}
              >
                Plată Cash la Casierie
              </button>
            </div>

            {/* Metode acceptate */}
            <div className="payment-methods-row">
              <span className="pm-label">{t('accepted_methods', lang) || 'Metode acceptate'}:</span>
              <div className="trust-pay-cards">
                <div className="trust-pay-card" title="Visa">
                  <svg width="72" height="24" viewBox="0 0 36 12" fill="none">
                    <path d="M14.07 0.4L9.22 11.6H6.04L3.69 2.7C3.55 2.12 3.4 1.88 2.92 1.63C2.18 1.23 1.02 0.86 0 0.65L0.08 0.4H5.16C5.83 0.4 6.43 0.84 6.57 1.63L7.79 8.16L10.95 0.4H14.07ZM26.44 7.87C26.46 4.96 22.38 4.8 22.42 3.45C22.43 3.03 22.83 2.59 23.73 2.47C24.18 2.41 25.43 2.36 26.83 3.01L27.42 0.94C26.62 0.65 25.59 0.38 24.28 0.38C21.36 0.38 19.33 1.93 19.31 4.13C19.29 5.76 20.76 6.67 21.87 7.21C23.01 7.76 23.4 8.12 23.39 8.62C23.37 9.38 22.46 9.72 21.62 9.73C20.12 9.75 19.25 9.32 18.57 9.01L17.96 11.17C18.66 11.49 19.96 11.77 21.3 11.78C24.38 11.78 26.42 10.26 26.44 7.87ZM34.25 11.6H37L34.61 0.4H32.22C31.69 0.4 31.24 0.71 31.05 1.18L26.54 11.6H29.68L30.31 9.87H34.14L34.25 11.6ZM31.17 7.55L32.74 3.23L33.64 7.55H31.17ZM18.72 0.4L16.27 11.6H13.27L15.72 0.4H18.72Z" fill="#1434CB"/>
                  </svg>
                </div>

                <div className="trust-pay-card" title="Mastercard">
                  <svg width="50" height="32" viewBox="0 0 28 18" fill="none">
                    <circle cx="9" cy="9" r="8" fill="#EB001B"/>
                    <circle cx="19" cy="9" r="8" fill="#F79E1B"/>
                    <path d="M14 3.73a7.97 7.97 0 0 0-3 5.27 7.97 7.97 0 0 0 3 5.27 7.97 7.97 0 0 0 3-5.27 7.97 7.97 0 0 0-3-5.27z" fill="#FF5F00"/>
                  </svg>
                </div>

                <div className="trust-pay-card" title="Apple Pay">
                  <svg width="75" height="30" viewBox="0 0 50 20" fill="none">
                    <path d="M9.13 6.9c-.48.58-1.26 1.02-2.03.96-.1-.8.25-1.63.7-2.16.48-.58 1.34-1 2.05-.98.08.82-.24 1.6-.72 2.18m.7 1.12c-1.12-.07-2.08.64-2.61.64-.54 0-1.35-.6-2.23-.58-1.15.02-2.21.67-2.8 1.7-1.2 2.08-.31 5.17.85 6.85.57.82 1.25 1.74 2.14 1.71.85-.04 1.18-.55 2.21-.55 1.03 0 1.33.55 2.22.53.92-.02 1.51-.83 2.07-1.66.66-.96.93-1.89.94-1.94-.02-.01-1.81-.7-1.83-2.76-.02-1.72 1.4-2.54 1.47-2.59-.8-.18-1.58.55-2.43.65" fill="#0f172a"/>
                    <text x="17" y="16.5" fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" fontSize="13.5" fontWeight="700" fill="#0f172a" letterSpacing="-0.3px">Pay</text>
                  </svg>
                </div>

                <div className="trust-pay-card" title="Google Pay">
                  <svg width="78" height="31" viewBox="0 0 50 20" fill="none">
                    <g transform="translate(1, 2) scale(0.66)">
                      <path d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.89z" fill="#4285F4"/>
                      <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.07.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.26v3.12A11.99 11.99 0 0 0 12 24z" fill="#34A853"/>
                      <path d="M5.28 14.29a7.18 7.18 0 0 1 0-4.58V6.59H1.26a11.99 11.99 0 0 0 0 10.82l4.02-3.12z" fill="#FBBC05"/>
                      <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.36 2.68 1.26 6.59l4.02 3.12c.95-2.84 3.6-4.96 6.72-4.96z" fill="#EA4335"/>
                    </g>
                    <text x="21" y="15" fontFamily="'Google Sans', Roboto, sans-serif" fontSize="13" fontWeight="600" fill="#5f6368" letterSpacing="-0.2px">Pay</text>
                  </svg>
                </div>
              </div>
            </div>

            <button className="btn btn-danger btn-lg pay-cancel-btn" onClick={handleCancelOrder}>{t('cancel_order', lang)}</button>
          </>
        )}

        {payState === STATE.INITIATING && (
          <div className="payment-processing">
            <div className="processing-spinner"/>
            <p className="processing-step">{retryNotice || 'Se pregateste plata...'}</p>
          </div>
        )}

        {payState === STATE.WAITING_CARD && (
          <div className="payment-processing fade-in">
            {/* 1. Header Prominent Alert pentru POS fizic */}
            <div className="pos-terminal-focus-card">
              <div className="ptfc-top-bar">
                <div className="ptfc-badge">
                  <span className="ptfc-pulse-dot" />
                  <span>Terminal POS activ</span>
                </div>
                <div className="ptfc-timer">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{posTimer > 0 ? `${posTimer}s` : (t('timeout', lang) || 'Timp expirat')}</span>
                </div>
              </div>

              <div className="ptfc-main">
                <div className="ptfc-icon-box">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="3" />
                    <rect x="7" y="5" width="10" height="6" rx="1" />
                    <circle cx="8" cy="14" r="1" fill="currentColor" />
                    <circle cx="12" cy="14" r="1" fill="currentColor" />
                    <circle cx="16" cy="14" r="1" fill="currentColor" />
                    <circle cx="8" cy="17" r="1" fill="currentColor" />
                    <circle cx="12" cy="17" r="1" fill="currentColor" />
                    <circle cx="16" cy="17" r="1" fill="#10b981" stroke="#10b981" />
                  </svg>
                </div>
                <div className="ptfc-text">
                  <h3 className="ptfc-title">URMĂRIȚI ECRANUL APARATULUI POS</h3>
                  <p className="ptfc-subtitle">
                    Aparatul de plată (situat lângă ecran) este activ. Urmați instrucțiunile afișate pe ecranul acestuia.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Ghid în 3 pași cu iconițe SVG curate (fără emoji) */}
            <div className="pos-steps-grid">
              <div className="pos-step-card">
                <div className="psc-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                    <path d="M7 15h3" />
                    <path d="M16 13a2.5 2.5 0 0 1 0 4" strokeWidth="1.6" />
                    <path d="M18.5 11.5a5 5 0 0 1 0 7" strokeWidth="1.6" />
                  </svg>
                </div>
                <div className="psc-text">
                  <span className="psc-title">1. Apropiați cardul sau telefonul</span>
                  <span className="psc-desc">Apropiați de ecranul POS-ului sau introduceți cardul cu cip în fantă</span>
                </div>
              </div>

              <div className="pos-step-card">
                <div className="psc-icon-box psc-icon-accent">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                    <circle cx="12" cy="8" r="1.2" fill="currentColor" />
                    <circle cx="16" cy="8" r="1.2" fill="currentColor" />
                    <circle cx="8" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="16" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="8" cy="16" r="1.2" fill="currentColor" />
                    <circle cx="12" cy="16" r="1.2" fill="currentColor" />
                    <rect x="15" y="15" width="2.5" height="2.5" rx="0.5" fill="#10b981" stroke="#10b981" />
                  </svg>
                </div>
                <div className="psc-text">
                  <span className="psc-title">2. Introduceți codul PIN dacă se solicită</span>
                  <span className="psc-desc">Tastați PIN-ul pe tastatura POS-ului și apăsați butonul Verde [OK]</span>
                </div>
              </div>

              <div className="pos-step-card">
                <div className="psc-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                </div>
                <div className="psc-text">
                  <span className="psc-title">3. Așteptați semnalul sonor</span>
                  <span className="psc-desc">Mențineți cardul lipit până auziți bip-ul și vedeți mesajul de aprobare</span>
                </div>
              </div>
            </div>

            <p className="processing-step" style={{ margin: '4px 0', fontSize: '0.92rem' }}>
              Card fizic • Contactless • Apple Pay • Google Pay
            </p>

            <div className="payment-cancel-actions">
              <button className="btn btn-outline btn-lg" onClick={handleCancel}>{t('back_to_cart', lang)}</button>
              <button className="btn btn-danger btn-lg" onClick={handleCancelOrder}>{t('cancel_order', lang)}</button>
            </div>
          </div>
        )}

        {payState === STATE.PIN_ENTRY && (
          <div className="payment-processing fade-in">
            <div className="pos-terminal-focus-card pos-terminal-pin-focus">
              <div className="ptfc-main">
                <div className="ptfc-icon-box ptfc-icon-pin">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                    <circle cx="12" cy="8" r="1.2" fill="currentColor" />
                    <circle cx="16" cy="8" r="1.2" fill="currentColor" />
                    <circle cx="8" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="16" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="8" cy="16" r="1.2" fill="currentColor" />
                    <circle cx="12" cy="16" r="1.2" fill="currentColor" />
                    <rect x="15" y="15" width="2.5" height="2.5" rx="0.5" fill="#10b981" stroke="#10b981" />
                  </svg>
                </div>
                <div className="ptfc-text">
                  <h3 className="ptfc-title">INTRODUCEȚI CODUL PIN PE APARATUL POS</h3>
                  <p className="ptfc-subtitle">
                    Tastați codul PIN pe tastatura fizică a aparatului POS, apoi apăsați tasta <strong>Verde [OK]</strong>.
                  </p>
                </div>
              </div>
            </div>

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
            <div className="result-icon-wrapper">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="approved-title">Plata aprobata</h2>
            {txInfo?.authCode && <p className="auth-code">Auth: {txInfo.authCode}</p>}
            <p className="success-msg">Comanda a fost trimisa spre preparare!</p>
          </div>
        )}

        {payState === STATE.CASH_SUCCESS && (
          <div className="payment-result success fade-in">
            <div className="result-icon-wrapper" style={{background: '#f59e0b'}}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="12" cy="12" r="2.5" />
                <path d="M6 12h.01M18 12h.01" strokeWidth="2.5" />
              </svg>
            </div>
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

      {/* Fiscal Modal */}
      {showFiscalModal && (
        <FiscalModal
          isOpen={showFiscalModal}
          onClose={() => setShowFiscalModal(false)}
          onConfirm={(data) => setFiscalData(data)}
          initialCui={fiscalData?.cui || ''}
          lang={lang}
        />
      )}
    </div>
  );
}


