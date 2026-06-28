import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
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
  WAITING_QR:   'waiting_qr',
  APPROVED:     'approved',
  DECLINED:     'declined',
  ERROR:        'error',
};

export default function PaymentScreen() {
  useInactivityTimeout(180);

  const goTo         = useKioskStore((s) => s.goTo);
  const getCartTotal = useKioskStore((s) => s.getCartTotal);
  const cartItems    = useKioskStore((s) => s.cartItems);
  const orderType    = useKioskStore((s) => s.orderType);
  const tableNumber  = useKioskStore((s) => s.tableNumber);
  const lang         = useKioskStore((s) => s.lang);
  const resetOrder   = useKioskStore((s) => s.resetOrder);

  const total      = getCartTotal();
  const orderIdRef = useRef(null);
  const socketRef  = useRef(null);

  const [payState, setPayState] = useState(STATE.IDLE);
  const [errorMsg, setErrorMsg] = useState('');
  const [txInfo,   setTxInfo]   = useState(null);
  const [qrUrl,    setQrUrl]    = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  const qrOrderIdRef = useRef(null);
  const qrSocketRef  = useRef(null);

  useEffect(() => {
    // cleanup card socket on unmount
    return () => {
      socketRef.current?.disconnect?.();
      qrSocketRef.current?.disconnect?.();
    };
  }, []);

  // Auto-generate QR when screen loads
  useEffect(() => {
    let cancelled = false;
    const generateQR = async () => {
      setQrLoading(true);
      try {
        const orderId = `kiosk-qr-${Date.now()}`;
        qrOrderIdRef.current = orderId;

        const { io } = await import('socket.io-client');
        const socket = io(BACKEND, { transports: ['websocket'], reconnection: false });
        qrSocketRef.current = socket;

        socket.on(`payment_confirmed_${orderId}`, async (result) => {
          socket.disconnect(); qrSocketRef.current = null;
          if (!cancelled && result.paid) {
            setTxInfo(result);
            setPayState(STATE.APPROVED);
            await sendOrder(result);
            setTimeout(() => goTo('confirmation'), 2200);
          }
        });

        const res = await fetch(`${BACKEND}/api/payment/qr-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, amount: total }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setQrUrl(data.paymentUrl);
      } catch (_) {
        // QR generation failed silently — card payment still works
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    };
    generateQR();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendOrder = useCallback(async (paymentResult) => {
    try {
      const urlBrand = new URLSearchParams(window.location.search).get('brand');
      const urlOrg   = new URLSearchParams(window.location.search).get('orgId');
      await fetch(`${BACKEND}/api/orders`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand:        urlBrand || DEFAULT_BRAND,
          orgId:        urlOrg   || DEFAULT_ORG,
          locationName: LOCATION_NAME,
          orderType, tableNumber,
          items: cartItems.map(i => ({
            productId: i.productId, name: i.name, quantity: i.quantity,
            unitPrice: i.unitPrice, totalPrice: i.totalPrice,
            selectedModifiers: i.selectedModifiers || [],
          })),
          totalAmount: total, channel: 'kiosk', paymentMethod: 'card',
          paymentRef: { authCode: paymentResult?.authCode, receiptNo: paymentResult?.receiptNo,
                        cardNo: paymentResult?.cardNo, refNum: paymentResult?.refNum },
        }),
      });
    } catch (err) { console.error('[PaymentScreen] sendOrder failed:', err); }
  }, [cartItems, total, orderType, tableNumber]);

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
          await sendOrder(result);
          setTimeout(() => goTo('confirmation'), 2200);
        } else {
          setPayState(STATE.DECLINED);
          setErrorMsg(result.error || 'Plată refuzată de bancă');
        }
      });

      const res = await fetch(`${BACKEND}/api/payment/initiate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount: total, paymentGateway: 'verifone_serial', channel: 'kiosk' }),
      });
      if (!res.ok) throw new Error(`Backend ${res.status}`);
      setPayState(STATE.WAITING_CARD);
    } catch (err) {
      setPayState(STATE.ERROR);
      setErrorMsg(err.message || 'Eroare conexiune terminal');
    }
  }, [total, sendOrder, goTo]);

  const handleCancel      = () => { socketRef.current?.disconnect(); qrSocketRef.current?.disconnect(); goTo('cart'); };
  const handleCancelOrder = () => { socketRef.current?.disconnect(); qrSocketRef.current?.disconnect(); resetOrder(); };
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
            {/* ── Randul cu iconul cardului + QR ── */}
            <div className="payment-icons-row">
              {/* Stanga: iconul card */}
              <div className="pir-card">
                <div className="payment-pos-icon">
                  <span className="pos-emoji">💳</span>
                  <div className="pos-waves"><div className="wave"/><div className="wave"/><div className="wave"/></div>
                </div>
                <p className="pir-label">{t('payment_card_title', lang)}</p>
              </div>

              {/* Separator */}
              <div className="pir-sep">
                <div className="pir-sep-line"/>
                <span>{t('or', lang).toUpperCase()}</span>
                <div className="pir-sep-line"/>
              </div>

              {/* Dreapta: QR */}
              <div className="pir-qr">
                {qrLoading && (
                  <div className="qr-loading">
                    <div className="processing-spinner" style={{width:36,height:36}}/>
                  </div>
                )}
                {!qrLoading && qrUrl && (
                  <div className="qr-code-wrapper">
                    <QRCodeCanvas value={qrUrl} size={160} level="H" includeMargin={true}/>
                  </div>
                )}
                {!qrLoading && !qrUrl && (
                  <div style={{width:160,height:160,display:'flex',alignItems:'center',justifyContent:'center',opacity:0.4}}>
                    <p style={{fontSize:'0.8rem',color:'var(--text-muted)',textAlign:'center'}}>QR indisponibil</p>
                  </div>
                )}
                <p className="pir-label">{t('scan_phone', lang)}</p>
              </div>
            </div>

            {/* ── Instructiuni + buton ── */}
            <div className="payment-instruction" style={{marginTop:12}}>
              <div className="pi-step"><span className="pi-num">1</span><span>{t('payment_step_1', lang)}</span></div>
              <div className="pi-step"><span className="pi-num">2</span><span>{t('payment_step_2', lang)}</span></div>
              <div className="pi-step"><span className="pi-num">3</span><span>{t('payment_step_3', lang)}</span></div>
            </div>

            <button className="btn btn-success btn-xl pay-btn" onClick={handlePay}>
              {t('pay', lang)} {total.toFixed(2)} {t('lei', lang)}
            </button>

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

        {payState === STATE.WAITING_QR && qrUrl && (
          <div className="payment-qr fade-in">
            <h2 className="processing-title">Scaneaza si plateste</h2>
            <p className="processing-step" style={{marginBottom:24}}>Deschide camera telefonului si scaneaza codul de mai jos</p>
            <div className="qr-code-wrapper">
              <QRCodeCanvas value={qrUrl} size={220} level="H" includeMargin={true} />
            </div>
            <p className="qr-link-text">
              Sau acceseaza link-ul: <a href={qrUrl} target="_blank" rel="noopener noreferrer" className="qr-link">{qrUrl.length > 50 ? qrUrl.slice(0,50) + '...' : qrUrl}</a>
            </p>
            <div className="payment-cancel-actions">
              <button className="btn btn-outline btn-lg" onClick={handleCancel}>{t('back_to_cart', lang)}</button>
              <button className="btn btn-danger btn-lg" onClick={handleCancelOrder}>{t('cancel_order', lang)}</button>
            </div>
          </div>
        )}

        {payState === STATE.WAITING_CARD && (
          <div className="payment-processing">
            <div className="pos-nfc-anim">
              <span className="pos-emoji" style={{fontSize:'4rem'}}>📱</span>
              <div className="nfc-ring nfc-ring-1"/><div className="nfc-ring nfc-ring-2"/><div className="nfc-ring nfc-ring-3"/>
            </div>
            <h2 className="processing-title">Apropiați sau introduceți cardul</h2>
            <p className="processing-step">Card fizic • Contactless • Apple Pay • Google Pay</p>
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
          <div className="payment-approved fade-in">
            <div className="approved-circle"><span className="approved-check">✓</span></div>
            <h2 className="approved-title">Plată aprobată!</h2>
            {txInfo?.authCode && <p className="approved-info">Cod: <strong>{txInfo.authCode}</strong></p>}
            <p className="approved-info">Se pregătește comanda...</p>
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


