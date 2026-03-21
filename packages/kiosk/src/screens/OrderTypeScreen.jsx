import { useKioskStore } from '../store/kioskStore';
import { t } from '../i18n/translations.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import './OrderTypeScreen.css';

export default function OrderTypeScreen() {
  useInactivityTimeout(90);
  const setOrderType = useKioskStore((s) => s.setOrderType);
  const goTo = useKioskStore((s) => s.goTo);
  const lang = useKioskStore((s) => s.lang);

  return (
    <div className="order-type-screen">
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
