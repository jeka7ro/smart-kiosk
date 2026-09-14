import { useState, useMemo } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useBrand } from '../context/BrandContext.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import { proxySyrveImage } from '../utils/imageUtils.js';
import { getEffectivePrice } from '../utils/priceUtils.js';
import UpsellModal from '../components/UpsellModal.jsx';
import './CartScreen.css';

export default function CartScreen() {
  useInactivityTimeout(90);
  const cartItems      = useKioskStore((s) => s.cartItems);
  const menuProducts   = useKioskStore((s) => s.menuProducts);
  const menuCategories = useKioskStore((s) => s.menuCategories);
  const updateCartItem = useKioskStore((s) => s.updateCartItem);
  const removeFromCart = useKioskStore((s) => s.removeFromCart);
  const addToCart      = useKioskStore((s) => s.addToCart);
  const getCartTotal   = useKioskStore((s) => s.getCartTotal);
  const goTo           = useKioskStore((s) => s.goTo);
  const lang           = useKioskStore((s) => s.lang);
  const locationData   = useKioskStore((s) => s.locationData);
  const setShowWheel   = useKioskStore((s) => s.setShowWheel);
  const setPromoIntendedRoute = useKioskStore((s) => s.setPromoIntendedRoute);
  const hasPlayedPromo = useKioskStore((s) => s.hasPlayedPromo);

  const brand          = useBrand();
  const [imgErrors, setImgErrors] = useState({});
  const [addedIds, setAddedIds]   = useState({});
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [hasEvaluatedUpsell, setHasEvaluatedUpsell] = useState(false);

  const subtotal  = getCartTotal();
  const VAT_RATE  = 0.09;
  const vatAmount = subtotal * VAT_RATE / (1 + VAT_RATE);

  // IDs already in cart
  const cartProductIds = new Set(cartItems.map(i => i.productId));

  // Smart suggestions: STRICTLY products from active menu categories, diverse multi-row selection
  const suggestions = useMemo(() => {
    if (!menuProducts.length) return [];
    
    // 1. Categoriile active efectiv pe ecranul meniului
    const activeCatIds = new Set((menuCategories || []).map(c => c.id));
    
    // 2. Filtrare strictă: produsul trebuie să aibă preț, să nu fie ascuns/șters/stop-list
    // și OBLIGATORIU să aparțină unei categorii active din meniu (exclus produse scoase din meniu)
    const validCandidates = menuProducts.filter(p => {
      if (!p || !p.id || !p.price || Number(p.price) <= 0) return false;
      if (p.isHidden || p.isDeleted || p.outOfStock) return false;
      if (activeCatIds.size > 0 && !activeCatIds.has(p.categoryId)) return false;
      if (cartProductIds.has(p.id) && !addedIds[p.id]) return false;
      return true;
    });

    if (!validCandidates.length) return [];

    // 3. Împărțire pe tipuri distincte pentru a afișa rânduri cu produse diferite
    const GUSTARI_RX = /cartof|fries|potato|wedges|nuggets|wings|strips|inel|onion|crispy|edamame|spring roll|gyoza|supa|supă|miso|box|snack/i;
    const SOSURI_RX = /sos|sauce|dip|ketchup|mayo|maionez|mustar|muștar|sweet chili|wasabi|ghimbir/i;
    const BAUTURI_RX = /bautur|băutur|drink|cola|pepsi|fanta|sprite|apa|apă|water|bere|beer|suc|juice|ceai|tea|limonad|lemonade|ayran|shake|smoothie|fuze/i;
    const DESERT_RX = /desert|dessert|mochi|cheesecake|tiramisu|clatit|clătit|donut|waffle|inghetat|înghețat|cake|brownie|lava cake/i;

    const gustari = validCandidates.filter(p => GUSTARI_RX.test(`${p.name} ${p.categoryName || ''}`)).sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));
    const sosuri = validCandidates.filter(p => SOSURI_RX.test(`${p.name} ${p.categoryName || ''}`)).sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));
    const bauturi = validCandidates.filter(p => BAUTURI_RX.test(`${p.name} ${p.categoryName || ''}`)).sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));
    const deserturi = validCandidates.filter(p => DESERT_RX.test(`${p.name} ${p.categoryName || ''}`)).sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));

    const picked = [];
    const usedIds = new Set();

    const addFromPool = (pool, count) => {
      let added = 0;
      for (const item of pool) {
        if (!usedIds.has(item.id) && added < count) {
          picked.push(item);
          usedIds.add(item.id);
          added++;
        }
      }
    };

    // Rândul 1 & Rândul 2: mix echilibrat de categorii diferite
    addFromPool(gustari, 4);
    addFromPool(sosuri, 2);
    if (deserturi.length > 0) {
      addFromPool(deserturi, 1);
      addFromPool(bauturi, 1);
    } else {
      addFromPool(bauturi, 2);
    }

    // Completare dacă au fost mai puține într-o categorie
    if (picked.length < 8) {
      for (const item of validCandidates) {
        if (!usedIds.has(item.id) && picked.length < 8) {
          picked.push(item);
          usedIds.add(item.id);
        }
      }
    }

    return picked;
  }, [menuProducts, menuCategories, cartItems, cartProductIds, addedIds]);

  const setSelectedProduct = useKioskStore((s) => s.setSelectedProduct);

  const handleQuickAdd = (prod) => {
    const hasRequiredModifiers = (prod.modifierGroups || []).some(gm => gm.required && gm.options?.length > 0) || (prod.modifiers || []).some(m => m.required && (m.options?.length > 0 || m.items?.length > 0));
    
    if (hasRequiredModifiers) {
      setSelectedProduct(prod);
      return;
    }

    const actualBrandId = prod._brand || brand?.id;
    addToCart(prod, 1, [], getEffectivePrice(prod), actualBrandId, false);
    setAddedIds(prev => ({ ...prev, [prod.id]: true }));
    setTimeout(() => {
      setAddedIds(prev => { 
        const next = { ...prev }; 
        delete next[prod.id]; 
        return next; 
      });
    }, 1200);
  };

  // Upsell candidates for "Doriți și..." modal (KFC style - On/Off via Settings)
  const isUpsellActive = locationData?.upsellActive !== undefined
    ? Boolean(locationData.upsellActive)
    : (localStorage.getItem('kiosk_upsell_active') !== 'false');
  const upsellCandidates = useMemo(() => {
    if (!menuProducts || !menuProducts.length) return [];
    const UPSELL_REGEX = /sos|sauce|ketchup|mayo|maionez|dip|aioli|wasabi|ghimbir|ginger|soia|sweet chili|cartof|fries|potato|wedges|inel|onion|porumb|corn|salat|coleslaw|miso|edamame|bautur|drink|cola|pepsi|apa|apă|water|fanta|sprite|fuze|ceai|tea|bere|beer|shake|smoothie|limonad|lemonade|suc|juice|ayran|mirinda|desert|dessert|muffin|prajit|prăjitur|cake|inghetat|înghețat|sundae|clatit|clătit|donut|mochi|tiramisu|brownie|cheesecake|cookie/i;

    return menuProducts.filter(p => {
      if (cartProductIds.has(p.id)) return false;
      if (!p.price || Number(p.price) <= 0) return false;
      const name = p.name || '';
      const cat = p.categoryName || '';
      return UPSELL_REGEX.test(`${name} ${cat}`);
    });
  }, [menuProducts, cartProductIds]);

  const executePaymentFlow = async () => {
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

          if (subtotal >= minVal && isRightFreq && !hasSpunTooMany && !hasPlayedPromo) {
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
  };

  const handlePayClick = () => {
    if (isUpsellActive && !hasEvaluatedUpsell && upsellCandidates.length > 0) {
      setShowUpsellModal(true);
      return;
    }
    executePaymentFlow();
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
          <div className="cart-empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: 'var(--text-muted)' }}>
            <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="21" r="1"/>
              <circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
            </svg>
          </div>
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
                        ? <img src={proxySyrveImage(item.image)} alt={item.name} onError={() => setImgErrors(e => ({ ...e, [item.id]: true }))} />
                        : <img src={`/brands/${bId}-logo.png`} style={{ width: '65%', opacity: 0.15, filter: 'grayscale(100%)', objectFit: 'contain' }} alt="" />
                      }
                    </div>
                    <div className="ci-info">
                      <h3 className="ci-name">{item.name}</h3>
                      {item.selectedModifiers?.length > 0 && (
                        <p className="ci-mods">{item.selectedModifiers.map(m => m.optionName).join(' • ')}</p>
                      )}
                      <span className="ci-unit">{(+item.unitPrice).toFixed(2)} {t('lei', lang)}</span>
                    </div>
                    <div className="ci-controls">
                      <div className="ci-qty-pill">
                        <button 
                          type="button"
                          className="ci-qty-btn ci-qty-minus" 
                          onClick={() => updateCartItem(item.id, item.quantity - 1)}
                          aria-label="Scade cantitate"
                        >
                          −
                        </button>
                        <span className="ci-qty-val">{item.quantity}</span>
                        <button 
                          type="button"
                          className="ci-qty-btn ci-qty-plus" 
                          onClick={() => updateCartItem(item.id, item.quantity + 1)}
                          aria-label="Crește cantitate"
                        >
                          +
                        </button>
                      </div>
                      <span className="ci-total">{item.totalPrice.toFixed(2)} {t('currency', lang) || 'lei'}</span>
                      <button 
                        type="button"
                        className="ci-remove-btn" 
                        onClick={() => removeFromCart(item.id)}
                        title="Șterge din coș"
                        aria-label="Șterge din coș"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {/* Smart Cross-sell Suggestions (Sub Coș - Prezentare pe mai multe rânduri, fără scroll) */}
          {suggestions.length > 0 && (
            <div className="cart-upsell-section">
              <div className="cart-upsell-header">
                <div className="cart-upsell-title-wrap">
                  <div className="cart-upsell-badge">
                    <span>{t('complete_order', lang) || 'Completează comanda ta'}</span>
                  </div>
                  <h2 className="cart-upsell-title">{t('add_also', lang) || 'Adaugă și alte preparate'}</h2>
                </div>
              </div>
              
              <div className="cart-upsell-grid">
                {suggestions.map(prod => {
                  const isAdded = Boolean(addedIds[prod.id]);
                  const price = getEffectivePrice(prod);
                  return (
                    <div
                      key={prod.id}
                      className={`cart-upsell-card ${isAdded ? 'cart-upsell-card--added' : ''}`}
                      onClick={() => handleQuickAdd(prod)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="cart-upsell-card-media">
                        {prod.image ? (
                          <img 
                            src={proxySyrveImage(prod.image)} 
                            alt={prod.name} 
                            className="cart-upsell-card-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="cart-upsell-card-placeholder">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 2v20" />
                              <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                              <path d="M6 2v20" />
                              <path d="M3 2v6a3 3 0 0 0 6 0V2" />
                            </svg>
                          </div>
                        )}
                        
                        {/* Preț sticker pe poză */}
                        <div className="cart-upsell-card-price-badge">
                          {price.toFixed(2)} lei
                        </div>

                        {/* Brand badge dacă există */}
                        {prod._brand && (
                          <div className="cart-upsell-card-brand-badge">
                            <img src={`/brands/${prod._brand}-logo.png`} alt="" onError={(e) => e.target.style.display = 'none'} />
                          </div>
                        )}

                        {/* Feedback overlay la adăugare */}
                        {isAdded && (
                          <div className="cart-upsell-card-overlay">
                            <span className="cart-upsell-card-check">✓</span>
                            <span className="cart-upsell-card-added-text">Adăugat</span>
                          </div>
                        )}
                      </div>

                      <div className="cart-upsell-card-body">
                        <h4 className="cart-upsell-card-name" title={prod.name}>{prod.name}</h4>
                        <div className="cart-upsell-card-footer">
                          <span className="cart-upsell-card-price-inline">{price.toFixed(2)} lei</span>
                          <button
                            type="button"
                            className={`cart-upsell-add-btn ${isAdded ? 'cart-upsell-add-btn--added' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAdd(prod);
                            }}
                            aria-label={`Adaugă ${prod.name}`}
                          >
                            {isAdded ? '✓ Adăugat' : '+ Adaugă'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button className="add-more-btn" onClick={() => goTo('menu')}>+ {t('add_more', lang)}</button>
        </div>

        {/* Right: Clean & Prominent Summary */}
        <div className="cart-summary">
          <div className="cart-summary-header">
            <h2 className="cart-summary-title">Sumar Comandă</h2>
            <span className="cart-summary-badge">{cartItems.length} {cartItems.length > 1 ? 'produse' : 'produs'}</span>
          </div>

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

          <button 
            className="btn btn-pay btn-xl" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
            onClick={handlePayClick}
          >
            {t('pay', lang)} {subtotal.toFixed(2)} {t('lei', lang)} →
          </button>
          <button className="btn btn-ghost btn-lg" style={{ width: '100%', marginTop: 10 }} onClick={() => goTo('menu')}>
            ← {t('add_more', lang)}
          </button>

          {/* Securitate & Plată POS (fără emoji) */}
          <div className="cart-summary-trust">
            <span className="trust-label">Plată rapidă și sigură la POS</span>
            <div className="trust-icons">
              <span className="trust-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '5px' }}>
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                Card Bancar
              </span>
              <span className="trust-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '5px' }}>
                  <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                  <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                  <line x1="12" y1="20" x2="12.01" y2="20"/>
                </svg>
                Contactless
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── UPSELL MODAL (KFC Style: DORIȚI ȘI... - Activabil din Setări) ─── */}
      {showUpsellModal && (
        <UpsellModal
          candidates={upsellCandidates}
          onConfirm={(selectedList) => {
            selectedList.forEach(({ product, quantity }) => {
              const actualBrandId = product._brand || brand?.id;
              addToCart(product, quantity, [], getEffectivePrice(product), actualBrandId, false);
            });
            setShowUpsellModal(false);
            setHasEvaluatedUpsell(true);
            executePaymentFlow();
          }}
          onSkip={() => {
            setShowUpsellModal(false);
            setHasEvaluatedUpsell(true);
            executePaymentFlow();
          }}
          lang={lang}
        />
      )}
    </div>
  );
}
