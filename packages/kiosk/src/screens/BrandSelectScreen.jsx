import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
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
  const locationData = useKioskStore((s) => s.locationData);

  const brands = locationData?.brands || [];

  const selectBrand = (brandId) => {
    // Store selected brand in URL and go to menu
    const url = new URL(window.location);
    url.searchParams.set('brand', brandId);
    window.history.replaceState({}, '', url);
    goTo('menu');
  };

  return (
    <div className="brand-select-screen screen">
      <h1 className="bss-title">{t('choose_brand', lang) || 'Alege restaurantul'}</h1>
      <p className="bss-subtitle">{t('choose_brand_sub', lang) || 'Poți comanda de la mai multe restaurante'}</p>

      <div className="bss-grid">
        {brands.map(bId => {
          const info = BRAND_INFO[bId] || { label: bId, color: '#6b7a99', emoji: '🍽', desc: '' };
          return (
            <button
              key={bId}
              className="bss-card"
              style={{ '--brand-c': info.color }}
              onClick={() => selectBrand(bId)}
            >
              <span className="bss-emoji">{info.emoji}</span>
              <span className="bss-label">{info.label}</span>
              <span className="bss-desc">{info.desc}</span>
            </button>
          );
        })}
      </div>

      <button className="bss-back" onClick={() => goTo('orderType')}>
        ← {t('back', lang) || 'Înapoi'}
      </button>
    </div>
  );
}
