import React, { useState, useEffect, useMemo, useRef } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';

const proxySyrveImage = (url) => {
  if (!url) return null;
  if (url.startsWith('/uploads')) return `${BACKEND}${url}`;
  if (url.startsWith('http')) return url;
  return `${BACKEND}${url}`;
};

const TEXTS = {
  ro: {
    banner: 'OFERTĂ SPECIALĂ DE BUN VENIT!',
    save: 'Economisești',
    accept: 'Adaugă Oferta în Coș',
    customize: 'Alege Opțiunile & Vreau Oferta',
    dismiss: 'Vezi tot meniul',
  },
  en: {
    banner: 'SPECIAL WELCOME OFFER!',
    save: 'You save',
    accept: 'Add Deal to Cart',
    customize: 'Choose Options & Get Deal',
    dismiss: 'View full menu',
  },
  hu: {
    banner: 'KÜLÖNLEGES ÜDVÖZLŐ AJÁNLAT!',
    save: 'Megtakarítás',
    accept: 'Ajánlat hozzáadása',
    customize: 'Válassz opciókat',
    dismiss: 'Teljes menü megtekintése',
  },
  de: {
    banner: 'SPEZIELLES WILLKOMMENSANGEBOT!',
    save: 'Sie sparen',
    accept: 'Angebot in den Warenkorb',
    customize: 'Optionen wählen',
    dismiss: 'Gesamtes Menü ansehen',
  },
};

export default function StartPromoModal({ products: rawProducts, product, onClose, onAccept, onInfo, lang = 'ro' }) {
  const promoList = useMemo(() => {
    if (Array.isArray(rawProducts) && rawProducts.length > 0) return rawProducts;
    if (product) return [product];
    return [];
  }, [rawProducts, product]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartXRef = useRef(null);

  const isMulti = promoList.length > 1;
  const currentProduct = promoList[currentIndex] || promoList[0];

  // Auto-slide every 6 seconds if multiple products
  useEffect(() => {
    if (!isMulti) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i < promoList.length - 1 ? i + 1 : 0));
    }, 6000);
    return () => clearInterval(timer);
  }, [isMulti, promoList.length]);

  if (!currentProduct) return null;

  const t = TEXTS[lang] || TEXTS.ro;
  const originalPrice = parseFloat(currentProduct.price) || 0;
  const promoPrice = parseFloat(currentProduct.promoPrice) || 0;
  const savings = Math.max(0, originalPrice - promoPrice);
  const discountPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

  const hasRequiredMods = (currentProduct.modifierGroups || []).some(
    (g) => g.required || (g.min && g.min > 0)
  );

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex((i) => (i > 0 ? i - 1 : promoList.length - 1));
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex((i) => (i < promoList.length - 1 ? i + 1 : 0));
  };

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    touchStartXRef.current = null;
    if (diff > 45) {
      handleNext();
    } else if (diff < -45) {
      handlePrev();
    }
  };

  const bannerTitle = isMulti 
    ? `${t.banner} (${currentIndex + 1}/${promoList.length})` 
    : t.banner;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'spmFadeIn 0.25s ease-out forwards',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes spmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spmScaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#ffffff',
          borderRadius: 28,
          overflow: 'hidden',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
          animation: 'spmScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Banner */}
        <div
          style={{
            background: 'var(--primary, #EE3B24)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#ffffff',
                border: '2px solid rgba(255, 255, 255, 0.85)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src={`/brands/${currentProduct._brand || 'smashme'}-logo.png`}
                alt="Smash Me"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <span style={{ fontSize: '0.98rem', fontWeight: 900, letterSpacing: '0.4px' }}>
              {bannerTitle}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Image & Carousel Nav */}
          {currentProduct.image && (
            <div
              style={{
                width: '100%',
                aspectRatio: '4 / 3',
                borderRadius: 20,
                overflow: 'hidden',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                position: 'relative',
                boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
              }}
            >
              <img
                key={currentProduct.id}
                src={proxySyrveImage(currentProduct.image)}
                alt={currentProduct.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {discountPercent > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    background: '#EE3B24',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: 12,
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    boxShadow: '0 4px 12px rgba(238, 59, 36, 0.4)',
                    letterSpacing: '0.5px',
                  }}
                >
                  -{discountPercent}%
                </div>
              )}

              {/* Săgeată Înapoi (Stânga) */}
              {isMulti && (
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 10,
                    transform: 'translateY(-50%)',
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.9)',
                    background: 'rgba(255,255,255,0.92)',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 5,
                  }}
                  aria-label="Oferta anterioară"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}

              {/* Săgeată Înainte (Dreapta) */}
              {isMulti && (
                <button
                  type="button"
                  onClick={handleNext}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: 10,
                    transform: 'translateY(-50%)',
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.9)',
                    background: 'rgba(255,255,255,0.92)',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 5,
                  }}
                  aria-label="Oferta următoare"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}

              {/* Buton Info (i) pe poză — deschide pagina originală de produs */}
              {onInfo && (
                <button
                  type="button"
                  onClick={() => onInfo(currentProduct)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.9)',
                    background: 'rgba(255,255,255,0.92)',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                    backdropFilter: 'blur(6px)',
                    transition: 'transform 0.15s ease',
                    zIndex: 4,
                  }}
                  aria-label="Detalii produs"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Dots Indicator */}
          {isMulti && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: -4 }}>
              {promoList.map((p, idx) => (
                <button
                  key={p.id || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    width: currentIndex === idx ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: currentIndex === idx ? 'var(--primary, #EE3B24)' : '#cbd5e1',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                  }}
                  aria-label={`Oferta ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Product Name & Description */}
          <div>
            <h2
              style={{
                fontSize: '1.55rem',
                fontWeight: 800,
                color: '#111827',
                margin: '0 0 6px 0',
                lineHeight: 1.2,
              }}
            >
              {currentProduct.name}
            </h2>
            {(currentProduct.description || (currentProduct.translations && currentProduct.translations[lang])) && (
              <p
                style={{
                  fontSize: '0.88rem',
                  color: '#64748b',
                  margin: 0,
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {(lang !== 'ro' && currentProduct.translations && currentProduct.translations[lang])
                  ? currentProduct.translations[lang]
                  : currentProduct.description}
              </p>
            )}
          </div>

          {/* Price Block */}
          <div
            style={{
              background: '#fff5f5',
              border: '1.5px solid #fed7d7',
              borderRadius: 18,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '1.25rem',
                  color: '#0f172a',
                  textDecoration: 'line-through',
                  textDecorationThickness: '2px',
                  marginRight: 10,
                  fontWeight: 800,
                }}
              >
                {originalPrice.toFixed(2)} lei
              </span>
              <span
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 900,
                  color: '#EE3B24',
                  letterSpacing: '-0.3px',
                }}
              >
                {promoPrice.toFixed(2)} lei
              </span>
            </div>

            {savings > 0 && (
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  background: '#10b981',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                  letterSpacing: '0.2px',
                }}
              >
                {t.save} {savings.toFixed(2)} lei
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => onAccept(currentProduct)}
              style={{
                width: '100%',
                minHeight: 52,
                background: 'var(--primary, #EE3B24)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 18,
                fontSize: '1.1rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(238, 59, 36, 0.35)',
                transition: 'transform 0.15s ease',
              }}
            >
              <span>+</span>
              <span>{hasRequiredMods ? t.customize : t.accept}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                minHeight: 46,
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                color: '#64748b',
                borderRadius: 16,
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              {t.dismiss}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
