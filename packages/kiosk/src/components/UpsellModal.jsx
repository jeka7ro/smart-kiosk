import React, { useState, useMemo } from 'react';
import { proxySyrveImage } from '../utils/imageUtils.js';
import './UpsellModal.css';

const TABS = [
  { id: 'all', label: 'Toate' },
  { id: 'sauces', label: 'Sosuri' },
  { id: 'sides', label: 'Garnituri' },
  { id: 'drinks', label: 'Băuturi' },
  { id: 'desserts', label: 'Deserturi' }
];

function categorizeItem(p) {
  const name = (p.name || '').toLowerCase();
  const cat = (p.categoryName || '').toLowerCase();
  const text = `${name} ${cat}`;

  if (/sos|sauce|ketchup|mayo|maionez|dip|aioli|wasabi|ghimbir|ginger|soia|sweet chili/i.test(text)) {
    return 'sauces';
  }
  if (/bautur|drink|cola|pepsi|apa|apă|water|fanta|sprite|fuze|ceai|tea|bere|beer|shake|smoothie|limonad|lemonade|suc|juice|ayran|mirinda/i.test(text)) {
    return 'drinks';
  }
  if (/desert|dessert|muffin|prajit|prăjitur|cake|inghetat|înghețat|sundae|clatit|clătit|donut|mochi|tiramisu|brownie|cheesecake|cookie/i.test(text)) {
    return 'desserts';
  }
  if (/cartof|fries|potato|wedges|inel|onion|porumb|corn|salat|coleslaw|miso|edamame/i.test(text)) {
    return 'sides';
  }
  return 'sides';
}

export default function UpsellModal({
  candidates = [],
  onConfirm = () => {},
  onSkip = () => {},
  lang = 'ro'
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [quantities, setQuantities] = useState({});

  // Categorize candidates
  const categorized = useMemo(() => {
    return candidates.map(p => ({
      product: p,
      categoryGroup: categorizeItem(p)
    }));
  }, [candidates]);

  // Filter by active tab
  const displayedItems = useMemo(() => {
    if (activeTab === 'all') return categorized;
    return categorized.filter(item => item.categoryGroup === activeTab);
  }, [categorized, activeTab]);

  // Compute totals
  const { totalCount, totalSum, selectedList } = useMemo(() => {
    let count = 0;
    let sum = 0;
    const list = [];

    Object.entries(quantities).forEach(([prodId, qty]) => {
      if (qty > 0) {
        const item = candidates.find(c => c.id === prodId);
        if (item) {
          count += qty;
          sum += (Number(item.price) || 0) * qty;
          list.push({ product: item, quantity: qty });
        }
      }
    });

    return { totalCount: count, totalSum: sum, selectedList: list };
  }, [quantities, candidates]);

  const handleIncrement = (prodId) => {
    setQuantities(prev => ({
      ...prev,
      [prodId]: (prev[prodId] || 0) + 1
    }));
  };

  const handleDecrement = (prodId) => {
    setQuantities(prev => {
      const cur = prev[prodId] || 0;
      if (cur <= 1) {
        const next = { ...prev };
        delete next[prodId];
        return next;
      }
      return { ...prev, [prodId]: cur - 1 };
    });
  };

  const handleFinalConfirm = () => {
    if (totalCount > 0) {
      onConfirm(selectedList);
    } else {
      onSkip();
    }
  };

  return (
    <div className="upsell-backdrop" onClick={onSkip}>
      <div className="upsell-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="upsell-header">
          <div className="upsell-header-text">
            <h2 className="upsell-title">DORIȚI ȘI...</h2>
            <p className="upsell-subtitle">Adaugă un sos, o garnitură sau o băutură rece la comanda ta</p>
          </div>
          <button 
            type="button" 
            className="upsell-close-btn" 
            onClick={onSkip}
            title="Închide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="upsell-tabs">
          {TABS.map(tab => {
            const count = tab.id === 'all' 
              ? categorized.length 
              : categorized.filter(c => c.categoryGroup === tab.id).length;

            if (count === 0 && tab.id !== 'all') return null;

            return (
              <button
                key={tab.id}
                type="button"
                className={`upsell-tab-btn ${activeTab === tab.id ? 'upsell-tab-btn--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                <span className="upsell-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Grid of Products */}
        <div className="upsell-grid-container">
          {displayedItems.length === 0 ? (
            <div className="upsell-empty">
              Nu sunt produse disponibile în această categorie.
            </div>
          ) : (
            <div className="upsell-grid">
              {displayedItems.map(({ product }) => {
                const qty = quantities[product.id] || 0;
                const isSelected = qty > 0;
                const priceFormatted = Number(product.price || 0).toFixed(2);

                return (
                  <div 
                    key={product.id} 
                    className={`upsell-card ${isSelected ? 'upsell-card--selected' : ''}`}
                  >
                    {/* Media */}
                    <div className="upsell-card-media" onClick={() => handleIncrement(product.id)}>
                      {product.image ? (
                        <img 
                          src={proxySyrveImage(product.image)} 
                          alt={product.name} 
                          className="upsell-card-img"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="upsell-card-placeholder" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="upsell-card-info" onClick={() => handleIncrement(product.id)}>
                      <h4 className="upsell-card-name" title={product.name}>
                        {product.name}
                      </h4>
                      <div className="upsell-card-price">
                        +{priceFormatted} lei
                      </div>
                    </div>

                    {/* Stepper on Card */}
                    <div className="upsell-card-action">
                      {qty === 0 ? (
                        <button
                          type="button"
                          className="upsell-add-btn"
                          onClick={() => handleIncrement(product.id)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          <span>Adaugă</span>
                        </button>
                      ) : (
                        <div className="upsell-stepper">
                          <button
                            type="button"
                            className="upsell-step-btn upsell-step-minus"
                            onClick={() => handleDecrement(product.id)}
                          >
                            -
                          </button>
                          <span className="upsell-step-val">{qty}</span>
                          <button
                            type="button"
                            className="upsell-step-btn upsell-step-plus"
                            onClick={() => handleIncrement(product.id)}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="upsell-footer">
          <button
            type="button"
            className="upsell-btn-skip"
            onClick={onSkip}
          >
            NU, MULȚUMESC
          </button>

          <button
            type="button"
            className="upsell-btn-confirm"
            onClick={handleFinalConfirm}
          >
            <span>
              {totalCount > 0 
                ? `ADAUGĂ ÎN COȘ (+${totalSum.toFixed(2)} LEI)` 
                : 'CONTINUĂ SPRE PLATĂ'}
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
