import { useState } from 'react';
import { useQrStore } from '../store/qrStore.js';
import './CheckoutPage.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';

export default function CheckoutPage({ brand }) {
  const total      = useQrStore((s) => s.getCartTotal());
  const cartItems  = useQrStore((s) => s.cartItems);
  const tableNum   = useQrStore((s) => s.tableNum);
  const locationId = useQrStore((s) => s.locationId);
  const brandId    = useQrStore((s) => s.brandId);
  const clearCart  = useQrStore((s) => s.clearCart);
  const goTo       = useQrStore((s) => s.goTo);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const tva   = total * 0.09;
  const grand = total + tva;

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      // POST real order to backend → goes to KDS via Socket.IO
      const res = await fetch(`${BACKEND}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand:       brandId || brand?.id || 'smashme',
          locationId:  locationId || 'loc1',
          orderType:   'dine-in',
          tableNumber: tableNum,
          items: cartItems.map(i => ({
            productId:         i.productId,
            name:              i.name,
            quantity:          i.quantity,
            unitPrice:         i.unitPrice,
            totalPrice:        i.totalPrice,
            selectedModifiers: i.selectedModifiers || [],
          })),
          totalAmount:   grand,
          channel:       'qr-web',
          paymentMethod: 'online', // Viva Smart Checkout — live integration pending
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Order failed');
      clearCart();
      goTo('success');
    } catch (err) {
      setError('Eroare la trimiterea comenzii. Încearcă din nou.');
      setLoading(false);
    }
  };

  return (
    <div className="co-screen">
      <button className="co-back" onClick={() => goTo('cart')}>← Coș</button>

      <div className="co-body">
        <div className="co-icon">💳</div>
        <h1 className="co-title">Plată securizată</h1>
        <p className="co-sub">Masa #{tableNum} · Procesată prin Viva.com</p>

        <div className="co-summary card">
          <div className="co-row"><span>Subtotal</span><span>{total.toFixed(2)} lei</span></div>
          <div className="co-row"><span>TVA 9%</span><span>{tva.toFixed(2)} lei</span></div>
          <div className="co-divider"/>
          <div className="co-row co-total">
            <span>Total de plată</span>
            <span className="price price-md">{grand.toFixed(2)} lei</span>
          </div>
        </div>

        <div className="co-info card">
          <div className="co-info-row">🔒 <span>Conexiune securizată SSL 3DS</span></div>
          <div className="co-info-row">🏦 <span>Procesat de Viva.com</span></div>
          <div className="co-info-row">❌ <span>Nu stocăm datele cardului</span></div>
        </div>

        {error && <div className="co-error">{error}</div>}

        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={handlePay}
          disabled={loading}
        >
          {loading
            ? <><span className="co-spinner" /> Procesăm...</>
            : <>Plătește {grand.toFixed(0)} lei →</>
          }
        </button>
      </div>
    </div>
  );
}
