import { useState, useMemo } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useBrand } from '../context/BrandContext.js';
import { proxySyrveImage } from '../utils/imageUtils.js';
import './ProductScreen.css';

export default function ProductScreen() {
  const product        = useKioskStore((s) => s.selectedProduct);
  const addToCart      = useKioskStore((s) => s.addToCart);
  const goTo           = useKioskStore((s) => s.goTo);
  const lang           = useKioskStore((s) => s.lang);
  const menuProducts   = useKioskStore((s) => s.menuProducts);
  const menuCategories = useKioskStore((s) => s.menuCategories);
  const brand          = useBrand();

  const modifiers = product?.modifierGroups || product?.modifiers || [];
  const allergens = product?.allergenGroups || product?.allergens || [];

  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [comment,  setComment]  = useState('');
  const [showAllergens, setShowAllergens] = useState(false);
  const [selectedPairings, setSelectedPairings] = useState([]);

  const [selected, setSelected] = useState(() => {
    const init = {};
    const mods = product?.modifierGroups || product?.modifiers || [];
    mods.forEach(mod => {
      const opts = mod.options || mod.items || [];
      if (mod.required && opts.length > 0) init[mod.id] = opts[0].id;
    });
    return init;
  });

  if (!product) { goTo('menu'); return null; }

  // ─── Pairings calculation ("Se potrivește de minune cu...") ─────────────
  const pairings = useMemo(() => {
    if (!product || !menuProducts || menuProducts.length === 0) return [];

    const actualBrandId = product._brand || brand?.id || 'smashme';
    const pool = menuProducts.filter(p => 
      p.id !== product.id && 
      p.price > 0 && 
      (p._brand === actualBrandId || p.brandId === actualBrandId)
    );

    if (pool.length === 0) return [];

    const catMap = {};
    (menuCategories || []).forEach(c => {
      catMap[c.id] = (c.name || '').toLowerCase();
    });

    const currCatName = (catMap[product.categoryId] || '').toLowerCase();
    const currName    = (product.name || '').toLowerCase();

    const isSide  = currCatName.includes('garnitur') || currName.includes('cartofi') || currName.includes('fries');
    const isSauce = currCatName.includes('sos') || currName.includes('sos');
    const isDrink = currCatName.includes('bautur') || currName.includes('cola') || currName.includes('apa') || currName.includes('fanta') || currName.includes('sprite');

    // 1. Garnituri / Cartofi
    const sides = pool.filter(p => {
      const c = catMap[p.categoryId] || '';
      return c.includes('garnitur') || p.name.toLowerCase().includes('cartofi') || p.name.toLowerCase().includes('fries');
    });

    // 2. Sosuri
    const sauces = pool.filter(p => {
      const c = catMap[p.categoryId] || '';
      return c.includes('sos') || p.name.toLowerCase().includes('sos') || p.name.toLowerCase().includes('ketchup') || p.name.toLowerCase().includes('mayo');
    });

    // 3. Băuturi
    const drinks = pool.filter(p => {
      const c = catMap[p.categoryId] || '';
      return c.includes('bautur') || p.name.toLowerCase().includes('cola') || p.name.toLowerCase().includes('fanta') || p.name.toLowerCase().includes('apa');
    });

    // 4. Burgers / Main
    const mains = pool.filter(p => {
      const c = catMap[p.categoryId] || '';
      return c.includes('burger') || c.includes('smashed') || c.includes('box');
    });

    // 5. Desserts
    const desserts = pool.filter(p => {
      const c = catMap[p.categoryId] || '';
      return c.includes('desert') || p.name.toLowerCase().includes('churros');
    });

    const list = [];
    if (!isSide && sides.length > 0)  list.push({ type: 'cartofi', ...sides[0] });
    if (!isSauce && sauces.length > 0) list.push({ type: 'sos',     ...sauces[0] });
    if (!isDrink && drinks.length > 0) list.push({ type: 'bautura', ...drinks[0] });

    if (list.length < 3) {
      if (isSide && mains.length > 0 && !list.some(p => p.id === mains[0].id)) {
        list.unshift({ type: 'burger', ...mains[0] });
      }
      if (isSauce && sides.length > 0 && !list.some(p => p.id === sides[0].id)) {
        list.unshift({ type: 'cartofi', ...sides[0] });
      }
      if (isDrink && mains.length > 0 && !list.some(p => p.id === mains[0].id)) {
        list.unshift({ type: 'burger', ...mains[0] });
      }
      if (list.length < 3 && desserts.length > 0 && !list.some(p => p.id === desserts[0].id)) {
        list.push({ type: 'desert', ...desserts[0] });
      }
    }

    return list.slice(0, 3);
  }, [product, menuProducts, menuCategories, brand?.id]);

  const togglePairing = (pairItem) => {
    setSelectedPairings(current => {
      const exists = current.some(p => p.id === pairItem.id);
      if (exists) {
        return current.filter(p => p.id !== pairItem.id);
      } else {
        return [...current, pairItem];
      }
    });
  };

  const selectedOptionsDiff = modifiers.reduce((sum, mod) => {
    const opts = mod.options || mod.items || [];
    const optionId = selected[mod.id];
    const opt = opts.find(o => o.id === optionId);
    return sum + (opt?.priceDiff || opt?.price || 0);
  }, 0);

  const unitPrice       = product.price + selectedOptionsDiff;
  const pairingsTotal   = selectedPairings.reduce((sum, p) => sum + p.price, 0);
  const totalPrice      = (unitPrice * quantity) + pairingsTotal;

  const allRequiredSelected = modifiers
    .filter(m => m.required && ((m.options?.length > 0) || (m.items?.length > 0)))
    .every(m => selected[m.id]);

  const handleSelect = (modId, optId) => setSelected(s => ({ ...s, [modId]: optId }));

  const handleAdd = () => {
    const selectedModifiers = modifiers.map(mod => {
      const opts = mod.options || mod.items || [];
      return {
        modId: mod.id,
        modifierName: mod.name,
        optionName: opts.find(o => o.id === selected[mod.id])?.name || '',
      };
    }).filter(m => m.optionName);

    // If user typed custom instructions/notes, include in modifiers
    if (comment && comment.trim()) {
      selectedModifiers.push({
        modId: 'custom_comment',
        modifierName: 'Notă',
        optionName: comment.trim(),
      });
    }

    const actualBrandId = product._brand || brand?.id;

    // 1. Add main product
    addToCart(product, quantity, selectedModifiers, unitPrice, actualBrandId, false);

    // 2. Add each selected companion item
    selectedPairings.forEach(pair => {
      addToCart(pair, 1, [], pair.price, pair._brand || actualBrandId, false);
    });

    // 3. Return to menu
    goTo('menu');
  };

  const allergenLabels = allergens.map(a =>
    typeof a === 'string' ? a : (a.name || a.id || '')
  ).filter(Boolean);

  const localizedDesc = (lang !== 'ro' && product.translations && product.translations[lang])
    ? product.translations[lang]
    : product.description;

  // Split marketing appetite description from technical ingredients / nutrition info
  const { shortDesc, detailedIngredients } = useMemo(() => {
    if (!localizedDesc) return { shortDesc: '', detailedIngredients: '' };

    const markers = ['ingrediente:', 'declarație nutrițională', 'declaratie nutritionala', 'valori nutritionale'];
    const lower = localizedDesc.toLowerCase();

    let splitIndex = -1;
    for (const marker of markers) {
      const idx = lower.indexOf(marker);
      if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
        splitIndex = idx;
      }
    }

    if (splitIndex !== -1) {
      const short = localizedDesc.slice(0, splitIndex).trim();
      const details = localizedDesc.slice(splitIndex).trim();
      return { shortDesc: short, detailedIngredients: details };
    }

    return { shortDesc: localizedDesc, detailedIngredients: '' };
  }, [localizedDesc]);

  return (
    <div className="product-screen-overlay">
      <div className="product-screen-card">
        {/* ─── HERO IMAGE ─── */}
        <div className="ps-hero-wrap">
          {product.image && !imgError ? (
            <img
              src={proxySyrveImage(product.image)}
              alt={product.name}
              className="ps-hero-img"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="ps-hero-fallback">
              <img
                src={`/brands/${brand?.id || 'smashme'}-logo.png`}
                alt=""
                className="ps-hero-fallback-logo"
              />
            </div>
          )}
        </div>

        {/* ─── SCROLLABLE CONTENT BODY ─── */}
        <div className="ps-card-body scroll-y">
          {/* Header Row: Title on Left, Price on Right */}
          <div className="ps-header-row">
            <h1 className="ps-title">{product.name}</h1>
            <span className="ps-price">{unitPrice.toFixed(2)} lei</span>
          </div>

          {/* Appetizing Marketing Description */}
          {shortDesc && (
            <div 
              className="ps-description"
              dangerouslySetInnerHTML={{ __html: shortDesc }}
            />
          )}

          {/* Compact Allergens Button / Drawer (Doesn't clutter the screen) */}
          {(product.weight || product.energyAmount || allergenLabels.length > 0 || detailedIngredients) && (
            <div className="ps-allergens-accordion">
              <button
                type="button"
                className={`ps-allergens-toggle-btn ${showAllergens ? 'ps-allergens-toggle-btn--open' : ''}`}
                onClick={() => setShowAllergens(v => !v)}
              >
                <div className="ps-allergens-toggle-left">
                  <span className="ps-allergens-icon">ℹ️</span>
                  <span className="ps-allergens-label">
                    {lang === 'ro' ? 'Alergeni & Valori nutriționale' : (t('allergens', lang) || 'Alergeni')}
                  </span>
                </div>
                <span className="ps-allergens-chevron">{showAllergens ? '▲' : '▼'}</span>
              </button>

              {showAllergens && (
                <div className="ps-allergens-expanded">
                  <div className="ps-meta-items-row">
                    {product.weight && <span className="ps-meta-pill">⚖️ Greutate: {product.weight}g</span>}
                    {product.energyAmount && <span className="ps-meta-pill">🔥 Calorii: {Math.round(product.energyAmount)} kcal</span>}
                  </div>
                  {allergenLabels.length > 0 && (
                    <div className="ps-allergens-tags-row">
                      <span className="ps-allergens-tags-title">Alergeni:</span>
                      <div className="ps-allergens-tags-list">
                        {allergenLabels.map(a => (
                          <span key={a} className="ps-allergen-tag">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailedIngredients && (
                    <div className="ps-detailed-ingredients">
                      <span className="ps-detailed-ingredients-title">Ingrediente & Detalii:</span>
                      <p className="ps-detailed-ingredients-text">{detailedIngredients}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Modifiers / Options */}
          {modifiers.map(mod => {
            const opts = mod.options || mod.items || [];
            if (opts.length === 0) return null;
            const groupLabel = mod.name ? mod.name.toUpperCase() : (t('options', lang) || 'OPȚIUNI').toUpperCase();
            
            let reqBadge = null;
            if (mod.required) {
              const min = mod.minAmount ?? 1;
              const max = mod.maxAmount ?? 1;
              reqBadge = min === max 
                ? (t('choose_exact', lang) || 'Alege {amount}').replace('{amount}', min)
                : (t('choose_min_max', lang) || 'Alege {min}-{max}').replace('{min}', min).replace('{max}', max);
            }
            
            return (
              <div key={mod.id} className="ps-mod-group">
                <div className="ps-mod-header">
                  <h3 className="ps-mod-title">{groupLabel}</h3>
                  {reqBadge && <span className="ps-req-badge">{reqBadge}</span>}
                </div>
                <div className="ps-mod-options-grid">
                  {opts.map(opt => {
                    const isSel = selected[mod.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`ps-mod-opt ${isSel ? 'ps-mod-opt--selected' : ''}`}
                        onClick={() => handleSelect(mod.id, opt.id)}
                      >
                        {opt.image && (
                          <img
                            src={proxySyrveImage(opt.image)}
                            alt={opt.name}
                            className="ps-mod-opt-img"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <span className="ps-mod-opt-name">{opt.name}</span>
                        {(opt.priceDiff > 0 || opt.price > 0) && (
                          <span className="ps-mod-opt-price">
                            +{(opt.priceDiff || opt.price || 0).toFixed(2)} lei
                          </span>
                        )}
                        {isSel && <span className="ps-mod-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ─── PAIRINGS / RECOMANDĂRI ("Se potrivește de minune cu...") ─── */}
          {pairings.length > 0 && (
            <div className="ps-pairings-section">
              <div className="ps-pairings-header">
                <span className="ps-pairings-sparkle">✨</span>
                <h3 className="ps-pairings-title">Se potrivește de minune cu:</h3>
              </div>

              <div className="ps-pairings-grid">
                {pairings.map(item => {
                  const isSel = selectedPairings.some(p => p.id === item.id);
                  const typeEmoji = item.type === 'cartofi' ? '🍟' : item.type === 'sos' ? '🧀' : item.type === 'bautura' ? '🥤' : '🍔';

                  return (
                    <div
                      key={item.id}
                      className={`ps-pairing-card ${isSel ? 'ps-pairing-card--selected' : ''}`}
                      onClick={() => togglePairing(item)}
                    >
                      <div className="ps-pairing-img-wrap">
                        {item.image ? (
                          <img
                            src={proxySyrveImage(item.image)}
                            alt={item.name}
                            className="ps-pairing-img"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="ps-pairing-fallback">{typeEmoji}</div>
                        )}
                        {isSel && <div className="ps-pairing-check-badge">✓</div>}
                      </div>

                      <div className="ps-pairing-info">
                        <span className="ps-pairing-name">{item.name}</span>
                        <span className="ps-pairing-price">+{item.price.toFixed(2)} lei</span>
                      </div>

                      <button
                        type="button"
                        className={`ps-pairing-btn ${isSel ? 'ps-pairing-btn--selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePairing(item);
                        }}
                      >
                        {isSel ? '✓ Adăugat' : '+ Adaugă'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comment / Extra Instructions Box */}
          <div className="ps-comment-wrap">
            <input
              type="text"
              className="ps-comment-input"
              placeholder="Adaugă informații suplimentare"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>

          {/* Quantity Controls Centered */}
          <div className="ps-qty-row">
            <button 
              type="button"
              className="ps-qty-btn ps-qty-minus" 
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
            >
              −
            </button>
            <span className="ps-qty-val">{quantity}</span>
            <button 
              type="button"
              className="ps-qty-btn ps-qty-plus" 
              onClick={() => setQuantity(q => Math.min(20, q + 1))}
            >
              +
            </button>
          </div>
        </div>

        {/* ─── FIXED BOTTOM BAR (RED FOOTER) ─── */}
        <div className="ps-bottom-bar">
          <button type="button" className="ps-back-btn" onClick={() => goTo('menu')}>
            <span className="ps-back-chevron">‹</span> {t('back', lang) || 'Înapoi'}
          </button>

          <div className="ps-total-wrap">
            <span className="ps-total-label">Total:</span>
            <span className="ps-total-amount">{totalPrice.toFixed(2)} lei</span>
            {selectedPairings.length > 0 && (
              <span className="ps-total-extra-hint">
                (+{selectedPairings.length} {selectedPairings.length === 1 ? 'produs' : 'produse'})
              </span>
            )}
          </div>

          <button
            type="button"
            className={`ps-add-btn ${!allRequiredSelected ? 'ps-add-btn--disabled' : ''}`}
            onClick={handleAdd}
            disabled={!allRequiredSelected}
          >
            <svg className="ps-bag-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <span>{lang === 'ro' ? 'Adaugă' : (t('add_to_cart', lang)?.replace('+', '').trim() || 'Adaugă')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
