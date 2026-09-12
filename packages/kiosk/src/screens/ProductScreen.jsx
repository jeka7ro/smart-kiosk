import { useState, useMemo } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useBrand } from '../context/BrandContext.js';
import { proxySyrveImage } from '../utils/imageUtils.js';
import './ProductScreen.css';

export default function ProductScreen() {
  const product       = useKioskStore((s) => s.selectedProduct);
  const addToCart     = useKioskStore((s) => s.addToCart);
  const goTo          = useKioskStore((s) => s.goTo);
  const lang          = useKioskStore((s) => s.lang);
  const brand         = useBrand();

  const modifiers = product?.modifierGroups || product?.modifiers || [];
  const allergens = product?.allergenGroups || product?.allergens || [];

  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [comment,  setComment]  = useState('');

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

  const selectedOptionsDiff = modifiers.reduce((sum, mod) => {
    const opts = mod.options || mod.items || [];
    const optionId = selected[mod.id];
    const opt = opts.find(o => o.id === optionId);
    return sum + (opt?.priceDiff || opt?.price || 0);
  }, 0);

  const unitPrice  = product.price + selectedOptionsDiff;
  const totalPrice = unitPrice * quantity;

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

    // If user typed custom instructions/notes, include in modifiers or item
    if (comment && comment.trim()) {
      selectedModifiers.push({
        modId: 'custom_comment',
        modifierName: 'Notă',
        optionName: comment.trim(),
      });
    }

    const actualBrandId = product._brand || brand?.id;
    addToCart(product, quantity, selectedModifiers, unitPrice, actualBrandId);
    goTo('menu');
  };

  const allergenLabels = allergens.map(a =>
    typeof a === 'string' ? a : (a.name || a.id || '')
  ).filter(Boolean);

  const localizedDesc = (lang !== 'ro' && product.translations && product.translations[lang])
    ? product.translations[lang]
    : product.description;

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

          {/* Description */}
          {localizedDesc && (
            <div 
              className="ps-description"
              dangerouslySetInnerHTML={{ __html: localizedDesc }}
            />
          )}

          {/* Weight & Calories & Allergens */}
          {(product.weight || product.energyAmount || allergenLabels.length > 0) && (
            <div className="ps-meta-section">
              {product.weight && <span className="ps-meta-item">⚖️ {product.weight}g</span>}
              {product.energyAmount && <span className="ps-meta-item">🔥 {Math.round(product.energyAmount)} kcal</span>}
              {allergenLabels.length > 0 && (
                <div className="ps-allergens-wrap">
                  <span className="ps-allergens-label">⚠️ Alergeni:</span>
                  {allergenLabels.map(a => (
                    <span key={a} className="ps-allergen-tag">{a}</span>
                  ))}
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
