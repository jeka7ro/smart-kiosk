import { useEffect, useState } from 'react';
import { useQrStore } from './store/qrStore.js';
import { getQrBrand } from './config/brands.js';
import { useInactivityTimeout } from './hooks/useInactivityTimeout.js';

import TableLanding from './screens/TableLanding.jsx';
import MenuBrowse   from './screens/MenuBrowse.jsx';
import ProductPage  from './screens/ProductPage.jsx';
import CartPage     from './screens/CartPage.jsx';
import CheckoutPage from './screens/CheckoutPage.jsx';
import OrderSuccess from './screens/OrderSuccess.jsx';
import PosterScreen from './screens/PosterScreen.jsx';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';

export default function App({ brandId }) {
  const screen = useQrStore((s) => s.screen);
  const init   = useQrStore((s) => s.init);
  const brand  = getQrBrand(brandId);
  
  const setLocationData = useQrStore((s) => s.setLocationData);
  const locationData = useQrStore((s) => s.locationData);
  const isIdle = useQrStore((s) => s.isIdle);
  
  const [loading, setLoading] = useState(true);

  // Activate inactivity tracking (30 seconds for mobile)
  useInactivityTimeout(30);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const table = parseInt(p.get('table') || '0');
    const locId = p.get('loc') || '1';
    
    init(brandId, table, locId);

    // Fetch marketing location settings
    fetch(`${BACKEND}/api/locations/${locId}?t=${Date.now()}`, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY || 'sk-live-2024-secure' }
    })
    .then(r => r.json())
    .then(loc => {
      if (loc && !loc.error) {
        // Prefer mobileConfig (per-location mobile settings), fallback to root fields
        const mc = loc.data?.mobileConfig || {};
        const merged = {
          ...loc,
          topBannerUrl:           mc.topBannerUrl           ?? loc.topBannerUrl           ?? '',
          topBannerHeight:        mc.topBannerHeight         ?? loc.topBannerHeight         ?? 3,
          topBannerRadiusTop:     mc.topBannerRadiusTop      ?? loc.topBannerRadiusTop      ?? true,
          topBannerRadiusBottom:  mc.topBannerRadiusBottom   ?? loc.topBannerRadiusBottom   ?? false,
          bottomBannerContent:    mc.bottomBannerUrl || mc.bottomBannerText || loc.bottomBannerContent || '',
          bottomBannerUrl:        mc.bottomBannerUrl         ?? loc.bottomBannerUrl         ?? '',
          bottomBannerText:       mc.bottomBannerText        ?? loc.bottomBannerText        ?? '',
          bottomBannerHeight:     mc.bottomBannerHeight      ?? loc.bottomBannerHeight      ?? 2,
          bottomBannerRadiusTop:  mc.bottomBannerRadiusTop   ?? loc.bottomBannerRadiusTop   ?? false,
          bottomBannerRadiusBottom: mc.bottomBannerRadiusBottom ?? loc.bottomBannerRadiusBottom ?? true,
          bottomBannerTextFixed:  mc.bottomBannerTextFixed   ?? loc.bottomBannerTextFixed   ?? false,
          bottomBannerTextAlign:  mc.bottomBannerTextAlign   ?? loc.bottomBannerTextAlign   ?? 'center',
          bottomBannerBg:         mc.bottomBannerBg          ?? loc.bottomBannerBg          ?? '#1e293b',
          posterUrl:              mc.posterUrl               ?? loc.posterUrl               ?? '',
          inactivityTimeout:      mc.inactivityTimeout       ?? loc.inactivityTimeout       ?? 30,
        };
        setLocationData(merged);
      }
      setLoading(false);
    })
    .catch((e) => {
      console.error('Failed to load location marketing data:', e);
      setLoading(false);
    });

  }, [brandId, init, setLocationData]);

  if (loading) return null;

  const showTopBanner = locationData?.topBannerUrl;
  const showBottomBanner = locationData?.bottomBannerContent;

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

  const renderBottomBanner = (content) => {
    if (!content) return null;
    if (content.startsWith('http')) {
      return renderPromoMedia(content);
    }
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
        <marquee scrollamount="6" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>
          {content}
        </marquee>
      </div>
    );
  };

  const tH = locationData?.topBannerHeight || 3;
  const tRadTop = locationData?.topBannerRadiusTop !== false;
  const tRadBot = locationData?.topBannerRadiusBottom === true;

  const bH = locationData?.bottomBannerHeight || 2;
  const bRadTop = locationData?.bottomBannerRadiusTop === true;
  const bRadBot = locationData?.bottomBannerRadiusBottom !== false;

  const mainRadTop = (showTopBanner && !tRadBot) ? '0' : '24px';
  const mainRadBot = (showBottomBanner && !bRadTop) ? '0' : '24px';

  return (
    <>
      {isIdle && <PosterScreen />}
      
      <div style={{ maxWidth: 480, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px', boxSizing: 'border-box', background: 'var(--bg, #f8fafc)' }}>
        
        {/* TOP BANNER */}
        {showTopBanner && (
          <div style={{ 
            height: `${tH * 4 + 4}vh`, 
            borderRadius: `${tRadTop ? '16px' : '0'} ${tRadTop ? '16px' : '0'} ${tRadBot ? '16px' : '0'} ${tRadBot ? '16px' : '0'}`,
            background: '#000', 
            flexShrink: 0, 
            position: 'relative', 
            zIndex: 100, 
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)' 
          }}>
            {renderPromoMedia(locationData.topBannerUrl)}
          </div>
        )}

        {/* MAIN APP CONTAINER */}
        <div style={{ 
          flex: 1, 
          width: '100%', 
          position: 'relative', 
          overflow: 'hidden',
          borderRadius: `${mainRadTop} ${mainRadTop} ${mainRadBot} ${mainRadBot}`,
          boxShadow: (showTopBanner || showBottomBanner) ? '0 4px 16px rgba(0,0,0,0.05)' : 'none',
          background: 'var(--card)'
        }}>
          {screen === 'landing'  && <TableLanding brand={brand} />}
          {screen === 'menu'     && <MenuBrowse brand={brand} />}
          {screen === 'product'  && <ProductPage brand={brand} />}
          {screen === 'cart'     && <CartPage brand={brand} />}
          {screen === 'checkout' && <CheckoutPage brand={brand} />}
          {screen === 'success'  && <OrderSuccess brand={brand} />}
        </div>

        {/* BOTTOM BANNER */}
        {showBottomBanner && (
          <div style={{ 
            height: `${bH * 4 + 4}vh`, 
            borderRadius: `${bRadTop ? '16px' : '0'} ${bRadTop ? '16px' : '0'} ${bRadBot ? '16px' : '0'} ${bRadBot ? '16px' : '0'}`,
            background: locationData.bottomBannerContent.startsWith('http') ? '#000' : '#1e293b', 
            flexShrink: 0, 
            marginTop: (!bRadTop && showBottomBanner) ? 0 : '12px',
            position: 'relative', 
            zIndex: 100, 
            overflow: 'hidden',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.1)' 
          }}>
            {renderBottomBanner(locationData.bottomBannerContent)}
          </div>
        )}
      </div>
    </>
  );
}
