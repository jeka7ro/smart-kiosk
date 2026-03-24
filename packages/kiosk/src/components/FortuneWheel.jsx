import { useState, useRef, useEffect } from 'react';
import { useKioskStore } from '../store/kioskStore';

// CSS IN JS for Keyframes & Blur
const style = document.createElement('style');
style.innerHTML = `
  @keyframes floatWheel {
    0% { transform: translateY(0px) scale(1); }
    50% { transform: translateY(-8px) scale(1.02); }
    100% { transform: translateY(0px) scale(1); }
  }
  @keyframes blinkLights {
    0% { opacity: 0.6; filter: none; }
    50% { opacity: 1; filter: drop-shadow(0 0 4px #fef08a); }
    100% { opacity: 0.6; filter: none; }
  }
  .fortune-wheel-container {
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(34px); -webkit-backdrop-filter: blur(34px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: 'Inter', system-ui, sans-serif;
    color: #fff;
    opacity: 0; animation: fadeInGlass 0.4s forwards cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes fadeInGlass { to { opacity: 1; } }
  
  .fortune-slice-text {
    font-size: 4.5px; font-weight: 900; fill: #fff; letter-spacing: -0.1px;
    text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  }
`;
document.head.appendChild(style);

export default function FortuneWheel({ config, onClose, onWin }) {
  const slices = config?.slices || [];
  const brandId = useKioskStore(s => s.activeBrandId) || 'smashme';
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [winningSlice, setWinningSlice] = useState(null);
  const [showWinModal, setShowWinModal] = useState(false);

  const wheelRef = useRef(null);

  if (slices.length === 0) {
    return (
      <div className="fortune-wheel-container">
        <h2>Roata Norocului nu a fost configurată corect.</h2>
        <button onClick={onClose} style={{ marginTop: 20, padding: '12px 24px', borderRadius: 12, background: '#fff', color: '#000', fontWeight: 800, border: 'none' }}>Închide</button>
      </div>
    );
  }

  const SLICE_COUNT = slices.length;
  const ANGLE_PER_SLICE = 360 / SLICE_COUNT;

  const spin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWinningSlice(null);
    setShowWinModal(false);

    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedIndex = 0;
    for (let i = 0; i < slices.length; i++) {
      cumulative += (slices[i].probability || 0);
      if (rand <= cumulative) {
        selectedIndex = i;
        break;
      }
    }

    const winner = slices[selectedIndex];

    // Pointer is strictly on the RIGHT side (0 degrees).
    // The center of slice 0 is at 0 degrees.
    const randomOffset = (Math.random() - 0.5) * (ANGLE_PER_SLICE * 0.8);
    const extraSpins = 360 * 6; // 6 full rotations
    
    const newRot = wheelRotation + extraSpins + (360 - (wheelRotation % 360)) + (360 - (selectedIndex * ANGLE_PER_SLICE)) + randomOffset;
    setWheelRotation(newRot);

    setTimeout(() => {
      setIsSpinning(false);
      setWinningSlice(winner);
      setTimeout(() => setShowWinModal(true), 600);
    }, 5500); 
  };

  const getSlicePath = (index) => {
    const startAngle = (index * ANGLE_PER_SLICE) - (ANGLE_PER_SLICE / 2);
    const endAngle = startAngle + ANGLE_PER_SLICE;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const r = 50; 
    const cx = 50;
    const cy = 50;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArcFlag = ANGLE_PER_SLICE > 180 ? 1 : 0;

    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  const getSliceMidAngle = (index) => {
    return (index * ANGLE_PER_SLICE);
  };

  const winBg = winningSlice?.bg || '#eab308';
  const V_BOX = "-15 -15 130 130";

  return (
    <div className="fortune-wheel-container">
      {showWinModal && winningSlice?.type !== 'nada' && (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'url(https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.gif)', backgroundSize: 'cover', mixBlendMode: 'screen', pointerEvents: 'none' }} />
      )}

      {/* Header Text */}
      <div style={{ position: 'absolute', top: 30, width: '100%', textAlign: 'center', transition: 'all 0.4s', opacity: showWinModal ? 0 : 1 }}>
        <h1 style={{ fontSize: '3.8rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, textShadow: '0 4px 24px rgba(0,0,0,0.6)', color: '#fef08a' }}>
          {config?.title || 'Roata Norocului'}
        </h1>
        <p style={{ fontSize: '1.4rem', opacity: 0.9, marginTop: 10, fontWeight: 700 }}>Apasă pe buton și descoperă surpriza!</p>
      </div>

      {/* Wheel Area */}
      <div style={{ position: 'relative', width: 640, height: 640, marginTop: showWinModal ? -80 : 40, transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)', transform: showWinModal ? 'scale(0.8) translateY(-40px)' : 'scale(1)', animation: isSpinning ? 'none' : 'floatWheel 5s infinite ease-in-out' }}>
        
        {/* Glow sub roată */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, ${winningSlice && showWinModal ? winBg : '#fef08a'}55 0%, transparent 60%)`, filter: 'blur(40px)', transition: 'background 0.5s' }} />

        {/* 1. LAYER STATIC: OUTER RING & LIGHTS */}
        <svg viewBox={V_BOX} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' }}>
          <defs>
            <radialGradient id="goldRim" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#eab308" />
              <stop offset="80%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#854d0e" />
            </radialGradient>
            <radialGradient id="goldCenter" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="80%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#713f12" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="54" fill="url(#goldRim)" stroke="#451a03" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="50" fill="#0f172a" />
          
          {Array.from({length: 24}).map((_, i) => {
            const angle = (i * 15 * Math.PI) / 180;
            const lx = 50 + 51.5 * Math.cos(angle);
            const ly = 50 + 51.5 * Math.sin(angle);
            const isAlt = (i % 2 === 0);
            return (
              <circle key={i} cx={lx} cy={ly} r="1.3" fill={isAlt ? '#fff' : '#fef08a'} 
                style={{ animation: 'blinkLights 1s infinite alternate', animationDelay: `${i * 0.05}s` }} />
            );
          })}
        </svg>

        {/* 2. LAYER ANIMAT: ROTATING SLICES */}
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, transformOrigin: '50% 50%', transform: `rotate(${wheelRotation}deg)`, transition: isSpinning ? 'transform 5s cubic-bezier(0.25, 1, 0.1, 1)' : 'none' }}>
          <svg viewBox={V_BOX} style={{ width: '100%', height: '100%' }}>
            {/* Feliile (Slices) */}
            {slices.map((slice, i) => (
              <path key={slice.id} d={getSlicePath(i)} fill={slice.bg || '#ccc'} stroke="#ffffff44" strokeWidth="0.8" />
            ))}

            {/* Textele și Imaginile */}
            {slices.map((slice, i) => {
              const midAngle = getSliceMidAngle(i);
              const isLeft = midAngle > 90 && midAngle < 270;
              const textRot = isLeft ? midAngle + 180 : midAngle;
              
              const sliceName = slice.type === 'nada' ? 'Necâștigător' : slice.name;

              const words = sliceName.split(' ');
              const lines = [];
              let cur = '';
              words.forEach(w => {
                if (cur.length + w.length > 14 && cur !== '') { lines.push(cur); cur = w; }
                else { cur += (cur ? ' ' : '') + w; }
              });
              if (cur) lines.push(cur);
              const displayLines = lines.slice(0, 3);

              const rad = (midAngle * Math.PI) / 180;
              const imgRadius = 40;
              const imgX = 50 + imgRadius * Math.cos(rad);
              const imgY = 50 + imgRadius * Math.sin(rad);

              const hasImage = slice.type !== 'nada' && slice.image;
              const txtRadius = hasImage ? 25 : 32;
              const tx = 50 + txtRadius * Math.cos(rad);
              const ty = 50 + txtRadius * Math.sin(rad);

              return (
                <g key={`text-${slice.id}`}>
                  {hasImage && (
                    <g transform={`translate(${imgX}, ${imgY}) rotate(${isLeft ? midAngle + 180 : midAngle})`}>
                      <image href={slice.image} x="-6" y="-6" width="12" height="12" clipPath="circle(6px at 6px 6px)" preserveAspectRatio="xMidYMid slice" />
                    </g>
                  )}
                  
                  <text className="fortune-slice-text" x={tx} y={ty} transform={`rotate(${textRot} ${tx} ${ty})`} textAnchor="middle" style={{ fill: '#fff' }}>
                    {displayLines.map((ln, idx) => (
                      <tspan key={idx} x={tx} dy={idx === 0 ? (displayLines.length === 1 ? '1px' : '-2px') : '1.3em'}>{ln}</tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 3. LAYER STATIC: CENTER OVERLAY & POINTER */}
        <svg viewBox={V_BOX} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3 }}>
          {/* Centrul Roții cu Border și umbră (Premium Setup) */}
          <circle cx="50" cy="50" r="13" fill="#ffffff" stroke="url(#goldCenter)" strokeWidth="1.5" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.6))" />
          
          {/* Logo Brand dinamic în miezul roții */}
          <image href={`/brands/${brandId}-logo.png`} x="39" y="39" width="22" height="22" preserveAspectRatio="xMidYMid meet" />
          
          {/* Săgeata Indicator - Poziționată în Dreapta (axa X 100) */}
          <g filter="drop-shadow(-4px 4px 6px rgba(0,0,0,0.6))">
            <path d="M 100 44 L 109 46 L 109 54 L 100 56 L 86 50 Z" fill="url(#goldRim)" stroke="#713f12" strokeWidth="0.5" />
            <circle cx="104" cy="50" r="2.5" fill="#ef4444" stroke="#450a0a" strokeWidth="0.3" />
            {/* Strălucire micuță pe "dioda" roșie */}
            <circle cx="103.5" cy="49" r="0.6" fill="#fca5a5" />
          </g>
        </svg>

      </div>

      {/* Controls / Spin Button */}
      <div style={{ marginTop: 60, transition: 'all 0.4s', opacity: showWinModal ? 0 : 1, transform: showWinModal ? 'translateY(20px)' : 'translateY(0)', zIndex: 10 }}>
        <button 
          onClick={spin}
          disabled={isSpinning}
          style={{
            background: 'linear-gradient(135deg, #eab308, #ca8a04)', color: '#fff', border: '2px solid #fef08a', borderRadius: 40,
            padding: '24px 64px', fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px',
            cursor: isSpinning ? 'not-allowed' : 'pointer',

            boxShadow: '0 10px 30px rgba(15,118,110,0.5), inset 0 2px 0 rgba(255,255,255,0.2)',
            transition: 'all 0.2s', filter: isSpinning ? 'grayscale(0.5)' : 'none'
          }}
          onMouseDown={e => !isSpinning && (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={e => !isSpinning && (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={e => !isSpinning && (e.currentTarget.style.transform = 'scale(1)')}
        >
          {isSpinning ? 'Se învârte...' : 'ÎNVÂRTE ROATA!'}
        </button>
      </div>

      {/* Închide Button (Top Right) */}
      <button 
        onClick={onClose}
        style={{ position: 'absolute', top: 30, right: 30, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', width: 64, height: 64, borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        ✕
      </button>

      {/* Win Modal Glass Overlay */}
      {showWinModal && winningSlice && (
        <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: 32, padding: '40px 60px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', animation: 'spinWin 0.6s cubic-bezier(0.16,1,0.3,1)', width: '80%', maxWidth: 700 }}>
          {winningSlice.type === 'nada' ? (
            <>
              <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 900 }}>Ai nimerit: {winningSlice.name}</h2>
              <p style={{ fontSize: '1.2rem', opacity: 0.8, marginTop: 10 }}>Mai încearcă altă dată! Norocul se întoarce.</p>
              <button onClick={onClose} style={{ marginTop: 30, padding: '16px 40px', fontSize: '1.2rem', fontWeight: 800, borderRadius: 20, border: 'none', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>Înapoi la meniu</button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.6rem', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>Felicitări, ai câștigat!</h2>
              <h1 style={{ fontSize: '3.2rem', margin: '10px 0', fontWeight: 900, color: '#fff', textShadow: `0 4px 20px ${winBg}88` }}>{winningSlice.name}</h1>
              <p style={{ fontSize: '1.2rem', opacity: 0.9, marginBottom: 30 }}>Acest cadou a fost adăugat GRATUIT în coșul tău!</p>
              
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                <button 
                  onClick={() => { onWin && onWin(winningSlice); onClose(); }} 
                  style={{ padding: '20px 48px', fontSize: '1.3rem', fontWeight: 900, borderRadius: 24, border: 'none', background: winBg, color: '#fff', cursor: 'pointer', boxShadow: `0 10px 30px ${winBg}66` }}
                >
                  Revendică Premiul!
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
