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
  brandId = null 
}) {
  const productList = (products && products.length > 0) ? products : (singleProduct ? [singleProduct] : []);
  if (productList.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Reset index when category or brand changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsTransitioning(false);
  }, [categoryName, brandId, productList.length]);

  // Rotate every 5 seconds smoothly and elegantly
  useEffect(() => {
    if (productList.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % productList.length);
        setIsTransitioning(false);
      }, 400); // 400ms smooth cross-fade duration
    }, 5000);

    return () => clearInterval(interval);
  }, [productList.length, categoryName, brandId]);

  const product = productList[currentIndex] || productList[0];
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
      {/* Full-bleed background image - exact KFC style with smooth fade */}
      {hasImage && (
        <img 
          key={product.id || product.name}
          src={proxySyrveImage(product.image)} 
          alt={product.name} 
          className={`hero-kfc-bg-img ${isTransitioning ? 'hero-bg-fade' : ''}`}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

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

      {/* Animated Content Container */}
      <div className={`hero-kfc-content-wrapper ${isTransitioning ? 'hero-content-fade' : ''}`}>
        {/* Top Bar: Round Brand Avatar + Star Badge & Carousel Dots + Price Sticker + Info */}
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

            <div className={`hero-kfc-badge ${isPromo ? 'hero-kfc-badge--promo' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span>
                {isPromo 
                  ? (lang === 'en' ? 'SPECIAL OFFER' : 'OFERTĂ SPECIALĂ')
                  : (lang === 'en' ? 'STAR PRODUCT' : 'PRODUSUL VEDETĂ')
                }
              </span>
            </div>
          </div>

          {/* Carousel Progress Dots Navigation */}
          {productList.length > 1 && (
            <div className="hero-kfc-carousel-dots" onClick={(e) => e.stopPropagation()}>
              {productList.map((p, idx) => (
                <button
                  key={p.id || idx}
                  type="button"
                  className={`hero-kfc-dot ${idx === currentIndex ? 'hero-kfc-dot--active' : ''}`}
                  onClick={() => {
                    if (idx !== currentIndex) {
                      setIsTransitioning(true);
                      setTimeout(() => {
                        setCurrentIndex(idx);
                        setIsTransitioning(false);
                      }, 200);
                    }
                  }}
                  title={p.name}
                  aria-label={`Produsul ${idx + 1}`}
                />
              ))}
            </div>
          )}

          <div className="hero-kfc-top-right">
            {/* KFC Price Sticker Badge in top right */}
            <div className={`hero-kfc-price-sticker ${isPromo ? 'hero-kfc-price-sticker--promo' : ''}`}>
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
        <div className="hero-kfc-bottom-bar">
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
