import { useState } from 'react';
import './PinScreen.css';

export default function PinScreen({ loc, onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKey = (num) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDel = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleSubmit = () => {
    if (pin === loc.kioskPin) {
      onUnlock();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="pin-screen">
      <div className="pin-box">
        <h2 className="pin-title">🔒 Securitate Kiosk</h2>
        <p className="pin-sub">Această tabletă este parțial restricționată. Te rog să introduci codul PIN pentru locația {loc.name}.</p>
        
        <div className={`pin-display ${error ? 'pin-error' : ''}`}>
          {pin.split('').map((_, i) => (
            <span key={i} className="pin-dot">●</span>
          ))}
          {pin.length === 0 && <span className="pin-placeholder">Introdu PIN</span>}
        </div>

        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} className="pin-key" onClick={() => handleKey(n.toString())}>{n}</button>
          ))}
          <button className="pin-key pin-cmd" onClick={handleDel}>⌫</button>
          <button className="pin-key" onClick={() => handleKey('0')}>0</button>
          <button className="pin-key pin-cmd pin-ok" onClick={handleSubmit}>OK</button>
        </div>
      </div>
    </div>
  );
}
