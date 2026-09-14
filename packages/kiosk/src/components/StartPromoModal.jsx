import React from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

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
    dismiss: 'Nu, mulțumesc (Mergi la meniu)',
  },
  en: {
    banner: 'SPECIAL WELCOME OFFER!',
    save: 'You save',
    accept: 'Add Deal to Cart',
    customize: 'Choose Options & Get Deal',
    dismiss: 'No, thanks (Go to menu)',
  },
  hu: {
    banner: 'KÜLÖNLEGES ÜDVÖZLŐ AJÁNLAT!',
    save: 'Megtakarítás',
    accept: 'Ajánlat hozzáadása',
    customize: 'Válassz opciókat',
    dismiss: 'Köszönöm, nem (Menü)',
  },
  de: {
    banner: 'SPEZIELLES WILLKOMMENSANGEBOT!',
    save: 'Sie sparen',
    accept: 'Angebot in den Warenkorb',
    customize: 'Optionen wählen',
    dismiss: 'Nein, danke (Zum Menü)',
  },
};

export default function StartPromoModal({ product, onClose, onAccept, onInfo, lang = 'ro' }) {
  if (!product) return null;

  const t = TEXTS[lang] || TEXTS.ro;
  const originalPrice = parseFloat(product.price) || 0;
  const promoPrice = parseFloat(product.promoPrice) || 0;
  const savings = Math.max(0, originalPrice - promoPrice);
  const discountPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

  const hasRequiredMods = (product.modifierGroups || []).some(
    (g) => g.required || (g.min && g.min > 0)
  );

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
                src={`/brands/${product._brand || 'smashme'}-logo.png`}
                alt="Smash Me"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '0.4px' }}>
              {t.banner}
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
          {/* Image */}
          {product.image && (
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
                src={proxySyrveImage(product.image)}
                alt={product.name}
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

              {/* Buton Info pe poză — navighează la pagina produsului */}
              {onInfo && (
                <button
                  type="button"
                  onClick={onInfo}
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
              {product.name}
            </h2>
            {(product.description || (product.translations && product.translations[lang])) && (
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
                {(lang !== 'ro' && product.translations && product.translations[lang])
                  ? product.translations[lang]
                  : product.description}
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
                  fontSize: '0.85rem',
                  color: '#94a3b8',
                  textDecoration: 'line-through',
                  marginRight: 8,
                  fontWeight: 600,
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
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  color: '#059669',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '5px 10px',
                  borderRadius: 10,
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
              onClick={() => onAccept(product)}
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
              <span>{hasRequiredMods ? t.customize : `${t.accept} (${promoPrice.toFixed(2)} lei)`}</span>
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
