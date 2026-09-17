import { useState, useEffect, useCallback } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { getBrand } from '../config/brands';
import './PinScreen.css';

const KEYPAD_KEYS = [
  { num: '1', letters: '' },
  { num: '2', letters: 'ABC' },
  { num: '3', letters: 'DEF' },
  { num: '4', letters: 'GHI' },
  { num: '5', letters: 'JKL' },
  { num: '6', letters: 'MNO' },
  { num: '7', letters: 'PQRS' },
  { num: '8', letters: 'TUV' },
  { num: '9', letters: 'WXYZ' },
];

export default function PinScreen({ loc, brandId, onUnlock, isScheduleLock = false, backendUrl }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Brand resolution
  const storeBrandId = useKioskStore((s) => s.activeBrandId);
  const urlBrand = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('brand') : null;
  const effectiveBrandId = urlBrand || brandId || storeBrandId || loc?.brands?.[0] || 'smashme';
  const brandConfig = getBrand(effectiveBrandId);
  const brandLogo = loc?.logoUrl || brandConfig?.logoImg || `/brands/${effectiveBrandId}-logo.png`;
  const brandName = brandConfig?.name || loc?.name || 'Smart Kiosk';

  const effectiveBackend = backendUrl || import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

  const sendLog = async (eventType, role) => {
    try {
      await fetch(`${effectiveBackend}/api/kiosk-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: loc?.id || '',
          locationName: loc?.name || '',
          kioskId: loc?.kioskId || localStorage.getItem('kiosk_device_id') || 'kiosk-main',
          eventType,
          role,
          details: {
            isScheduleLock,
            schedule: isScheduleLock ? `${loc?.lockStartTime || '22:00'} - ${loc?.lockEndTime || '09:00'}` : null,
            timestamp: new Date().toISOString()
          }
        })
      });
    } catch (e) {
      console.warn('[PinScreen] Failed to record log:', e.message);
    }
  };

  const checkPin = useCallback(async (enteredPin) => {
    if (submitting) return;

    const managerPin = String(loc?.kioskPin || '').trim();
    const vendorPin = String(loc?.vendorPin || '').trim();

    // Accepta strict PIN-ul setat pe locatie in panoul Admin sau fallback 1234/0000 daca locatia nu are pin
    const isManager = Boolean(managerPin && enteredPin === managerPin) || (!managerPin && !vendorPin && (enteredPin === '1234' || enteredPin === '0000'));
    const isVendor = Boolean(vendorPin && enteredPin === vendorPin);

    if (isManager) {
      setSubmitting(true);
      await sendLog('unlock_manager', 'manager');
      onUnlock?.('manager');
    } else if (isVendor) {
      setSubmitting(true);
      await sendLog('unlock_vendor', 'vendor');
      onUnlock?.('vendor');
    } else {
      setError(true);
      sendLog('unlock_failed', 'unknown');
      setTimeout(() => {
        setPin('');
      }, 450);
    }
  }, [submitting, loc, isScheduleLock, onUnlock, effectiveBackend]);

  const handleKey = useCallback((num) => {
    if (submitting) return;
    if (error) {
      setError(false);
      setPin(num);
      return;
    }
    if (pin.length < 4) {
      const next = pin + num;
      setPin(next);
      setError(false);
      if (next.length === 4) {
        checkPin(next);
      }
    }
  }, [pin, submitting, error, checkPin]);

  const handleDel = useCallback(() => {
    if (!submitting) {
      setPin((prev) => prev.slice(0, -1));
      setError(false);
    }
  }, [submitting]);

  // Physical keyboard navigation support
  useEffect(() => {
    const onKeyDown = (e) => {
      if (submitting) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        handleDel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey, handleDel, submitting]);

  return (
    <div className="pin-screen">
      {/* Ambient background glow */}
      <div className="ios-pin-ambient-glow" />

      <div className="ios-pin-card">
        {/* Brand Logo */}
        <div className="ios-pin-brand-header">
          {brandLogo && (
            <div className="ios-pin-logo-box">
              <img
                src={brandLogo}
                alt={brandName}
                className="ios-pin-logo-img"
                onError={(e) => {
                  if (!e.currentTarget.dataset.fallback) {
                    e.currentTarget.dataset.fallback = 'true';
                    e.currentTarget.src = '/brands/smashme-logo.png';
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Passcode Title */}
        <h1 className="ios-pin-title">Introduceți codul PIN</h1>

        {/* 4 iOS Passcode Dots */}
        <div className={`ios-pin-dots ${error ? 'ios-pin-dots-shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => {
            const isFilled = i < pin.length;
            return (
              <div
                key={i}
                className={`ios-pin-dot ${isFilled ? 'filled' : ''} ${error ? 'error' : ''}`}
              />
            );
          })}
        </div>

        {/* Feedback message area */}
        <div className="ios-pin-feedback-area">
          {error ? (
            <span className="ios-pin-error-text">Cod PIN incorect. Încercați din nou.</span>
          ) : submitting ? (
            <span className="ios-pin-verifying-text">Se verifică...</span>
          ) : (
            <span className="ios-pin-feedback-placeholder">&nbsp;</span>
          )}
        </div>

        {/* iOS Keypad Grid */}
        <div className="ios-pin-keypad">
          {KEYPAD_KEYS.map((k) => (
            <button
              key={k.num}
              type="button"
              className="ios-pin-key"
              onClick={() => handleKey(k.num)}
              disabled={submitting}
            >
              <span className="ios-pin-num">{k.num}</span>
              <span className="ios-pin-letters">{k.letters || '\u00A0'}</span>
            </button>
          ))}

          {/* Bottom Row: Spacer, 0, Backspace */}
          <div className="ios-pin-key-spacer" />

          <button
            type="button"
            className="ios-pin-key"
            onClick={() => handleKey('0')}
            disabled={submitting}
          >
            <span className="ios-pin-num">0</span>
            <span className="ios-pin-letters">{'\u00A0'}</span>
          </button>

          <button
            type="button"
            className="ios-pin-key ios-pin-backspace"
            onClick={handleDel}
            disabled={submitting}
            aria-label="Șterge"
          >
            <svg
              className="ios-pin-del-icon"
              width="26"
              height="22"
              viewBox="0 0 26 22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3L2 11l6 8h15a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8z" />
              <line x1="16" y1="8" x2="11" y2="14" />
              <line x1="11" y1="8" x2="16" y2="14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
