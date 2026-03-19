import { useEffect, useState } from 'react';
import { useKioskStore } from '../store/kioskStore';
import './ConfirmationScreen.css';

export default function ConfirmationScreen() {
  const cartItems = useKioskStore((s) => s.cartItems);
  const getCartTotal = useKioskStore((s) => s.getCartTotal);
  const orderType = useKioskStore((s) => s.orderType);
  const tableNumber = useKioskStore((s) => s.tableNumber);
  const resetOrder = useKioskStore((s) => s.resetOrder);
  const [countdown, setCountdown] = useState(15);
  const [orderNum] = useState(() => Math.floor(1000 + Math.random() * 9000));
  const total = getCartTotal();

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => {
      if (c <= 1) { clearInterval(t); resetOrder(); }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
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

        <h1 className="confirm-title">Comandă plasată!</h1>
        <p className="confirm-sub">Plata a fost procesată cu succes</p>

        {/* Order number BIG */}
        <div className="confirm-order-num">
          <span className="on-label">NUMĂRUL TĂU DE COMANDĂ</span>
          <span className="on-number">#{orderNum}</span>
          <span className="on-info">🏁 Ridiači comanda la caserie</span>
        </div>

        {/* Summary */}
        <div className="confirm-summary">
          <div className="cs-row">
            <span>{cartItems.length} produs{cartItems.length > 1 ? 'e' : ''}</span>
            <span className="price">{total.toFixed(2)} lei</span>
          </div>
          <div className="cs-row cs-paid">
            <span>💳 Plătit cu cardul</span>
            <span className="cs-ok">✓ Confirmat</span>
          </div>
        </div>

        {/* Auto-reset countdown */}
        <div className="confirm-countdown">
          <div className="countdown-bar" style={{ '--pct': `${(countdown / 15) * 100}%` }} />
          <p>Ecranul se va reseta în <strong>{countdown}s</strong></p>
        </div>

        <button className="btn btn-secondary btn-lg" onClick={resetOrder}>
          Comandă nouă
        </button>
      </div>
    </div>
  );
}
