import React from 'react';

// CSS IN JS for Keyframes & Blur
const style = document.createElement('style');
style.innerHTML = `
  @keyframes blinkLights {
    0% { opacity: 0.6; filter: none; }
    50% { opacity: 1; filter: drop-shadow(0 0 4px #fef08a); }
    100% { opacity: 0.6; filter: none; }
  }
  .preview-fortune-wheel {
    position: relative;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: 'Inter', system-ui, sans-serif;
    color: #fff;
    transform: scale(0.65); /* Scaled down for Admin UI */
    transform-origin: top center;
    margin-bottom: -180px; /* offset the scale */
  }
  
  .fortune-slice-text {
    font-size: 2.1px; font-weight: 800; fill: #fff; letter-spacing: -0.1px;
    text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  }
`;
document.head.appendChild(style);

export default function FortuneWheelPreview({ config, brandId }) {
  const slices = config?.slices || [];
  
  if (slices.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
        Roata Norocului nu are felii configurate.
      </div>
    );
  }

  const SLICE_COUNT = slices.length;
  const ANGLE_PER_SLICE = 360 / SLICE_COUNT;

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

  const V_BOX = "-15 -15 130 130";
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
  const logoUrl = `${backendUrl}/brands/${brandId}-logo.png`;

  return (
    <div className="preview-fortune-wheel">
      
      {/* Header Text */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, textShadow: '0 4px 12px rgba(0,0,0,0.3)', color: 'var(--text)' }}>
          {config?.title || 'Roata Norocului'}
        </h1>
      </div>

      {/* Wheel Area */}
      <div style={{ position: 'relative', width: 640, height: 640 }}>
        
        {/* Glow sub roată */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, #fef08a44 0%, transparent 60%)`, filter: 'blur(40px)' }} />

        {/* 1. LAYER STATIC: OUTER RING & LIGHTS */}
        <svg viewBox={V_BOX} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.3))' }}>
          <defs>
            <radialGradient id="goldRimP" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#eab308" />
              <stop offset="80%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#854d0e" />
            </radialGradient>
            <radialGradient id="goldCenterP" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="80%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#713f12" />
            </radialGradient>
            <clipPath id="centerClipP">
              <circle cx="50" cy="50" r="10" />
            </clipPath>
          </defs>
          <circle cx="50" cy="50" r="54" fill="url(#goldRimP)" stroke="#451a03" strokeWidth="0.5" />
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

        {/* 2. LAYER STATIC: SLICES */}
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2 }}>
          <svg viewBox={V_BOX} style={{ width: '100%', height: '100%' }}>
            {slices.map((slice, i) => (
              <path key={slice.id} d={getSlicePath(i)} fill={slice.bg || '#ccc'} stroke="#ffffff44" strokeWidth="0.8" />
            ))}

            {slices.map((slice, i) => {
              const midAngle = getSliceMidAngle(i);
              const isLeft = midAngle > 90 && midAngle < 270;
              const textRot = isLeft ? midAngle + 180 : midAngle;
              
              const sliceName = slice.type === 'nada' ? 'Necâștigător' : slice.name;

              const words = sliceName.split(' ');
              const lines = [];
              let cur = '';
              words.forEach(w => {
                if (cur.length + w.length > 20 && cur !== '') { lines.push(cur); cur = w; }
                else { cur += (cur ? ' ' : '') + w; }
              });
              if (cur) lines.push(cur);
              const displayLines = lines.slice(0, 3);

              const rad = (midAngle * Math.PI) / 180;
              const imgRadius = 36;
              const imgX = 50 + imgRadius * Math.cos(rad);
              const imgY = 50 + imgRadius * Math.sin(rad);

              const hasImage = slice.type !== 'nada' && slice.image;
              const txtRadius = hasImage ? 21 : 27;
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
        <svg viewBox={V_BOX} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}>
          <circle cx="50" cy="50" r="13.5" fill="#ffffff" stroke="url(#goldCenterP)" strokeWidth="1.5" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.6))" />
          <image href={logoUrl} x="40" y="40" width="20" height="20" preserveAspectRatio="xMidYMid meet" clipPath="url(#centerClipP)" />
          
          <g filter="drop-shadow(-4px 4px 6px rgba(0,0,0,0.6))">
            <path d="M 100 44 L 109 46 L 109 54 L 100 56 L 93 50 Z" fill="url(#goldRimP)" stroke="#713f12" strokeWidth="0.5" />
            <circle cx="104" cy="50" r="2.5" fill="#ef4444" stroke="#450a0a" strokeWidth="0.3" />
            <circle cx="103.5" cy="49" r="0.6" fill="#fca5a5" />
          </g>
        </svg>

      </div>
    </div>
  );
}
