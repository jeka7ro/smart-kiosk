import { useEffect, useState } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import './ConfirmationScreen.css';

export default function ConfirmationScreen() {
  const cartItems = useKioskStore((s) => s.cartItems);
  const getCartTotal = useKioskStore((s) => s.getCartTotal);
  const orderType = useKioskStore((s) => s.orderType);
  const tableNumber = useKioskStore((s) => s.tableNumber);
  const resetOrder = useKioskStore((s) => s.resetOrder);
  const lang = useKioskStore((s) => s.lang);
  const setShowWheel = useKioskStore((s) => s.setShowWheel);
  const wonPrize = useKioskStore((s) => s.wonPrize);
  const [countdown, setCountdown] = useState(15);
  const [orderNum] = useState(() => Math.floor(1000 + Math.random() * 9000));
  const total = getCartTotal();

  useEffect(() => {
    // Dacă am câștigat ceva, oferim mult mai mult timp (ex 60s) ca să apuce să arate casierului.
    if (wonPrize && countdown < 45) {
      setCountdown(45);
    }
  }, [wonPrize]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown((c) => {
      if (c <= 1) { clearInterval(timer); resetOrder(); }
      return c - 1;
    }), 1000);

    // Evaluare Afișare Roată Noroc după succes comandă
    (async () => {
      try {
        const locId = new URLSearchParams(window.location.search).get('loc') || localStorage.getItem('kiosk_loc_id');
        if (!locId) return;
        
        const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
        const res = await fetch(`${BACKEND}/api/promotions/kiosk/${locId}`);
        const pData = await res.json();
        
        if (pData && pData.available && pData.rules) {
          const trigger = pData.rules.triggerMoment || 'after_payment';
          if (trigger === 'after_payment') {
            const minVal = pData.rules.minOrderValue || 0;
            const freqEnabled = pData.rules.freqEnabled === undefined ? true : pData.rules.freqEnabled;
            const ordersToAppear = pData.rules.ordersToAppear || 1;
            const ordersFinished = parseInt(localStorage.getItem('kiosk_orders_count') || '0', 10);
            
            // isRightFreq trebuie să evalueze momentul terminării actualei comenzi
            const isRightFreq = freqEnabled ? ((ordersFinished % ordersToAppear) === 0) : true;

            if (total >= minVal && isRightFreq) {
               setShowWheel(true);
            }
          }
        }
      } catch (e) {
        console.error("Promo eval failed on Confirmation:", e);
      }
    })();

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="confirm-screen screen">
      <div className="confirm-content">
        {/* Success icon */}
        <div className="confirm-icon">
          <div className="confirm-circle">
            <span className="confirm-check">✓</span>
          </div>
        </div>

        <h1 className="confirm-title">{t('order_placed', lang)}</h1>
        <p className="confirm-sub">{t('payment_success', lang)}</p>

        {/* Order number BIG */}
        <div className="confirm-order-num">
          <span className="on-label">{t('your_order_number', lang)}</span>
          <span className="on-number">#{orderNum}</span>
          <span className="on-info">{t('pickup_at_counter', lang)}</span>
        </div>

        {/* Won Prize Section */}
        {wonPrize && (
          <div style={{ marginTop: 24, padding: 16, border: '2px solid #10b981', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12"></polyline>
                <rect x="2" y="7" width="20" height="5"></rect>
                <line x1="12" y1="22" x2="12" y2="7"></line>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
              </svg>
              {t('prize_won', lang) || 'Ai primit un Cadou!'}
            </h3>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem', color: '#10b981' }}>{wonPrize.name}</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#047857' }}>Arată acest ecran cu numărul #{(orderNum)} The casierie pentru validare.</p>
          </div>
        )}

        {/* Summary */}
        <div className="confirm-summary">
          <div className="cs-row">
            <span>{cartItems.length} {cartItems.length > 1 ? t('products_count_many', lang) : t('products_count', lang)}</span>
            <span className="price">{total.toFixed(2)} {t('lei', lang)}</span>
          </div>
          <div className="cs-row cs-paid">
            <span>{t('paid_by_card', lang)}</span>
            <span className="cs-ok">{t('confirmed', lang)}</span>
          </div>
        </div>

        {/* Auto-reset countdown */}
        <div className="confirm-countdown">
          <div className="countdown-bar" style={{ '--pct': `${(countdown / 15) * 100}%` }} />
          <p>{t('screen_reset_in', lang)} <strong>{countdown}s</strong></p>
        </div>

        <button className="btn btn-secondary btn-lg" onClick={resetOrder}>
          {t('new_order', lang)}
        </button>
      </div>
    </div>
  );
}
