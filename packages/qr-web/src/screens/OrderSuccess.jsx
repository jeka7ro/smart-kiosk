import { useEffect, useState } from 'react';
import { useQrStore } from '../store/qrStore.js';
import './OrderSuccess.css';

export default function OrderSuccess({ brand }) {
  const tableNum = useQrStore((s) => s.tableNum);
  const clearCart = useQrStore((s) => s.clearCart);
  const [orderNum] = useState(() => Math.floor(Math.random() * 900) + 100);
  const [secs, setSecs] = useState(8);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecs(s => {
        if (s <= 1) { clearCart(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="os-screen safe-top">
      <div className="os-content fade-up">
        {/* Check circle */}
        <div className="os-circle">
          <span className="os-check">✓</span>
        </div>

        <h1 className="os-title">Comandă plasată!</h1>
        <p className="os-sub">Îți pregătim comanda chiar acum – o aducem la masa ta.</p>

        {/* Order number */}
        <div className="os-num-box">
          <span className="os-nl">Numărul comenzii</span>
          <span className="os-nn">#{orderNum}</span>
          <span className="os-nm">Masa {tableNum}</span>
        </div>

        {/* Steps */}
        <div className="os-steps">
          {[
            { icon: '✅', text: 'Comandă înregistrată' },
            { icon: '👨‍🍳', text: 'Bucătăria pregătește comanda' },
            { icon: '🚀', text: 'Livrare la masa ta' },
          ].map((s, i) => (
            <div key={i} className="os-step" style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
              <span>{s.icon}</span><span>{s.text}</span>
            </div>
          ))}
        </div>

        {/* Brand */}
        <div className="os-brand">
          {brand.logoImg
            ? <img src={brand.logoImg} alt={brand.name} style={{ height: 36 }}/>
            : <span>{brand.emoji} {brand.name}</span>
          }
          <span>Mulțumim pentru comandă!</span>
        </div>

        {/* Countdown */}
        <p className="os-countdown">
          Se resetează în <strong>{secs}s</strong>
        </p>
      </div>
    </div>
  );
}
