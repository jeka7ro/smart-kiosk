import { useState } from 'react';
import './FiscalModal.css';

export default function FiscalModal({ isOpen, onClose, onConfirm, initialCui = '', lang = 'ro' }) {
  const [cuiInput, setCuiInput] = useState(initialCui.replace(/^RO/i, ''));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [companyResult, setCompanyResult] = useState(null);

  if (!isOpen) return null;

  const handleKeyPress = (char) => {
    setErrorMsg('');
    if (char === 'C') {
      setCuiInput('');
      setCompanyResult(null);
    } else if (char === 'backspace') {
      setCuiInput((prev) => prev.slice(0, -1));
      setCompanyResult(null);
    } else {
      if (cuiInput.length < 10) {
        setCuiInput((prev) => prev + char);
        setCompanyResult(null);
      }
    }
  };

  const handleVerify = async () => {
    if (!cuiInput || cuiInput.length < 2) {
      setErrorMsg('Introduceți un CUI format din cel puțin 2 cifre.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setCompanyResult(null);

    try {
      const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';
      const response = await fetch(`${BACKEND}/api/anaf/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cui: cuiInput }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMsg(data.error || 'Firma nu a putut fi identificată.');
        return;
      }

      setCompanyResult(data.company);
    } catch (err) {
      console.error('[FiscalModal] Lookup failed:', err);
      setErrorMsg('Nu s-a putut contacta serverul. Vă rugăm încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (companyResult) {
      onConfirm(companyResult);
      onClose();
    }
  };

  return (
    <div className="fiscal-modal-overlay" onClick={onClose}>
      <div className="fiscal-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fm-header">
          <div className="fm-header-title-group">
            <div className="fm-icon-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="9" y1="6" x2="15" y2="6" />
                <line x1="9" y1="10" x2="15" y2="10" />
                <line x1="9" y1="14" x2="15" y2="14" />
                <line x1="9" y1="18" x2="11" y2="18" />
              </svg>
            </div>
            <div>
              <h3 className="fm-title">Bon Fiscal cu CUI / Factură</h3>
              <p className="fm-subtitle">Introduceți CUI-ul firmei pentru căutare automată</p>
            </div>
          </div>
          <button className="fm-close-btn" onClick={onClose} aria-label="Închide">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="fm-body">
          {/* CUI Display & Search Button */}
          <div className="fm-input-wrapper focused">
            <div className="fm-input-content">
              <span className="fm-prefix">RO</span>
              {cuiInput ? (
                <span className="fm-cui-text">{cuiInput}</span>
              ) : (
                <span className="fm-placeholder">Cod fiscal...</span>
              )}
            </div>

            <button
              className="fm-verify-btn"
              onClick={handleVerify}
              disabled={loading || cuiInput.length < 2}
            >
              {loading ? (
                'Căutare...'
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Caută Firmă</span>
                </>
              )}
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="fm-error-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Result Card */}
          {companyResult && (
            <div className="fm-result-card">
              <div className="fm-result-top">
                <h4 className="fm-result-name">{companyResult.name}</h4>
                <span className={`fm-vat-pill ${companyResult.isVatPayer ? 'vat-yes' : 'vat-no'}`}>
                  {companyResult.isVatPayer ? 'Plătitor TVA' : 'Neplătitor TVA'}
                </span>
              </div>
              <p className="fm-result-detail">
                <strong>CUI:</strong> {companyResult.rawCui} {companyResult.regCom ? `| Reg.Com: ${companyResult.regCom}` : ''}
              </p>
              {companyResult.address && (
                <p className="fm-result-detail">
                  <strong>Adresă:</strong> {companyResult.address}
                </p>
              )}

              <button className="fm-confirm-btn" onClick={handleSave}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Salvează Datele Firmei</span>
              </button>
            </div>
          )}

          {/* Keypad */}
          <div className="fm-keypad-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                className="fm-key-btn"
                onClick={() => handleKeyPress(String(num))}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="fm-key-btn fm-key-action"
              onClick={() => handleKeyPress('C')}
              title="Șterge tot"
            >
              C
            </button>
            <button
              type="button"
              className="fm-key-btn"
              onClick={() => handleKeyPress('0')}
            >
              0
            </button>
            <button
              type="button"
              className="fm-key-btn fm-key-action"
              onClick={() => handleKeyPress('backspace')}
              title="Șterge ultima cifră"
              aria-label="Șterge"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="fm-footer">
          <button className="fm-cancel-btn" onClick={onClose}>
            Renunță
          </button>
        </div>
      </div>
    </div>
  );
}
