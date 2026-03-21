import { useState, useRef, useEffect } from 'react';
import { useKioskStore } from '../store/kioskStore';

export default function ProductCard({ product, delay, lang, activeBrand, onQuickAdd, onInfo }) {
  const cardRef = useRef(null);
  const cartItems = useKioskStore((s) => s.cartItems);
  const updateCartItem = useKioskStore((s) => s.updateCartItem);
  const removeFromCart = useKioskStore((s) => s.removeFromCart);

  // Find this product in cart (any variant)
  const cartEntry = cartItems.find(i => i.productId === product.id);
  const cartQty = cartEntry ? cartEntry.quantity : 0;

  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = (e) => {
    e.stopPropagation();
    if (cartQty === 0) {
      onQuickAdd(product, cardRef.current);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 600);
    } else {
      updateCartItem(cartEntry.id, cartQty + 1);
    }
  };

  const handleMinus = (e) => {
    e.stopPropagation();
    if (cartQty <= 1) {
      removeFromCart(cartEntry.id);
    } else {
      updateCartItem(cartEntry.id, cartQty - 1);
    }
  };

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

      {/* Product image — click = open detail if no cart entry, else just add */}
      <div
        className="product-card-body"
        onClick={() => cartQty === 0 ? onQuickAdd(product, cardRef.current) : null}
      >
        <div className="product-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="product-photo"
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

            {/* ─── Inline add-to-cart counter ─── */}
            {cartQty === 0 ? (
              <button
                className={`pc-add-btn ${justAdded ? 'pc-add-btn--pop' : ''}`}
                onClick={handleAdd}
              >+</button>
            ) : (
              <div className="pc-qty-control" onClick={e => e.stopPropagation()}>
                <button className="pc-qty-btn" onClick={handleMinus}>−</button>
                <span className="pc-qty-num">{cartQty}</span>
                <button className="pc-qty-btn" onClick={handleAdd}>+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
