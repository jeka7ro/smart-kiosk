import { useState, useEffect } from 'react';
import { proxySyrveImage } from '../utils/imageUtils.js';
import './ModifierModal.css';

export default function ModifierModal({ product, onConfirm, onClose, activeBrandId }) {
  const modifierGroups = (product?.modifierGroups || []).filter(gm => gm.options?.length > 0);

  // Initialize: auto-select first option for each required group
  const [selected, setSelected] = useState(() => {
    const init = {};
    modifierGroups.forEach(gm => {
      if (gm.required && gm.options.length > 0) {
        init[gm.id] = gm.options[0].id;
      }
    });
    return init;
  });

  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 350);
  };

  const handleSelect = (groupId, optionId) => {
    setSelected(prev => ({ ...prev, [groupId]: optionId }));
  };

  const allRequiredSelected = modifierGroups
    .filter(gm => gm.required)
    .every(gm => selected[gm.id]);

  const selectedOptionsDiff = modifierGroups.reduce((sum, gm) => {
    const opt = (gm.options || []).find(o => o.id === selected[gm.id]);
    return sum + (opt?.price || 0);
  }, 0);

  const totalPrice = (product?.price || 0) + selectedOptionsDiff;

  const handleConfirm = () => {
    if (!allRequiredSelected) return;
    const selectedModifiers = modifierGroups.map(gm => {
      const opt = gm.options.find(o => o.id === selected[gm.id]);
      return opt ? { modifierGroupId: gm.id, modifierName: gm.name || '', optionId: selected[gm.id], optionName: opt.name } : null;
    }).filter(Boolean);

    onConfirm(product, 1, selectedModifiers, totalPrice, activeBrandId);
    setVisible(false);
    setTimeout(onClose, 350);
  };

  return (
    <div className={`modifier-modal-overlay ${visible ? 'visible' : ''}`} onClick={handleClose}>
      <div className={`modifier-modal-sheet ${visible ? 'visible' : ''}`} onClick={e => e.stopPropagation()}>
        {/* Handle bar */}
        <div className="mm-handle" />

        {/* Product header */}
        <div className="mm-header">
          {product?.image && (
            <img 
              src={proxySyrveImage(product.image)} 
              alt={product?.name}
              className="mm-product-img"
              onError={e => { e.target.style.display = 'none'; }}
            />
          )}
          <div className="mm-product-info">
            <h2 className="mm-product-name">{product?.name}</h2>
            <span className="mm-product-price">{totalPrice.toFixed(2)} lei</span>
          </div>
        </div>

        {/* Modifier Groups */}
        <div className="mm-groups-scroll">
          {modifierGroups.map(gm => (
            <div key={gm.id} className="mm-group">
              <div className="mm-group-header">
                <span className="mm-group-name">{gm.name ? gm.name.toUpperCase() : 'OPȚIUNI'}</span>
                {gm.required && (
                  <span className="mm-group-badge">
                    Alege {gm.minAmount ?? 1}–{gm.maxAmount ?? 1}
                  </span>
                )}
              </div>
              <div className="mm-options">
                {(gm.options || []).map(opt => {
                  const isSelected = selected[gm.id] === opt.id;
                  const isFree = !opt.price || opt.price === 0;
                  return (
                    <button
                      key={opt.id}
                      className={`mm-option ${isSelected ? 'mm-option--selected' : ''}`}
                      onClick={() => handleSelect(gm.id, opt.id)}
                    >
                      {opt.image && (
                        <img 
                          src={proxySyrveImage(opt.image)} 
                          alt={opt.name}
                          className="mm-opt-img"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <span className="mm-opt-name">{opt.name}</span>
                      <span className={`mm-opt-price ${isFree ? 'mm-opt-price--free' : ''}`}>
                        {isFree ? 'Inclus' : `+${opt.price.toFixed(2)} lei`}
                      </span>
                      <div className={`mm-opt-check ${isSelected ? 'checked' : ''}`}>
                        {isSelected && <span>✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Confirm button */}
        <div className="mm-footer">
          <button
            className={`mm-confirm-btn ${allRequiredSelected ? 'active' : 'disabled'}`}
            onClick={handleConfirm}
            disabled={!allRequiredSelected}
          >
            <span>+ Adaugă în coș</span>
            <span className="mm-confirm-price">{totalPrice.toFixed(2)} lei</span>
          </button>
        </div>
      </div>
    </div>
  );
}
