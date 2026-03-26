import { useState, useEffect, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { useBrand } from '../context/BrandContext.js';
import { BRANDS, applyBrandTheme } from '../config/brands.js';
import { t, LANGUAGES, LANGUAGE_NAMES, LANGUAGE_FLAGS } from '../i18n/translations.js';
import { io } from 'socket.io-client';
import './WelcomeScreen.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default function WelcomeScreen() {
  const goTo    = useKioskStore((s) => s.goTo);
  const goToMenu= useKioskStore((s) => s.goToMenu);
  const goAfterWelcome = useKioskStore((s) => s.goAfterWelcome);
  const lang    = useKioskStore((s) => s.lang);
  const setLang = useKioskStore((s) => s.setLang);
  const isUnlocking = useKioskStore((s) => s.isUnlocking);
  const brand   = useBrand();
  const [slide, setSlide] = useState(0);
  const slides = brand.welcomeSlides;

  // ─── Poster / Screensaver ────────────────────────────────
  const locationData = useKioskStore((s) => s.locationData);
  const [poster, setPoster] = useState(null);   // { url, type, showLogo }
  const [posterVisible, setPosterVisible] = useState(false);

  useEffect(() => {
    if (locationData && locationData.posterUrl) {
      const detectType = (u) => {
        if (/\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(u)) return 'video';
        if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(u)) return 'image';
        return 'iframe';
      };
      
      setPoster({
        url: locationData.posterUrl,
        type: detectType(locationData.posterUrl),
        showLogo: true // Always show logo based on user requirements for now
      });
      setPosterVisible(true);
    } else {
      setPoster(null);
      setPosterVisible(false);
    }
  }, [locationData]);

  // Slide timer
  useEffect(() => {
    const timer = setInterval(() => setSlide((s) => (s + 1) % slides.length), 3500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const switchBrand = (brandId) => {
    applyBrandTheme(brandId);
    window.location.search = `?brand=${brandId}`;
  };

  // Handle tap on poster — dismiss poster and go to orderType
  const handlePosterTap = () => {
    setPosterVisible(false);
    goAfterWelcome();
  };

const FLAG_GRADIENTS = {
  ro: 'linear-gradient(90deg, #002B7F 33.3%, #FCD116 33.3% 66.6%, #CE1126 66.6%)',
  en: 'linear-gradient(90deg, #012169 0%, #C8102E 100%)',
  fr: 'linear-gradient(90deg, #002395 33.3%, #FFFFFF 33.3% 66.6%, #ED2939 66.6%)',
  hu: 'linear-gradient(180deg, #CE2939 33.3%, #FFFFFF 33.3% 66.6%, #477050 66.6%)',
  ru: 'linear-gradient(180deg, #FFFFFF 33.3%, #0039A6 33.3% 66.6%, #D52B1E 66.6%)',
  uk: 'linear-gradient(180deg, #005BBB 50%, #FFD500 50%)',
  bg: 'linear-gradient(180deg, #FFFFFF 33.3%, #00966E 33.3% 66.6%, #D62612 66.6%)',
  de: 'linear-gradient(180deg, #000000 33.3%, #DD0000 33.3% 66.6%, #FFCE00 66.6%)',
  es: 'linear-gradient(180deg, #AA151B 25%, #F1BF00 25% 75%, #AA151B 75%)',
};

  const useFlagBg = locationData?.langButtonFlagColors === true;
  const baseBtnColor = locationData?.langButtonColor || '#0f172a';
  const btnColor = useFlagBg ? (FLAG_GRADIENTS[lang] || baseBtnColor) : baseBtnColor;
  const btnShadowColor = baseBtnColor;
  const btnTextColor = locationData?.langButtonTextColor || '#ffffff';
  const btnBorderColor = locationData?.langButtonBorderColor || 'transparent';
  const customBtnText = locationData?.langButtonText || '';
  const pos = locationData?.langSelectorPosition || 'after';
  const showLangOnWelcome = pos === 'before' || pos === 'both';
  const allowedLangs = locationData?.languages && locationData.languages.length > 0 ? locationData.languages : LANGUAGES;

  return (
    <div className={`welcome-screen ${isUnlocking ? 'unlocking' : ''}`} onClick={() => goAfterWelcome()}>
      {/* Language selector on welcome screen (if position = before or both) */}
      {showLangOnWelcome && allowedLangs.length > 1 && (
        <div 
          className="poster-langs" 
          onClick={(e) => e.stopPropagation()}
          style={locationData?.langVerticalPosition === 'top' ? { top: '40px', bottom: 'auto' } : { bottom: '40px', top: 'auto' }}
        >
          {allowedLangs.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`poster-lang-btn ${lang === l ? 'active' : ''}`}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px',
                ...(lang !== l && locationData?.langBgColor ? { background: locationData.langBgColor } : {}),
                ...(lang !== l && locationData?.langBorderColor ? { borderColor: locationData.langBorderColor } : {})
              }}
            >
              <img src={`https://flagcdn.com/w40/${LANGUAGE_FLAGS[l]}.png`} alt={l} style={{ width: 24, borderRadius: 3 }} />
              {LANGUAGE_NAMES[l]}
            </button>
          ))}
        </div>
      )}
      {/* ─── POSTER SCREENSAVER (fullscreen overlay) ─── */}
      {posterVisible && poster && (
        <div className="poster-overlay" onClick={(e) => { e.stopPropagation(); handlePosterTap(); }}>
          {poster.type === 'video' ? (
            <video
              src={poster.url}
              className="poster-media"
              autoPlay muted loop playsInline
            />
          ) : poster.type === 'iframe' ? (
            <iframe
              src={poster.url}
              className="poster-iframe"
              title="Promo"
            />
          ) : (
            <img
              src={poster.url}
              alt="Promo"
              className="poster-media"
              onError={() => setPosterVisible(false)}
            />
          )}
          <div className="poster-cta-center">
            
            <div className="poster-brands-glass" onClick={(e) => { e.stopPropagation(); handlePosterTap(); }}>
              {/* Show all brand logos for multibrand locations */}
              {(locationData?.brands?.length > 1 ? locationData.brands : null)?.map(bId => (
                <div key={bId} className="brand-logo-wrapper">
                  <img src={`/brands/${bId}-logo.png`} alt={bId} className="brand-logo-img" onError={(e) => { e.target.style.display='none'; }} />
                </div>
              )) ?? (
                poster.showLogo && (
                  <div className="brand-logo-wrapper">
                    <img src={brand.logoImg || '/brands/smashme-logo.png'} alt="" className="brand-logo-img" />
                  </div>
                )
              )}
            </div>

            <button 
              className="poster-cta-btn-glass" 
              style={{ background: btnColor, color: btnTextColor, borderColor: btnBorderColor, borderWidth: btnBorderColor !== 'transparent' ? '3px' : '0', borderStyle: 'solid', boxShadow: `0 12px 32px ${btnShadowColor}80` }}
              onClick={(e) => { e.stopPropagation(); handlePosterTap(); }}
            >
              <span className="poster-cta-label" style={{ color: btnTextColor }}>{customBtnText || t('start_order', lang)}</span>
            </button>

            <span className="poster-tap-hint">{t('touch_anywhere', lang)}</span>
          </div>
        </div>
      )}

      {/* Animated background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Logo — single or multi-brand */}
      <div className="welcome-logo">
        {(locationData?.brands?.length > 1 ? locationData.brands : [brand.id]).map((bId, idx) => (
          <img
            key={bId}
            src={`/brands/${bId}-logo.png`}
            alt={bId}
            className="logo-img"
            style={{
              height: brand.logoHeight || 72,
              marginLeft: idx > 0 ? 12 : 0,
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))'
            }}
            onError={(e) => { e.target.style.display='none'; }}
          />
        ))}
      </div>

      {/* Promo slides — crossfade */}
      <div className="welcome-promo-wrap">
        {slides.map((s, i) => (
          <div key={i} className={`welcome-promo ${i === slide ? 'promo--active' : ''}`}>
            {s.heroImage ? (
              <img
                src={s.heroImage}
                alt={s.headline}
                className="promo-hero-img"
                onError={(e) => { e.target.style.display='none'; }}
              />
            ) : s.emoji ? (
              <div className="promo-emoji">{s.emoji}</div>
            ) : null}
            <h1 className="promo-headline">{s.headline}</h1>
            <p className="promo-sub">{s.sub}</p>
          </div>
        ))}
        <div className="slide-dots">
          {slides.map((_, i) => (
            <div key={i} className={`dot ${i === slide ? 'dot--active' : ''}`} />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="welcome-cta">
        <button 
          className="cta-button" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: btnColor, color: btnTextColor, borderColor: btnBorderColor, borderWidth: btnBorderColor !== 'transparent' ? '3px' : '0', borderStyle: 'solid', boxShadow: `0 12px 32px ${btnShadowColor}80` }}
          onClick={goAfterWelcome}
        >
          {(locationData?.brands?.length > 1 ? locationData.brands : [brand.id]).map((bId) => (
            <img
              key={bId}
              src={`/brands/${bId}-logo.png`}
              alt={bId}
              style={{ height: 38, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: '2px 8px' }}
              onError={(e) => { e.target.style.display='none'; }}
            />
          ))}
          <span style={{ color: btnTextColor }}>{customBtnText || t('tap_to_order', lang)}</span>
        </button>
      </div>

    </div>
  );
}

