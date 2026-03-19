import { createContext, useContext } from 'react';
import { useKioskStore } from './store/kioskStore';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { getBrand } from './config/brands.js';

import WelcomeScreen      from './screens/WelcomeScreen';
import OrderTypeScreen    from './screens/OrderTypeScreen';
import MenuScreen         from './screens/MenuScreen';
import ProductScreen      from './screens/ProductScreen';
import CartScreen         from './screens/CartScreen';
import PaymentScreen      from './screens/PaymentScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';

export const BrandContext = createContext(null);
export const useBrand = () => useContext(BrandContext);

export default function App({ brandId }) {
  const screen = useKioskStore((s) => s.screen);
  const brand  = getBrand(brandId);
  useInactivityTimeout();

  return (
    <BrandContext.Provider value={brand}>
      {screen === 'welcome'      && <WelcomeScreen />}
      {screen === 'orderType'    && <OrderTypeScreen />}
      {screen === 'menu'         && <MenuScreen />}
      {screen === 'product'      && <ProductScreen />}
      {screen === 'cart'         && <CartScreen />}
      {screen === 'payment'      && <PaymentScreen />}
      {screen === 'confirmation' && <ConfirmationScreen />}
    </BrandContext.Provider>
  );
}

