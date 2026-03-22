import { useState, useMemo, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useBrand } from '../App.jsx';
import ProductCard from '../components/ProductCard.jsx';
import './ProductScreen.css';

export default function ProductScreen() {
  const product       = useKioskStore((s) => s.selectedProduct);
  const addToCart     = useKioskStore((s) => s.addToCart);
  const goTo          = useKioskStore((s) => s.goTo);
  const lang          = useKioskStore((s) => s.lang);
  const menuProducts  = useKioskStore((s) => s.menuProducts);
  const setSelectedProduct = useKioskStore((s) => s.setSelectedProduct);
  const brand = useBrand();

  const modifiers = product?.modifierGroups || product?.modifiers || [];
  const allergens = product?.allergenGroups || product?.allergens || [];

  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [flyAnim, setFlyAnim]   = useState(null);
  const cartIconRef = useRef(null);

  const [selected, setSelected] = useState(() => {
    const init = {};
    const mods = product?.modifierGroups || product?.modifiers || [];
    mods.forEach(mod => {
      const opts = mod.options || mod.items || [];
      if (mod.required && opts.length > 0) init[mod.id] = opts[0].id;
    });
    return init;
  });

  const suggestions = useMemo(() => {
    if (!product) return [];
    const COMPLEMENT_KEYWORDS = /sos|sauce|bautur|drink|desert|dessert|cartof|fries|soup|supă|salat|miso|ceai|tea/i;
    const others = menuProducts.filter(p => p.id !== product.id && p.price > 0);
    const scored = others.map(p => ({
      ...p,
      _score: (COMPLEMENT_KEYWORDS.test(p.name) ? 2 : 0) + (p.image ? 1 : 0)
    }));
    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, 6);
  }, [product, menuProducts]);

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

    addToCart(product, quantity, selectedModifiers, unitPrice, brand?.id);
    goTo('menu');
  };

  const handleQuickAddSug = (sugProd, refElem) => {
    addToCart(sugProd, 1, [], sugProd.price, brand?.id);
    if (!refElem || !cartIconRef.current) return;
    const fromRect = refElem.getBoundingClientRect();
    const toRect = cartIconRef.current.getBoundingClientRect();
    setFlyAnim({
      img: sugProd.image,
      startX: fromRect.left + fromRect.width / 2,
      startY: fromRect.top + fromRect.height / 2,
      endX: toRect.left + toRect.width / 2,
      endY: toRect.top + toRect.height / 2,
    });
    setTimeout(() => { setFlyAnim(null); }, 850);
  };

  const allergenLabels = allergens.map(a =>
    typeof a === 'string' ? a : (a.name || a.id || '')
  ).filter(Boolean);

  return (
    <div className="product-screen">
      {/* ─── LEFT PANEL (1/3) ─── */}
      <div className="ps-left">
        <button className="back-btn-ps" onClick={() => goTo('menu')}>
          ← {t('back', lang)} 
        </button>

        <div className="ps-left-content scroll-y">
          <div className="pd-hero-img" style={imgError || !product.image ? {background: 'var(--surface)'} : {}}>
            {product.image && !imgError ? (
              <img
                src={product.image}
                alt={product.name}
                className="pd-photo"
                onError={() => setImgError(true)}
              />
            ) : (
              <img src={`/brands/${brand?.id || 'smashme'}-logo.png`} style={{ opacity: 0.15, filter: 'grayscale(100%)', width: '50%', objectFit: 'contain' }} alt="" />
            )}
          </div>

          <div className="pd-hero-info">
            {product.badge && <span className="product-badge">{product.badge}</span>}
            <h1 className="pd-name">{product.name}</h1>
            <p className="pd-desc">{product.description}</p>
            {product.weight && <span className="pd-weight">⚖️ {product.weight}g</span>}
            {product.energyAmount && <span className="pd-calories">🔥 {Math.round(product.energyAmount)} kcal</span>}
            {allergenLabels.length > 0 && (
              <div className="pd-allergens">
                <span className="pd-allergen-label">⚠️ Alergeni:</span>
                {allergenLabels.map(a => (<span key={a} className="allergen-tag">{a}</span>))}
              </div>
            )}
          </div>

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

      {/* ─── RIGHT PANEL (2/3) ─── */}
      <div className="ps-right scroll-y">
        <div className="suggestions-header" style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid var(--border)' }}>
           <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#111827', margin: '0 0 8px 0' }}>Recomandări Pentru Tine 🔥</h2>
           <p style={{ fontSize: '1.2rem', color: '#4b5563', margin: 0 }}>Ce s-ar mai potrivi cu comanda ta de astăzi?</p>
        </div>
        
        {suggestions.length > 0 ? (
          <div className="suggestions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {suggestions.map((sug, i) => (
               <ProductCard 
                 key={sug.id} 
                 product={sug} 
                 delay={i * 0.05} 
                 lang={lang} 
                 activeBrand={brand?.id || 'smashme'} 
                 onQuickAdd={(p, ref) => handleQuickAddSug(p, ref)}
                 onInfo={() => setSelectedProduct(sug)} 
               />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🍽️</div>
            <h3 style={{ color: '#111827', fontSize: '1.4rem' }}>Fără recomandări momentan.</h3>
          </div>
        )}
      </div>

      {/* Invisible cart target for animations in right panel */}
      <div ref={cartIconRef} style={{ position: 'fixed', bottom: 16, right: 16, opacity: 0, pointerEvents: 'none' }} />

      {/* FLY ANIMATION */}
      {flyAnim && (
        <div 
          className="fly-thumb"
          style={{
            '--fly-sx': `${flyAnim.startX}px`,
            '--fly-sy': `${flyAnim.startY}px`,
            '--fly-ex': `${flyAnim.endX}px`,
            '--fly-ey': `${flyAnim.endY}px`,
          }}
        >
          {flyAnim.img && <img src={flyAnim.img} alt="" />}
        </div>
      )}
    </div>
  );
}
