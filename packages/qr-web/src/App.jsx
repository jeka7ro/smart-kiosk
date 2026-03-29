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

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

export default function App({ brandId }) {
  const screen = useQrStore((s) => s.screen);
  const init   = useQrStore((s) => s.init);
  const brand  = getQrBrand(brandId);
  
  const setLocationData = useQrStore((s) => s.setLocationData);
  const locationData = useQrStore((s) => s.locationData);
  const isIdle = useQrStore((s) => s.isIdle);
  const setIdle = useQrStore((s) => s.setIdle);
  
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
        // ONLY read mobile-specific settings from mobileConfig — never inherit kiosk settings
        const mc = loc.data?.mobileConfig || {};
        const merged = {
          ...loc,
          topBannerUrl:             mc.topBannerUrl             || '',
          topBannerHeight:          mc.topBannerHeight          ?? 3,
          topBannerRadiusTop:       mc.topBannerRadiusTop       ?? true,
          topBannerRadiusBottom:    mc.topBannerRadiusBottom    ?? false,
          bottomBannerContent:      mc.bottomBannerUrl || mc.bottomBannerText || '',
          bottomBannerUrl:          mc.bottomBannerUrl          || '',
          bottomBannerText:         mc.bottomBannerText         || '',
          bottomBannerHeight:       mc.bottomBannerHeight       ?? 2,
          bottomBannerRadiusTop:    mc.bottomBannerRadiusTop    ?? false,
          bottomBannerRadiusBottom: mc.bottomBannerRadiusBottom ?? true,
          bottomBannerTextFixed:    mc.bottomBannerTextFixed    ?? false,
          bottomBannerTextAlign:    mc.bottomBannerTextAlign    || 'center',
          bottomBannerBg:           mc.bottomBannerBg           || '#1e293b',
          posterUrl:                mc.posterUrl                || '',
          inactivityTimeout:        mc.inactivityTimeout        ?? 30,
        };
        setLocationData(merged);
        // Show screensaver on first load if configured
        if (mc.posterUrl) {
          setTimeout(() => setIdle(true), 100);
        }
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
      
      <div style={{ maxWidth: 480, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box', background: 'var(--bg, #f5f5f7)' }}>
        
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

        {/* MAIN APP CONTAINER — scrollable */}
        <div style={{ 
          flex: 1, 
          width: '100%', 
          position: 'relative', 
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          background: 'var(--card, #fff)'
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
