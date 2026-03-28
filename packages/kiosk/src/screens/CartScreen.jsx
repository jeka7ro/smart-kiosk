import { useState, useMemo } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useBrand } from '../context/BrandContext.js';
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
  const setShowWheel   = useKioskStore((s) => s.setShowWheel);
  const setPromoIntendedRoute = useKioskStore((s) => s.setPromoIntendedRoute);
  
  const brand          = useBrand();
  const [imgErrors, setImgErrors] = useState({});
  const [addedIds, setAddedIds]   = useState({});

  const subtotal  = getCartTotal();
  const VAT_RATE  = 0.09;
  const vatAmount = subtotal * VAT_RATE / (1 + VAT_RATE);

  // IDs already in cart
  const cartProductIds = new Set(cartItems.map(i => i.productId));

  // Smart suggestions: products NOT already in cart, prefer addons/sides
  // Crucially: never suggest items from categories the user already bought (e.g. no sets if set is in cart)
  const suggestions = useMemo(() => {
    if (!menuProducts.length) return [];
    
    // Expanded keywords for standard upsell items across all brands
    const ADDONS_REGEX = /sos|sauce|bautur|drink|desert|dessert|cartof|fries|potato|wedges|soup|supă|salat|miso|ceai|tea|mochi|ketchup|mayo|maionez/i;
    
    const cartCategoryIds = new Set(cartItems.map(i => {
      const p = menuProducts.find(prod => prod.id === i.productId);
      return p ? p.categoryId : null;
    }).filter(Boolean));
    
    const candidates = menuProducts.filter(p => !cartProductIds.has(p.id) && p.price > 0);
    
    const scored = candidates.map(p => {
      let score = 0;
      // Bonus: Add-ons / sides are excellent cross-sells
      if (ADDONS_REGEX.test(p.name)) score += 10;
      // Bonus: Visuals sell
      if (p.image) score += 2;
      // PENALTY: Heavily penalize categories the user already bought from
      if (cartCategoryIds.has(p.categoryId)) score -= 20;
      
      return { ...p, _score: score };
    });
    
    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, 4);
  }, [menuProducts, cartItems]);

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
                      <span className="ci-total">{item.totalPrice.toFixed(0)} {t('currency', lang) || 'lei'}</span>
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
                <span className="cart-sugg-title">🔥 {t('add_also', lang) || 'Adaugă și...'}</span>
                <span className="cart-sugg-sub">{t('complete_order', lang) || 'Completează comanda ta'}</span>
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
          <button className="btn btn-pay btn-xl" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => {
            (async () => {
              try {
                const locId = new URLSearchParams(window.location.search).get('loc') || localStorage.getItem('kiosk_loc_id');
                if (!locId) return goTo('payment');
                
                const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';
                const res = await fetch(`${BACKEND}/api/promotions/kiosk/${locId}`);
                const pData = await res.json();
                
                if (pData && pData.available && pData.rules) {
                  const trigger = pData.rules.triggerMoment || 'after_payment';
                  if (trigger === 'before_payment') {
                    const minVal = pData.rules.minOrderValue || 0;
                    const freqEnabled = pData.rules.freqEnabled === undefined ? true : pData.rules.freqEnabled;
                    const ordersToAppear = pData.rules.ordersToAppear || 1;
                    const ordersFinished = parseInt(localStorage.getItem('kiosk_orders_count') || '0', 10);
                    
                    const isRightFreq = freqEnabled ? ((ordersFinished % ordersToAppear) === 0) : true;
                    const hasSpunTooMany = cartItems.filter(i => i.isPromo).length >= 1;

                    if (subtotal >= minVal && isRightFreq && !hasSpunTooMany) {
                       setPromoIntendedRoute('payment');
                       setShowWheel(true);
                       return;
                    }
                  }
                }
              } catch (e) {
                console.error("Promo eval failed:", e);
              }
              // Normal flow
              goTo('payment');
            })();
          }}>
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
