import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { proxySyrveImage } from '../utils/imageUtils.js';
import { getEffectivePrice } from '../utils/priceUtils.js';
import './ModifierModal.css';

export default function ModifierModal({ product, onConfirm, onClose, activeBrandId }) {
  const lang = useKioskStore(s => s.lang);
  const locationData = useKioskStore(s => s.locationData);
  const menuProducts = useKioskStore(s => s.menuProducts);

  // Filtrare automată a opțiunilor de modificatori pentru a exclude produsele ascunse, anulate sau fără stoc
  const modifierGroups = useMemo(() => {
    const rawGroups = (product?.modifierGroups || []).filter(gm => (gm.options?.length > 0 || gm.items?.length > 0));
    if (!rawGroups.length) return [];

    const activeBrand = activeBrandId || product?._brand || 'smashme';
    const brandOverrides = locationData?.menuOverrides?.[activeBrand] || {};
    const localHidden = brandOverrides.hiddenItems || {};

    const hiddenIds = new Set();
    const hiddenNames = new Set();

    Object.entries(localHidden).forEach(([id, isHid]) => {
      if (isHid === true) hiddenIds.add(id);
    });

    (menuProducts || []).forEach(p => {
      const cleanName = (p.name || '').replace(/^\*+\s*/, '').trim().toLowerCase();
      if (p.isHidden || p.isDeleted || p.outOfStock || localHidden[p.id] === true || localHidden[p.categoryId] === true) {
        hiddenIds.add(p.id);
        if (cleanName) hiddenNames.add(cleanName);
      }
    });

    const isOptionAvailable = (opt) => {
      if (!opt) return false;
      if (opt.outOfStock || opt.isHidden || opt.isDeleted) return false;
      if (hiddenIds.has(opt.id)) return false;
      if (opt._matchedId && hiddenIds.has(opt._matchedId)) return false;
      const cleanOptName = (opt.name || '').replace(/^\*+\s*/, '').trim().toLowerCase();
      if (cleanOptName && hiddenNames.has(cleanOptName)) return false;
      if (/churros|churo/i.test(cleanOptName)) return false;
      return true;
    };

    return rawGroups.map(gm => {
      const opts = (gm.options || gm.items || []).filter(isOptionAvailable);
      return {
        ...gm,
        options: opts,
        items: opts
      };
    }).filter(gm => (gm.options || []).length > 0);
  }, [product, menuProducts, locationData, activeBrandId]);

  // Initialize: auto-select first option for each required group
  const [selected, setSelected] = useState(() => {
    const init = {};
    modifierGroups.forEach(gm => {
      if (gm.required && gm.options.length > 0) {
        init[gm.id] = { [gm.options[0].id]: 1 };
      } else {
        init[gm.id] = {};
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
    const gm = modifierGroups.find(g => g.id === groupId);
    if (!gm) return;
    const max = gm.maxAmount ?? 1;

    setSelected(prev => {
      const groupSel = { ...(prev[groupId] || {}) };
      const currentCount = groupSel[optionId] || 0;
      const groupTotal = Object.values(groupSel).reduce((a, b) => a + b, 0);

      if (max <= 1) {
        if (currentCount > 0 && !gm.required) {
          return { ...prev, [groupId]: {} };
        }
        return { ...prev, [groupId]: { [optionId]: 1 } };
      }

      if (currentCount === 0) {
        if (groupTotal < max) {
          groupSel[optionId] = 1;
        }
      } else {
        if (groupTotal < max) {
          groupSel[optionId] = currentCount + 1;
        }
      }
      return { ...prev, [groupId]: groupSel };
    });
  };

  const handleModifyOptionAmount = (groupId, optionId, delta, e) => {
    if (e) e.stopPropagation();
    const gm = modifierGroups.find(g => g.id === groupId);
    if (!gm) return;
    const max = gm.maxAmount ?? 1;

    setSelected(prev => {
      const groupSel = { ...(prev[groupId] || {}) };
      const currentCount = groupSel[optionId] || 0;
      const groupTotal = Object.values(groupSel).reduce((a, b) => a + b, 0);

      if (delta > 0) {
        if (groupTotal < max) {
          groupSel[optionId] = currentCount + 1;
        }
      } else if (delta < 0) {
        if (currentCount > 1) {
          groupSel[optionId] = currentCount - 1;
        } else {
          delete groupSel[optionId];
        }
      }
      return { ...prev, [groupId]: groupSel };
    });
  };

  const allRequiredSelected = modifierGroups
    .filter(gm => gm.required)
    .every(gm => {
      const groupSel = selected[gm.id] || {};
      const count = Object.values(groupSel).reduce((a, b) => a + b, 0);
      const min = gm.minAmount ?? 1;
      return count >= min;
    });

  const selectedOptionsDiff = modifierGroups.reduce((sum, gm) => {
    const groupSel = selected[gm.id] || {};
    let groupDiff = 0;
    Object.entries(groupSel).forEach(([optId, count]) => {
      if (count > 0) {
        const opt = (gm.options || []).find(o => o.id === optId);
        groupDiff += (opt?.priceDiff || opt?.price || 0) * count;
      }
    });
    return sum + groupDiff;
  }, 0);

  const basePrice = getEffectivePrice(product);
  const totalPrice = basePrice + selectedOptionsDiff;

  const handleConfirm = () => {
    if (!allRequiredSelected) return;
    const selectedModifiers = [];
    modifierGroups.forEach(gm => {
      const groupSel = selected[gm.id] || {};
      Object.entries(groupSel).forEach(([optId, count]) => {
        if (count > 0) {
          const opt = gm.options.find(o => o.id === optId);
          if (opt) {
            selectedModifiers.push({
              modId: gm.id,
              id: opt.id,
              productId: opt.id,
              groupId: gm.id,
              modifierGroupId: gm.id,
              modifierName: gm.name || '',
              optionId: opt.id,
              optionName: opt.name,
              price: opt.priceDiff || opt.price || 0,
              amount: count,
            });
          }
        }
      });
    });

    onConfirm(product, 1, selectedModifiers, totalPrice, activeBrandId);
    setVisible(false);
    setTimeout(onClose, 350);
  };

  return createPortal(
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
            <span className="mm-product-price">{totalPrice.toFixed(2)} {t('currency', lang) || 'lei'}</span>
          </div>
        </div>

        {/* Modifier Groups */}
        <div className="mm-groups-scroll">
          {modifierGroups.map(gm => {
            const min = gm.minAmount ?? 1;
            const max = gm.maxAmount ?? 1;
            const isMulti = max > 1;
            const groupSel = selected[gm.id] || {};
            const groupTotal = Object.values(groupSel).reduce((a, b) => a + b, 0);
            const isGroupValid = !gm.required || groupTotal >= min;

            let reqBadge = null;
            if (gm.required) {
              reqBadge = min === max 
                ? t('choose_exact', lang).replace('{amount}', min)
                : t('choose_min_max', lang).replace('{min}', min).replace('{max}', max);
            }

            return (
              <div key={gm.id} className="mm-group">
                <div className="mm-group-header">
                  <span className="mm-group-name">{gm.name ? gm.name.toUpperCase() : t('options', lang).toUpperCase()}</span>
                  {reqBadge && (
                    <span className={`mm-group-badge ${isMulti && isGroupValid ? 'mm-group-badge--done' : ''}`}>
                      {reqBadge}{isMulti ? ` (${groupTotal}/${max})` : ''}
                    </span>
                  )}
                </div>
                <div className="mm-options-grid">
                  {(gm.options || []).map(opt => {
                    const count = groupSel[opt.id] || 0;
                    const isSelected = count > 0;
                    const canAddMore = groupTotal < max;
                    const isFree = !opt.price || opt.price === 0;
                    return (
                      <button
                        key={opt.id}
                        className={`mm-grid-opt ${isMulti ? 'mm-grid-opt--multi' : ''} ${isSelected ? 'mm-grid-opt--selected' : ''}`}
                        onClick={() => handleSelect(gm.id, opt.id)}
                      >
                        {opt.image && (
                          <img
                            src={proxySyrveImage(opt.image)}
                            alt={opt.name}
                            className="mm-grid-opt-img"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <span className="mm-grid-opt-name">{opt.name}</span>
                        <span className={`mm-grid-opt-price ${isFree ? 'mm-grid-opt-price--free' : ''}`}>
                          {isFree ? (t('included', lang) || 'Inclus') : `+${opt.price.toFixed(2)} ${t('currency', lang) || 'lei'}`}
                        </span>
                        {isSelected && (
                          <span className="mm-grid-opt-check">
                            {isMulti && count > 1 ? `x${count}` : '✓'}
                          </span>
                        )}
                        {isMulti && isSelected && (
                          <div className="mm-mod-stepper" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              className="mm-step-btn mm-step-btn--minus"
                              onClick={e => handleModifyOptionAmount(gm.id, opt.id, -1, e)}
                            >
                              −
                            </button>
                            <span className="mm-step-val">{count}</span>
                            <button
                              type="button"
                              className={`mm-step-btn mm-step-btn--plus ${!canAddMore ? 'mm-step-btn--disabled' : ''}`}
                              onClick={e => handleModifyOptionAmount(gm.id, opt.id, 1, e)}
                              disabled={!canAddMore}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirm button */}
        <div className="mm-footer">
          <button
            className={`mm-confirm-btn ${allRequiredSelected ? 'active' : 'disabled'}`}
            onClick={handleConfirm}
            disabled={!allRequiredSelected}
          >
            <span>{t('add_to_cart', lang) || '+ Adaugă în coș'}</span>
            <span className="mm-confirm-price">{totalPrice.toFixed(2)} {t('currency', lang) || 'lei'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
