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
      <div 
        className="bss-langs" 
        onClick={(e) => e.stopPropagation()}
        style={locationData?.langVerticalPosition === 'bottom' ? { top: 'auto', bottom: '30px' } : {}}
      >
        {allowedLangs.map(l => (
          <button
            key={l}
            className={`bss-lang-btn ${lang === l ? 'active' : ''}`}
            onClick={() => setLang(l)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px',
              ...(lang !== l && locationData?.langBgColor ? { background: locationData.langBgColor } : {}),
              ...(lang !== l && locationData?.langBorderColor ? { borderColor: locationData.langBorderColor } : {})
            }}
          >
            <img src={`https://flagcdn.com/w40/${LANGUAGE_FLAGS[l]}.png`} alt={l} style={{ width: 18, borderRadius: 2 }} />
            {LANGUAGE_NAMES[l]}
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
          <div className="ot-card-icon">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 2v20" />
              <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
              <path d="M6 2v20" />
              <path d="M3 2v6a3 3 0 0 0 6 0V2" />
            </svg>
          </div>
          <h2>{t('dine_in', lang)}</h2>
          <p>{t('dine_in_sub', lang)}</p>
          <div className="ot-arrow">→</div>
        </button>

        <div className="ot-divider">{t('or', lang)}</div>

        <button className="ot-card" onClick={() => setOrderType('takeaway', null)}>
          <div className="ot-card-icon">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2>{t('takeaway', lang)}</h2>
          <p>{t('takeaway_sub', lang)}</p>
          <div className="ot-arrow">→</div>
        </button>
      </div>

      <p className="ot-note">{t('pickup_note', lang)}</p>
    </div>
  );
}
