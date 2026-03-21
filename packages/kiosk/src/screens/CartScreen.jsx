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

  const groupedCart = cartItems.reduce((acc, item) => {
    const bId = item.brandId || 'smashme';
    if (!acc[bId]) acc[bId] = [];
    acc[bId].push(item);
    return acc;
  }, {});

  if (cartItems.length === 0) {
    return (
      <div className="cart-screen screen">
        <div className="cart-empty">
          <span className="cart-empty-icon">🛒</span>
          <h2>{t('cart_empty', lang)}</h2>
          <p>{t('add_more', lang)}</p>
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
        <span className="cart-count-badge">{cartItems.length} {cartItems.length > 1 ? t('items_many', lang) : t('item_one', lang)}</span>
      </header>

      <div className="cart-body">
        {/* Items */}
        <div className="cart-items scroll-y">
          {Object.entries(groupedCart).map(([bId, items]) => (
            <div key={bId} className="cart-brand-group" style={{ marginBottom: '24px', background: 'var(--card, #ffffff)', borderRadius: '20px', padding: '16px', border: '1px solid var(--border)' }}>
              <div className="cart-brand-header" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed var(--border)' }}>
                <img src={`/brands/${bId}-logo.png`} alt={bId} style={{ height: '44px', objectFit: 'contain', maxWidth: '220px' }} onError={(e) => e.target.style.display = 'none'} />
              </div>
              <div className="cart-brand-items" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {items.map((item, i) => (
                  <div key={item.id} className="cart-item fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    {/* Thumbnail */}
                    <div className="ci-thumb" style={(imgErrors[item.id] || !item.image) ? {background: 'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center'} : {}}>
                      {item.image && !imgErrors[item.id]
                        ? <img src={item.image} alt={item.name} onError={() => setImgErrors(e => ({ ...e, [item.id]: true }))} />
                        : <img src={`/brands/${bId}-logo.png`} style={{ width: '65%', opacity: 0.15, filter: 'grayscale(100%)', objectFit: 'contain' }} alt="" />
                      }
                    </div>
                    <div className="ci-info">
                      <h3 className="ci-name">{item.name}</h3>
                      {item.selectedModifiers?.length > 0 && (
                        <p className="ci-mods">{item.selectedModifiers.map(m => m.optionName).join(' • ')}</p>
                      )}
                      <span className="ci-unit">{item.unitPrice} {t('lei', lang)}</span>
                    </div>
                    <div className="ci-controls">
                      <div className="ci-qty">
                        <button className="ci-btn" onClick={() => updateCartItem(item.id, item.quantity - 1)}>−</button>
                        <span>{item.quantity}</span>
                        <button className="ci-btn" onClick={() => updateCartItem(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <span className="ci-total">{item.totalPrice.toFixed(0)} {t('lei', lang)}</span>
                      <button className="ci-remove" onClick={() => removeFromCart(item.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
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
              <span>{t('tva', lang)} {t('tva_included', lang)}</span>
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
