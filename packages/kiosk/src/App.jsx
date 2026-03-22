import { createContext, useContext, useEffect, useState } from 'react';
import { useKioskStore } from './store/kioskStore';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { getBrand } from './config/brands.js';

import WelcomeScreen       from './screens/WelcomeScreen';
import OrderTypeScreen     from './screens/OrderTypeScreen';
import BrandSelectScreen   from './screens/BrandSelectScreen';
import MenuScreen          from './screens/MenuScreen';
import ProductScreen       from './screens/ProductScreen';
import CartScreen          from './screens/CartScreen';
import PaymentScreen       from './screens/PaymentScreen';
import ConfirmationScreen  from './screens/ConfirmationScreen';
import PinScreen           from './screens/PinScreen';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export const BrandContext = createContext(null);
export const useBrand = () => useContext(BrandContext);

export default function App() {
  const screen = useKioskStore((s) => s.screen);
  const setLocationData = useKioskStore((s) => s.setLocationData);
  const setKioskData = useKioskStore((s) => s.setKioskData);
  const locationData = useKioskStore((s) => s.locationData);
  
  const [activeBrandId, setActiveBrandId] = useState('smashme');
  const brand = getBrand(activeBrandId);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useInactivityTimeout();

  // Fetch location data at boot (for multi-brand detection, security PIN, and styling)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locId = params.get('loc');
    if (!locId) {
       setLoading(false);
       return;
    }
    
    fetch(`${BACKEND}/api/locations/${locId}?t=${Date.now()}`, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY || 'sk-live-2024-secure' }
    })
      .then(r => r.json())
      .then(async loc => {
        if (loc && !loc.error) {
          setLocationData(loc);
          
          // Determine the Main Brand natively from Database payload
          const bId = (loc.brands && loc.brands.length > 0) ? loc.brands[0] : 'smashme';
          setActiveBrandId(bId);
          
          // Dynamically apply brand theme colors
          const { applyBrandTheme } = await import('./config/brands.js');
          applyBrandTheme(bId);

          if (loc.kioskPin) {
             const unlocked = localStorage.getItem(`kiosk_unlocked_${loc.id}_${loc.kioskPin}`);
             setIsLocked(unlocked !== 'true');
          }
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error('Failed to load location:', e);
        setLoading(false);
      });
  }, [setLocationData]);

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

  return (
    <BrandContext.Provider value={brand}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg, #f8fafc)', padding: '16px' }}>
        
        {showBanner && (
          <div style={{ 
            height: '25vh', 
            borderRadius: '24px 24px 0 0',
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
          borderRadius: showBanner ? '0 0 24px 24px' : '24px',
          boxShadow: showBanner ? '0 8px 32px rgba(0,0,0,0.05)' : 'none',
          background: '#fff'
        }}>
          {screen === 'welcome'      && <WelcomeScreen />}
          {screen === 'orderType'    && <OrderTypeScreen />}
          {screen === 'brandSelect'  && <BrandSelectScreen />}
          {screen === 'menu'         && <MenuScreen />}
          {screen === 'product'      && <ProductScreen />}
          {screen === 'cart'         && <CartScreen />}
          {screen === 'payment'      && <PaymentScreen />}
          {screen === 'confirmation' && <ConfirmationScreen />}
        </div>
        
      </div>
    </BrandContext.Provider>
  );
}

