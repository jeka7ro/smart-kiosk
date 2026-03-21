import { useKioskStore } from '../store/kioskStore';
import { t, LANGUAGES, LANGUAGE_NAMES, LANGUAGE_FLAGS } from '../i18n/translations.js';
import { BRANDS } from '../config/brands.js';
import './BrandSelectScreen.css';

const BRAND_INFO = {
  smashme:     { label: 'SmashMe',       color: '#EE3B24', emoji: '🍔', desc: 'Burgeri smash suculenți' },
  sushimaster: { label: 'Sushi Master',  color: '#E31E24', emoji: '🍣', desc: 'Bucătărie japoneză autentică' },
  ikura:       { label: 'Ikura',         color: '#8b5cf6', emoji: '🍱', desc: 'Sushi premium & bowls' },
  welovesushi: { label: 'WeLoveSushi',   color: '#ec4899', emoji: '🍣', desc: 'Sushi fresh & creative' },
};

export default function BrandSelectScreen() {
  const goTo = useKioskStore((s) => s.goTo);
  const lang = useKioskStore((s) => s.lang);
  const setLang = useKioskStore((s) => s.setLang);
  const locationData = useKioskStore((s) => s.locationData);

  const brands = locationData?.brands || [];

  const selectBrand = (brandId) => {
    // Update brand in URL and go to orderType
    const url = new URL(window.location);
    url.searchParams.set('brand', brandId);
    window.history.replaceState({}, '', url);
    goTo('orderType');
  };

  return (
    <div className="brand-select-screen screen">
      {/* Language selector top-right */}
      <div className="bss-langs" onClick={(e) => e.stopPropagation()}>
        {LANGUAGES.map(l => (
          <button
            key={l}
            className={`bss-lang-btn ${lang === l ? 'active' : ''}`}
            onClick={() => setLang(l)}
          >
            {LANGUAGE_FLAGS[l]} {LANGUAGE_NAMES[l]}
          </button>
        ))}
      </div>

      <h1 className="bss-title">{t('choose_brand', lang) || 'Alege restaurantul'}</h1>
      <p className="bss-subtitle">{t('choose_brand_sub', lang) || 'Poți comanda de la mai multe restaurante'}</p>

      <div className="bss-grid">
        {brands.map(bId => {
          const info = BRAND_INFO[bId] || { label: bId, color: '#6b7a99', emoji: '🍽', desc: '' };
          const brandConfig = BRANDS[bId];
          return (
            <button
              key={bId}
              className="bss-card"
              style={{ '--brand-c': info.color }}
              onClick={() => selectBrand(bId)}
            >
              <div className="bss-logo-wrapper" style={{ height: '120px' }}>
                <img 
                  src={`/brands/${bId}-logo.png`} 
                  alt={info.label} 
                  className="bss-logo" 
                  style={{ maxHeight: '100%', maxWidth: '200px' }}
                  onError={(e) => { e.target.style.display='none'; }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <button className="bss-back" onClick={() => goTo('welcome')}>
        ← {t('back', lang) || 'Înapoi'}
      </button>
    </div>
  );
}
