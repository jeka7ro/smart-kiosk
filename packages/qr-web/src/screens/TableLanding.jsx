import { useQrStore } from '../store/qrStore.js';
import './TableLanding.css';

export default function TableLanding({ brand }) {
  const goTo     = useQrStore((s) => s.goTo);
  const tableNum = useQrStore((s) => s.tableNum);

  return (
    <div className="tl-screen safe-top">
      {/* Header */}
      <div className="tl-header">
        {brand.logoImg
          ? <img src={brand.logoImg} alt={brand.name} className="tl-logo" />
          : <span className="tl-brand">{brand.emoji} {brand.name}</span>
        }
      </div>

      {/* Hero */}
      <div className="tl-hero fade-up">
        <div className="tl-table-badge">
          <span className="tl-tb-label">MASA</span>
          <span className="tl-tb-num">{tableNum || '?'}</span>
        </div>
        <h1 className="tl-title">Bun venit!</h1>
        <p className="tl-subtitle">
          Comandați și plătiți direct de pe telefon.<br />
          Fără așteptare, fără coadă.
        </p>
      </div>

      {/* Features */}
      <div className="tl-features fade-up">
        {[
          { icon: '📱', text: 'Comandă de pe telefon' },
          { icon: '💳', text: 'Plată online securizată' },
          { icon: '⚡', text: 'Livrare directă la masă' },
        ].map((f, i) => (
          <div key={i} className="tl-feature" style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="tl-f-icon">{f.icon}</span>
            <span className="tl-f-text">{f.text}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="tl-cta safe-bottom">
        <button className="btn btn-primary btn-lg btn-full" onClick={() => goTo('menu')}>
          <span>Vezi meniul</span>
          <span className="tl-arrow">→</span>
        </button>
        <p className="tl-fine">Prin comandare, accepti termenii și condițiile {brand.name}</p>
      </div>
    </div>
  );
}
