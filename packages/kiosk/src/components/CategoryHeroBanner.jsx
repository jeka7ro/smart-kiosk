import React, { useRef, useState, useEffect } from 'react';
import { proxySyrveImage } from '../utils/imageUtils.js';
import { t } from '../i18n/translations.js';
import { getEffectivePrice, hasActivePromo } from '../utils/priceUtils.js';
import ProductVisualFX from './ProductVisualFX.jsx';
import { shouldShowSteam } from '../utils/visualFxUtils.js';
import './CategoryHeroBanner.css';

export default function CategoryHeroBanner({ 
  product: singleProduct, 
  products = [], 
  categoryName, 
  lang, 
  onSelect, 
  onQuickAdd, 
  steam = true, 
  brandLogo = null, 
  brandId = null,
  intervalSeconds = null
}) {
  const productList = (products && products.length > 0) ? products : (singleProduct ? [singleProduct] : []);
  if (productList.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null);
  const [isFading, setIsFading] = useState(false);

  // Dynamic rotation speed configurable from kiosk manager or admin
  const [currentSpeed, setCurrentSpeed] = useState(() => {
    const localVal = typeof window !== 'undefined' ? Number(localStorage.getItem('kiosk_hero_interval')) : null;
    return Number(localVal || intervalSeconds || 5);
  });

  // Listen to live speed changes triggered by ManagerPortalModal
  useEffect(() => {
    const handleSpeedChange = () => {
      const s = Number(localStorage.getItem('kiosk_hero_interval'));
      if (s && s >= 2) setCurrentSpeed(s);
    };
    window.addEventListener('kiosk_hero_interval_changed', handleSpeedChange);
    window.addEventListener('storage', handleSpeedChange);
    return () => {
      window.removeEventListener('kiosk_hero_interval_changed', handleSpeedChange);
      window.removeEventListener('storage', handleSpeedChange);
    };
  }, []);

  // Pre-load all hero images so transitions never stutter or blink
  useEffect(() => {
    if (!productList.length) return;
    productList.forEach(p => {
      if (p?.image) {
        const img = new Image();
        img.src = proxySyrveImage(p.image);
      }
    });
  }, [productList]);

  // Reset index when category or brand changes
  useEffect(() => {
    setCurrentIndex(0);
    setPrevIndex(null);
    setIsFading(false);
  }, [categoryName, brandId, productList.length]);

  // Rotate every X seconds (configurable) with ultra-smooth cross-fade
  useEffect(() => {
    if (productList.length <= 1) return;

    const ms = Math.max(2, currentSpeed) * 1000;
    const interval = setInterval(() => {
      setPrevIndex(currentIndex);
      setIsFading(true);
      setCurrentIndex(prev => (prev + 1) % productList.length);

      const timer = setTimeout(() => {
        setIsFading(false);
        setPrevIndex(null);
      }, 750); // 750ms cinematic cross-fade

      return () => clearTimeout(timer);
    }, ms);

    return () => clearInterval(interval);
  }, [productList.length, currentIndex, currentSpeed, categoryName, brandId]);

  const product = productList[currentIndex] || productList[0];
  const prevProduct = prevIndex !== null ? productList[prevIndex] : null;
  const bannerRef = useRef(null);
  const hasImage = !!product?.image;
  const isPromo = hasActivePromo(product) || 
                  (product?.oldPrice && Number(product.oldPrice) > Number(product.price)) ||
                  (product?.promoPrice && Number(product.promoPrice) > 0 && Number(product.promoPrice) < Number(product.price));
  const effectivePrice = getEffectivePrice(product);
  const priceFormatted = effectivePrice.toFixed(2);
  const originalPrice = Number(product?.oldPrice || product?.price || 0);

  const rawDesc = (lang !== 'ro' && product?.translations?.[lang]) 
    ? product.translations[lang] 
    : (product?.description || product?.shortDescription || '');
  const cleanDesc = rawDesc ? rawDesc.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim() : '';
  const desc = cleanDesc || (lang === 'en' ? 'Freshly prepared with premium ingredients.' : 'Pregătit proaspăt pe loc cu ingrediente alese.');

  const handleCardClick = () => {
    if (onSelect) onSelect(product);
  };

  const handleInfoClick = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(product);
  };

  const handleActionBtnClick = (e) => {
    e.stopPropagation();
    if (onQuickAdd) {
      onQuickAdd(product, e);
    } else if (onSelect) {
      onSelect(product);
    }
  };

  return (
    <div className="category-hero-kfc-banner" ref={bannerRef} onClick={handleCardClick}>
      {/* Background Images with cinematic 750ms Cross-fade */}
      <div className="hero-kfc-bg-container">
        {/* Previous Image (fades out underneath) */}
        {prevProduct?.image && (
          <img 
            key={`prev-${prevProduct.id || prevProduct.name}`}
            src={proxySyrveImage(prevProduct.image)} 
            alt="prev" 
            className="hero-kfc-bg-img hero-kfc-bg-img--prev"
          />
        )}

        {/* Current Active Image (fades in smoothly with subtle zoom) */}
        {hasImage && (
          <img 
            key={`curr-${product.id || product.name}`}
            src={proxySyrveImage(product.image)} 
            alt={product.name} 
            className={`hero-kfc-bg-img hero-kfc-bg-img--current ${isFading ? 'hero-kfc-bg-img--animating' : ''}`}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
      </div>

      {/* Subtle vignette overlay for text readability */}
      <div className="hero-kfc-overlay" />

      {/* Visual FX layer: Abur la cald, Gheață la băuturi, Logo brand plutitor la deserturi */}
      {steam && (
        <ProductVisualFX 
          key={`fx-${product.id || product.name}`}
          heroRef={bannerRef}
          effects={{ steam: true, parallax: false, ice: true, brandFloat: true }}
          isHotProduct={shouldShowSteam(product, brandId)}
          product={product}
          brandLogo={brandLogo}
          brandId={brandId}
        />
      )}

      {/* Dynamic Content Container */}
      <div className="hero-kfc-content-wrapper">
        {/* Top Bar: Round Brand Avatar + Price Sticker + Info */}
        <div className="hero-kfc-top-bar">
          <div className="hero-kfc-top-left">
            {brandLogo && (
              <div className="hero-kfc-brand-avatar">
                <img 
                  src={brandLogo} 
                  alt="Brand" 
                  className="hero-kfc-avatar-img"
                  onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                />
              </div>
            )}

            {/* Doar daca este reducere activa afisam OFERTA SPECIALA, fara eticheta redundanta de Produsul Vedeta */}
            {isPromo && (
              <div className="hero-kfc-badge hero-kfc-badge--promo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span>{lang === 'en' ? 'SPECIAL OFFER' : 'OFERTĂ SPECIALĂ'}</span>
              </div>
            )}
          </div>

          <div className="hero-kfc-top-right">
            {/* KFC Price Sticker Badge in top right */}
            <div 
              key={`price-${product.id}`}
              className={`hero-kfc-price-sticker ${isPromo ? 'hero-kfc-price-sticker--promo' : ''} ${isFading ? 'hero-content-fade-in' : ''}`}
            >
              {isPromo && originalPrice > effectivePrice && (
                <span className="kfc-price-old">{originalPrice.toFixed(2)}</span>
              )}
              <span className="kfc-price-num">{priceFormatted}</span>
              <span className="kfc-price-curr">lei</span>
            </div>

            {/* Info (i) button matching product cards */}
            <button 
              type="button" 
              className="hero-kfc-info-btn"
              title={lang === 'en' ? 'Product details' : 'Detalii produs'}
              onClick={handleInfoClick}
            >
              i
            </button>
          </div>
        </div>

        {/* Bottom Row: Product Title, Description & + Adaugă Button */}
        <div key={`bottom-${product.id}`} className={`hero-kfc-bottom-bar ${isFading ? 'hero-content-fade-in' : ''}`}>
          <div className="hero-kfc-info">
            <h2 className="hero-kfc-title">{product.name}</h2>
            {desc && <p className="hero-kfc-desc">{desc}</p>}
          </div>

          <button 
            type="button" 
            className="hero-kfc-add-btn"
            onClick={handleActionBtnClick}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{lang === 'en' ? 'Add' : 'Adaugă'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
