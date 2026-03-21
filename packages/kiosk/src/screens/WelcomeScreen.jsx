import { useState, useEffect, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { useBrand } from '../App';
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
  const brand   = useBrand();
  const [slide, setSlide] = useState(0);
  const slides = brand.welcomeSlides;

  // ─── Poster / Screensaver ────────────────────────────────
  const [poster, setPoster] = useState(null);   // { url, type, enabled }
  const [posterVisible, setPosterVisible] = useState(false);
  const socketRef = useRef(null);

  // Fetch poster config from backend
  useEffect(() => {
    const brandId = brand.id || import.meta.env.VITE_BRAND || 'smashme';

    // Try location-specific first, then brand-level
    const fetchPoster = async () => {
      try {
        const locId = new URLSearchParams(window.location.search).get('loc');
        let locData = null;

        // 1. Check specific location settings first
        if (locId) {
          try {
            const rLoc = await fetch(`${BACKEND}/api/locations/${locId}`);
            locData = await rLoc.json();
            if (locData && locData.screensaverUrl) {
              const detectType = (u) => {
                if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return 'video';
                if (/youtube|vimeo|dailymotion/i.test(u)) return 'iframe';
                return 'image';
              };
              setPoster({
                url: locData.screensaverUrl,
                type: detectType(locData.screensaverUrl),
                enabled: true,
                showLogo: locData.showLogoOnScreensaver !== false
              });
              setPosterVisible(true);
              return;
            }
          } catch (e) {
            console.warn('[Poster] Location fetch failed:', e.message);
          }
        }

        // 2. Fallback to generic brand kiosk config
        const keys = [
          import.meta.env.VITE_LOCATION_ID,    // specific kiosk
          `${brandId}-main`,                     // brand main location
          brandId,                               // brand level
        ].filter(Boolean);

        for (const key of keys) {
          const res = await fetch(`${BACKEND}/api/admin/kiosk-config/${key}`);
          const data = await res.json();
          if (data.poster && data.poster.enabled && data.poster.url) {
            setPoster({ ...data.poster, showLogo: true });
            setPosterVisible(true);
            return;
          }
        }
      } catch (e) {
        console.warn('[Poster] Fetch failed:', e.message);
      }
    };

    fetchPoster();

    // Listen for real-time poster updates via Socket.IO
    try {
      const socket = io(BACKEND, { reconnectionAttempts: 3, timeout: 5000 });
      socketRef.current = socket;
      socket.on('poster_updated', ({ brandId: bid, poster: newPoster }) => {
        const myBrand = brand.id || import.meta.env.VITE_BRAND || 'smashme';
        if (bid === myBrand || bid === `${myBrand}-main` || bid === import.meta.env.VITE_LOCATION_ID) {
          if (newPoster && newPoster.enabled && newPoster.url) {
            setPoster({ ...newPoster, showLogo: true });
            setPosterVisible(true);
          } else {
            setPoster(null);
            setPosterVisible(false);
          }
        }
      });
      return () => socket.disconnect();
    } catch (e) {}
  }, [brand.id]);

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

  return (
    <div className="welcome-screen" onClick={() => goAfterWelcome()}>
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
            <button className="poster-cta-round" onClick={(e) => { e.stopPropagation(); handlePosterTap(); }}>
              {poster.showLogo && <img src={brand.logoImg || '/brands/smashme-logo.png'} alt="" className="poster-cta-img" />}
            </button>
            <span className="poster-cta-label">{t('start_order', lang)}</span>
            <span className="poster-tap-hint">{t('touch_anywhere', lang)}</span>
          </div>
        </div>
      )}

      {/* Animated background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Logo */}
      <div className="welcome-logo">
        {brand.logoImg ? (
          <img
            src={brand.logoImg}
            alt={brand.name}
            className="logo-img"
            style={{ height: brand.logoHeight || 72 }}
            onError={(e) => { e.target.style.display='none'; }}
          />
        ) : (
          <div className="logo-icon">{brand.emoji}</div>
        )}
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
        <button className="cta-button">
          {t('tap_to_order', lang)}
        </button>
      </div>

      {/* Dev brand switcher — DEMO ONLY */}
      <div className="brand-switcher" onClick={(e) => e.stopPropagation()}>
        <span className="bs-label">Demo brand:</span>
        {Object.values(BRANDS).map(b => (
          <button
            key={b.id}
            className={`bs-btn ${brand.id === b.id ? 'bs-btn--active' : ''}`}
            onClick={() => switchBrand(b.id)}
          >
            {b.emoji} {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}

