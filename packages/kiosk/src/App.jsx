import { createContext, useContext, useEffect } from 'react';
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

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export const BrandContext = createContext(null);
export const useBrand = () => useContext(BrandContext);

export default function App({ brandId }) {
  const screen = useKioskStore((s) => s.screen);
  const setLocationData = useKioskStore((s) => s.setLocationData);
  const setKioskData = useKioskStore((s) => s.setKioskData);
  const brand  = getBrand(brandId);
  useInactivityTimeout();

  // Fetch location data at boot (for multi-brand detection)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locId = params.get('loc');
    if (!locId) return;
    fetch(`${BACKEND}/api/locations/${locId}`)
      .then(r => r.json())
      .then(loc => {
        if (loc) {
          setLocationData(loc);
        }
      })
      .catch(() => {});
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

  return (
    <BrandContext.Provider value={brand}>
      {screen === 'welcome'      && <WelcomeScreen />}
      {screen === 'orderType'    && <OrderTypeScreen />}
      {screen === 'brandSelect'  && <BrandSelectScreen />}
      {screen === 'menu'         && <MenuScreen />}
      {screen === 'product'      && <ProductScreen />}
      {screen === 'cart'         && <CartScreen />}
      {screen === 'payment'      && <PaymentScreen />}
      {screen === 'confirmation' && <ConfirmationScreen />}
    </BrandContext.Provider>
  );
}

