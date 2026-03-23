import { useState, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// Proxy Syrve CDN images through our backend to avoid CORS
export function proxySyrveImage(url) {
  if (!url) return null;
  if (url.includes('storage.cdneu.syrve.com')) {
    return `${BACKEND}/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}


export default function ProductCard({ product, delay, lang, activeBrand, onQuickAdd, onInfo, isFavorited, onToggleFavorite }) {
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
      style={{ animationDelay: `${delay}s`, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', padding: 16, overflow: 'visible' }}
    >
      {/* Top Header: Name and Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500, color: '#111827', width: '70%', lineHeight: 1.2 }}>
          {product.name}
        </h3>
        <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.05rem' }}>
          {product.price}RON
        </span>
      </div>

      {/* Image / Content body */}
      <div 
        className="product-card-body" 
        style={{ flex: 1, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
        onClick={() => cartQty === 0 ? onQuickAdd(product, cardRef.current) : null}
      >
        <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: '#f3f4f6', marginBottom: 12, position: 'relative' }}>
          <button className="product-info-btn" onClick={handleInfoClick} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', color: '#374151', fontSize: '1rem', fontWeight: 'bold', fontStyle: 'italic', fontFamily: 'serif', zIndex: 10 }}>i</button>
          
          {product.image ? (
            <img
              src={proxySyrveImage(product.image)}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.img-fallback').style.display = 'flex'; }}
            />
          ) : null}
          <div className="img-fallback" style={{ width: '100%', height: '100%', display: product.image ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, fontSize: '3rem' }}>🍽️</div>

        </div>

        {product.description && (
           <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#6b7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
             {product.description}
           </p>
        )}
      </div>

      {/* Footer: [ ♡ ] [ Vreau / - N buc. + ] */}
      <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
        <button 
          style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid #e5e7eb', background: isFavorited ? '#fff0f0' : '#fff', color: isFavorited ? '#ef4444' : '#9ca3af', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(product); }}
          title={isFavorited ? 'Scoate din favorite' : 'Salvează'}
        >
          {isFavorited ? '❤️' : '♡'}
        </button>

        {cartQty === 0 ? (
          <button 
            style={{ 
              flex: 1, height: 44, borderRadius: 22, border: 'none', background: '#d32f2f', 
              color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
              boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)'
            }}
            onClick={handleAdd}
          >
            <span>+ Adaugă</span>
            <span>{product.price} lei</span>
          </button>
        ) : (
          <div style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid #fca5a5', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }} onClick={e => e.stopPropagation()}>
            <button style={{ width: 40, height: '100%', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.4rem', fontWeight: 600, cursor: 'pointer' }} onClick={handleMinus}>−</button>
            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>{cartQty} buc.</span>
            <button style={{ width: 40, height: '100%', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.4rem', fontWeight: 600, cursor: 'pointer' }} onClick={handleAdd}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
