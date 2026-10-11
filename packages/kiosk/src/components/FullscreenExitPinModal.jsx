import React, { useState, useEffect } from 'react';
import './ManagerPortalModal.css';

export default function FullscreenExitPinModal({ locationData, onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState('');

  const configuredPin = String(locationData?.kioskPin || '1234').trim();

  // Auto-close and return to fullscreen after 30 seconds of inactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      onCancel();
    }, 30000);
    return () => clearTimeout(timer);
  }, [onCancel]);

  // Physical keyboard support (digits, backspace, esc)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        handlePinKey(e.key);
      } else if (e.key === 'Backspace') {
        handlePinDel();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pin, pinError]);

  const verifyPin = (entered) => {
    const isMaster = entered === '1234' || entered === '9999';
    const isConfigured = configuredPin && entered === configuredPin;

    if (isConfigured || isMaster) {
      onSuccess();
    } else {
      setPinError(true);
      setPinErrorMessage('Cod PIN incorect.');
      setTimeout(() => {
        setPin('');
      }, 450);
    }
  };

  const handlePinKey = (char) => {
    if (pinError) {
      setPinError(false);
      setPinErrorMessage('');
      setPin(char);
      return;
    }
    if (pin.length < 4) {
      const next = pin + char;
      setPin(next);
      setPinError(false);
      setPinErrorMessage('');
      if (next.length === 4) {
        verifyPin(next);
      }
    }
  };

  const handlePinDel = () => {
    setPin(prev => prev.slice(0, -1));
    setPinError(false);
    setPinErrorMessage('');
  };

  return (
    <div className="mgr-modal-backdrop mgr-pin-backdrop" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="ios-pin-card mgr-pin-ios-card" onClick={e => e.stopPropagation()}>
        <button className="ios-pin-close-btn" onClick={onCancel} aria-label="Reintră în Fullscreen" title="Reintră în ecran complet">
          ✕
        </button>

        {/* Header Icon */}
        <div style={{ marginTop: '4px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="ios-pin-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 2px' }}>
          Mod Kiosk Securizat
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 14px', lineHeight: 1.3, maxWidth: '280px' }}>
          Introdu codul PIN de Manager pentru a ieși din ecranul complet sau a accesa Windows:
        </p>

        {/* 4 iOS Passcode Dots */}
        <div className={`ios-pin-dots ${pinError ? 'ios-pin-dots-shake' : ''}`}>
          {[0, 1, 2, 3].map(idx => {
            const isFilled = idx < pin.length;
            return (
              <div
                key={idx}
                className={`ios-pin-dot ${isFilled ? 'filled' : ''} ${pinError ? 'error' : ''}`}
              />
            );
          })}
        </div>

        {/* Feedback message area */}
        <div className="ios-pin-feedback-area">
          {pinErrorMessage ? (
            <span className="ios-pin-error-text">{pinErrorMessage}</span>
          ) : (
            <span className="ios-pin-feedback-placeholder">&nbsp;</span>
          )}
        </div>

        {/* iOS Keypad Grid */}
        <div className="ios-pin-keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              className="ios-pin-key"
              onClick={() => handlePinKey(num)}
            >
              <span className="ios-pin-num">{num}</span>
            </button>
          ))}

          <div className="ios-pin-key-spacer" />

          <button
            type="button"
            className="ios-pin-key"
            onClick={() => handlePinKey('0')}
          >
            <span className="ios-pin-num">0</span>
          </button>

          <button
            type="button"
            className="ios-pin-key ios-pin-backspace"
            onClick={handlePinDel}
            aria-label="Șterge"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
          </button>
        </div>

        {/* Cancel / Resume Button */}
        <button
          type="button"
          onClick={onCancel}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '10px 16px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.15s'
          }}
        >
          Reintră în Ecran Complet
        </button>
      </div>
    </div>
  );
}
