import React from 'react';

export default function BrandLogo({ brandId, size = 18 }) {
  const logos = {
    smashme: '/brands/smashme-logo.png',
    crunch: '/brands/crunch-logo.png',
    rollmaster: '/brands/rollmaster-logo.png',
    lovesushi: '/brands/lovesushi-logo.png',
    pokiwoki: '/brands/pokiwoki-logo.png'
  };
  const src = logos[brandId];
  if (src) {
    return (
      <img 
        src={src} 
        alt={brandId} 
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }} 
        onError={(e) => { e.target.style.display = 'none'; }} 
      />
    );
  }
  return <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }} />;
}
