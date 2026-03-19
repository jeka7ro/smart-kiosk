import { useState } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import './ProductScreen.css';

export default function ProductScreen() {
  const product     = useKioskStore((s) => s.selectedProduct);
  const addToCart   = useKioskStore((s) => s.addToCart);
  const goTo        = useKioskStore((s) => s.goTo);
  const lang        = useKioskStore((s) => s.lang);

  // Normalize data — supports both Syrve API fields and mock data fields
  const modifiers = product?.modifierGroups || product?.modifiers || [];
  const allergens = product?.allergenGroups || product?.allergens || [];

  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
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

  // Calculate price adjustments from modifiers
  const selectedOptionsDiff = modifiers.reduce((sum, mod) => {
    const opts = mod.options || mod.items || [];
    const optionId = selected[mod.id];
    const opt = opts.find(o => o.id === optionId);
    return sum + (opt?.priceDiff || opt?.price || 0);
  }, 0);

  const unitPrice  = product.price + selectedOptionsDiff;
  const totalPrice = unitPrice * quantity;

  // Only check required modifiers that actually have options to select
  const allRequiredSelected = modifiers
    .filter(m => m.required && (m.options?.length > 0 || m.items?.length > 0))
    .every(m => selected[m.id]);

  const handleSelect = (modId, optId) => setSelected(s => ({ ...s, [modId]: optId }));

  const handleAdd = () => {
    const selectedModifiers = modifiers.map(mod => {
      const opts = mod.options || mod.items || [];
      return {
        modifierName: mod.name,
        optionName: opts.find(o => o.id === selected[mod.id])?.name || '',
      };
    }).filter(m => m.optionName);

    addToCart(product, quantity, selectedModifiers, unitPrice);
    goTo('menu');
  };

  // Normalize allergen display
  const allergenLabels = allergens.map(a =>
    typeof a === 'string' ? a : (a.name || a.id || '')
  ).filter(Boolean);

  return (
    <div className="product-screen screen">
      <button className="back-btn-abs" onClick={() => goTo('menu')}>
        ← {t('back', lang)} 
      </button>

      <div className="product-detail scroll-y">
        {/* ─── Hero ─────────────────────────────── */}
        <div className="pd-hero">
          <div className="pd-hero-img">
            {product.image && !imgError ? (
              <img
                src={product.image}
                alt={product.name}
                className="pd-photo"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="pd-emoji">🍽️</span>
            )}
          </div>

          <div className="pd-hero-info">
            {product.badge && <span className="product-badge">{product.badge}</span>}
            <h1 className="pd-name">{product.name}</h1>
            <p className="pd-desc">{product.description}</p>

            {product.weight && (
              <span className="pd-weight">⚖️ {product.weight}g</span>
            )}
            {product.energyAmount && (
              <span className="pd-calories">🔥 {Math.round(product.energyAmount)} kcal</span>
            )}

            {allergenLabels.length > 0 && (
              <div className="pd-allergens">
                <span className="pd-allergen-label">⚠️ Alergeni:</span>
                {allergenLabels.map(a => (
                  <span key={a} className="allergen-tag">{a}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Modifiers ────────────────────────── */}
        {modifiers.map(mod => {
          const opts = mod.options || mod.items || [];
          if (opts.length === 0) return null;
          return (
            <div key={mod.id} className="pd-modifier">
              <div className="pd-mod-header">
                <h3>{mod.name}</h3>
                {mod.required && <span className="req-badge">Obligatoriu</span>}
              </div>
              <div className="pd-mod-options">
                {opts.map(opt => (
                  <button
                    key={opt.id}
                    className={`mod-option ${selected[mod.id] === opt.id ? 'mod-option--selected' : ''}`}
                    onClick={() => handleSelect(mod.id, opt.id)}
                  >
                    <span className="mod-opt-name">{opt.name}</span>
                    {(opt.priceDiff > 0 || opt.price > 0) && (
                      <span className="mod-opt-price">
                        +{(opt.priceDiff || opt.price || 0).toFixed(0)} lei
                      </span>
                    )}
                    {selected[mod.id] === opt.id && <span className="mod-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Footer sticky ────────────────────── */}
      <div className="pd-footer">
        <div className="qty-control">
          <button className="qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          <span className="qty-num">{quantity}</span>
          <button className="qty-btn" onClick={() => setQuantity(q => Math.min(20, q + 1))}>+</button>
        </div>
        <button
          className="btn btn-primary btn-xl"
          style={{ flex: 1 }}
          disabled={!allRequiredSelected}
          onClick={handleAdd}
        >
          <span>{t('add_to_cart', lang)}</span>
          <span className="pd-total">{totalPrice.toFixed(0)} {t('lei', lang)}</span>
        </button>
      </div>
    </div>
  );
}
