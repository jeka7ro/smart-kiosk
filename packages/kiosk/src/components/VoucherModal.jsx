import { useState, useEffect } from 'react';
import { useKioskStore } from '../store/kioskStore';
import './VoucherModal.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';

const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

export default function VoucherModal({ isOpen, onClose }) {
  const { locationData, getCartSubtotal, setAppliedVoucher, activeBrandId, cartItems } = useKioskStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  // Support physical keyboard typing as well
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        handleApply();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeyPress('BACKSPACE');
        return;
      }
      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, code]);

  if (!isOpen) return null;

  const handleKeyPress = (key) => {
    setError('');
    setSuccess('');
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (_) { }

    if (key === 'BACKSPACE') {
      setCode((prev) => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setCode('');
    } else {
      if (code.length < 20) {
        setCode((prev) => prev + key);
      }
    }
  };

  const handleApply = async () => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Introduceți un cod promoțional.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const subtotal = getCartSubtotal();
      const params = new URLSearchParams(window.location.search);
      const locId = locationData?.id || params.get('loc') || localStorage.getItem('kiosk_loc_id') || '';
      const kioskId = locationData?.kioskUrl || params.get('kiosk') || '';

      const cartBrands = Array.from(
        new Set([
          ...(cartItems || []).map(i => i.brandId).filter(Boolean),
          ...(activeBrandId ? [activeBrandId] : []),
        ])
      );

      const res = await fetch(`${BACKEND}/api/vouchers/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          subtotal,
          locationId: locId,
          kioskId,
          brandId: activeBrandId || 'smashme',
          cartBrands
        })
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        setError(data.error || 'Codul promoțional nu este valid.');
        return;
      }

      setSuccess(`Codul "${cleanCode}" a fost aplicat cu succes! (-${data.voucher.discountAmount.toFixed(2)} lei)`);
      setAppliedVoucher(data.voucher);

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setError('Eroare la verificarea codului. Vă rugăm reîncercați.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="voucher-modal-overlay" onClick={onClose}>
      <div className="voucher-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="voucher-modal-header">
          <div className="voucher-modal-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </div>
          <div>
            <h2>Cod Promoțional / Voucher</h2>
            <p>Introduceți codul pentru a beneficia de reducere</p>
          </div>
          <button type="button" className="voucher-modal-close" onClick={onClose} aria-label="Închide">
            ✕
          </button>
        </div>

        {/* Input display */}
        <div className="voucher-input-box">
          <div className={`voucher-input-display ${code ? 'has-value' : ''}`}>
            {code || <span className="voucher-placeholder">Introduceți codul</span>}
            <span className="voucher-caret" />
          </div>
          {code && (
            <button
              type="button"
              className="voucher-clear-btn"
              onClick={() => handleKeyPress('CLEAR')}
              title="Șterge tot"
            >
              ✕
            </button>
          )}
        </div>

        {/* Feedback messages */}
        {error && <div className="voucher-feedback voucher-feedback--error">{error}</div>}
        {success && <div className="voucher-feedback voucher-feedback--success">{success}</div>}

        {/* On-screen Virtual Keyboard */}
        <div className="voucher-keyboard">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="voucher-keyboard-row">
              {row.map((k) => {
                const isBack = k === 'BACKSPACE';
                return (
                  <button
                    key={k}
                    type="button"
                    className={`voucher-key ${isBack ? 'voucher-key--backspace' : ''}`}
                    onClick={() => handleKeyPress(k)}
                  >
                    {isBack ? (
                      <span className="voucher-backspace-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                          <line x1="18" y1="9" x2="12" y2="15" />
                          <line x1="12" y1="9" x2="18" y2="15" />
                        </svg>
                      </span>
                    ) : (
                      k
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="voucher-modal-actions">
          <button type="button" className="voucher-btn voucher-btn-cancel" onClick={onClose}>
            Renunță
          </button>
          <button
            type="button"
            className="voucher-btn voucher-btn-apply"
            disabled={!code.trim() || loading}
            onClick={handleApply}
          >
            {loading ? 'Se verifică...' : 'Aplică Codul'}
          </button>
        </div>
      </div>
    </div>
  );
}
