import { useEffect } from 'react';
import { useQrStore } from './store/qrStore.js';
import { getQrBrand } from './config/brands.js';

import TableLanding from './screens/TableLanding.jsx';
import MenuBrowse   from './screens/MenuBrowse.jsx';
import ProductPage  from './screens/ProductPage.jsx';
import CartPage     from './screens/CartPage.jsx';
import CheckoutPage from './screens/CheckoutPage.jsx';
import OrderSuccess from './screens/OrderSuccess.jsx';

export default function App({ brandId }) {
  const screen = useQrStore((s) => s.screen);
  const init   = useQrStore((s) => s.init);
  const brand  = getQrBrand(brandId);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const table = parseInt(p.get('table') || '0');
    const loc   = p.get('loc') || '1';
    init(brandId, table, loc);
  }, [brandId]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'var(--card)' }}>
      {screen === 'landing'  && <TableLanding brand={brand} />}
      {screen === 'menu'     && <MenuBrowse brand={brand} />}
      {screen === 'product'  && <ProductPage brand={brand} />}
      {screen === 'cart'     && <CartPage brand={brand} />}
      {screen === 'checkout' && <CheckoutPage brand={brand} />}
      {screen === 'success'  && <OrderSuccess brand={brand} />}
    </div>
  );
}
