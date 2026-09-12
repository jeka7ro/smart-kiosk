import { useState, useMemo } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useBrand } from '../context/BrandContext.js';
import { proxySyrveImage } from '../utils/imageUtils.js';
import './ProductScreen.css';

/* ─── Clean Vector SVG Icons with Round Outlines (Zero Emojis) ─── */
function IconInfo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconStarCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7l1.3 3.3L16.5 12l-3.2 1.7L12 17l-1.3-3.3L7.5 12l3.2-1.7z" fill="currentColor" />
    </svg>
  );
}

function IconFries() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v4" />
      <path d="M5 10h14l-1.5 11a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 10z" />
      <line x1="9" y1="3" x2="9" y2="1" />
      <line x1="12" y1="3" x2="12" y2="1" />
      <line x1="15" y1="3" x2="15" y2="1" />
    </svg>
  );
}

function IconSauce() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11h16a8 8 0 0 1-16 0z" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <path d="M8 8a4 4 0 0 1 8 0" />
    </svg>
  );
}

function IconDrink() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8h10l-1.2 12a2 2 0 0 1-2 1.8H10.2a2 2 0 0 1-2-1.8L7 8z" />
      <path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <line x1="15" y1="2" x2="13" y2="8" />
    </svg>
  );
}

function IconBurger() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a8 8 0 0 1 16 0H4z" />
      <rect x="3" y="14" width="18" height="2" rx="1" />
      <path d="M4 19a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3H4z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconBag() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

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

    // 1. Garnituri
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

    if (comment && comment.trim()) {
      selectedModifiers.push({
        modId: 'custom_comment',
        modifierName: 'Notă',
        optionName: comment.trim(),
      });
    }

    const actualBrandId = product._brand || brand?.id;

    // 1. Adaugă produsul principal
    addToCart(product, quantity, selectedModifiers, unitPrice, actualBrandId, false);

    // 2. Adaugă fiecare produs recomandat selectat
    selectedPairings.forEach(pair => {
      addToCart(pair, 1, [], pair.price, pair._brand || actualBrandId, false);
    });

    // 3. Mergi înapoi la meniu
    goTo('menu');
  };

  const allergenLabels = allergens.map(a =>
    typeof a === 'string' ? a : (a.name || a.id || '')
  ).filter(Boolean);

  const rawDesc = (lang !== 'ro' && product.translations && product.translations[lang])
    ? product.translations[lang]
    : (product.description || '');

  // Separă descrierea comercială de textul lung cu ingrediente/tabel nutrițional
  const { shortDesc, detailedIngredients } = useMemo(() => {
    if (!rawDesc) return { shortDesc: '', detailedIngredients: '' };

    const markers = ['ingrediente:', 'declarație nutrițională', 'declaratie nutritionala', 'valori nutritionale'];
    const lower = rawDesc.toLowerCase();

    let splitIndex = -1;
    for (const marker of markers) {
      const idx = lower.indexOf(marker);
      if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
        splitIndex = idx;
      }
    }

    if (splitIndex !== -1) {
      return {
        shortDesc: rawDesc.slice(0, splitIndex).trim(),
        detailedIngredients: rawDesc.slice(splitIndex).trim(),
      };
    }

    return { shortDesc: rawDesc, detailedIngredients: '' };
  }, [rawDesc]);

  return (
    <div className="product-screen-overlay" onClick={() => goTo('menu')}>
      <div className="product-screen-card" onClick={(e) => e.stopPropagation()}>
        
        {/* ─── TOP BAR ─── */}
        <div className="ps-modal-top">
          <div className="ps-modal-top-left">
            <img 
              src={`/brands/${product._brand || brand?.id || 'smashme'}-logo.png`} 
              alt={brand?.name || 'Smash Me'} 
              className="ps-modal-brand-logo" 
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          <button type="button" className="ps-close-btn" onClick={() => goTo('menu')} aria-label="Închide">
            <IconClose />
          </button>
        </div>

        {/* ─── MAIN SCROLLABLE BODY ─── */}
        <div className="ps-card-body scroll-y">
          
          {/* Poza Mare Produs (Mare și Apetisantă pe tot rândul) */}
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

          {/* Nume & Preț */}
          <div className="ps-header-row">
            <h1 className="ps-title">{product.name}</h1>
            <span className="ps-price">{unitPrice.toFixed(2)} lei</span>
          </div>

          {/* Descriere Comercială Scurtă */}
          {shortDesc && (
            <div 
              className="ps-description"
              dangerouslySetInnerHTML={{ __html: shortDesc }}
            />
          )}

          {/* Buton discret rotund cu contur pentru Alergeni & Nutriție (FĂRĂ EMOJI) */}
          {(product.weight || product.energyAmount || allergenLabels.length > 0 || detailedIngredients) && (
            <div className="ps-allergens-accordion">
              <button
                type="button"
                className={`ps-allergens-toggle-btn ${showAllergens ? 'ps-allergens-toggle-btn--open' : ''}`}
                onClick={() => setShowAllergens(v => !v)}
              >
                <div className="ps-allergens-toggle-left">
                  <span className="ps-round-badge">
                    <IconInfo />
                  </span>
                  <span className="ps-allergens-label">
                    {lang === 'ro' ? 'Alergeni & Valori nutriționale' : (t('allergens', lang) || 'Alergeni')}
                  </span>
                </div>
                <span className="ps-chevron-pill">{showAllergens ? 'Închide' : 'Afișează'}</span>
              </button>

              {showAllergens && (
                <div className="ps-allergens-expanded">
                  <div className="ps-meta-items-row">
                    {product.weight && <span className="ps-meta-pill">Greutate: {product.weight}g</span>}
                    {product.energyAmount && <span className="ps-meta-pill">Calorii: {Math.round(product.energyAmount)} kcal</span>}
                  </div>
                  {allergenLabels.length > 0 && (
                    <div className="ps-allergens-tags-row">
                      <span className="ps-allergens-tags-title">Alergeni declarați:</span>
                      <div className="ps-allergens-tags-list">
                        {allergenLabels.map(a => (
                          <span key={a} className="ps-allergen-tag">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailedIngredients && (
                    <div className="ps-detailed-ingredients">
                      <span className="ps-detailed-ingredients-title">Ingrediente & Detalii complete:</span>
                      <p className="ps-detailed-ingredients-text">{detailedIngredients}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Modificatori / Opțiuni */}
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
                        {isSel && (
                          <span className="ps-mod-check">
                            <IconCheck />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ─── SECȚIUNEA RECOMANDĂRI SUB EA ("Se potrivește de minune cu") ─── */}
          {pairings.length > 0 && (
            <div className="ps-pairings-section">
              <div className="ps-pairings-header">
                <span className="ps-round-badge ps-round-badge--primary">
                  <IconStarCircle />
                </span>
                <h3 className="ps-pairings-title">Se potrivește de minune cu:</h3>
              </div>

              <div className="ps-pairings-grid">
                {pairings.map(item => {
                  const isSel = selectedPairings.some(p => p.id === item.id);

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
                          <div className="ps-pairing-fallback">
                            {item.type === 'cartofi' && <IconFries />}
                            {item.type === 'sos' && <IconSauce />}
                            {item.type === 'bautura' && <IconDrink />}
                            {item.type === 'burger' && <IconBurger />}
                          </div>
                        )}
                        {isSel && (
                          <div className="ps-pairing-check-badge">
                            <IconCheck />
                          </div>
                        )}
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
                        {isSel ? (
                          <>
                            <span className="ps-btn-mini-icon"><IconCheck /></span>
                            <span>Adăugat</span>
                          </>
                        ) : (
                          <>
                            <span className="ps-btn-mini-icon"><IconPlus /></span>
                            <span>Adaugă</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Câmp Opțional: Mențiuni Speciale */}
          <div className="ps-comment-wrap">
            <input
              type="text"
              className="ps-comment-input"
              placeholder="Adaugă mențiuni sau instrucțiuni speciale (opțional)"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>

          {/* Selector Cantitate */}
          <div className="ps-qty-row">
            <span className="ps-qty-label">Cantitate:</span>
            <div className="ps-qty-controls">
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

        </div>

        {/* ─── BARA FIXĂ DE JOS (STILUL CURAT KIOSK SMASH ME) ─── */}
        <div className="ps-bottom-bar">
          <button type="button" className="ps-back-btn" onClick={() => goTo('menu')}>
            <IconArrowLeft />
            <span>{t('back', lang) || 'Înapoi'}</span>
          </button>

          <div className="ps-total-wrap">
            <span className="ps-total-label">Total de plată</span>
            <span className="ps-total-amount">{totalPrice.toFixed(2)} lei</span>
            {selectedPairings.length > 0 && (
              <span className="ps-total-extra-hint">
                include {selectedPairings.length} {selectedPairings.length === 1 ? 'recomandare' : 'recomandări'}
              </span>
            )}
          </div>

          <button
            type="button"
            className={`ps-add-btn ${!allRequiredSelected ? 'ps-add-btn--disabled' : ''}`}
            onClick={handleAdd}
            disabled={!allRequiredSelected}
          >
            <IconBag />
            <span>Adaugă în coș</span>
          </button>
        </div>

      </div>
    </div>
  );
}
