import { useState } from 'react';
import './PinScreen.css';

export default function PinScreen({ loc, onUnlock, isScheduleLock = false, backendUrl }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const handleKey = (num) => {
    if (pin.length < 4 && !submitting) {
      const next = pin + num;
      setPin(next);
      setError(false);
      if (next.length === 4) {
        checkPin(next);
      }
    }
  };

  const handleDel = () => {
    if (!submitting) {
      setPin(prev => prev.slice(0, -1));
      setError(false);
    }
  };

  const checkPin = async (enteredPin) => {
    if (submitting) return;

    const managerPin = String(loc?.kioskPin || '').trim();
    const vendorPin = String(loc?.vendorPin || '').trim();

    // Accepta PIN-ul setat pe locatie, master 1234 sau 1308
    const isManager = (managerPin && enteredPin === managerPin) || enteredPin === '1308' || enteredPin === '1234';
    const isVendor = vendorPin && enteredPin === vendorPin;

    if (isManager) {
      setSubmitting(true);
      await sendLog('unlock_manager', 'manager');
      onUnlock('manager');
    } else if (isVendor) {
      setSubmitting(true);
      await sendLog('unlock_vendor', 'vendor');
      onUnlock('vendor');
    } else {
      setError(true);
      setPin('');
      sendLog('unlock_failed', 'unknown');
    }
  };

  const handleSubmit = () => {
    if (pin.length === 4) {
      checkPin(pin);
    }
  };

  const subtitle = isScheduleLock
    ? `Kiosk-ul este blocat conform orarului de funcționare (${loc?.lockStartTime || '22:00'} - ${loc?.lockEndTime || '09:00'}). Introdu codul PIN pentru acces.`
    : 'Această tabletă este parțial restricționată. Te rog să introduci codul PIN pentru acces la acest Kiosk.';

  return (
    <div className="pin-screen">
      <div className="pin-box">
        <h2 className="pin-title">Securitate Kiosk</h2>
        <p className="pin-sub">{subtitle}</p>
        
        <div className={`pin-dots-container ${error ? 'pin-error' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`pin-dot ${i < pin.length ? 'pin-dot-active' : ''}`}
            />
          ))}
        </div>

        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} className="pin-key" onClick={() => handleKey(n.toString())} disabled={submitting}>{n}</button>
          ))}
          <button className="pin-key pin-cmd" onClick={handleDel} disabled={submitting}>⌫</button>
          <button className="pin-key" onClick={() => handleKey('0')} disabled={submitting}>0</button>
          <button className="pin-key pin-cmd pin-ok" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '...' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
