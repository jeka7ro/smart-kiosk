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
  const [countdown, setCountdown] = useState(15);
  const [orderNum] = useState(() => Math.floor(1000 + Math.random() * 9000));
  const total = getCartTotal();

  useEffect(() => {
    const timer = setInterval(() => setCountdown((c) => {
      if (c <= 1) { clearInterval(timer); resetOrder(); }
      return c - 1;
    }), 1000);
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
