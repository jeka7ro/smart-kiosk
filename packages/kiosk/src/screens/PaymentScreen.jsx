import { useState, useEffect, useRef, useCallback } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import FiscalModal from '../components/FiscalModal.jsx';
import { BRANDS } from '../config/brands.js';
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

  const urlBrand = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('brand') : null;
  const effectiveBrand = activeBrandId || urlBrand || DEFAULT_BRAND;
  const currentBrand = BRANDS[effectiveBrand] || BRANDS[DEFAULT_BRAND] || BRANDS.smashme;
  const brandName = currentBrand?.name || 'Smash Me';
  const brandLogo = currentBrand?.logoImg || `/brands/${effectiveBrand}-logo.png`;

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
    return () => {
      socketRef.current?.disconnect?.();
    };
  }, []);

  const sendOrder = useCallback(async (paymentResult, pMethod = 'card') => {
    try {
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
      setTimeout(() => goTo('confirmation'), 8000);
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
  }, [total, sendOrder, goTo, locationData]);

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
        <button className="back-btn-abs" onClick={handleCancel}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>{(t('back_to_cart', lang) || 'Înapoi la coș').replace(/^←\s*/, '')}</span>
        </button>
      )}

      <div className="payment-content fade-in">
        {/* ── Top Amount & Context Display ── */}
        <div className="kiosk-amount-header-card">
          <div className="kahc-context-row">
            <span className="kahc-badge-type">
              {orderType === 'takeaway' ? 'LA PACHET' : 'SERVIRE ÎN RESTAURANT'}
              {tableNumber ? ` • MASA ${tableNumber}` : ''}
            </span>
          </div>
          <span className="kahc-label">{t('total_to_pay', lang) || 'TOTAL DE PLATĂ'}</span>
          <div className="kahc-price-box">
            <span className="kahc-val">{total.toFixed(2)}</span>
            <span className="kahc-curr">{t('lei', lang) || 'LEI'}</span>
          </div>
        </div>

        {/* ── STATE: IDLE (Alegere metodă de plată) ── */}
        {payState === STATE.IDLE && (
          <div className="kiosk-idle-mode fade-in">
            {/* Solicitare CUI / Persoană Juridică */}
            <div className="payment-fiscal-container">
              {!fiscalData ? (
                <button
                  type="button"
                  className="ps-fiscal-trigger-card"
                  onClick={() => setShowFiscalModal(true)}
                >
                  <div className="ps-fiscal-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

            {/* Metode de Plată: Card & Cash */}
            <div className="kiosk-methods-grid">
              <button 
                className="kiosk-method-choice-card active-method" 
                onClick={handlePay}
                disabled={payState !== STATE.IDLE}
              >
                <div className="kmcc-icon kmcc-card-icon">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="3" />
                    <line x1="2" y1="10" x2="22" y2="10" strokeWidth="2" />
                    <line x1="6" y1="15" x2="10" y2="15" strokeWidth="2.2" />
                  </svg>
                </div>
                <div className="kmcc-text">
                  <span className="kmcc-title">Plată cu Cardul / Telefonul</span>
                  <span className="kmcc-sub">Contactless, Visa, Mastercard, Apple Pay, Google Pay</span>
                </div>
                <div className="kmcc-arrow">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>

              <button 
                className="kiosk-method-choice-card" 
                onClick={handlePayCash}
                disabled={payState !== STATE.IDLE}
              >
                <div className="kmcc-icon kmcc-cash-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <circle cx="12" cy="12" r="2.5" />
                    <path d="M6 12h.01M18 12h.01" strokeWidth="2" />
                  </svg>
                </div>
                <div className="kmcc-text">
                  <span className="kmcc-title">Plată Cash la Casierie</span>
                  <span className="kmcc-sub">Achitați numerar la casa de marcat</span>
                </div>
                <div className="kmcc-arrow">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            </div>

            {/* Badges logo */}
            <div className="kiosk-trust-badges-bar">
              <div className="ktb-pill" title="Contactless">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                  <path d="M12 19a8.5 8.5 0 0 1 0-14" />
                  <path d="M15.5 21.5a12 12 0 0 1 0-19" />
                </svg>
                <span>Contactless</span>
              </div>
              <div className="ktb-pill" title="Visa">
                <svg width="44" height="15" viewBox="0 0 36 12" fill="none">
                  <path d="M14.07 0.4L9.22 11.6H6.04L3.69 2.7C3.55 2.12 3.4 1.88 2.92 1.63C2.18 1.23 1.02 0.86 0 0.65L0.08 0.4H5.16C5.83 0.4 6.43 0.84 6.57 1.63L7.79 8.16L10.95 0.4H14.07ZM26.44 7.87C26.46 4.96 22.38 4.8 22.42 3.45C22.43 3.03 22.83 2.59 23.73 2.47C24.18 2.41 25.43 2.36 26.83 3.01L27.42 0.94C26.62 0.65 25.59 0.38 24.28 0.38C21.36 0.38 19.33 1.93 19.31 4.13C19.29 5.76 20.76 6.67 21.87 7.21C23.01 7.76 23.4 8.12 23.39 8.62C23.37 9.38 22.46 9.72 21.62 9.73C20.12 9.75 19.25 9.32 18.57 9.01L17.96 11.17C18.66 11.49 19.96 11.77 21.3 11.78C24.38 11.78 26.42 10.26 26.44 7.87ZM34.25 11.6H37L34.61 0.4H32.22C31.69 0.4 31.24 0.71 31.05 1.18L26.54 11.6H29.68L30.31 9.87H34.14L34.25 11.6ZM31.17 7.55L32.74 3.23L33.64 7.55H31.17ZM18.72 0.4L16.27 11.6H13.27L15.72 0.4H18.72Z" fill="#1434CB"/>
                </svg>
              </div>
              <div className="ktb-pill" title="Mastercard">
                <svg width="34" height="21" viewBox="0 0 28 18" fill="none">
                  <circle cx="9" cy="9" r="8" fill="#EB001B"/>
                  <circle cx="19" cy="9" r="8" fill="#F79E1B"/>
                  <path d="M14 3.73a7.97 7.97 0 0 0-3 5.27 7.97 7.97 0 0 0 3 5.27 7.97 7.97 0 0 0 3-5.27 7.97 7.97 0 0 0-3-5.27z" fill="#FF5F00"/>
                </svg>
              </div>
              <div className="ktb-pill" title="Apple Pay">
                <svg width="48" height="20" viewBox="0 0 50 20" fill="none">
                  <path d="M9.13 6.9c-.48.58-1.26 1.02-2.03.96-.1-.8.25-1.63.7-2.16.48-.58 1.34-1 2.05-.98.08.82-.24 1.6-.72 2.18m.7 1.12c-1.12-.07-2.08.64-2.61.64-.54 0-1.35-.6-2.23-.58-1.15.02-2.21.67-2.8 1.7-1.2 2.08-.31 5.17.85 6.85.57.82 1.25 1.74 2.14 1.71.85-.04 1.18-.55 2.21-.55 1.03 0 1.33.55 2.22.53.92-.02 1.51-.83 2.07-1.66.66-.96.93-1.89.94-1.94-.02-.01-1.81-.7-1.83-2.76-.02-1.72 1.4-2.54 1.47-2.59-.8-.18-1.58.55-2.43.65" fill="#0f172a"/>
                  <text x="17" y="16.5" fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" fontSize="13.5" fontWeight="700" fill="#0f172a">Pay</text>
                </svg>
              </div>
              <div className="ktb-pill" title="Google Pay">
                <svg width="52" height="21" viewBox="0 0 50 20" fill="none">
                  <g transform="translate(1, 2) scale(0.66)">
                    <path d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.89z" fill="#4285F4"/>
                    <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.07.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.26v3.12A11.99 11.99 0 0 0 12 24z" fill="#34A853"/>
                    <path d="M5.28 14.29a7.18 7.18 0 0 1 0-4.58V6.59H1.26a11.99 11.99 0 0 0 0 10.82l4.02-3.12z" fill="#FBBC05"/>
                    <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.36 2.68 1.26 6.59l4.02 3.12c.95-2.84 3.6-4.96 6.72-4.96z" fill="#EA4335"/>
                  </g>
                  <text x="21" y="15" fontFamily="'Google Sans', Roboto, sans-serif" fontSize="13" fontWeight="600" fill="#5f6368">Pay</text>
                </svg>
              </div>
            </div>

            <button className="kiosk-touch-btn kiosk-btn-danger" style={{ maxWidth: '400px', margin: '8px auto 0' }} onClick={handleCancelOrder}>
              <span>{t('cancel_order', lang) || 'Anulează comanda'}</span>
            </button>
          </div>
        )}

        {/* ── STATE: INITIATING ── */}
        {payState === STATE.INITIATING && (
          <div className="kiosk-payment-card-mode fade-in">
            <div className="kiosk-pos-live-pill">
              <span className="kiosk-live-dot" />
              <span className="kiosk-live-title">Se activează POS-ul...</span>
            </div>
            <div className="kiosk-hero-spinner-wrapper">
              <div className="kiosk-dual-ring-spinner" />
            </div>
            <div className="kiosk-action-header">
              <h2 className="kiosk-action-title">Pornire aparat POS</h2>
              <p className="kiosk-action-subtitle">{retryNotice || 'Vă rugăm așteptați activarea terminalului de plată...'}</p>
            </div>
          </div>
        )}

        {/* ── STATE: WAITING_CARD (Hero NFC Contactless) ── */}
        {payState === STATE.WAITING_CARD && (
          <div className="kiosk-payment-card-mode fade-in">
            {/* Live Terminal Status Pill */}
            <div className="kiosk-pos-live-pill">
              <span className="kiosk-live-dot" />
              <span className="kiosk-live-title">Terminal POS pregătit</span>
              <span className="kiosk-live-divider">•</span>
              <span className="kiosk-live-timer">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {posTimer > 0 ? `${posTimer}s` : (t('timeout', lang) || 'Timp expirat')}
              </span>
            </div>

            {/* Hero NFC & Contactless Visual Animation */}
            <div className="kiosk-hero-nfc-wrapper">
              <div className="kiosk-nfc-radar">
                <div className="radar-circle radar-c1" />
                <div className="radar-circle radar-c2" />
                <div className="radar-circle radar-c3" />
              </div>

              {/* Floating 3D-styled Card & Phone */}
              <div className="kiosk-devices-stage">
                {/* Credit Card Graphic with Brand name as cardholder & Brand logo beside Mastercard */}
                <div className="kiosk-mockup-card">
                  <div className="kmc-header-row">
                    <div className="kmc-chip">
                      <div className="kmc-chip-line" />
                      <div className="kmc-chip-line" />
                    </div>
                    <div className="kmc-nfc-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M8.5 7.5a5 5 0 0 1 0 9" />
                        <path d="M12 5a8.5 8.5 0 0 1 0 14" />
                        <path d="M15.5 2.5a12 12 0 0 1 0 19" />
                      </svg>
                    </div>
                  </div>

                  <div className="kmc-number">•••• •••• •••• 8842</div>

                  <div className="kmc-footer">
                    <span className="kmc-cardholder">{brandName}</span>
                    <div className="kmc-footer-logos">
                      {brandLogo && (
                        <img 
                          src={brandLogo} 
                          alt={brandName} 
                          className="kmc-brand-logo-img" 
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div className="kmc-master-circles">
                        <span className="kmc-mc-1" />
                        <span className="kmc-mc-2" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sleek Apple iPhone Mockup */}
                <div className="kiosk-iphone">
                  <div className="iphone-btn-volume-up" />
                  <div className="iphone-btn-volume-down" />
                  <div className="iphone-btn-power" />

                  <div className="iphone-screen">
                    <div className="iphone-dynamic-island" />

                    <div className="iphone-apple-pay-content">
                      <div className="iphone-apple-logo-row">
                        <svg width="18" height="22" viewBox="0 0 170 170" fill="#ffffff">
                          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.71-11.65-14-6.42-9.97-11.27-21.75-14.56-35.34-3.29-13.6-4.94-26.65-4.94-39.15 0-14.97 3.65-27.42 10.96-37.37 7.31-9.95 16.5-15.06 27.57-15.34 4.35 0 9.29 1.18 14.83 3.53 5.54 2.35 9.4 3.59 11.58 3.71 1.96-.12 6.04-1.44 12.24-3.95 6.2-2.52 11.28-3.65 15.24-3.41 11.58.55 20.89 4.8 27.91 12.75-10.27 6.2-15.31 14.85-15.11 25.96.2 8.65 3.44 15.91 9.72 21.78 6.28 5.87 13.91 9.26 22.88 10.17-2.35 7.18-5.24 14.3-8.67 21.36zM119.22 33.64c0-7.39 2.66-14.4 7.98-21.03 5.32-6.63 11.94-11.17 19.86-13.61.2 1.4.3 2.69.3 3.87 0 7.39-2.73 14.34-8.19 20.84-5.46 6.5-12.24 10.96-20.35 13.38-.4-1.12-.6-2.27-.6-3.45z" />
                        </svg>
                        <span className="iphone-apple-pay-text">Pay</span>
                      </div>

                      <div className="iphone-nfc-wave">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M8.5 7.5a5 5 0 0 1 0 9" />
                          <path d="M12 5a8.5 8.5 0 0 1 0 14" />
                          <path d="M15.5 2.5a12 12 0 0 1 0 19" />
                        </svg>
                      </div>

                      <span className="iphone-hold-near">Apple Pay</span>
                    </div>

                    <div className="iphone-home-bar" />
                  </div>
                </div>
              </div>
            </div>

            {/* Clear Primary Instruction */}
            <div className="kiosk-action-header">
              <h2 className="kiosk-action-title">Apropiați cardul sau telefonul</h2>
              <p className="kiosk-action-subtitle">
                Urmăriți instrucțiunile afișate pe ecranul aparatului POS (situat în dreapta)
              </p>
            </div>

            {/* Official Payment Badges */}
            <div className="kiosk-trust-badges-bar">
              <div className="ktb-pill" title="Contactless">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M8.5 7.5a5 5 0 0 1 0 9" />
                  <path d="M12 5a8.5 8.5 0 0 1 0 14" />
                  <path d="M15.5 2.5a12 12 0 0 1 0 19" />
                </svg>
                <span>Contactless</span>
              </div>
              <div className="ktb-pill" title="Visa">
                <svg width="44" height="15" viewBox="0 0 36 12" fill="none">
                  <path d="M14.07 0.4L9.22 11.6H6.04L3.69 2.7C3.55 2.12 3.4 1.88 2.92 1.63C2.18 1.23 1.02 0.86 0 0.65L0.08 0.4H5.16C5.83 0.4 6.43 0.84 6.57 1.63L7.79 8.16L10.95 0.4H14.07ZM26.44 7.87C26.46 4.96 22.38 4.8 22.42 3.45C22.43 3.03 22.83 2.59 23.73 2.47C24.18 2.41 25.43 2.36 26.83 3.01L27.42 0.94C26.62 0.65 25.59 0.38 24.28 0.38C21.36 0.38 19.33 1.93 19.31 4.13C19.29 5.76 20.76 6.67 21.87 7.21C23.01 7.76 23.4 8.12 23.39 8.62C23.37 9.38 22.46 9.72 21.62 9.73C20.12 9.75 19.25 9.32 18.57 9.01L17.96 11.17C18.66 11.49 19.96 11.77 21.3 11.78C24.38 11.78 26.42 10.26 26.44 7.87ZM34.25 11.6H37L34.61 0.4H32.22C31.69 0.4 31.24 0.71 31.05 1.18L26.54 11.6H29.68L30.31 9.87H34.14L34.25 11.6ZM31.17 7.55L32.74 3.23L33.64 7.55H31.17ZM18.72 0.4L16.27 11.6H13.27L15.72 0.4H18.72Z" fill="#1434CB"/>
                </svg>
              </div>
              <div className="ktb-pill" title="Mastercard">
                <svg width="34" height="21" viewBox="0 0 28 18" fill="none">
                  <circle cx="9" cy="9" r="8" fill="#EB001B"/>
                  <circle cx="19" cy="9" r="8" fill="#F79E1B"/>
                  <path d="M14 3.73a7.97 7.97 0 0 0-3 5.27 7.97 7.97 0 0 0 3 5.27 7.97 7.97 0 0 0 3-5.27 7.97 7.97 0 0 0-3-5.27z" fill="#FF5F00"/>
                </svg>
              </div>
              <div className="ktb-pill" title="Apple Pay">
                <svg width="48" height="20" viewBox="0 0 50 20" fill="none">
                  <path d="M9.13 6.9c-.48.58-1.26 1.02-2.03.96-.1-.8.25-1.63.7-2.16.48-.58 1.34-1 2.05-.98.08.82-.24 1.6-.72 2.18m.7 1.12c-1.12-.07-2.08.64-2.61.64-.54 0-1.35-.6-2.23-.58-1.15.02-2.21.67-2.8 1.7-1.2 2.08-.31 5.17.85 6.85.57.82 1.25 1.74 2.14 1.71.85-.04 1.18-.55 2.21-.55 1.03 0 1.33.55 2.22.53.92-.02 1.51-.83 2.07-1.66.66-.96.93-1.89.94-1.94-.02-.01-1.81-.7-1.83-2.76-.02-1.72 1.4-2.54 1.47-2.59-.8-.18-1.58.55-2.43.65" fill="#0f172a"/>
                  <text x="17" y="16.5" fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" fontSize="13.5" fontWeight="700" fill="#0f172a">Pay</text>
                </svg>
              </div>
              <div className="ktb-pill" title="Google Pay">
                <svg width="52" height="21" viewBox="0 0 50 20" fill="none">
                  <g transform="translate(1, 2) scale(0.66)">
                    <path d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.89z" fill="#4285F4"/>
                    <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.07.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.26v3.12A11.99 11.99 0 0 0 12 24z" fill="#34A853"/>
                    <path d="M5.28 14.29a7.18 7.18 0 0 1 0-4.58V6.59H1.26a11.99 11.99 0 0 0 0 10.82l4.02-3.12z" fill="#FBBC05"/>
                    <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.36 2.68 1.26 6.59l4.02 3.12c.95-2.84 3.6-4.96 6.72-4.96z" fill="#EA4335"/>
                  </g>
                  <text x="21" y="15" fontFamily="'Google Sans', Roboto, sans-serif" fontSize="13" fontWeight="600" fill="#5f6368">Pay</text>
                </svg>
              </div>
            </div>

            {/* Bottom Kiosk Buttons */}
            <div className="kiosk-pay-actions-row">
              <button className="kiosk-touch-btn kiosk-btn-secondary" onClick={handleCancel}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>{(t('back_to_cart', lang) || 'Înapoi la coș').replace(/^←\s*/, '')}</span>
              </button>
              <button className="kiosk-touch-btn kiosk-btn-danger" onClick={handleCancelOrder}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>{t('cancel_order', lang) || 'Anulează comanda'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STATE: PIN_ENTRY ── */}
        {payState === STATE.PIN_ENTRY && (
          <div className="kiosk-payment-card-mode fade-in">
            <div className="kiosk-pos-live-pill kiosk-pill-pin">
              <span className="kiosk-live-dot pin-dot-pulse" />
              <span className="kiosk-live-title">Introduceți PIN pe terminal</span>
              <span className="kiosk-live-divider">•</span>
              <span className="kiosk-live-timer">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {posTimer > 0 ? `${posTimer}s` : (t('timeout', lang) || 'Timp expirat')}
              </span>
            </div>

            <div className="kiosk-hero-pin-wrapper">
              <div className="kiosk-pin-terminal-illu">
                <div className="kpt-screen">
                  <span className="kpt-star">●</span>
                  <span className="kpt-star">●</span>
                  <span className="kpt-star">●</span>
                  <span className="kpt-star active-blink">_</span>
                </div>
                <div className="kpt-keys">
                  <span className="kpt-key" /><span className="kpt-key" /><span className="kpt-key" />
                  <span className="kpt-key" /><span className="kpt-key" /><span className="kpt-key" />
                  <span className="kpt-key" /><span className="kpt-key" /><span className="kpt-key" />
                  <span className="kpt-key red-key" /><span className="kpt-key" /><span className="kpt-key green-key" />
                </div>
              </div>
            </div>

            <div className="kiosk-action-header">
              <h2 className="kiosk-action-title">Introduceți codul PIN pe POS</h2>
              <p className="kiosk-action-subtitle">
                Tastați codul PIN pe tastatura fizică a aparatului POS, apoi apăsați butonul <strong>Verde [OK]</strong>
              </p>
            </div>

            <div className="kiosk-pin-dots-display">
              <span className="kpd-pin-dot active" />
              <span className="kpd-pin-dot active" />
              <span className="kpd-pin-dot blinking" />
              <span className="kpd-pin-dot" />
            </div>

            <div className="kiosk-pay-actions-row">
              <button className="kiosk-touch-btn kiosk-btn-secondary" onClick={handleCancel}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>{(t('back_to_cart', lang) || 'Înapoi la coș').replace(/^←\s*/, '')}</span>
              </button>
              <button className="kiosk-touch-btn kiosk-btn-danger" onClick={handleCancelOrder}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>{t('cancel_order', lang) || 'Anulează comanda'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STATE: AUTHORIZING ── */}
        {payState === STATE.AUTHORIZING && (
          <div className="kiosk-payment-card-mode fade-in">
            <div className="kiosk-pos-live-pill">
              <span className="kiosk-live-dot" />
              <span className="kiosk-live-title">Tranzacție în curs</span>
            </div>
            <div className="kiosk-hero-spinner-wrapper">
              <div className="kiosk-dual-ring-spinner" />
            </div>
            <div className="kiosk-action-header">
              <h2 className="kiosk-action-title">Comunicare securizată cu banca...</h2>
              <p className="kiosk-action-subtitle">Vă rugăm mențineți cardul pe aparat și așteptați confirmarea.</p>
            </div>
          </div>
        )}

        {/* ── STATE: APPROVED ── */}
        {payState === STATE.APPROVED && (
          <div className="kiosk-payment-card-mode fade-in">
            <div className="kiosk-result-icon success-pop">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="kiosk-action-header">
              <h2 className="kiosk-action-title text-success">Plată Aprobată!</h2>
              {txInfo?.authCode && <p className="kiosk-auth-code">Cod autorizare: {txInfo.authCode}</p>}
              <p className="kiosk-action-subtitle">Comanda dvs. a fost trimisă la bucătărie.</p>
            </div>
          </div>
        )}

        {/* ── STATE: CASH_SUCCESS ── */}
        {payState === STATE.CASH_SUCCESS && (
          <div className="kiosk-payment-card-mode fade-in">
            <div className="kiosk-result-icon cash-pop">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="12" cy="12" r="2.5" />
                <path d="M6 12h.01M18 12h.01" strokeWidth="2.5" />
              </svg>
            </div>
            <div className="kiosk-cash-box">
              <span className="kcb-badge">COMANDĂ ÎNREGISTRATĂ</span>
              <h1 className="kcb-order-num">#{txInfo?.orderNumber}</h1>
              <span className="kcb-instruction">ACHITAȚI LA CASIERIE</span>
              <p className="kcb-sub">Prezentați acest număr casierului pentru a achita comanda.</p>
            </div>
          </div>
        )}

        {/* ── STATE: DECLINED / ERROR ── */}
        {(payState === STATE.DECLINED || payState === STATE.ERROR) && (
          <div className="kiosk-payment-card-mode fade-in">
            <div className="kiosk-result-icon decline-pop">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="kiosk-action-header">
              <h2 className="kiosk-action-title text-danger">
                {payState === STATE.ERROR ? 'Eroare conexiune terminal' : 'Plată refuzată'}
              </h2>
              <p className="kiosk-action-subtitle">
                {errorMsg || 'Tranzacția nu a putut fi finalizată. Vă rugăm încercați din nou sau adresați-vă casieriei.'}
              </p>
            </div>
            <div className="kiosk-pay-actions-row">
              <button className="kiosk-touch-btn kiosk-btn-primary" onClick={handleRetry}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                <span>Încearcă din nou</span>
              </button>
              <button className="kiosk-touch-btn kiosk-btn-secondary" onClick={handleCancel}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>{(t('back_to_cart', lang) || 'Înapoi la coș').replace(/^←\s*/, '')}</span>
              </button>
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
