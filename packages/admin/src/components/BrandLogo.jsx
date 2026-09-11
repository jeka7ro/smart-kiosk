import React from 'react';

export default function BrandLogo({ brandId, size = 26, className = "" }) {
  const logos = {
    smashme: '/brands/smashme-logo.png',
    crunch: '/brands/crunch-logo.png',
    rollmaster: '/brands/rollmaster-logo.png',
    lovesushi: '/brands/lovesushi-logo.png',
    welovesushi: '/brands/welovesushi-logo.png',
    pokiwoki: '/brands/pokiwoki-logo.png',
    sushimaster: '/brands/sushimaster-logo.png',
    ikura: '/brands/ikura-logo.png',
  };
  const key = (brandId || '').toLowerCase().replace(/[\s\-_]+/g, '');
  // Căutăm potrivire directă sau parțială
  const matchedKey = Object.keys(logos).find(k => key.includes(k) || k.includes(key));
  const src = matchedKey ? logos[matchedKey] : null;

  if (src) {
    return (
      <img 
        src={src} 
        alt={brandId} 
        title={brandId}
        className={`rounded-full object-contain bg-white shadow-xs border border-slate-200 dark:border-slate-700 ${className}`}
        style={{ width: size, height: size, verticalAlign: 'middle', flexShrink: 0 }} 
        onError={(e) => { 
          e.target.style.display = 'none'; 
          if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline-block';
        }} 
      />
    );
  }
  return (
    <div 
      title={brandId || 'Brand'}
      className={`rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold flex items-center justify-center text-[10px] uppercase border border-slate-200 dark:border-slate-700 ${className}`}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      {(brandId || '?').slice(0, 2)}
    </div>
  );
}
