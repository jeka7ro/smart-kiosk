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

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';

function isWithinLockSchedule(loc, now = new Date()) {
  if (!loc || !loc.lockScheduleActive) return false;

  const mode = loc.lockScheduleMode || 'daily';
  const startStr = loc.lockStartTime || '22:00';
  const endStr = loc.lockEndTime || '09:00';

  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = (sH || 0) * 60 + (sM || 0);
  const endMinutes = (eH || 0) * 60 + (eM || 0);

  const days = Array.isArray(loc.lockDays) ? loc.lockDays.map(Number) : [1, 2, 3, 4, 5, 6, 0];

  if (startMinutes > endMinutes) {
    // Overnight window (e.g. 22:00 -> 09:00)
    if (currentMinutes >= startMinutes) {
      if (mode === 'daily') return true;
      return days.includes(now.getDay());
    } else if (currentMinutes < endMinutes) {
      if (mode === 'daily') return true;
      const yesterday = (now.getDay() + 6) % 7;
      return days.includes(yesterday);
    }
    return false;
  } else {
    // Same-day window (e.g. 14:00 -> 18:00)
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      if (mode === 'daily') return true;
      return days.includes(now.getDay());
    }
    return false;
  }
}

function getLockWindowId(loc, now = new Date()) {
  if (!loc || !loc.lockScheduleActive) return null;
  const startStr = loc.lockStartTime || '22:00';
  const endStr = loc.lockEndTime || '09:00';
  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = (sH || 0) * 60 + (sM || 0);
  const endMinutes = (eH || 0) * 60 + (eM || 0);

  let windowDate = new Date(now);
  if (startMinutes > endMinutes && currentMinutes < endMinutes) {
    windowDate.setDate(windowDate.getDate() - 1);
  }
  const dateKey = `${windowDate.getFullYear()}-${windowDate.getMonth()+1}-${windowDate.getDate()}`;
  return `kiosk_win_${loc.id}_${dateKey}_${startStr}_${endStr}`;
}

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
  const [isScheduleLocked, setIsScheduleLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Promoții Roată Noroc
  const [promoData, setPromoData] = useState(null);
  const showWheel = useKioskStore((s) => s.showWheel);
  const setShowWheel = useKioskStore((s) => s.setShowWheel);

  useInactivityTimeout();

  const evaluateLockState = (loc) => {
    if (!loc || !loc.id) return;

    if (loc.lockScheduleActive) {
      const inSchedule = isWithinLockSchedule(loc);
      const windowId = getLockWindowId(loc);

      if (inSchedule) {
        const isManuallyUnlocked = windowId && sessionStorage.getItem(windowId) === 'true';
        if (!isManuallyUnlocked) {
          setIsScheduleLocked(true);
          setIsLocked(prev => {
            if (!prev) {
              try {
                fetch(`${BACKEND}/api/kiosk-logs`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    locationId: loc.id,
                    locationName: loc.name,
                    kioskId: loc.kioskId || localStorage.getItem('kiosk_device_id') || 'kiosk-main',
                    eventType: 'auto_lock',
                    role: 'system',
                    details: { schedule: `${loc.lockStartTime || '22:00'} - ${loc.lockEndTime || '09:00'}` }
                  })
                }).catch(() => {});
              } catch {}
            }
            return true;
          });
        }
      } else {
        setIsScheduleLocked(false);
        if (windowId) sessionStorage.removeItem(windowId);
        if (loc.lockAutoUnlock !== false) {
          setIsLocked(prev => {
            if (prev) {
              try {
                fetch(`${BACKEND}/api/kiosk-logs`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    locationId: loc.id,
                    locationName: loc.name,
                    kioskId: loc.kioskId || localStorage.getItem('kiosk_device_id') || 'kiosk-main',
                    eventType: 'auto_unlock',
                    role: 'system',
                    details: { schedule: `${loc.lockStartTime || '22:00'} - ${loc.lockEndTime || '09:00'}` }
                  })
                }).catch(() => {});
              } catch {}
            }
            return false;
          });
        }
      }
    } else if (loc.kioskPin) {
      setIsScheduleLocked(false);
      const unlocked = localStorage.getItem(`kiosk_unlocked_${loc.id}_${loc.kioskPin}`);
      setIsLocked(unlocked !== 'true');
    } else {
      setIsScheduleLocked(false);
      setIsLocked(false);
    }
  };

  // Periodically evaluate lock schedule (every 15s) for smooth transitions
  useEffect(() => {
    if (!locationData?.id) return;
    evaluateLockState(locationData);
    const interval = setInterval(() => evaluateLockState(locationData), 15_000);
    return () => clearInterval(interval);
  }, [locationData]);

  // ─── KIOSK SECURITY: Block right-click, refresh & pull-to-refresh ───────────
  useEffect(() => {
    // 1. Block right-click context menu
    const blockContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', blockContextMenu);

    // 2. Block F5, Ctrl+R, Ctrl+Shift+R (accidental refresh)
    const blockRefresh = (e) => {
      if (
        e.key === 'F5' ||
        (e.ctrlKey && e.key === 'r') ||
        (e.ctrlKey && e.shiftKey && e.key === 'R') ||
        (e.metaKey && e.key === 'r')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', blockRefresh);

    // 3. Block pull-to-refresh (drag down pe tabletă/telefon)
    const blockPullRefresh = (e) => {
      // Blochează scroll vertical când e la top (previne pull-to-refresh)
      if (e.touches && e.touches.length === 1) {
        const touch = e.touches[0];
        if (touch.clientY > (e.target._startY || 0) && window.scrollY === 0) {
          e.preventDefault();
        }
      }
    };
    const saveStartY = (e) => {
      if (e.touches) e.target._startY = e.touches[0].clientY;
    };
    document.addEventListener('touchstart', saveStartY, { passive: true });
    document.addEventListener('touchmove', blockPullRefresh, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockRefresh);
      document.removeEventListener('touchstart', saveStartY);
      document.removeEventListener('touchmove', blockPullRefresh);
    };
  }, []);

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
  // ─── Fetch + Poll location data every 30s ────────────────────────────────
  // This is the primary settings sync mechanism - no socket dependency.
  useEffect(() => {
    let isInitialBoot = true;
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
          // Daca backend-ul local nu are kioskPin configurat, verificam fallback pe cloud
          if (!loc.kioskPin && BACKEND !== 'https://smart-kiosk-v7ws.onrender.com') {
            try {
              const cloudR = await fetch(`https://smart-kiosk-v7ws.onrender.com/api/locations/${locId}?t=${Date.now()}`, {
                headers: { 'x-api-key': 'sk-live-2024-secure' }
              });
              const cloudLoc = await cloudR.json();
              if (cloudLoc && cloudLoc.kioskPin) {
                loc.kioskPin = cloudLoc.kioskPin;
                if (cloudLoc.vendorPin) loc.vendorPin = cloudLoc.vendorPin;
                if (cloudLoc.lockScheduleActive !== undefined) loc.lockScheduleActive = cloudLoc.lockScheduleActive;
                if (cloudLoc.lockStartTime) loc.lockStartTime = cloudLoc.lockStartTime;
                if (cloudLoc.lockEndTime) loc.lockEndTime = cloudLoc.lockEndTime;
                if (cloudLoc.lockDays) loc.lockDays = cloudLoc.lockDays;
                if (cloudLoc.lockAutoUnlock !== undefined) loc.lockAutoUnlock = cloudLoc.lockAutoUnlock;
              }
            } catch (err) {}
          }

          const currentData = useKioskStore.getState().locationData;
          if (JSON.stringify(currentData) !== JSON.stringify(loc)) {
            setLocationData(loc);
          }
          if (loc.visualEffects) {
            useKioskStore.setState({ visualEffects: loc.visualEffects });
            try { localStorage.setItem('kiosk_visual_effects', JSON.stringify(loc.visualEffects)); } catch {}
          }
          if (loc.categoryHeroActive !== undefined) {
            try { localStorage.setItem('kiosk_category_hero', String(loc.categoryHeroActive)); } catch {}
          }
          if (loc.categoryHeroSteam !== undefined) {
            try { localStorage.setItem('kiosk_category_hero_steam', String(loc.categoryHeroSteam)); } catch {}
          }
          if (loc.categoryHeroProductId !== undefined) {
            try { localStorage.setItem('kiosk_category_hero_product_id', String(loc.categoryHeroProductId)); } catch {}
          }
          if (loc.topBannerActive !== undefined) {
            try { localStorage.setItem('kiosk_top_banner_active', String(loc.topBannerActive)); } catch {}
          }
          if (loc.upsellActive !== undefined) {
            try { localStorage.setItem('kiosk_upsell_active', String(loc.upsellActive)); } catch {}
          }
          // Apply default language from Admin config
          const { lang: currentLang, setLang } = useKioskStore.getState();
          const defaultLang = loc.defaultLanguage || (loc.languages?.[0]);
          // Only override if current lang isn't in the allowed list (respect user's manual selection)
          const allowedSet = new Set(loc.languages || []);
          if (defaultLang && (!allowedSet.has(currentLang))) {
            setLang(defaultLang);
          }

          if (isInitialBoot) {
            const bId = (loc.brands && loc.brands.length > 0) ? loc.brands[0] : 'smashme';
            setActiveBrandId(bId);
            const { applyBrandTheme } = await import('./config/brands.js');
            applyBrandTheme(bId);
            isInitialBoot = false;
          }
          evaluateLockState(loc);
        } else if (loc.error) {
          // If the location is not found, clear it from localStorage so it doesn't stay stuck
          localStorage.removeItem('kiosk_loc_id');
          console.error('[Kiosk] Invalid location ID. Cleared from storage.');
          setLocationData({ notFound: true, requestedId: new URLSearchParams(window.location.search).get('loc') });
          setLoading(false);
          return;
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

    const kioskDeviceId = locationData?.kioskId || localStorage.getItem('kiosk_device_id') || 'kiosk-main';
    const activeScreen = isLocked ? 'pin' : screen;

    socket.on('connect', () => {
      console.log(`[Kiosk] Socket connected (${socket.id}), joining room kiosk-${locId}`);
      socket.emit('join', {
        role: 'kiosk',
        locationId: locId,
        kioskId: kioskDeviceId,
        screen: activeScreen
      });
    });

    socket.on('reconnect', () => {
      // Re-join room after reconnect
      socket.emit('join', {
        role: 'kiosk',
        locationId: locId,
        kioskId: kioskDeviceId,
        screen: activeScreen
      });
    });

    // Handle live ping from admin panel
    const handlePing = (data) => {
      console.log('[Kiosk] 🏓 Ping signal received from Admin, responding with pong...');
      socket.emit('kiosk_pong', {
        pingId: data?.pingId,
        locationId: locId,
        kioskId: kioskDeviceId,
        screen: isLocked ? 'pin' : screen
      });
    };
    socket.on('kiosk_ping', handlePing);
    socket.on(`kiosk_ping_${locId}`, handlePing);

    // Heartbeat every 10s to keep admin live status real
    const hbInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('kiosk_heartbeat', {
          locationId: locId,
          kioskId: kioskDeviceId,
          screen: isLocked ? 'pin' : screen
        });
      }
    }, 10000);

    // Room-level restart (when in room kiosk-{id})
    socket.on('remote_restart', hardReload);
    // Global fallback restart (before room join completes)
    socket.on(`remote_restart_${locId}`, hardReload);

    socket.on('location_updated', (newData) => {
      console.log('[Kiosk] Live config update received from Admin Panel.');
      setLocationData(newData);
      evaluateLockState(newData);
      if (newData.categoryHeroActive !== undefined) {
        try { localStorage.setItem('kiosk_category_hero', String(newData.categoryHeroActive)); } catch {}
      }
      if (newData.categoryHeroSteam !== undefined) {
        try { localStorage.setItem('kiosk_category_hero_steam', String(newData.categoryHeroSteam)); } catch {}
      }
      if (newData.categoryHeroProductId !== undefined) {
        try { localStorage.setItem('kiosk_category_hero_product_id', String(newData.categoryHeroProductId)); } catch {}
      }
      if (newData.topBannerActive !== undefined) {
        try { localStorage.setItem('kiosk_top_banner_active', String(newData.topBannerActive)); } catch {}
      }
      if (newData.upsellActive !== undefined) {
        try { localStorage.setItem('kiosk_upsell_active', String(newData.upsellActive)); } catch {}
      }
    });

    return () => {
      clearInterval(hbInterval);
      socket.off('kiosk_ping', handlePing);
      socket.off(`kiosk_ping_${locId}`, handlePing);
      socket.disconnect();
    };
  }, [locationData?.id, setLocationData, screen, isLocked]);

  // Auto-fullscreen agresiv pentru kiosk/tabletă
  useEffect(() => {
    const requestFS = () => {
      const el = document.documentElement;
      const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (rfs && !document.fullscreenElement && !document.webkitFullscreenElement) {
        rfs.call(el).catch(() => {});
      }
    };

    // Încearcă imediat la load (funcționează în Chrome kiosk mode)
    requestFS();

    // Reintră în fullscreen dacă utilizatorul iese accidental (Esc)
    const onFSChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setTimeout(requestFS, 300);
      }
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);

    // Încearcă din nou la orice interacțiune (touchstart, click, keydown)
    const onInteraction = () => requestFS();
    document.addEventListener('touchstart', onInteraction, { passive: true });
    document.addEventListener('click', onInteraction);
    document.addEventListener('keydown', onInteraction);

    // Încearcă din nou după 1s și 3s (pentru tablete lente)
    const t1 = setTimeout(requestFS, 1000);
    const t2 = setTimeout(requestFS, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
      document.removeEventListener('touchstart', onInteraction);
      document.removeEventListener('click', onInteraction);
      document.removeEventListener('keydown', onInteraction);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#111827', color: '#fff', gap: '24px', fontFamily: 'inherit' }}>
        <div style={{ width: 56, height: 56, border: '4px solid rgba(255,255,255,0.15)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: '1.1rem', opacity: 0.7, margin: 0 }}>Se conectează la server (trezire sistem)...</p>
      </div>
    );
  }

  if (locationData && locationData.notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#111827', color: '#fff', gap: '16px', fontFamily: 'inherit' }}>
        <p style={{ fontSize: '1.4rem', fontWeight: 600, color: '#ef4444' }}>Eroare: Locația nu a fost găsită</p>
        <p style={{ fontSize: '1.1rem', opacity: 0.8, maxWidth: 400, textAlign: 'center' }}>
          Locația <code>{locationData.requestedId}</code> nu există pe acest server. Te rugăm să o salvezi în Admin Panel.
        </p>
        <button
          onClick={() => { window.location.href = window.location.pathname; }}
          style={{ marginTop: 24, padding: '10px 28px', fontSize: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
        >
          Înapoi
        </button>
      </div>
    );
  }

  if (!locationData) {
    const locId = new URLSearchParams(window.location.search).get('loc') || localStorage.getItem('kiosk_loc_id');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#111827', color: '#fff', gap: '24px', fontFamily: 'inherit' }}>
        {locId ? (
          <>
            <div style={{ width: 56, height: 56, border: '4px solid rgba(255,255,255,0.15)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: '1.1rem', opacity: 0.7, margin: 0 }}>Se conectează la server...</p>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 8, padding: '10px 28px', fontSize: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
            >
              Reîncearcă
            </button>
          </>
        ) : (
          <p style={{ fontSize: '1.2rem', opacity: 0.7 }}>Nicio locație configurată. Adaugă <code>?loc=ID</code> în URL.</p>
        )}
      </div>
    );
  }

  if (isLocked) {
    return (
      <PinScreen 
        loc={locationData} 
        isScheduleLock={isScheduleLocked}
        backendUrl={BACKEND}
        onUnlock={(role) => {
          if (locationData) {
            const windowId = getLockWindowId(locationData);
            if (windowId) {
              sessionStorage.setItem(windowId, 'true');
            }
            localStorage.setItem(`kiosk_unlocked_${locationData.id}_${locationData.kioskPin}`, 'true');
          }
          setIsLocked(false);
        }} 
      />
    );
  }

  // Support new split fields AND legacy bottomBannerContent
  const isMediaUrl = (u) => {
    if (!u || typeof u !== 'string') return false;
    const clean = u.trim();
    return /\.(mp4|webm|mov|jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(clean) || clean.startsWith('data:image/') || clean.includes('/uploads/');
  };

  // Top Persistent Banner: afișat DOAR dacă este activ și are un URL media valid (fără ecrane negre goale)
  const isTopBannerActive = locationData?.topBannerActive !== undefined
    ? Boolean(locationData.topBannerActive)
    : (localStorage.getItem('kiosk_top_banner_active') !== 'false' && Boolean(locationData?.topBannerUrl || (activeBrandId && locationData?.[`topBannerUrl_${activeBrandId}`])));

  const rawTopBanner = isTopBannerActive 
    ? (locationData?.[`topBannerUrl_${activeBrandId}`] || locationData?.topBannerUrl || '').trim() 
    : '';

  const activeBrandBannerUrl = isMediaUrl(rawTopBanner) ? rawTopBanner : '';
  const showBanner = screen !== 'welcome' && isTopBannerActive && Boolean(activeBrandBannerUrl);

  const rawBbUrl = (locationData?.bottomBannerUrl || (locationData?.bottomBannerContent?.startsWith('http') ? locationData.bottomBannerContent : '') || '').trim();
  const _bbUrl = isMediaUrl(rawBbUrl) ? rawBbUrl : '';

  let _bbText = locationData?.bottomBannerText || (!locationData?.bottomBannerContent?.startsWith('http') ? locationData?.bottomBannerContent || '' : '') || '';
  // If user entered a plain website address like www.getapp.ro into the URL field, display it as part of the text instead of breaking media
  if (!isMediaUrl(rawBbUrl) && rawBbUrl && !_bbText.includes(rawBbUrl)) {
    _bbText = _bbText ? `${_bbText} • ${rawBbUrl}` : rawBbUrl;
  }
  const _bbLogo = locationData?.bottomBannerLogoUrl || '';
  const showBottomBanner = screen !== 'welcome' && (_bbUrl || _bbText || _bbLogo);

  const renderPromoMedia = (u) => {
    if (!u || typeof u !== 'string') return null;
    const clean = u.trim();
    if (!clean) return null;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(clean)) {
      return (
        <video 
          src={clean} 
          autoPlay 
          muted 
          loop 
          playsInline 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          onError={(e) => {
            if (e.currentTarget?.parentElement) e.currentTarget.parentElement.style.display = 'none';
          }}
        />
      );
    } else if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(clean) || clean.startsWith('data:image/') || clean.includes('/uploads/')) {
      return (
        <img 
          src={clean} 
          alt="Promo" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          onError={(e) => {
            if (e.currentTarget?.parentElement) e.currentTarget.parentElement.style.display = 'none';
          }}
        />
      );
    }
    return null;
  };

  const parseFooterDetails = (rawText, explicitWebsite, explicitPhone) => {
    let website = (explicitWebsite || '').trim();
    let phone = (explicitPhone || '').trim();
    let extra = '';

    const fullText = (rawText || '').trim();
    if (!fullText && !website && !phone) return { website: '', phone: '', extra: '' };

    // 1. Website detection (e.g. wwww.getapp.ro, www.getapp.ro, https://..., getapp.ro)
    if (!website && fullText) {
      const webMatch = fullText.match(/(?:https?:\/\/|(?:www\w*\.))[^\s•|,;]+|[a-zA-Z0-9-]+\.(?:ro|com|eu|net|org|io|app|menu|site|info)\b[^\s•|,;]*/i);
      if (webMatch) {
        website = webMatch[0].trim();
      }
    }

    // 2. Phone detection (e.g. 0727 77 77 12, 0725777712, +40 727 77 77 12)
    if (!phone && fullText) {
      const textWithoutWeb = website ? fullText.replace(website, '') : fullText;
      const phoneMatch = textWithoutWeb.match(/(?:\+?4?0\s*)?(?:0[1-9][\d\s\.\-]{7,15}|\+?[\d\s\.\-]{9,16})/);
      if (phoneMatch) {
        const candidate = phoneMatch[0].trim();
        const digitCount = (candidate.match(/\d/g) || []).length;
        if (digitCount >= 8) {
          phone = candidate;
        }
      }
    }

    // 3. Extra text (anything remaining after removing website and phone)
    if (fullText) {
      let rem = fullText;
      if (website) rem = rem.replace(website, '');
      if (phone) rem = rem.replace(phone, '');
      rem = rem.replace(/^[•\s\-\|,;:]+|[•\s\-\|,;:]+$/g, '').trim();
      if (rem && rem.length > 1) {
        extra = rem;
      }
    }

    return { website, phone, extra };
  };

  const renderBottomBanner = () => {
    const align = locationData?.bottomBannerTextAlign || 'center';
    const logoUrl = locationData?.bottomBannerLogoUrl || '';
    const hasOverlay = _bbText || logoUrl;
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        {/* Media layer (full height) */}
        {_bbUrl && renderPromoMedia(_bbUrl)}
        {/* Text and/or Logo overlay strip */}
        {hasOverlay && (() => {
          const isFixed = locationData?.bottomBannerTextFixed === true;
          const { website, phone, extra } = parseFooterDetails(
            _bbText, 
            locationData?.bottomBannerWebsite, 
            locationData?.bottomBannerPhone
          );
          const hasStructuredContact = Boolean(website || phone);

          return (
            <div style={{ 
              position: 'absolute', 
              top: 0,
              bottom: 0, 
              left: 0, 
              right: 0, 
              padding: '6px 20px', 
              background: _bbUrl ? 'linear-gradient(0deg,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.5) 100%)' : (locationData?.bottomBannerBg || '#1e293b'), 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center', 
              justifyContent: 'center', 
              gap: 'clamp(2px, 0.4vh, 4px)', 
              overflow: 'hidden',
              textAlign: align
            }}>
              {/* Card / Fundal Info (Logo + Site + Telefon) - Configurat din Admin */}
              {(() => {
                const infoBg = locationData?.bottomBannerInfoBg;
                const hasCustomBg = Boolean(infoBg && infoBg !== 'transparent');
                
                return (
                  <div style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
                    justifyContent: 'center',
                    gap: 'clamp(2px, 0.4vh, 4px)',
                    backgroundColor: infoBg || 'transparent',
                    padding: hasCustomBg ? '4px 14px' : '0',
                    borderRadius: hasCustomBg ? '10px' : '0',
                    boxShadow: hasCustomBg ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                    backdropFilter: hasCustomBg ? 'blur(4px)' : 'none',
                    flexShrink: 0
                  }}>
                    {/* 1. Logo (sus) */}
                    {logoUrl && (
                      <img 
                        src={logoUrl} 
                        alt="Logo" 
                        style={{ 
                          height: hasStructuredContact ? 'clamp(24px, 2.6vh, 34px)' : 'clamp(32px, 4vh, 46px)', 
                          maxHeight: hasStructuredContact ? 'clamp(28px, 3vh, 38px)' : 'clamp(36px, 4.5vh, 50px)', 
                          maxWidth: '220px',
                          objectFit: 'contain', 
                          flexShrink: 0 
                        }} 
                      />
                    )}

                    {/* 2. Sub el: Site-ul */}
                    {website && (
                      <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        fontSize: 'clamp(0.92rem, 1.1vh, 1.12rem)', 
                        fontWeight: 700, 
                        color: '#ffffff', 
                        letterSpacing: '0.4px',
                        lineHeight: 1.15,
                        textShadow: '0 1px 3px rgba(0,0,0,0.45)'
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9, flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        <span>{website}</span>
                      </div>
                    )}

                    {/* 3. Sub ele: Telefonul */}
                    {phone && (
                      <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        fontSize: 'clamp(0.85rem, 0.98vh, 1.02rem)', 
                        fontWeight: 600, 
                        color: 'rgba(255, 255, 255, 0.94)', 
                        letterSpacing: '0.3px',
                        lineHeight: 1.15,
                        textShadow: '0 1px 3px rgba(0,0,0,0.45)'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9, flexShrink: 0 }}>
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <span>{phone}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Text adițional dacă există */}
              {extra && (
                <div style={{ 
                  fontSize: 'clamp(0.78rem, 0.9vh, 0.92rem)', 
                  fontWeight: 500, 
                  color: 'rgba(255, 255, 255, 0.85)',
                  lineHeight: 1.15,
                  letterSpacing: '0.2px'
                }}>
                  {extra}
                </div>
              )}

              {/* Text simplu dacă nu conține contacte structurate */}
              {!hasStructuredContact && !extra && _bbText && (
                isFixed
                  ? <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>{_bbText}</span>
                  : <marquee scrollamount="6" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>{_bbText}</marquee>
              )}
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
        '--kiosk-banner-bottom': showBottomBanner ? `max(${bBannerVh}vh, 86px)` : '0px',
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
            {renderPromoMedia(activeBrandBannerUrl)}
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
          paddingBottom: showBottomBanner ? `max(${bBannerVh + 2}vh, 102px)` : 0,
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
            height: `max(${bBannerVh}vh, 86px)`, 
            borderRadius: `${bRadTop ? '24px' : '0'} ${bRadTop ? '24px' : '0'} ${bRadBot ? '24px' : '0'} ${bRadBot ? '24px' : '0'}`,
            background: _bbUrl ? '#000' : (locationData.bottomBannerBg || '#1e293b'), 
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
                    name: prize.name, 
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
                 } else {
                   useKioskStore.getState().goTo('cart');
                 }
              }, 1800);
            }}
          />
        )}
        
      </div>
    </BrandContext.Provider>
  );
}
