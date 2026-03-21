import { useState, useMemo } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useBrand } from '../App.jsx';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import './CartScreen.css';

export default function CartScreen() {
  useInactivityTimeout(90);
  const cartItems      = useKioskStore((s) => s.cartItems);
  const menuProducts   = useKioskStore((s) => s.menuProducts);
  const updateCartItem = useKioskStore((s) => s.updateCartItem);
  const removeFromCart = useKioskStore((s) => s.removeFromCart);
  const addToCart      = useKioskStore((s) => s.addToCart);
  const getCartTotal   = useKioskStore((s) => s.getCartTotal);
  const goTo           = useKioskStore((s) => s.goTo);
  const lang           = useKioskStore((s) => s.lang);
  const brand          = useBrand();
  const [imgErrors, setImgErrors] = useState({});
  const [addedIds, setAddedIds]   = useState({});

  const subtotal  = getCartTotal();
  const VAT_RATE  = 0.09;
  const vatAmount = subtotal * VAT_RATE / (1 + VAT_RATE);

  // IDs already in cart
  const cartProductIds = new Set(cartItems.map(i => i.productId));

  // Smart suggestions: products NOT already in cart, prefer ones with images
  // Prioritize categories that complement cart (sauces, drinks, desserts, sides)
  const suggestions = useMemo(() => {
    if (!menuProducts.length) return [];
    const COMPLEMENT_KEYWORDS = /sos|sauce|bautur|drink|desert|dessert|cartof|fries|soup|supă|salat|miso|ceai|tea/i;
    
    const cartNames = cartItems.map(i => i.name.toLowerCase());
    
    const candidates = menuProducts.filter(p =>
      !cartProductIds.has(p.id) && p.price > 0
    );
    
    // Score: complementary > has image > everything else
    const scored = candidates.map(p => ({
      ...p,
      _score: (COMPLEMENT_KEYWORDS.test(p.name) ? 2 : 0) + (p.image ? 1 : 0)
    }));
    
    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, 4);
  }, [menuProducts, cartProductIds]);

  const handleQuickAdd = (prod) => {
    addToCart(prod, 1, [], prod.price, brand?.id);
    setAddedIds(prev => ({ ...prev, [prod.id]: true }));
    setTimeout(() => setAddedIds(prev => { const next = { ...prev }; delete next[prod.id]; return next; }), 1200);
  };

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

        {/* Right: Summary + Suggestions */}
        <div className="cart-summary">
          {/* Smart Cross-sell Suggestions */}
          {suggestions.length > 0 && (
            <div className="cart-suggestions">
              <div className="cart-sugg-header">
                <span className="cart-sugg-title">🔥 Adaugă și...</span>
                <span className="cart-sugg-sub">Completează comanda ta</span>
              </div>
              <div className="cart-sugg-grid">
                {suggestions.map(prod => (
                  <button
                    key={prod.id}
                    className={`cart-sugg-item ${addedIds[prod.id] ? 'cart-sugg-item--added' : ''}`}
                    onClick={() => handleQuickAdd(prod)}
                  >
                    <div className="cart-sugg-img">
                      {prod.image
                        ? <img src={prod.image} alt={prod.name} />
                        : <span style={{ fontSize: '1.8rem' }}>🍽️</span>
                      }
                      {addedIds[prod.id] && (
                        <div className="cart-sugg-added-overlay">✓</div>
                      )}
                    </div>
                    <div className="cart-sugg-info">
                      <span className="cart-sugg-name">{prod.name}</span>
                      <span className="cart-sugg-price">{prod.price} lei</span>
                    </div>
                    <div className="cart-sugg-plus">＋</div>
                  </button>
                ))}
              </div>
            </div>
          )}

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
          <button className="btn btn-pay btn-xl" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => goTo('payment')}>
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
