import { useState, useEffect, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import './PaymentScreen.css';

const BACKEND       = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const DEFAULT_BRAND = import.meta.env.VITE_BRAND       || 'smashme';
const DEFAULT_ORG   = import.meta.env.VITE_ORG_ID      || '';
const LOCATION_NAME = import.meta.env.VITE_LOCATION_NAME || '';

export default function PaymentScreen() {
  useInactivityTimeout(120);
  const goTo        = useKioskStore((s) => s.goTo);
  const getCartTotal= useKioskStore((s) => s.getCartTotal);
  const cartItems   = useKioskStore((s) => s.cartItems);
  const orderType   = useKioskStore((s) => s.orderType);
  const tableNumber = useKioskStore((s) => s.tableNumber);
  const lang        = useKioskStore((s) => s.lang);

  const [step, setStep]           = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [orderSent, setOrderSent]   = useState(false);
  const total = getCartTotal();

  const timersRef = useRef([]);

  const STEPS = [t('pos_init', lang), t('waiting_payment', lang), t('processing_payment', lang)];

  const sendOrderToBackend = async () => {
    try {
      const urlBrand = new URLSearchParams(window.location.search).get('brand');
      const urlOrg   = new URLSearchParams(window.location.search).get('orgId');

      const payload = {
        brand:        urlBrand || DEFAULT_BRAND,
        orgId:        urlOrg   || DEFAULT_ORG,
        locationName: LOCATION_NAME,
        orderType,
        tableNumber,
        items: cartItems.map(i => ({
          productId:   i.productId,
          name:        i.name,
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
          totalPrice:  i.totalPrice,
          selectedModifiers: i.selectedModifiers || [],
        })),
        totalAmount: total,
        channel:     'kiosk',
        paymentMethod: 'card',
      };
      const res = await fetch(`${BACKEND}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log('[PaymentScreen] Order sent to backend:', data);
      setOrderSent(true);
    } catch (err) {
      console.error('[PaymentScreen] Failed to send order:', err);
    }
  };

  const handleSimulatePayment = () => {
    setSimulating(true);
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 1200);
    const t2 = setTimeout(() => setStep(2), 3000);
    const t3 = setTimeout(() => {
      sendOrderToBackend();
      goTo('confirmation');
    }, 5000);
    timersRef.current = [t1, t2, t3];
  };

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  return (
    <div className="payment-screen screen">
      <button className="back-btn-abs" onClick={() => goTo('cart')}>{t('back_to_cart', lang)}</button>

      <div className="payment-content fade-in">
        <div className="payment-pos-icon">
          <span className="pos-emoji">💳</span>
          <div className="pos-waves">
            <div className="wave" /><div className="wave" /><div className="wave" />
          </div>
        </div>

        <h1 className="payment-title">{t('payment_card_title', lang)}</h1>
        <p className="payment-subtitle">{t('payment_card_subtitle', lang)}</p>

        <div className="payment-amount">
          <span className="pa-label">{t('total_to_pay', lang)}</span>
          <span className="pa-amount">{total.toFixed(2)} {t('lei', lang)}</span>
        </div>

        {!simulating ? (
          <div className="payment-actions">
            <div className="payment-instruction">
              <div className="pi-step">
                <span className="pi-num">1</span>
                <span>{t('payment_step_1', lang)}</span>
              </div>
              <div className="pi-step">
                <span className="pi-num">2</span>
                <span>{t('payment_step_2', lang)}</span>
              </div>
              <div className="pi-step">
                <span className="pi-num">3</span>
                <span>{t('payment_step_3', lang)}</span>
              </div>
            </div>
            <button className="btn btn-success btn-xl" style={{ width: '100%' }} onClick={handleSimulatePayment}>
              {t('simulate_payment', lang)}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => goTo('cart')}>
              {t('cancel', lang)}
            </button>
          </div>
        ) : (
          <div className="payment-processing">
            <div className="processing-spinner" />
            <p className="processing-step">{STEPS[step]}</p>
          </div>
        )}
      </div>
    </div>
  );
}
