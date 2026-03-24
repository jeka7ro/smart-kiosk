import { useState, useRef, useEffect } from 'react';

// CSS IN JS for Keyframes & Blur
const style = document.createElement('style');
style.innerHTML = `
  @keyframes floatWheel {
    0% { transform: translateY(0px) scale(1); }
    50% { transform: translateY(-8px) scale(1.02); }
    100% { transform: translateY(0px) scale(1); }
  }
  @keyframes spinWin {
    0% { transform: scale(1); }
    50% { transform: scale(1.1) rotate(5deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  .fortune-wheel-container {
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: 'Inter', system-ui, sans-serif;
    color: #fff;
    opacity: 0; animation: fadeInGlass 0.4s forwards cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes fadeInGlass { to { opacity: 1; } }
  
  .fortune-slice-text {
    font-size: 1.1rem; font-weight: 800; fill: #fff; letter-spacing: -0.5px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
`;
document.head.appendChild(style);

export default function FortuneWheel({ config, onClose, onWin }) {
  const slices = config?.slices || [];
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [winningSlice, setWinningSlice] = useState(null);
  const [showWinModal, setShowWinModal] = useState(false);

  const wheelRef = useRef(null);

  // Fallback dacă nu avem felii
  if (slices.length === 0) {
    return (
      <div className="fortune-wheel-container">
        <h2>Roata Norocului nu a fost configurată corect.</h2>
        <button onClick={onClose} style={{ marginTop: 20, padding: '12px 24px', borderRadius: 12, background: '#fff', color: '#000', fontWeight: 800, border: 'none' }}>Închide</button>
      </div>
    );
  }

  // Pre-calculăm unghiurile
  const SLICE_COUNT = slices.length;
  const ANGLE_PER_SLICE = 360 / SLICE_COUNT;

  const spin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWinningSlice(null);
    setShowWinModal(false);

    // Algoritm selecție câștigător pe bază de probabilități
    const rand = Math.random() * 100; // 0..100
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

    // Calculăm rotația
    // Feliile sunt așezate de la 0 la 360 grade. Felia X este la centrul `selectedIndex * ANGLE_PER_SLICE`.
    // Vrem ca săgeata de sus (care e la 270 grade vizual, sau depinde cum o desenam) să indice spre centrul feliei alese.
    // Vom desena SVG-ul astfel încât felia 0 începe de la -ANGLE/2 până la +ANGLE/2 (adică pe centru dreapta - 0 grade).
    // Săgeata noastră o vom pune TOP (la -90 grade).
    // Deci ca felia i să ajungă la TOP (-90 deg), roata trebuie să se rotească cu:
    // Destinație locală: 270 grade (sau -90). Rotație = 360 - (selectedIndex * ANGLE_PER_SLICE) + 90
    // Să mai adăugăm niște ture extra complete (ex. 5 ture = 1800 grade)
    
    // Offset random în interiorul feliei pentru naturalețe (+/- 40% din felie)
    const randomOffset = (Math.random() - 0.5) * (ANGLE_PER_SLICE * 0.8);
    
    const extraSpins = 360 * 6; // 6 rotații complete
    const targetAngle = extraSpins + (360 - (selectedIndex * ANGLE_PER_SLICE)) - 90 + randomOffset;

    setWheelRotation(prev => prev + targetAngle + (360 - (prev % 360))); // Resetează vizual la un multiplu parțial, dar simplificat e mai bine așa:
    // Mai sigur:
    const newRot = wheelRotation + extraSpins + (360 - (wheelRotation % 360)) + (270 - (selectedIndex * ANGLE_PER_SLICE)) + randomOffset;
    
    setWheelRotation(newRot);

    // Timing spin 5 secunde, wait and open modal
    setTimeout(() => {
      setIsSpinning(false);
      setWinningSlice(winner);
      setTimeout(() => setShowWinModal(true), 600);
    }, 5500); // Wait for transition + 0.5s pause
  };

  const getSlicePath = (index) => {
    const startAngle = (index * ANGLE_PER_SLICE) - (ANGLE_PER_SLICE / 2);
    const endAngle = startAngle + ANGLE_PER_SLICE;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const r = 50; // Raza roții în grid SVG (100x100)
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

  const winBg = winningSlice?.bg || '#3b82f6';

  return (
    <div className="fortune-wheel-container">
      {/* Confetti Background on Win */}
      {showWinModal && winningSlice?.type !== 'nada' && (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'url(https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.gif)', backgroundSize: 'cover', mixBlendMode: 'screen', pointerEvents: 'none' }} />
      )}

      {/* Header */}
      <div style={{ position: 'absolute', top: 40, width: '100%', textAlign: 'center', transition: 'all 0.4s', opacity: showWinModal ? 0 : 1 }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {config?.title || 'Roata Norocului'}
        </h1>
        <p style={{ fontSize: '1.4rem', opacity: 0.8, marginTop: 10 }}>Apasă pe buton și câștigă un premiu din partea noastră!</p>
      </div>

      {/* Wheel Area */}
      <div style={{ position: 'relative', width: 600, height: 600, marginTop: showWinModal ? -100 : 40, transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)', transform: showWinModal ? 'scale(0.8) translateY(-40px)' : 'scale(1)', animation: isSpinning ? 'none' : 'floatWheel 5s infinite ease-in-out' }}>
        
        {/* Săgeata Indicator */}
        <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', zIndex: 10, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>
          <svg width="60" height="70" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 22L2 2h20L12 22z" />
          </svg>
        </div>

        {/* Glow sub roată */}
        <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: `radial-gradient(circle, ${winningSlice && showWinModal ? winBg : '#ffffff'}44 0%, transparent 70%)`, filter: 'blur(30px)', transition: 'background 0.5s' }} />

        {/* Roata SVH */}
        <svg 
          ref={wheelRef}
          viewBox="0 0 100 100" 
          width="100%" height="100%" 
          style={{ 
            borderRadius: '50%', 
            boxShadow: '0 0 0 12px rgba(255,255,255,0.1), 0 20px 60px rgba(0,0,0,0.5)',
            transform: `rotate(${wheelRotation}deg)`,
            transition: isSpinning ? 'transform 5s cubic-bezier(0.25, 1, 0.1, 1)' : 'none'
          }}
        >
          {/* Feliile (Slices) */}
          {slices.map((slice, i) => (
            <path 
              key={slice.id} 
              d={getSlicePath(i)} 
              fill={slice.bg || '#ccc'} 
              stroke="rgba(255,255,255,0.3)" 
              strokeWidth="0.4" 
            />
          ))}

          {/* Textele și Imaginile */}
          {slices.map((slice, i) => {
            const midAngle = getSliceMidAngle(i);
            return (
              <g key={`text-${slice.id}`} transform={`translate(50, 50) rotate(${midAngle}) translate(28, 0)`}>
                {slice.image ? (
                  // Desenăm imaginea avatar la margine
                  <image href={slice.image} x="-8" y="-8" width="16" height="16" clipPath="circle(8px at 8px 8px)" preserveAspectRatio="xMidYMid slice" />
                ) : (
                  <text className="fortune-slice-text" textAnchor="middle" transform="rotate(90)" y="1.5">
                    {slice.name.substring(0, 15)}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Centrul Roții */}
          <circle cx="50" cy="50" r="12" fill="#fff" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.3))" />
          <circle cx="50" cy="50" r="8" fill="#0f172a" />
        </svg>
      </div>

      {/* Controls / Spin Button */}
      <div style={{ marginTop: 60, transition: 'all 0.4s', opacity: showWinModal ? 0 : 1, transform: showWinModal ? 'translateY(20px)' : 'translateY(0)' }}>
        <button 
          onClick={spin}
          disabled={isSpinning}
          style={{
            background: 'var(--primary, #0f766e)', color: '#fff', border: 'none', borderRadius: 40,
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
              <div style={{ fontSize: '4rem', marginBottom: 20 }}>😢</div>
              <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 900 }}>Ai nimerit: {winningSlice.name}</h2>
              <p style={{ fontSize: '1.2rem', opacity: 0.8, marginTop: 10 }}>Mai încearcă altă dată! Norocul se întoarce.</p>
              <button onClick={onClose} style={{ marginTop: 30, padding: '16px 40px', fontSize: '1.2rem', fontWeight: 800, borderRadius: 20, border: 'none', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>Înapoi la meniu</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '5rem', marginBottom: 10 }}>🎉</div>
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
