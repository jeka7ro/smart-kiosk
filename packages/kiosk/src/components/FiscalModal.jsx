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
            <div className="fm-icon-badge">🏢</div>
            <div>
              <h3 className="fm-title">Bon Fiscal cu CUI / Factură</h3>
              <p className="fm-subtitle">Introduceți CUI-ul firmei pentru căutare automată</p>
            </div>
          </div>
          <button className="fm-close-btn" onClick={onClose} aria-label="Închide">
            ✕
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
              {loading ? 'Căutare...' : '🔍 Caută Firmă'}
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="fm-error-banner">
              <span>⚠️</span>
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
                ✓ Salvează Datele Firmei
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
            >
              ⌫
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
