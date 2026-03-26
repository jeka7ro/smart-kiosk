import { createContext, useContext, useEffect, useState } from 'react';
import { useKioskStore } from './store/kioskStore';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { getBrand } from './config/brands.js';
import { BrandContext, useBrand } from './context/BrandContext.js';
import { io } from 'socket.io-client';

// Re-export so existing imports from App.jsx still work
export { BrandContext, useBrand };

import WelcomeScreen       from './screens/WelcomeScreen';
import OrderTypeScreen     from './screens/OrderTypeScreen';
import BrandSelectScreen   from './screens/BrandSelectScreen';
import MenuScreen          from './screens/MenuScreen';
import ProductScreen       from './screens/ProductScreen';
import CartScreen          from './screens/CartScreen';
import PaymentScreen       from './screens/PaymentScreen';
import ConfirmationScreen  from './screens/ConfirmationScreen';
import PinScreen           from './screens/PinScreen';
import FortuneWheel        from './components/FortuneWheel';
import { proxySyrveImage } from './utils/imageUtils.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';



export default function App() {
  const screen = useKioskStore((s) => s.screen);
  const cartItems = useKioskStore((s) => s.cartItems);
  const isUnlocking = useKioskStore((s) => s.isUnlocking);
  const setLocationData = useKioskStore((s) => s.setLocationData);
  const setKioskData = useKioskStore((s) => s.setKioskData);
  const locationData = useKioskStore((s) => s.locationData);
  
  const activeBrandId = useKioskStore((s) => s.activeBrandId);
  const setActiveBrandId = useKioskStore((s) => s.setActiveBrandId);
  const brand = getBrand(activeBrandId);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Promoții Roată Noroc
  const [promoData, setPromoData] = useState(null);
  const showWheel = useKioskStore((s) => s.showWheel);
  const setShowWheel = useKioskStore((s) => s.setShowWheel);

  useInactivityTimeout();

  // Pre-load all product images silently into iOS Safari Local Cache while idling on screensaver
  useEffect(() => {
    const timer = setTimeout(() => {
      const savedProducts = useKioskStore.getState().menuProducts || [];
      savedProducts.forEach(p => {
        if (p.image) {
          const img = new Image();
          img.src = proxySyrveImage(p.image);
        }
      });
    }, 4000); // 4 seconds after boot
    return () => clearTimeout(timer);
  }, []);

  // ─── Fetch + Poll location data every 30s ────────────────────────────────
  // This is the primary settings sync mechanism - no socket dependency.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let locId = params.get('loc');
    if (locId) localStorage.setItem('kiosk_loc_id', locId);
    else locId = localStorage.getItem('kiosk_loc_id');

    if (!locId) { setLoading(false); return; }

    const fetchLocation = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/locations/${locId}?t=${Date.now()}`, {
          headers: { 'x-api-key': import.meta.env.VITE_API_KEY || 'sk-live-2024-secure' }
        });
        const loc = await r.json();
        if (loc && !loc.error) {
          setLocationData(loc);

          // Apply default language from Admin config
          const { lang: currentLang, setLang } = useKioskStore.getState();
          const defaultLang = loc.defaultLanguage || (loc.languages?.[0]);
          // Only override if current lang isn't in the allowed list (respect user's manual selection)
          const allowedSet = new Set(loc.languages || []);
          if (defaultLang && (!allowedSet.has(currentLang))) {
            setLang(defaultLang);
          }

          const bId = (loc.brands && loc.brands.length > 0) ? loc.brands[0] : 'smashme';
          setActiveBrandId(bId);
          const { applyBrandTheme } = await import('./config/brands.js');
          applyBrandTheme(bId);

          if (loc.kioskPin) {
            const unlocked = localStorage.getItem(`kiosk_unlocked_${loc.id}_${loc.kioskPin}`);
            setIsLocked(unlocked !== 'true');
          }
        }
      } catch (e) {
        console.warn('[Kiosk] Failed to fetch location:', e.message);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately on boot
    fetchLocation();

    // Then poll every 30 seconds to pick up any Admin changes
    const interval = setInterval(fetchLocation, 30_000);
    return () => clearInterval(interval);
  }, [setLocationData]);

  // Fetch Promo (Wheel) after location is loaded
  useEffect(() => {
    if (locationData && locationData.id) {
      fetch(`${BACKEND}/api/promotions/kiosk/${locationData.id}?t=${Date.now()}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.available) setPromoData(data);
        })
        .catch(console.error);
    }
  }, [locationData]);

  // Global Socket.io connection for Remote Management
  useEffect(() => {
    if (!locationData?.id) return;
    
    const locId = locationData.id;
    
    const socket = io(BACKEND, {
      transports: ['websocket', 'polling'], // allow polling fallback
      reconnectionDelayMax: 5000,
      reconnection: true,
    });

    // Hard reload that also cleans Service Worker cache to avoid PWA stale cache
    const hardReload = () => {
      console.log('[Kiosk] Remote restart signal received! Unregistering SW & reloading...');
      // Unregister service worker so the next load fetches fresh code
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
        }).finally(() => {
          // Clear caches and reload
          if ('caches' in window) {
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => {
              window.location.reload(true);
            });
          } else {
            window.location.reload(true);
          }
        });
      } else {
        window.location.reload(true);
      }
    };

    socket.on('connect', () => {
      console.log(`[Kiosk] Socket connected (${socket.id}), joining room kiosk-${locId}`);
      socket.emit('join', { role: 'kiosk', locationId: locId });
    });

    socket.on('reconnect', () => {
      // Re-join room after reconnect
      socket.emit('join', { role: 'kiosk', locationId: locId });
    });

    // Room-level restart (when in room kiosk-{id})
    socket.on('remote_restart', hardReload);
    // Global fallback restart (before room join completes)
    socket.on(`remote_restart_${locId}`, hardReload);

    socket.on('location_updated', (newData) => {
      console.log('[Kiosk] Live config update received from Admin Panel.');
      setLocationData(newData);
    });

    return () => socket.disconnect();
  }, [locationData?.id, setLocationData]);

  // Auto-fullscreen on first user interaction (for kiosk/tablet mode)
  useEffect(() => {
    const goFull = () => {
      const el = document.documentElement;
      const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (rfs && !document.fullscreenElement && !document.webkitFullscreenElement) {
        rfs.call(el).catch(() => {});
      }
      document.removeEventListener('touchstart', goFull);
      document.removeEventListener('click', goFull);
    };
    document.addEventListener('touchstart', goFull, { once: true });
    document.addEventListener('click', goFull, { once: true });
    return () => {
      document.removeEventListener('touchstart', goFull);
      document.removeEventListener('click', goFull);
    };
  }, []);

  if (loading) return null;

  if (!locationData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#111827', color: '#fff', gap: '24px', fontFamily: 'Outfit' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Kiosk Setup</h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.8, marginBottom: '32px' }}>Alege locația pentru această tabletă (salvare integrată PWA):</p>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '600px' }}>
          <button 
            style={{ padding: '20px 40px', fontSize: '1.5rem', borderRadius: '16px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }}
            onClick={() => {
              localStorage.setItem('kiosk_loc_id', 'sm-brasov');
              window.location.href = '/?loc=sm-brasov';
            }}
          >
            📍 Brașov
          </button>
          
          <button 
            style={{ padding: '20px 40px', fontSize: '1.5rem', borderRadius: '16px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.4)' }}
            onClick={() => {
              localStorage.setItem('kiosk_loc_id', 'sm-bucuresti');
              window.location.href = '/?loc=sm-bucuresti';
            }}
          >
            📍 București
          </button>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <PinScreen 
        loc={locationData} 
        onUnlock={() => {
          localStorage.setItem(`kiosk_unlocked_${locationData.id}_${locationData.kioskPin}`, 'true');
          setIsLocked(false);
        }} 
      />
    );
  }

  const showBanner = screen !== 'welcome' && locationData?.topBannerUrl;
  // Support new split fields AND legacy bottomBannerContent
  const _bbUrl  = locationData?.bottomBannerUrl  || (locationData?.bottomBannerContent?.startsWith('http') ? locationData.bottomBannerContent : '') || '';
  const _bbText = locationData?.bottomBannerText  || (!locationData?.bottomBannerContent?.startsWith('http') ? locationData?.bottomBannerContent || '' : '') || '';
  const showBottomBanner = screen !== 'welcome' && (_bbUrl || _bbText);

  const renderPromoMedia = (u) => {
    if (!u) return null;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) {
      return <video src={u} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    } else if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(u)) {
      return <img src={u} alt="Promo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    } else {
      return <iframe src={u} title="Promo" style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }} />;
    }
  };

  const renderBottomBanner = () => {
    const align = locationData?.bottomBannerTextAlign || 'center';
    const logoUrl = locationData?.bottomBannerLogoUrl || '';
    const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Media layer (full height) */}
        {_bbUrl && renderPromoMedia(_bbUrl)}
        {/* Text overlay strip at bottom */}
        {_bbText && (() => {
          const isFixed = locationData?.bottomBannerTextFixed === true;
          return (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 28px', background: _bbUrl ? 'linear-gradient(0deg,rgba(0,0,0,0.75) 0%,transparent 100%)' : (locationData?.bottomBannerBg || '#1e293b'), display: 'flex', alignItems: 'center', justifyContent: justifyMap[align] || 'center', gap: 12, minHeight: '40%', overflow: 'hidden' }}>
              {logoUrl && <img src={logoUrl} alt="" style={{ height: 36, objectFit: 'contain', flexShrink: 0 }} />}
              {isFixed
                ? <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', letterSpacing: '0.5px', textAlign: align }}>{_bbText}</span>
                : <marquee scrollamount="6" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>{_bbText}</marquee>
              }
            </div>
          );
        })()}
      </div>
    );
  };

  // Design Config
  const tH = locationData?.topBannerHeight || 3;
  const tRadTop = locationData?.topBannerRadiusTop !== false;
  const tRadBot = locationData?.topBannerRadiusBottom === true;

  const bH = locationData?.bottomBannerHeight || 2;
  const bRadTop = locationData?.bottomBannerRadiusTop === true;
  const bRadBot = locationData?.bottomBannerRadiusBottom !== false;

  // Banner height formulas — starts small (size 1 = 5vh, size 5 = 17vh)
  const tBannerVh = tH * 3 + 2;
  const bBannerVh = bH * 3 + 2;

  const mainRadTop = (showBanner && !tRadBot) ? '0' : '24px';
  const mainRadBot = (showBottomBanner && !bRadTop) ? '0' : '24px';

  return (
    <BrandContext.Provider value={brand}>
      <div style={{ 
        display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw', 
        overflow: 'hidden', background: 'var(--bg, #f8fafc)', 
        padding: screen === 'welcome' ? '0' : '16px', 
        boxSizing: 'border-box',
        '--kiosk-banner-bottom': showBottomBanner ? `${bBannerVh}vh` : '0px',
      }}>
        
        {showBanner && (
          <div style={{ 
            height: `${tBannerVh}vh`, 
            borderRadius: `${tRadTop ? '24px' : '0'} ${tRadTop ? '24px' : '0'} ${tRadBot ? '24px' : '0'} ${tRadBot ? '24px' : '0'}`,
            background: '#000', 
            flexShrink: 0, 
            position: 'relative', 
            zIndex: 100, 
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)' 
          }}>
            {renderPromoMedia(locationData.topBannerUrl)}
          </div>
        )}

        <div style={{ 
          flex: 1, 
          width: '100%', 
          position: 'relative', 
          overflow: 'hidden',
          borderRadius: screen === 'welcome' && !isUnlocking ? '0' : `${mainRadTop} ${mainRadTop} ${mainRadBot} ${mainRadBot}`,
          boxShadow: (showBanner || showBottomBanner) ? '0 8px 32px rgba(0,0,0,0.05)' : 'none',
          background: screen === 'welcome' && !isUnlocking ? 'transparent' : '#fff',
          paddingBottom: showBottomBanner ? `${bBannerVh + 2}vh` : 0,
        }}>
          {screen === 'orderType'    && <OrderTypeScreen />}
          {screen === 'brandSelect'  && <BrandSelectScreen />}
          {screen === 'menu'         && <MenuScreen />}
          {screen === 'product'      && <ProductScreen />}
          {screen === 'cart'         && <CartScreen />}
          {screen === 'payment'      && <PaymentScreen />}
          {screen === 'confirmation' && <ConfirmationScreen />}
          
          {(screen === 'welcome' || isUnlocking) && <WelcomeScreen />}
        </div>
        
        {showBottomBanner && (
          <div style={{ 
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${bBannerVh}vh`, 
            borderRadius: `${bRadTop ? '24px' : '0'} ${bRadTop ? '24px' : '0'} ${bRadBot ? '24px' : '0'} ${bRadBot ? '24px' : '0'}`,
            background: locationData.bottomBannerContent.startsWith('http') ? '#000' : (locationData.bottomBannerBg || '#1e293b'), 
            zIndex: 50,
            overflow: 'hidden',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.15)' 
          }}>
            {renderBottomBanner()}
          </div>
        )}

        {/* Floating Button eliminat complet la cererea clientului */}

        {/* ─── Fortune Wheel Modal (Triggered Internally e.g. from Checkout) ─── */}
        {showWheel && promoData && (
          <FortuneWheel 
            config={promoData} 
            onClose={() => {
               setShowWheel(false);
               // Dacă roata a fost declanșată fix înainte de plată, mergem la plată
               if (useKioskStore.getState().promoIntendedRoute === 'payment') {
                 useKioskStore.getState().setPromoIntendedRoute(null);
                 useKioskStore.getState().goTo('payment');
               }
            }}
            onWin={(prize) => {
              if (prize && prize.type !== 'nada') {
                useKioskStore.getState().addToCart(
                  { 
                    id: prize.productId || `promo_${Date.now()}`, 
                    name: `🎁 ${prize.name}`, 
                    image: prize.image || '', 
                    isPromo: true 
                  },
                  1,
                  [],
                  0, // totalPrice per unit
                  prize.brand_id || activeBrandId
                );
              }
              setTimeout(() => {
                 setShowWheel(false);
                 if (useKioskStore.getState().promoIntendedRoute === 'payment') {
                   useKioskStore.getState().setPromoIntendedRoute(null);
                   useKioskStore.getState().goTo('payment');
                 }
              }, 1800);
            }}
          />
        )}
        
      </div>
    </BrandContext.Provider>
  );
}
