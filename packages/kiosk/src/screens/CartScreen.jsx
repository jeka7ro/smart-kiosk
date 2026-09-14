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
    const catNameMap = new Map((menuCategories || []).map(c => [c.id, (c.name || '').toLowerCase()]));
    
    // 2. Filtrare strictă: produsul trebuie să aibă preț, să nu fie ascuns/șters/stop-list
    // și OBLIGATORIU să aparțină unei categorii active din meniu (exclus produse scoase din meniu)
    const validCandidates = menuProducts.filter(p => {
      if (!p || !p.id || !p.price || Number(p.price) <= 0) return false;
      if (p.isHidden || p.isDeleted || p.outOfStock) return false;
      if (activeCatIds.size > 0 && !activeCatIds.has(p.categoryId)) return false;
      if (cartProductIds.has(p.id) && !addedIds[p.id]) return false;
      if (/churros|churo/i.test(p.name)) return false;
      return true;
    });

    if (!validCandidates.length) return [];

    // 3. Împărțire pe tipuri distincte pentru a afișa 3 rânduri (12 produse) din categorii diferite
    const GUSTARI_RX = /cartof|fries|potato|wedges|nuggets|wings|strips|inel|onion|crispy|edamame|spring roll|gyoza|supa|supă|miso|box|snack/i;
    const SOSURI_RX = /sos|sauce|dip|ketchup|mayo|maionez|mustar|muștar|sweet chili|wasabi|ghimbir/i;
    const BAUTURI_RX = /bautur|băutur|drink|cola|pepsi|fanta|sprite|apa|apă|water|bere|beer|suc|juice|ceai|tea|limonad|lemonade|ayran|shake|smoothie|fuze/i;
    const DESERT_RX = /desert|dessert|churros|churo|nutella|nuttela|mochi|cheesecake|tiramisu|clatit|clătit|donut|waffle|inghetat|înghețat|cake|brownie|lava cake|dulce/i;
    const MAIN_DISH_RX = /burger|smashed|cheese|bacon|beef|chicken|vita|vită|pui|combo|box|wrap|sandwich|roll|wok|noodles|orez/i;

    // Produse de bază (Main dishes: burgeri, mâncăruri calde, combos, roll-uri principale, wok)
    const mainCandidates = validCandidates.filter(p => {
      const pCat = catNameMap.get(p.categoryId) || p.categoryName || '';
      const text = `${p.name} ${pCat}`;
      if (DESERT_RX.test(text)) return false;
      if (SOSURI_RX.test(text)) return false;
      if (BAUTURI_RX.test(text)) return false;
      if (GUSTARI_RX.test(p.name)) return false;
      return (MAIN_DISH_RX.test(text) || !pCat.includes('garnitur')) && p.image;
    });

    // Diversificăm produsele de bază luând din categorii diferite (ex: Smashed, Next Level, Combo, Chicken)
    const mainsByCat = {};
    mainCandidates.forEach(p => {
      mainsByCat[p.categoryId] = mainsByCat[p.categoryId] || [];
      mainsByCat[p.categoryId].push(p);
    });
    const diverseMains = [];
    const catKeys = Object.keys(mainsByCat);
    let round = 0;
    while (diverseMains.length < 4 && round < 4) {
      for (const ck of catKeys) {
        if (mainsByCat[ck][round] && diverseMains.length < 4) {
          diverseMains.push(mainsByCat[ck][round]);
        }
      }
      round++;
    }

    const gustari = validCandidates.filter(p => GUSTARI_RX.test(`${p.name} ${catNameMap.get(p.categoryId) || p.categoryName || ''}`) && !diverseMains.some(m => m.id === p.id)).sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));
    const sosuri = validCandidates.filter(p => SOSURI_RX.test(`${p.name} ${catNameMap.get(p.categoryId) || p.categoryName || ''}`)).sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));
    const bauturi = validCandidates.filter(p => BAUTURI_RX.test(`${p.name} ${catNameMap.get(p.categoryId) || p.categoryName || ''}`)).sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));
    const deserturi = validCandidates.filter(p => {
      if (/churros|churo/i.test(p.name)) return false;
      return DESERT_RX.test(`${p.name} ${catNameMap.get(p.categoryId) || p.categoryName || ''}`);
    }).sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));

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

    // Rândul 1 (4 Produse de Bază): Burgeri / Preparate principale
    addFromPool(diverseMains, 4);

    // Rândul 2 (4 Garnituri & Gustări): Cartofi, Nuggets, Box etc.
    addFromPool(gustari, 4);

    // Rândul 3 (4 Sosuri & Băuturi): 2 Sosuri + 2 Băuturi (sau desert dacă există)
    addFromPool(sosuri, 2);
    if (deserturi.length > 0) {
      addFromPool(deserturi, 1);
      addFromPool(bauturi, 1);
    } else {
      addFromPool(bauturi, 2);
    }

    // Completare dacă au fost mai puține într-o categorie până la 12 produse
    if (picked.length < 12) {
      for (const item of validCandidates) {
        if (!usedIds.has(item.id) && picked.length < 12) {
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
    const activeCatIds = new Set((menuCategories || []).map(c => c.id));
    const UPSELL_REGEX = /sos|sauce|ketchup|mayo|maionez|dip|aioli|wasabi|ghimbir|ginger|soia|sweet chili|cartof|fries|potato|wedges|inel|onion|porumb|corn|salat|coleslaw|miso|edamame|bautur|drink|cola|pepsi|apa|apă|water|fanta|sprite|fuze|ceai|tea|bere|beer|shake|smoothie|limonad|lemonade|suc|juice|ayran|mirinda|desert|dessert|muffin|prajit|prăjitur|cake|inghetat|înghețat|sundae|clatit|clătit|donut|mochi|tiramisu|brownie|cheesecake|cookie/i;

    return menuProducts.filter(p => {
      if (cartProductIds.has(p.id)) return false;
      if (!p.price || Number(p.price) <= 0) return false;
      if (p.isHidden || p.isDeleted || p.outOfStock) return false;
      if (activeCatIds.size > 0 && !activeCatIds.has(p.categoryId)) return false;
      if (/churros|churo/i.test(p.name)) return false;
      const name = p.name || '';
      const cat = p.categoryName || '';
      return UPSELL_REGEX.test(`${name} ${cat}`);
    });
  }, [menuProducts, menuCategories, cartProductIds]);

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
      <div className="cart-wrapper">
        <header className="cart-header">
          <button className="back-btn" onClick={() => goTo('menu')}>← {t('menu', lang)}</button>
          <h1>{t('my_cart', lang)}</h1>
          <span className="cart-count-badge">{cartItems.length} {cartItems.length > 1 ? t('items_many', lang) : t('item_one', lang)}</span>
        </header>

        <div className="cart-body">
          {/* Items */}
          <div className="cart-items scroll-y">
            {Object.entries(groupedCart).map(([bId, items]) => (
              <div key={bId} className="cart-brand-group" style={{ marginBottom: '16px', background: 'var(--card, #ffffff)', borderRadius: '22px', padding: '16px', border: '1.5px solid var(--border)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)' }}>
              <div className="cart-brand-header" style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px dashed var(--border)' }}>
                <div className="cart-brand-avatar">
                  <img 
                    src={`/brands/${bId}-logo.png`} 
                    alt={bId} 
                    className="cart-brand-logo-img"
                    onError={(e) => { e.target.parentElement.style.display = 'none'; }} 
                  />
                </div>
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
                        



                        {/* Buton Info (i) */}
                        <button
                          type="button"
                          className="cart-upsell-info-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(prod);
                          }}
                          aria-label={`Informații ${prod.name}`}
                        >
                          i
                        </button>

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

          {/* Securitate & Metode Plată POS (Visa, Mastercard, Apple Pay, Google Pay) */}
          <div className="cart-summary-trust">
            <span className="trust-label">Plată rapidă și sigură la POS</span>
            <div className="trust-pay-cards">
              <div className="trust-pay-card" title="Visa">
                <svg width="44" height="15" viewBox="0 0 36 12" fill="none">
                  <path d="M14.07 0.4L9.22 11.6H6.04L3.69 2.7C3.55 2.12 3.4 1.88 2.92 1.63C2.18 1.23 1.02 0.86 0 0.65L0.08 0.4H5.16C5.83 0.4 6.43 0.84 6.57 1.63L7.79 8.16L10.95 0.4H14.07ZM26.44 7.87C26.46 4.96 22.38 4.8 22.42 3.45C22.43 3.03 22.83 2.59 23.73 2.47C24.18 2.41 25.43 2.36 26.83 3.01L27.42 0.94C26.62 0.65 25.59 0.38 24.28 0.38C21.36 0.38 19.33 1.93 19.31 4.13C19.29 5.76 20.76 6.67 21.87 7.21C23.01 7.76 23.4 8.12 23.39 8.62C23.37 9.38 22.46 9.72 21.62 9.73C20.12 9.75 19.25 9.32 18.57 9.01L17.96 11.17C18.66 11.49 19.96 11.77 21.3 11.78C24.38 11.78 26.42 10.26 26.44 7.87ZM34.25 11.6H37L34.61 0.4H32.22C31.69 0.4 31.24 0.71 31.05 1.18L26.54 11.6H29.68L30.31 9.87H34.14L34.25 11.6ZM31.17 7.55L32.74 3.23L33.64 7.55H31.17ZM18.72 0.4L16.27 11.6H13.27L15.72 0.4H18.72Z" fill="#1434CB"/>
                </svg>
              </div>

              <div className="trust-pay-card" title="Mastercard">
                <svg width="32" height="20" viewBox="0 0 28 18" fill="none">
                  <circle cx="9" cy="9" r="8" fill="#EB001B"/>
                  <circle cx="19" cy="9" r="8" fill="#F79E1B"/>
                  <path d="M14 3.73a7.97 7.97 0 0 0-3 5.27 7.97 7.97 0 0 0 3 5.27 7.97 7.97 0 0 0 3-5.27 7.97 7.97 0 0 0-3-5.27z" fill="#FF5F00"/>
                </svg>
              </div>

              <div className="trust-pay-card" title="Apple Pay">
                <svg width="46" height="19" viewBox="0 0 50 20" fill="none">
                  <path d="M9.13 6.9c-.48.58-1.26 1.02-2.03.96-.1-.8.25-1.63.7-2.16.48-.58 1.34-1 2.05-.98.08.82-.24 1.6-.72 2.18m.7 1.12c-1.12-.07-2.08.64-2.61.64-.54 0-1.35-.6-2.23-.58-1.15.02-2.21.67-2.8 1.7-1.2 2.08-.31 5.17.85 6.85.57.82 1.25 1.74 2.14 1.71.85-.04 1.18-.55 2.21-.55 1.03 0 1.33.55 2.22.53.92-.02 1.51-.83 2.07-1.66.66-.96.93-1.89.94-1.94-.02-.01-1.81-.7-1.83-2.76-.02-1.72 1.4-2.54 1.47-2.59-.8-.18-1.58.55-2.43.65" fill="#0f172a"/>
                  <text x="17" y="16.5" fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" fontSize="13.5" fontWeight="700" fill="#0f172a" letterSpacing="-0.3px">Pay</text>
                </svg>
              </div>

              <div className="trust-pay-card" title="Google Pay">
                <svg width="48" height="19" viewBox="0 0 50 20" fill="none">
                  <g transform="translate(1, 2) scale(0.66)">
                    <path d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.89z" fill="#4285F4"/>
                    <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.07.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.26v3.12A11.99 11.99 0 0 0 12 24z" fill="#34A853"/>
                    <path d="M5.28 14.29a7.18 7.18 0 0 1 0-4.58V6.59H1.26a11.99 11.99 0 0 0 0 10.82l4.02-3.12z" fill="#FBBC05"/>
                    <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.36 2.68 1.26 6.59l4.02 3.12c.95-2.84 3.6-4.96 6.72-4.96z" fill="#EA4335"/>
                  </g>
                  <text x="21" y="15" fontFamily="'Google Sans', Roboto, sans-serif" fontSize="13" fontWeight="600" fill="#5f6368" letterSpacing="-0.2px">Pay</text>
                </svg>
              </div>
            </div>
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
