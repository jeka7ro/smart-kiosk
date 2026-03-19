import { useState } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import './CartScreen.css';

export default function CartScreen() {
  useInactivityTimeout(90);
  const cartItems = useKioskStore((s) => s.cartItems);
  const updateCartItem = useKioskStore((s) => s.updateCartItem);
  const removeFromCart = useKioskStore((s) => s.removeFromCart);
  const getCartTotal = useKioskStore((s) => s.getCartTotal);
  const goTo = useKioskStore((s) => s.goTo);
  const lang = useKioskStore((s) => s.lang);
  const [imgErrors, setImgErrors] = useState({});

  const subtotal = getCartTotal();
  const VAT_RATE = 0.09;
  const vatAmount = subtotal * VAT_RATE / (1 + VAT_RATE);

  if (cartItems.length === 0) {
    return (
      <div className="cart-screen screen">
        <div className="cart-empty">
          <span className="cart-empty-icon">🛒</span>
          <h2>{t('cart_empty', lang)}</h2>
          <p>Adaugă produse din meniu pentru a continua</p>
          <button className="btn btn-primary btn-xl" onClick={() => goTo('menu')}>← {t('menu', lang)}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-screen screen">
      <header className="cart-header">
        <button className="back-btn" onClick={() => goTo('menu')}>← {t('menu', lang)}</button>
        <h1>{t('my_cart', lang)}</h1>
        <span className="cart-count-badge">{cartItems.length} produse</span>
      </header>

      <div className="cart-body">
        {/* Items */}
        <div className="cart-items scroll-y">
          {cartItems.map((item, i) => (
            <div key={item.id} className="cart-item fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
              {/* Thumbnail */}
              <div className="ci-thumb">
                {item.image && !imgErrors[item.id]
                  ? <img src={item.image} alt={item.name}
                      onError={() => setImgErrors(e => ({ ...e, [item.id]: true }))} />
                  : <span>🍽️</span>
                }
              </div>
              <div className="ci-info">
                <h3 className="ci-name">{item.name}</h3>
                {item.selectedModifiers?.length > 0 && (
                  <p className="ci-mods">{item.selectedModifiers.map(m => m.optionName).join(' • ')}</p>
                )}
                <span className="ci-unit">{item.unitPrice} lei / buc</span>
              </div>
              <div className="ci-controls">
                <div className="ci-qty">
                  <button className="ci-btn" onClick={() => updateCartItem(item.id, item.quantity - 1)}>−</button>
                  <span>{item.quantity}</span>
                  <button className="ci-btn" onClick={() => updateCartItem(item.id, item.quantity + 1)}>+</button>
                </div>
                <span className="ci-total">{item.totalPrice.toFixed(0)} lei</span>
                <button className="ci-remove" onClick={() => removeFromCart(item.id)}>🗑️</button>
              </div>
            </div>
          ))}
          <button className="add-more-btn" onClick={() => goTo('menu')}>+ {t('add_more', lang)}</button>
        </div>

        {/* Summary */}
        <div className="cart-summary">
          <div className="summary-rows">
            <div className="summary-row">
              <span>{t('subtotal', lang)}</span>
              <span>{subtotal.toFixed(2)} {t('lei', lang)}</span>
            </div>
            <div className="summary-row">
              <span>{t('tva', lang)} inclus</span>
              <span>{vatAmount.toFixed(2)} {t('lei', lang)}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-row summary-row--total">
              <span>{t('total', lang)}</span>
              <span className="price price-xl">{subtotal.toFixed(2)} {t('lei', lang)}</span>
            </div>
          </div>
          <button className="btn btn-primary btn-xl" style={{ width: '100%' }} onClick={() => goTo('payment')}>
            {t('pay', lang)} {subtotal.toFixed(0)} {t('lei', lang)} →
          </button>
          <button className="btn btn-ghost btn-lg" style={{ width: '100%', marginTop: 10 }} onClick={() => goTo('menu')}>
            ← {t('add_more', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
