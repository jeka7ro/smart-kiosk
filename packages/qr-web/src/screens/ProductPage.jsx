import { useState } from 'react';
import { useQrStore } from '../store/qrStore.js';
import './ProductPage.css';

export default function ProductPage({ brand }) {
  const product = useQrStore((s) => s.selectedProduct);
  const addToCart = useQrStore((s) => s.addToCart);
  const goTo = useQrStore((s) => s.goTo);

  // FIX: Syrve returns modifierGroups, not modifiers
  const modifiers = product?.modifierGroups || product?.modifiers || [];

  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState(() => {
    const init = {};
    modifiers.forEach(mod => {
      if (mod.required && mod.options?.length > 0) init[mod.id] = mod.options[0].id;
    });
    return init;
  });
  const [imgFailed, setImgFailed] = useState(false);

  if (!product) { goTo('menu'); return null; }

  const diff = modifiers.reduce((s, mod) => {
    const opt = mod.options?.find(o => o.id === selected[mod.id]);
    return s + (opt?.priceDiff || opt?.price || 0);
  }, 0);
  const unitPrice = product.price + diff;
  const total = unitPrice * qty;
  const allRequired = modifiers.filter(m => m.required).every(m => selected[m.id]);

  const catEmojis = {
    'smash-burgers':'🍔','pizza':'🍕','salate':'🥗','deserturi':'🍰','bauturi':'🥤',
    'sm-rolls':'🌀','sm-sets':'🎁','sm-nigiri':'🍣','sm-supe':'🍜','sm-deserturi':'🍡','sm-bauturi':'🍵',
  };

  return (
    <div className="pp-screen">
      {/* Back */}
      <button className="pp-back" onClick={() => goTo('menu')}>
        ← Meniu
      </button>

      {/* Product image */}
      <div className="pp-img-block">
        {product.image && !imgFailed
          ? <img src={product.image} alt={product.name} className="pp-img"
              onError={() => setImgFailed(true)} />
          : <span className="pp-emoji">{catEmojis[product.categoryId] || '🍽️'}</span>
        }
      </div>

      {/* Info */}
      <div className="pp-body">
        {product.badge && <span className="pp-badge">{product.badge}</span>}
        <h1 className="pp-name">{product.name}</h1>
        <p className="pp-desc">{product.description}</p>
        {product.weight && <p className="pp-weight">⚖️ {product.weight}g</p>}

        {/* Modifiers */}
        {modifiers.map(mod => (
          <div key={mod.id} className="pp-modifier">
            <div className="pp-mod-head">
              <span className="pp-mod-name">{mod.name}</span>
              {mod.required && <span className="pp-req">Obligatoriu</span>}
            </div>
            <div className="pp-mod-opts">
              {(mod.options || []).map(opt => (
                <button
                  key={opt.id}
                  className={`pp-opt ${selected[mod.id] === opt.id ? 'active' : ''}`}
                  onClick={() => setSelected(s => ({ ...s, [mod.id]: opt.id }))}
                >
                  <span>{opt.name}</span>
                  {(opt.priceDiff || opt.price) !== 0 && (
                    <span className="pp-opt-price">
                      {(opt.priceDiff || opt.price) > 0 ? '+' : ''}
                      {opt.priceDiff ?? opt.price} lei
                    </span>
                  )}
                  {selected[mod.id] === opt.id && <span className="pp-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sticky-bottom pp-footer">
        <div className="pp-qty">
          <button className="pp-q-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
          <span className="pp-q-num">{qty}</span>
          <button className="pp-q-btn" onClick={() => setQty(q => Math.min(20, q + 1))}>+</button>
        </div>
        <button
          className="btn btn-primary btn-lg"
          style={{ flex: 1 }}
          disabled={!allRequired}
          onClick={() => {
            const mods = modifiers.map(mod => ({
              modifierName: mod.name,
              optionName: mod.options?.find(o => o.id === selected[mod.id])?.name || '',
            })).filter(m => m.optionName);
            addToCart(product, qty, mods, unitPrice);
            goTo('menu');
          }}
        >
          + Adaugă &nbsp;<strong>{total.toFixed(0)} lei</strong>
        </button>
      </div>
    </div>
  );
}
