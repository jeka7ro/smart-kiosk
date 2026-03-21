import { useState, useRef } from 'react';

export default function ProductCard({ product, delay, lang, activeBrand, onQuickAdd, onInfo }) {
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef(null);

  // Stop propagation on Info button so it doesn't trigger Add to Cart
  const handleInfoClick = (e) => {
    e.stopPropagation();
    if (onInfo) onInfo();
  };

  return (
    <div
      ref={cardRef}
      className={`product-card fade-in`}
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Info button (absolute top-right) */}
      <button className="product-info-btn" onClick={handleInfoClick}>i</button>

      {/* Main card — click = add to cart */}
      <div className="product-card-body" onClick={() => onQuickAdd(product, cardRef.current)}>
        <div className="product-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
          {product.image && !imgError ? (
            <img
              src={product.image}
              alt={product.name}
              className="product-photo"
              onError={() => setImgError(true)}
            />
          ) : (
            <div style={{ opacity: 0.1, fontSize: '3rem' }}>🍽️</div>
          )}
        </div>
        <div className="product-info">
          {product.badge && <span className="product-badge">{product.badge}</span>}
          <h3 className="product-name">{product.name}</h3>
          <p className="product-desc">{product.description}</p>
          <div className="product-footer">
            <span className="price price-lg">{product.price} lei</span>
            <span className="add-icon">➕</span>
          </div>
        </div>
      </div>
    </div>
  );
}
