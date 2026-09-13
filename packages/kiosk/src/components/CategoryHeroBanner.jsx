import React, { useRef } from 'react';
import { proxySyrveImage } from '../utils/imageUtils.js';
import { t } from '../i18n/translations.js';
import { getEffectivePrice, hasActivePromo } from '../utils/priceUtils.js';
import ProductVisualFX from './ProductVisualFX.jsx';
import './CategoryHeroBanner.css';

export default function CategoryHeroBanner({ product, categoryName, lang, onSelect, onQuickAdd, steam = true, brandLogo = null }) {
  if (!product) return null;

  const bannerRef = useRef(null);
  const hasImage = !!product.image;
  const isPromo = hasActivePromo(product) || 
                  (product.oldPrice && Number(product.oldPrice) > Number(product.price)) ||
                  (product.promoPrice && Number(product.promoPrice) > 0 && Number(product.promoPrice) < Number(product.price));
  const effectivePrice = getEffectivePrice(product);
  const priceFormatted = effectivePrice.toFixed(2);
  const originalPrice = Number(product.oldPrice || product.price || 0);

  const rawDesc = (lang !== 'ro' && product.translations?.[lang]) 
    ? product.translations[lang] 
    : (product.description || product.shortDescription || '');
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
    // Butonul "+ Adaugă" adaugă direct în coș (sau deschide opțiunile necesare dacă există)
    if (onQuickAdd) {
      onQuickAdd(e);
    } else if (onSelect) {
      onSelect(product);
    }
  };

  return (
    <div className="category-hero-kfc-banner" ref={bannerRef} onClick={handleCardClick}>
      {/* Full-bleed background image - exact KFC style */}
      {hasImage && (
        <img 
          src={proxySyrveImage(product.image)} 
          alt={product.name} 
          className="hero-kfc-bg-img"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      {/* Subtle vignette overlay for text readability */}
      <div className="hero-kfc-overlay" />

      {/* Visual FX layer: Abur la cald, Gheață la băuturi, Logo brand plutitor la deserturi, Nimic la sosuri */}
      {steam && (
        <ProductVisualFX 
          heroRef={bannerRef}
          effects={{ steam: true, parallax: false, ice: true, brandFloat: true }}
          isHotProduct={true}
          product={product}
          brandLogo={brandLogo}
        />
      )}

      {/* Top Bar: Round Brand Avatar + Star Badge & KFC-style Price Sticker + Info Icon */}
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
  );
}
