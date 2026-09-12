import { useState, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { proxySyrveImage } from '../utils/imageUtils.js';
import { t } from '../i18n/translations.js';
export { proxySyrveImage }; // re-export for backward compat

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
    // 'i' button always opens the full info screen with description + modifiers
    if (onInfo) onInfo();
  };

  // Tapping the card body/image: opens the product info/modifier screen.
  // The '+ Adauga' button handles quick-add.
  const handleCardBodyClick = () => {
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
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500, color: '#111827', width: '100%', lineHeight: 1.2 }}>
          {product.name}
        </h3>
      </div>

        {/* Image / Content body */}
        <div 
          className="product-card-body" 
          style={{ flex: 1, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
          onClick={handleCardBodyClick}
        >
          {product.image ? (
            <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: '#f3f4f6', marginBottom: 12, position: 'relative' }}>
              {product.isFeatured && (
                <div style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '4px 8px',
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  zIndex: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <span>⭐</span>
                  <span>Ofertă</span>
                </div>
              )}
              <button className="product-info-btn" onClick={handleInfoClick} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', color: '#374151', fontSize: '1rem', fontWeight: 'bold', fontStyle: 'italic', fontFamily: 'serif', zIndex: 10 }}>i</button>
              <img
                src={proxySyrveImage(product.image)}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.style.display = 'none'; }}
              />
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {product.isFeatured && (
                <div style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '4px 8px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  textTransform: 'uppercase'
                }}>
                  <span>⭐</span>
                  <span>Ofertă</span>
                </div>
              )}
              <button className="product-info-btn" onClick={handleInfoClick} style={{ width: 32, height: 32, background: '#f3f4f6', border: 'none', borderRadius: '50%', color: '#374151', fontSize: '1rem', fontWeight: 'bold', fontStyle: 'italic', fontFamily: 'serif', marginLeft: 'auto' }}>i</button>
            </div>
          )}

        {product.description && (
           <p 
             style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#6b7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}
             dangerouslySetInnerHTML={{ __html: (lang !== 'ro' && product.translations && product.translations[lang]) ? product.translations[lang] : product.description }}
           />
        )}
      </div>

      {/* Footer: [ ♡ ] [ Vreau / - N buc. + ] */}
      <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
        <button 
          style={{ 
            width: 44, 
            height: 44, 
            borderRadius: '50%', 
            border: '1.5px solid #e2e8f0', 
            background: isFavorited ? '#fff0f0' : '#ffffff', 
            color: isFavorited ? '#EE3B24' : '#64748b', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer', 
            flexShrink: 0, 
            transition: 'all 0.2s',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(product); }}
          title={isFavorited ? 'Scoate din favorite' : 'Salvează'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorited ? '#EE3B24' : 'none'} stroke={isFavorited ? '#EE3B24' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {cartQty === 0 ? (
          <button 
            style={{ 
              flex: 1, height: 44, borderRadius: 22, border: 'none', background: '#d32f2f', 
              color: '#fff', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px',
              gap: 6, overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)'
            }}
            onClick={handleAdd}
          >
            <span style={{ flexShrink: 0 }}>{t('add_to_cart', lang) || '+ Adaugă'}</span>
            {(() => {
              const now = new Date();
              const hasPromo = product.promoPrice && product.promoPrice > 0
                && (!product.promoStart || new Date(product.promoStart) <= now)
                && (!product.promoEnd || new Date(product.promoEnd) >= now);
              const currency = t('currency', lang) || 'lei';
              if (hasPromo) {
                return (
                  <span style={{ flexShrink: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.75)', fontWeight: 500, fontSize: '0.85rem' }}>{product.price} {currency}</span>
                    <span style={{ color: '#fff' }}>{product.promoPrice} {currency}</span>
                  </span>
                );
              }
              return <span style={{ flexShrink: 0, fontWeight: 800 }}>{product.price} {currency}</span>;
            })()}
          </button>
        ) : (
          <div style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid #fca5a5', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }} onClick={e => e.stopPropagation()}>
            <button style={{ width: 40, height: '100%', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.4rem', fontWeight: 600, cursor: 'pointer' }} onClick={handleMinus}>−</button>
            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>{cartQty} {t('pcs', lang) || 'buc.'}</span>
            <button style={{ width: 40, height: '100%', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.4rem', fontWeight: 600, cursor: 'pointer' }} onClick={handleAdd}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
