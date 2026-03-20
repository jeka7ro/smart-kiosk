import { useState, useEffect } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { useBrand } from '../App';
import { BRANDS, applyBrandTheme } from '../config/brands.js';
import { t, LANGUAGES, LANGUAGE_NAMES } from '../i18n/translations.js';
import './WelcomeScreen.css';

export default function WelcomeScreen() {
  const goTo    = useKioskStore((s) => s.goTo);
  const goToMenu= useKioskStore((s) => s.goToMenu);
  const lang    = useKioskStore((s) => s.lang);
  const setLang = useKioskStore((s) => s.setLang);
  const brand   = useBrand();
  const [slide, setSlide] = useState(0);
  const slides = brand.welcomeSlides;

  useEffect(() => {
    const timer = setInterval(() => setSlide((s) => (s + 1) % slides.length), 3500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const switchBrand = (brandId) => {
    applyBrandTheme(brandId);
    window.location.search = `?brand=${brandId}`;
  };

  return (
    <div className="welcome-screen" onClick={() => goTo('orderType')}>
      {/* Animated background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Logo */}
      <div className="welcome-logo">
        {brand.logoImg ? (
          <img
            src={brand.logoImg}
            alt={brand.name}
            className="logo-img"
            style={{ height: brand.logoHeight || 72 }}
            onError={(e) => { e.target.style.display='none'; }}
          />
        ) : (
          <div className="logo-icon">{brand.emoji}</div>
        )}
      </div>

      {/* Promo slides — crossfade */}
      <div className="welcome-promo-wrap">
        {slides.map((s, i) => (
          <div key={i} className={`welcome-promo ${i === slide ? 'promo--active' : ''}`}>
            {s.heroImage ? (
              <img
                src={s.heroImage}
                alt={s.headline}
                className="promo-hero-img"
                onError={(e) => { e.target.style.display='none'; }}
              />
            ) : s.emoji ? (
              <div className="promo-emoji">{s.emoji}</div>
            ) : null}
            <h1 className="promo-headline">{s.headline}</h1>
            <p className="promo-sub">{s.sub}</p>
          </div>
        ))}
        <div className="slide-dots">
          {slides.map((_, i) => (
            <div key={i} className={`dot ${i === slide ? 'dot--active' : ''}`} />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="welcome-cta">
        <button className="cta-button">
          {t('tap_to_order', lang)}
        </button>
      </div>

      {/* Language selector */}
      <div className="welcome-langs">
        {LANGUAGES.map(l => (
          <button
            key={l}
            className={`lang-btn ${lang === l ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setLang(l); }}
          >
            {LANGUAGE_NAMES[l]}
          </button>
        ))}
      </div>

      {/* Dev brand switcher — DEMO ONLY */}
      <div className="brand-switcher" onClick={(e) => e.stopPropagation()}>
        <span className="bs-label">Demo brand:</span>
        {Object.values(BRANDS).map(b => (
          <button
            key={b.id}
            className={`bs-btn ${brand.id === b.id ? 'bs-btn--active' : ''}`}
            onClick={() => switchBrand(b.id)}
          >
            {b.emoji} {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}

