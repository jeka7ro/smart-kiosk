import { useState, useEffect, useMemo, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { useBrand } from '../context/BrandContext.js';
import { BRANDS, applyBrandTheme } from '../config/brands.js';
import { t, LANGUAGES, LANGUAGE_NAMES, LANGUAGE_FLAGS } from '../i18n/translations.js';
import { io } from 'socket.io-client';
import './WelcomeScreen.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';

export default function WelcomeScreen() {
  const goTo    = useKioskStore((s) => s.goTo);
  const goToMenu= useKioskStore((s) => s.goToMenu);
  const goAfterWelcome = useKioskStore((s) => s.goAfterWelcome);
  const lang    = useKioskStore((s) => s.lang);
  const setLang = useKioskStore((s) => s.setLang);
  const isUnlocking = useKioskStore((s) => s.isUnlocking);
  const screen      = useKioskStore((s) => s.screen);
  const brand   = useBrand();
  const locationData = useKioskStore((s) => s.locationData);
  const [slide, setSlide] = useState(0);
  const slides = locationData?.brands?.length > 1 
    ? [{ headline: 'Bine ați venit!', sub: 'Alegeți restaurantul preferat', emoji: '🍽️' }]
    : brand.welcomeSlides;

  // ─── Poster / Screensaver ────────────────────────────────
  const [poster, setPoster] = useState(null);   // { url, type, showLogo }
  const [posterVisible, setPosterVisible] = useState(!!locationData?.posterUrl);

  useEffect(() => {
    if (locationData && locationData.posterUrl) {
      const detectType = (u) => {
        if (/\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(u)) return 'video';
        if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(u)) return 'image';
        return 'iframe'; // Default to iframe to support arbitrary web pages, Canva links, and interactive promos
      };
      
      let finalUrl = locationData.posterUrl;
      if (finalUrl && finalUrl.startsWith('/uploads')) {
        finalUrl = `${BACKEND}${finalUrl}`;
      }
      
      let rotation = locationData.posterRotation || 0;
      if (finalUrl.includes('rotate=true') || finalUrl.includes('#rotate')) {
        rotation = 90;
      }
      
      setPoster({
        url: finalUrl,
        type: detectType(finalUrl),
        showLogo: true, // Always show logo based on user requirements for now
        rotation
      });
      setPosterVisible(true);
    } else {
      setPoster(null);
      setPosterVisible(false);
    }
  }, [locationData]);

  // Ensure poster comes back EVERY time we return to welcome screen
  useEffect(() => {
    if (screen === 'welcome' && locationData?.posterUrl) {
      // Small delay to ensure React state is fully settled after screen transition
      const t = setTimeout(() => setPosterVisible(true), 50);
      return () => clearTimeout(t);
    }
  }, [screen, locationData?.posterUrl]);

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

  // ─── Live POS Bridge (start.bat) status indicator ────────────────────────
  const [bridgeStatus, setBridgeStatus] = useState(null);
  const [showBridgeModal, setShowBridgeModal] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const urlLoc = new URLSearchParams(window.location.search).get('loc');
    const locKey = locationData?.kioskUrl || locationData?.id || urlLoc || 'sm-brasov';

    const checkBridge = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/bridge-monitoring/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        const locs = data?.locations || {};
        let matched = locs[locKey];
        if (!matched) {
          for (const [k, v] of Object.entries(locs)) {
            if (
              (locKey.includes('brasov') && k.includes('brasov')) ||
              (locKey.includes('cluj1') && k === 'cluj1') ||
              (locKey.includes('cluj2') && k === 'cluj2') ||
              (locKey.includes('constanta') && k.includes('constanta'))
            ) {
              matched = v;
              break;
            }
          }
        }

        if (matched) {
          setBridgeStatus({
            isOnline: Boolean(matched.status === 'online' || matched.isBridgeOnline),
            port: matched.port || 'N/A',
            printerName: matched.printerName || 'N/A',
            gateway: matched.gateway || 'raiffeisen',
            lastPingSecondsAgo: matched.lastPingSecondsAgo,
            locationId: matched.locationId || locKey,
            serverUrl: BACKEND.replace(/^https?:\/\//, '')
          });
        }
      } catch (_) {}
    };

    checkBridge();
    const interval = setInterval(checkBridge, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [locationData?.id, locationData?.kioskUrl]);

const FLAG_GRADIENTS = {
  ro: 'linear-gradient(90deg, #002B7F 33.3%, #FCD116 33.3% 66.6%, #CE1126 66.6%)',
  en: 'center/cover no-repeat url("https://flagcdn.com/w320/gb.png")',
  fr: 'linear-gradient(90deg, #002395 33.3%, #FFFFFF 33.3% 66.6%, #ED2939 66.6%)',
  hu: 'linear-gradient(180deg, #CE2939 33.3%, #FFFFFF 33.3% 66.6%, #477050 66.6%)',
  ru: 'linear-gradient(180deg, #FFFFFF 33.3%, #0039A6 33.3% 66.6%, #D52B1E 66.6%)',
  uk: 'linear-gradient(180deg, #005BBB 50%, #FFD500 50%)',
  bg: 'linear-gradient(180deg, #FFFFFF 33.3%, #00966E 33.3% 66.6%, #D62612 66.6%)',
  de: 'linear-gradient(180deg, #000000 33.3%, #DD0000 33.3% 66.6%, #FFCE00 66.6%)',
  es: 'linear-gradient(180deg, #AA151B 25%, #F1BF00 25% 75%, #AA151B 75%)',
};

  const isHalloweenActive = useMemo(() => {
    const setting = locationData?.halloweenButtonTheme || 'auto';
    if (setting === 'on') return true;
    if (setting === 'off') return false;
    // 'auto' calendar: activ automat între 23 Octombrie și 3 Noiembrie
    const now = new Date();
    const month = now.getMonth(); // 9 = Octombrie, 10 = Noiembrie
    const day = now.getDate();
    return (month === 9 && day >= 23) || (month === 10 && day <= 3);
  }, [locationData?.halloweenButtonTheme]);

  const useFlagBg = locationData?.langButtonFlagColors === true;
  const baseBtnColor = locationData?.langButtonColor || '#0f172a';
  const defaultBtnColor = useFlagBg ? (FLAG_GRADIENTS[lang] || baseBtnColor) : baseBtnColor;
  const btnColor = isHalloweenActive 
    ? 'linear-gradient(135deg, #ff6b00 0%, #d82613 40%, #7928ca 85%, #4c1d95 100%)' 
    : defaultBtnColor;
  const btnShadowColor = isHalloweenActive ? '#ff6b00' : baseBtnColor;
  const btnTextColor = locationData?.langButtonTextColor || '#ffffff';
  const btnBorderColor = isHalloweenActive ? '#f97316' : (locationData?.langButtonBorderColor || 'transparent');
  const customBtnText = locationData?.langButtonText || '';
  const pos = locationData?.langSelectorPosition || 'after';
  const showLangOnWelcome = pos === 'before' || pos === 'both';
  const allowedLangs = locationData?.languages && locationData.languages.length > 0 ? locationData.languages : LANGUAGES;
  // Renders the poster media with correct rotation.
  // For iframe with 90/270deg: we need a wrapper DIV that is the size of the PORTRAIT screen,
  // but the iframe inside is rendered in LANDSCAPE dimensions and then rotated+scaled to fit.
  const renderPosterMedia = () => {
    const r = poster?.rotation || 0;
    const baseImgStyle = { position: 'absolute', top: 0, left: 0, zIndex: 1, width: '100%', height: '100%', objectFit: 'cover', display: 'block' };

    if (r === 0) {
      if (poster.type === 'video') return <video src={poster.url} autoPlay loop muted playsInline style={baseImgStyle} onError={() => setPosterVisible(false)} />;
      if (poster.type === 'image') return <img src={poster.url} alt="Promo" style={baseImgStyle} onError={() => setPosterVisible(false)} />;
      return <iframe src={poster.url} style={{ ...baseImgStyle, border: 'none' }} title="Promo" frameBorder="0" allow="autoplay; fullscreen" />;
    }

    if (r === 90 || r === 270) {
      // The iframe/image will be landscape. We put it in a wrapper the size of the screen,
      // then scale+rotate the inner element so it fills the portrait screen.
      const wrapStyle = {
        position: 'absolute', top: 0, left: 0,
        width: '100vw', height: '100vh',
        overflow: 'hidden',
        zIndex: 1,
      };
      // Inner is rendered at 100vh wide x 100vw tall (landscape), then rotated.
      // translateX shifts it to align after rotation.
      const innerStyle = {
        position: 'absolute',
        width: '100vh',
        height: '100vw',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) rotate(${r}deg)`,
        border: 'none',
        objectFit: 'cover',
      };
      if (poster.type === 'video') return <div style={wrapStyle}><video src={poster.url} autoPlay loop muted playsInline style={innerStyle} onError={() => setPosterVisible(false)} /></div>;
      if (poster.type === 'image') return <div style={wrapStyle}><img src={poster.url} alt="Promo" style={innerStyle} onError={() => setPosterVisible(false)} /></div>;
      return <div style={wrapStyle}><iframe src={poster.url} style={innerStyle} title="Promo" frameBorder="0" allow="autoplay; fullscreen" /></div>;
    }

    // 180deg
    if (poster.type === 'video') return <video src={poster.url} autoPlay loop muted playsInline style={{ ...baseImgStyle, transform: 'rotate(180deg)' }} onError={() => setPosterVisible(false)} />;
    if (poster.type === 'image') return <img src={poster.url} alt="Promo" style={{ ...baseImgStyle, transform: 'rotate(180deg)' }} onError={() => setPosterVisible(false)} />;
    return <iframe src={poster.url} style={{ ...baseImgStyle, border: 'none', transform: 'rotate(180deg)' }} title="Promo" frameBorder="0" allow="autoplay; fullscreen" />;
  };

  return (
    <div className={`welcome-screen ${isUnlocking ? 'unlocking' : ''}`} onClick={() => goAfterWelcome()}>
      {/* Language selector on welcome screen (if position = before or both) */}
      {showLangOnWelcome && allowedLangs.length > 1 && (
        <div 
          className="poster-langs" 
          onClick={(e) => e.stopPropagation()}
          style={{
            ...(locationData?.langVerticalPosition === 'top' ? { top: '40px', bottom: 'auto' } : { bottom: '40px', top: 'auto' }),
            ...(locationData?.langBarBg ? { background: locationData.langBarBg } : {}),
          }}
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
          {renderPosterMedia()}
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
              className={`poster-cta-btn-glass ${isHalloweenActive ? 'btn-halloween-glow' : ''}`} 
              style={{ 
                background: btnColor, 
                color: btnTextColor, 
                borderColor: btnBorderColor, 
                borderWidth: (isHalloweenActive || btnBorderColor !== 'transparent') ? '2px' : '0', 
                borderStyle: 'solid',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '18px',
                padding: isHalloweenActive ? '16px 48px' : undefined
              }}
              onClick={(e) => { e.stopPropagation(); handlePosterTap(); }}
            >
              {isHalloweenActive && (
                <img 
                  src="/halloween_pumpkin.png" 
                  alt="🎃" 
                  className="standby-pumpkin-img" 
                />
              )}
              <span className={`poster-cta-label ${isHalloweenActive ? 'halloween-btn-label' : ''}`}>
                {customBtnText || t('start_order', lang)}
              </span>
              {isHalloweenActive && (
                <img 
                  src="/halloween_bat.png" 
                  alt="🦇" 
                  className="standby-bat-img" 
                />
              )}
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
          className={`cta-button ${isHalloweenActive ? 'btn-halloween-glow' : ''}`} 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, background: btnColor, color: btnTextColor, borderColor: btnBorderColor, borderWidth: (isHalloweenActive || btnBorderColor !== 'transparent') ? '2px' : '0', borderStyle: 'solid', boxShadow: isHalloweenActive ? undefined : `0 12px 32px ${btnShadowColor}80` }}
          onClick={goAfterWelcome}
        >
          {isHalloweenActive && <img src="/halloween_pumpkin.png" alt="🎃" className="standby-pumpkin-img" style={{ width: 38, height: 38 }} />}
          {(locationData?.brands?.length > 1 ? locationData.brands : [brand.id]).map((bId) => (
            <img
              key={bId}
              src={`/brands/${bId}-logo.png`}
              alt={bId}
              style={{ height: 38, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: '2px 8px' }}
              onError={(e) => { e.target.style.display='none'; }}
            />
          ))}
          <span style={{ color: btnTextColor }} className={isHalloweenActive ? 'halloween-btn-label' : ''}>{customBtnText || t('tap_to_order', lang)}</span>
          {isHalloweenActive && <img src="/halloween_bat.png" alt="🦇" className="standby-bat-img" style={{ height: 40, width: 'auto', maxWidth: 95 }} />}
        </button>
      </div>

      {/* ─── LIVE POS BRIDGE STATUS PILL (Top-Right, away from AnyDesk) ─── */}
      <div 
        className="kiosk-bridge-status-pill"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rounded Pill */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowBridgeModal(prev => !prev);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            borderRadius: '9999px',
            background: bridgeStatus?.isOnline ? 'rgba(6, 78, 59, 0.92)' : 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${bridgeStatus?.isOnline ? '#10b981' : 'rgba(239, 68, 68, 0.5)'}`,
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            transition: 'all 0.2s ease',
            userSelect: 'none'
          }}
          title="Stare conexiune echipamente locale - click pentru detalii"
        >
          <span 
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: bridgeStatus?.isOnline ? '#34d399' : '#ef4444',
              boxShadow: bridgeStatus?.isOnline ? '0 0 10px #34d399' : '0 0 8px #ef4444',
              display: 'inline-block'
            }} 
          />
          <span>{bridgeStatus?.isOnline ? 'Online' : 'Offline'}</span>
        </button>

        {/* Expanded detail popover on tap */}
        {showBridgeModal && (
          <div 
            style={{
              background: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '16px',
              padding: '14px 18px',
              color: '#ffffff',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
              fontSize: '12px',
              minWidth: '240px',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' }}>
                Hardware POS & Bridge
              </span>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowBridgeModal(false); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#94a3b8' }}>Stare start.bat:</span>
                <span style={{ fontWeight: 700, color: bridgeStatus?.isOnline ? '#34d399' : '#f87171' }}>
                  {bridgeStatus?.isOnline ? '● Pornit / Activ' : '● Oprit / Deconectat'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#94a3b8' }}>Port Serial POS:</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{bridgeStatus?.port || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#94a3b8' }}>Imprimantă:</span>
                <span style={{ fontWeight: 600 }}>{bridgeStatus?.printerName || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#94a3b8' }}>Server Cloud:</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#60a5fa', fontSize: '11px' }}>
                  {bridgeStatus?.serverUrl || 'smart-kiosk-ttut'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

