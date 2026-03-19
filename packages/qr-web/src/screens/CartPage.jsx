import { useState } from 'react';
import { useQrStore } from '../store/qrStore.js';
import './CartPage.css';

export default function CartPage({ brand }) {
  const items = useQrStore((s) => s.cartItems);
  const update = useQrStore((s) => s.updateCartItem);
  const remove = useQrStore((s) => s.removeFromCart);
  const getTotal = useQrStore((s) => s.getCartTotal);
  const goTo = useQrStore((s) => s.goTo);
  const [imgErrors, setImgErrors] = useState({});

  const total = getTotal();
  const tva   = total * 0.09; // 9% TVA food Romania

  return (
    <div className="cp-screen">
      {/* Header */}
      <header className="cp-header">
        <button className="cp-back" onClick={() => goTo('menu')}>← Meniu</button>
        <h1>Coșul meu</h1>
      </header>

      {/* Items */}
      <div className="cp-items">
        {items.length === 0 ? (
          <div className="cp-empty">
            <span>🛒</span>
            <p>Coșul este gol</p>
            <button className="btn btn-secondary" onClick={() => goTo('menu')}>Adaugă produse</button>
          </div>
        ) : items.map(item => (
          <div key={item.id} className="cp-item">
            {/* Thumbnail */}
            <div className="cp-item-thumb">
              {item.image && !imgErrors[item.id]
                ? <img src={item.image} alt={item.name}
                    onError={() => setImgErrors(e => ({ ...e, [item.id]: true }))} />
                : <span>🍽️</span>
              }
            </div>
            <div className="cp-item-info">
              <span className="cp-item-name">{item.name}</span>
              {item.selectedModifiers?.map((m, i) => (
                <span key={i} className="cp-item-mod">{m.modifierName}: {m.optionName}</span>
              ))}
              <span className="cp-item-unit">{item.unitPrice} lei / buc</span>
            </div>
            <div className="cp-item-controls">
              <div className="cp-qty">
                <button onClick={() => update(item.id, item.quantity - 1)}>−</button>
                <span>{item.quantity}</span>
                <button onClick={() => update(item.id, item.quantity + 1)}>+</button>
              </div>
              <span className="cp-item-total price price-md">{item.totalPrice.toFixed(0)} lei</span>
              <button className="cp-remove" onClick={() => remove(item.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary + CTA */}
      {items.length > 0 && (
        <div className="sticky-bottom cp-footer">
          <div className="cp-rows">
            <div className="cp-row"><span>Subtotal</span><span>{total.toFixed(2)} lei</span></div>
            <div className="cp-row"><span>TVA 9%</span><span>{tva.toFixed(2)} lei</span></div>
            <div className="cp-row cp-row--total"><span>Total</span><span className="price">{(total + tva).toFixed(2)} lei</span></div>
          </div>
          <button className="btn btn-primary btn-lg btn-full" onClick={() => goTo('checkout')}>
            Plătește {total.toFixed(0)} lei →
          </button>
        </div>
      )}
    </div>
  );
}
