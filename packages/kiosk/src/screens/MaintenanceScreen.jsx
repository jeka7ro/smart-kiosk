import { useState, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { getBrand } from '../config/brands';
import PinScreen from './PinScreen';

const BRAND_ACCENTS = {
  smashme: '#ef4444',
  rollmaster: '#e31e24',
  sushimaster: '#e31e24',
  ikura: '#e31e24',
  pokiwoki: '#f97316',
  lovesushi: '#ec4899',
  welovesushi: '#8b5cf6',
  crunch: '#eab308',
};

export default function MaintenanceScreen({ loc, brandId, backendUrl, onUnlock }) {
  const [showSecretPin, setShowSecretPin] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  const storeBrandId = useKioskStore((s) => s.activeBrandId);
  const urlBrand = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('brand') : null;
  const effectiveBrandId = urlBrand || brandId || storeBrandId || loc?.brands?.[0] || 'smashme';
  const brandConfig = getBrand(effectiveBrandId);
  const brandLogo = loc?.logoUrl || brandConfig?.logoImg || `/brands/${effectiveBrandId}-logo.png`;
  const brandName = brandConfig?.name || loc?.name || 'Smart Kiosk';
  const accentColor = BRAND_ACCENTS[effectiveBrandId] || '#ef4444';

  // Secret 5-tap on brand logo opens PIN pad for Manager/Cashier emergency unlock
  const handleLogoTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setShowSecretPin(true);
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1800);
  };

  if (showSecretPin) {
    return (
      <PinScreen
        loc={loc}
        brandId={effectiveBrandId}
        isScheduleLock={false}
        backendUrl={backendUrl}
        onUnlock={(role) => {
          setShowSecretPin(false);
          onUnlock?.(role);
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 999999,
        background: 'radial-gradient(circle at 50% 25%, #1e293b 0%, #0f172a 55%, #020617 100%)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        boxSizing: 'border-box',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        @keyframes maintOrbitSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes maintOrbitReverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes maintFloatLogo {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-8px) scale(1.04); }
        }
        @keyframes maintGlowPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.95); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes maintShimmerBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        @keyframes maintGearSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          width: '520px',
          height: '520px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}44 0%, transparent 70%)`,
          filter: 'blur(60px)',
          animation: 'maintGlowPulse 4s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Central glass card */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: '580px',
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '36px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          padding: '52px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Animated Orbital Brand Logo */}
        <div
          onClick={handleLogoTap}
          style={{
            position: 'relative',
            width: '180px',
            height: '180px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '34px',
            cursor: 'default',
          }}
        >
          {/* Outer spinning ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px dashed rgba(255, 255, 255, 0.18)',
              animation: 'maintOrbitSpin 18s linear infinite',
            }}
          />

          {/* Conic glowing orbit */}
          <div
            style={{
              position: 'absolute',
              inset: '10px',
              borderRadius: '50%',
              padding: '3px',
              background: `conic-gradient(from 0deg, transparent 0%, ${accentColor} 50%, #f59e0b 80%, transparent 100%)`,
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              animation: 'maintOrbitSpin 3.2s linear infinite',
            }}
          />

          {/* Inner counter-rotating ring */}
          <div
            style={{
              position: 'absolute',
              inset: '22px',
              borderRadius: '50%',
              border: `1.5px solid ${accentColor}55`,
              animation: 'maintOrbitReverse 8s linear infinite',
            }}
          />

          {/* Logo Circle Container */}
          <div
            style={{
              width: '124px',
              height: '124px',
              borderRadius: '50%',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              boxSizing: 'border-box',
              boxShadow: `0 12px 35px ${accentColor}55, 0 0 0 6px rgba(255, 255, 255, 0.08)`,
              animation: 'maintFloatLogo 3.5s ease-in-out infinite',
              overflow: 'hidden',
            }}
          >
            <img
              src={brandLogo}
              alt={brandName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
              onError={(e) => {
                if (!e.currentTarget.dataset.fallback) {
                  e.currentTarget.dataset.fallback = 'true';
                  e.currentTarget.src = '/brands/smashme-logo.png';
                }
              }}
            />
          </div>
        </div>

        {/* Status Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 20px',
            borderRadius: '999px',
            background: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fbbf24',
            fontSize: '0.82rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '22px',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: 'maintGearSpin 5s linear infinite' }}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Mentenanță Tehnică</span>
        </div>

        {/* Main Title */}
        <h1
          style={{
            fontSize: 'clamp(1.75rem, 3.2vw, 2.35rem)',
            fontWeight: 900,
            margin: '0 0 14px 0',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            color: '#ffffff',
          }}
        >
          Kiosk temporar indisponibil
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 'clamp(1rem, 1.8vw, 1.15rem)',
            lineHeight: 1.6,
            color: 'rgba(226, 232, 240, 0.85)',
            margin: '0 0 28px 0',
            maxWidth: '460px',
            fontWeight: 500,
          }}
        >
          Efectuăm o scurtă actualizare tehnică. Revenim în câteva momente!
          <br />
          <span style={{ color: '#94a3b8', fontSize: '0.95em' }}>
            Pentru comenzi imediate, vă rugăm să vă adresați colegilor de la casă.
          </span>
        </p>

        {/* Animated Progress Shimmer */}
        <div
          style={{
            width: '100%',
            maxWidth: '320px',
            height: '6px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: '45%',
              height: '100%',
              borderRadius: '999px',
              background: `linear-gradient(90deg, transparent, ${accentColor}, #fbbf24, transparent)`,
              animation: 'maintShimmerBar 2.2s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}

