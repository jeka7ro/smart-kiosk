import { useKioskStore } from '../store/kioskStore';
import { t, LANGUAGES, LANGUAGE_NAMES, LANGUAGE_FLAGS } from '../i18n/translations.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import './OrderTypeScreen.css';

export default function OrderTypeScreen() {
  useInactivityTimeout(90);
  const setOrderType = useKioskStore((s) => s.setOrderType);
  const goTo = useKioskStore((s) => s.goTo);
  const lang = useKioskStore((s) => s.lang);
  const setLang = useKioskStore((s) => s.setLang);
  const locationData = useKioskStore((s) => s.locationData);

  const allowedLangs = locationData?.languages && locationData.languages.length > 0 
    ? locationData.languages 
    : LANGUAGES;

  const btnColor = locationData?.langButtonColor || '#0f172a';
  const isLightColor = parseInt(btnColor.replace('#',''), 16) > 0xaaaaaa;
  const btnTextColor = isLightColor ? '#111' : '#fff';
  const showLangSelector = (locationData?.langSelectorPosition || 'after') !== 'before';

  return (
    <div className="order-type-screen screen">
      {/* Language selector top-right */}
      {showLangSelector && (
      <div className="bss-langs" style={{ position: 'absolute', top: 32, right: 32, zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
        {allowedLangs.map(l => (
          <button
            key={l}
            className={`bss-lang-btn ${lang === l ? 'active' : ''}`}
            onClick={() => setLang(l)}
            style={lang === l ? { background: btnColor, color: btnTextColor, borderColor: btnColor, opacity: 1 } : { opacity: 0.5 }}
          >
            {LANGUAGE_FLAGS[l]} {LANGUAGE_NAMES[l]}
          </button>
        ))}
      </div>
      )}

      <button className="back-btn-screen" onClick={() => goTo('welcome')}>
        ← {t('back', lang)}
      </button>

      <div className="ot-header fade-in">
        <h1>{t('how_to_order', lang)}</h1>
        <p>{t('order_type_subtitle', lang)}</p>
      </div>

      <div className="ot-options slide-up">
        <button className="ot-card" onClick={() => setOrderType('dine-in', null)}>
          <div className="ot-card-icon">🍽️</div>
          <h2>{t('dine_in', lang)}</h2>
          <p>{t('dine_in_sub', lang)}</p>
          <div className="ot-arrow">→</div>
        </button>

        <div className="ot-divider">{t('or', lang)}</div>

        <button className="ot-card" onClick={() => setOrderType('takeaway', null)}>
          <div className="ot-card-icon">🛍️</div>
          <h2>{t('takeaway', lang)}</h2>
          <p>{t('takeaway_sub', lang)}</p>
          <div className="ot-arrow">→</div>
        </button>
      </div>

      <p className="ot-note">{t('pickup_note', lang)}</p>
    </div>
  );
}
