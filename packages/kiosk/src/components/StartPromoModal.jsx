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
    bannerDuo: 'OFERTE SPECIALE DE BUN VENIT!',
    save: 'Economisești',
    accept: 'Adaugă Oferta în Coș',
    customize: 'Alege Opțiunile & Vreau Oferta',
    dismiss: 'Vezi tot meniul',
  },
  en: {
    banner: 'SPECIAL WELCOME OFFER!',
    bannerDuo: 'SPECIAL WELCOME OFFERS!',
    save: 'You save',
    accept: 'Add Deal to Cart',
    customize: 'Choose Options & Get Deal',
    dismiss: 'View full menu',
  },
  hu: {
    banner: 'KÜLÖNLEGES ÜDVÖZLŐ AJÁNLAT!',
    bannerDuo: 'KÜLÖNLEGES ÜDVÖZLŐ AJÁNLATOK!',
    save: 'Megtakarítás',
    accept: 'Ajánlat hozzáadása',
    customize: 'Válassz opciókat',
    dismiss: 'Teljes menü megtekintése',
  },
  de: {
    banner: 'SPEZIELLES WILLKOMMENSANGEBOT!',
    bannerDuo: 'SPEZIELLE WILLKOMMENSANGEBOTE!',
    save: 'Sie sparen',
    accept: 'Angebot in den Warenkorb',
    customize: 'Optionen wählen',
    dismiss: 'Gesamtes Menü ansehen',
  },
};

export default function StartPromoModal({
  products: rawProducts,
  product,
  onClose,
  onAccept,
  onInfo,
  lang = 'ro',
  layout = 'carousel',
}) {
  const promoList = useMemo(() => {
    if (Array.isArray(rawProducts) && rawProducts.length > 0) return rawProducts;
    if (product) return [product];
    return [];
  }, [rawProducts, product]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartXRef = useRef(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(520);

  const isMulti = promoList.length > 1;
  const isDuo = layout === 'duo' && isMulti;
  const currentProduct = promoList[currentIndex] || promoList[0];

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto-slide every 6 seconds if carousel mode and multiple products (resets when currentIndex changes)
  useEffect(() => {
    if (!isMulti || isDuo) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i < promoList.length - 1 ? i + 1 : 0));
    }, 6000);
    return () => clearInterval(timer);
  }, [isMulti, isDuo, promoList.length, currentIndex]);

  if (!currentProduct) return null;

  const t = TEXTS[lang] || TEXTS.ro;

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex((i) => (i > 0 ? i - 1 : promoList.length - 1));
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex((i) => (i < promoList.length - 1 ? i + 1 : 0));
  };

  const handleTouchStart = (e) => {
    if (!isMulti || isDuo) return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!isMulti || isDuo || touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    touchStartXRef.current = null;
    if (diff > 35) {
      handleNext();
    } else if (diff < -35) {
      handlePrev();
    }
  };

  const getTranslateX = (idx) => {
    if (!isMulti) return 0;
    const w = containerWidth;
    const cardW = w - 80;
    const step = cardW + 12;
    if (idx === 0) return 16;
    if (idx === promoList.length - 1 && promoList.length > 1) {
      return 64 - (idx * step);
    }
    return 40 - (idx * step);
  };

  const bannerTitle = isDuo
    ? t.bannerDuo
    : isMulti
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
        padding: 20,
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
        @keyframes spmPulseArrow {
          0%, 100% { transform: translateY(-50%) scale(1); }
          50% { transform: translateY(-50%) scale(1.1); box-shadow: 0 6px 20px rgba(238, 59, 36, 0.45); }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: isDuo ? 820 : isMulti ? 540 : 500,
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

        {/* Modal Body: Duo (2 Columns) or Carousel / Single */}
        {isDuo ? (
          /* ─── DUO LAYOUT (2 COLUMNS SIDE-BY-SIDE) ─── */
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {promoList.slice(0, 2).map((item) => {
                const origP = parseFloat(item.price) || 0;
                const promP = parseFloat(item.promoPrice) || 0;
                const sav = Math.max(0, origP - promP);
                const discPct = origP > 0 ? Math.round((sav / origP) * 100) : 0;
                const hasReq = (item.modifierGroups || []).some(
                  (g) => g.required || (g.min && g.min > 0)
                );

                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 22,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                    }}
                  >
                    {item.image && (
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '16 / 11',
                          borderRadius: 16,
                          overflow: 'hidden',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          position: 'relative',
                        }}
                      >
                        <img
                          src={proxySyrveImage(item.image)}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {discPct > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              background: '#EE3B24',
                              color: '#ffffff',
                              padding: '4px 10px',
                              borderRadius: 10,
                              fontWeight: 900,
                              fontSize: '0.82rem',
                              boxShadow: '0 2px 8px rgba(238, 59, 36, 0.4)',
                            }}
                          >
                            -{discPct}%
                          </div>
                        )}
                        {onInfo && (
                          <button
                            type="button"
                            onClick={() => onInfo(item)}
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              border: '1.5px solid rgba(255,255,255,0.9)',
                              background: 'rgba(255,255,255,0.92)',
                              color: '#1e293b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            }}
                            aria-label="Detalii produs"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}

                    <div>
                      <h3
                        style={{
                          fontSize: '1.15rem',
                          fontWeight: 800,
                          color: '#111827',
                          margin: '0 0 4px 0',
                          lineHeight: 1.25,
                        }}
                      >
                        {item.name}
                      </h3>
                      {(item.description || (item.translations && item.translations[lang])) && (
                        <p
                          style={{
                            fontSize: '0.8rem',
                            color: '#64748b',
                            margin: 0,
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {(lang !== 'ro' && item.translations && item.translations[lang])
                            ? item.translations[lang]
                            : item.description}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        background: '#fff5f5',
                        border: '1px solid #fed7d7',
                        borderRadius: 14,
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: '0.95rem',
                            color: '#0f172a',
                            textDecoration: 'line-through',
                            marginRight: 6,
                            fontWeight: 700,
                          }}
                        >
                          {origP.toFixed(2)} lei
                        </span>
                        <span
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 900,
                            color: '#EE3B24',
                          }}
                        >
                          {promP.toFixed(2)} lei
                        </span>
                      </div>
                      {sav > 0 && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            background: '#10b981',
                            padding: '3px 8px',
                            borderRadius: 8,
                          }}
                        >
                          {t.save} {sav.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onAccept(item)}
                      style={{
                        width: '100%',
                        minHeight: 46,
                        background: 'var(--primary, #EE3B24)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 14,
                        fontSize: '0.96rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(238, 59, 36, 0.3)',
                      }}
                    >
                      <span>+</span>
                      <span>{hasReq ? t.customize : t.accept}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                minHeight: 42,
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                color: '#64748b',
                borderRadius: 14,
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.dismiss}
            </button>
          </div>
        ) : (
          /* ─── CAROUSEL LAYOUT WITH VISIBLE CARD PEEK ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 0 16px 0', width: '100%' }}>
            {/* Viewport for carousel */}
            <div
              ref={containerRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              style={{
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                padding: '4px 0',
              }}
            >
              {/* Floating Navigation Arrows */}
              {isMulti && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    style={{
                      position: 'absolute',
                      top: '38%',
                      left: 6,
                      transform: 'translateY(-50%)',
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.95)',
                      background: 'rgba(255, 255, 255, 0.96)',
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                      backdropFilter: 'blur(6px)',
                      zIndex: 10,
                      transition: 'transform 0.15s ease',
                    }}
                    aria-label="Oferta anterioară"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    style={{
                      position: 'absolute',
                      top: '38%',
                      right: 6,
                      transform: 'translateY(-50%)',
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.95)',
                      background: 'rgba(255, 255, 255, 0.96)',
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                      backdropFilter: 'blur(6px)',
                      zIndex: 10,
                      animation: currentIndex === 0 ? 'spmPulseArrow 2s infinite ease-in-out' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                    aria-label="Oferta următoare"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </>
              )}

              {/* Horizontal Sliding Track */}
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  transform: `translateX(${getTranslateX(currentIndex)}px)`,
                  transition: 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)',
                  paddingLeft: isMulti ? 0 : 20,
                  paddingRight: isMulti ? 0 : 20,
                }}
              >
                {promoList.map((item, idx) => {
                  const origP = parseFloat(item.price) || 0;
                  const promP = parseFloat(item.promoPrice) || 0;
                  const sav = Math.max(0, origP - promP);
                  const discPct = origP > 0 ? Math.round((sav / origP) * 100) : 0;
                  const hasReq = (item.modifierGroups || []).some(
                    (g) => g.required || (g.min && g.min > 0)
                  );
                  const isActive = idx === currentIndex;

                  return (
                    <div
                      key={item.id || idx}
                      onClick={() => {
                        if (!isActive) setCurrentIndex(idx);
                      }}
                      style={{
                        flexShrink: 0,
                        width: isMulti ? 'calc(100% - 80px)' : '100%',
                        background: '#ffffff',
                        border: isActive ? '2px solid var(--primary, #EE3B24)' : '1.5px solid #e2e8f0',
                        borderRadius: 22,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        boxShadow: isActive
                          ? '0 12px 28px -6px rgba(238, 59, 36, 0.16), 0 4px 12px rgba(0,0,0,0.06)'
                          : '0 4px 12px rgba(0,0,0,0.04)',
                        opacity: isActive ? 1 : 0.76,
                        transform: isActive ? 'scale(1)' : 'scale(0.96)',
                        transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                        cursor: isActive ? 'default' : 'pointer',
                        position: 'relative',
                      }}
                    >
                      {/* Product Image */}
                      {item.image && (
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '16 / 11',
                            borderRadius: 16,
                            overflow: 'hidden',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            position: 'relative',
                          }}
                        >
                          <img
                            src={proxySyrveImage(item.image)}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />

                          {discPct > 0 && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 10,
                                left: 10,
                                background: '#EE3B24',
                                color: '#ffffff',
                                padding: '5px 12px',
                                borderRadius: 10,
                                fontWeight: 900,
                                fontSize: '0.85rem',
                                boxShadow: '0 3px 10px rgba(238, 59, 36, 0.4)',
                                letterSpacing: '0.4px',
                              }}
                            >
                              -{discPct}%
                            </div>
                          )}

                          {onInfo && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInfo(item);
                              }}
                              style={{
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                border: '1.5px solid rgba(255,255,255,0.9)',
                                background: 'rgba(255,255,255,0.92)',
                                color: '#1e293b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                                zIndex: 2,
                              }}
                              aria-label="Detalii produs"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Product Name & Description */}
                      <div>
                        <h2
                          style={{
                            fontSize: '1.28rem',
                            fontWeight: 800,
                            color: '#111827',
                            margin: '0 0 4px 0',
                            lineHeight: 1.25,
                          }}
                        >
                          {item.name}
                        </h2>
                        {(item.description || (item.translations && item.translations[lang])) && (
                          <p
                            style={{
                              fontSize: '0.82rem',
                              color: '#64748b',
                              margin: 0,
                              lineHeight: 1.4,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {(lang !== 'ro' && item.translations && item.translations[lang])
                              ? item.translations[lang]
                              : item.description}
                          </p>
                        )}
                      </div>

                      {/* Price Block */}
                      <div
                        style={{
                          background: '#fff5f5',
                          border: '1.5px solid #fed7d7',
                          borderRadius: 16,
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: '1.05rem',
                              color: '#0f172a',
                              textDecoration: 'line-through',
                              textDecorationThickness: '2px',
                              marginRight: 8,
                              fontWeight: 700,
                            }}
                          >
                            {origP.toFixed(2)} lei
                          </span>
                          <span
                            style={{
                              fontSize: '1.45rem',
                              fontWeight: 900,
                              color: '#EE3B24',
                              letterSpacing: '-0.3px',
                            }}
                          >
                            {promP.toFixed(2)} lei
                          </span>
                        </div>

                        {sav > 0 && (
                          <span
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              color: '#ffffff',
                              background: '#10b981',
                              padding: '4px 10px',
                              borderRadius: 10,
                              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            {t.save} {sav.toFixed(2)} lei
                          </span>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAccept(item);
                        }}
                        style={{
                          width: '100%',
                          minHeight: 48,
                          background: 'var(--primary, #EE3B24)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 16,
                          fontSize: '1rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(238, 59, 36, 0.3)',
                          transition: 'transform 0.15s ease',
                        }}
                      >
                        <span>+</span>
                        <span>{hasReq ? t.customize : t.accept}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Controls: Dots & Dismiss */}
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {isMulti && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
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

              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '100%',
                  minHeight: 42,
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  color: '#64748b',
                  borderRadius: 14,
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {t.dismiss}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
