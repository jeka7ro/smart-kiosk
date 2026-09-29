import React from 'react';

/**
 * Componentă oficială pentru Avatar / Logo Bănci Emitente Carduri
 * (BT, Revolut, ING, BCR, Raiffeisen, BRD, CEC, Altele)
 */
export default function BankLogo({ bankId, bank, size = 20, className = "" }) {
  const rawId = (bank?.id || bankId || '').toLowerCase().trim();
  
  let key = 'other';
  if (rawId.includes('bt') || rawId.includes('transilvania')) key = 'bt';
  else if (rawId.includes('revo')) key = 'revolut';
  else if (rawId.includes('ing')) key = 'ing';
  else if (rawId.includes('bcr') || rawId.includes('erste')) key = 'bcr';
  else if (rawId.includes('raif') || rawId.includes('rzb')) key = 'raiffeisen';
  else if (rawId.includes('brd') || rawId.includes('societe')) key = 'brd';
  else if (rawId.includes('cec')) key = 'cec';

  const s = size;

  switch (key) {
    case 'bt':
      return (
        <div 
          className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-amber-500/40 shadow-xs ${className}`}
          style={{ width: s, height: s, background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 60%, #d97706 100%)' }}
          title="Banca Transilvania"
        >
          {/* BT Shield & Typography */}
          <svg width={s * 0.82} height={s * 0.82} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 5V11C4 16.5 7.4 20.8 12 22C16.6 20.8 20 16.5 20 11V5L12 2Z" fill="#18181b" fillOpacity="0.12" />
            <path d="M12 3L5.5 5.5V11C5.5 15.5 8.2 19.2 12 20.2C15.8 19.2 18.5 15.5 18.5 11V5.5L12 3Z" stroke="#000000" strokeWidth="1.2" fill="#ffd100" />
            <text x="12" y="14" textAnchor="middle" fill="#000000" fontSize="8.5" fontWeight="900" fontFamily="sans-serif" letterSpacing="-0.5">BT</text>
          </svg>
        </div>
      );

    case 'revolut':
      return (
        <div 
          className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-slate-700/80 shadow-xs ${className}`}
          style={{ width: s, height: s, background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)' }}
          title="Revolut"
        >
          {/* Revolut Icon 'R' */}
          <svg width={s * 0.72} height={s * 0.72} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M5 4.5H13C16.0376 4.5 18.5 6.96243 18.5 10C18.5 12.3857 16.9749 14.4158 14.8385 15.1614L19.2 20.5H14.8L11 15.5H8.2V20.5H5V4.5ZM8.2 12.5H13C14.3807 12.5 15.5 11.3807 15.5 10C15.5 8.61929 14.3807 7.5 13 7.5H8.2V12.5Z" 
              fill="#FFFFFF" 
            />
          </svg>
        </div>
      );

    case 'ing':
      return (
        <div 
          className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-orange-500/40 shadow-xs ${className}`}
          style={{ width: s, height: s, background: 'linear-gradient(135deg, #ff6200 0%, #ea580c 100%)' }}
          title="ING Bank"
        >
          {/* ING Typography & Lion Curve */}
          <svg width={s * 0.8} height={s * 0.8} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="12" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.2">ING</text>
            <circle cx="19" cy="8.5" r="1.5" fill="#FFFFFF" />
          </svg>
        </div>
      );

    case 'bcr':
      return (
        <div 
          className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-sky-400/40 shadow-xs ${className}`}
          style={{ width: s, height: s, background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}
          title="BCR (Erste Group)"
        >
          {/* BCR / Erste Spark & Text */}
          <svg width={s * 0.85} height={s * 0.85} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4C7.5 4 4 7 4 10.5C4 14 7.5 17 12 17C16.5 17 20 14 20 10.5C20 7 16.5 4 12 4Z" fill="#ffffff" fillOpacity="0.15" />
            <circle cx="7" cy="8" r="2.2" fill="#ef4444" />
            <text x="13.5" y="14.5" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="900" fontFamily="sans-serif">BCR</text>
          </svg>
        </div>
      );

    case 'raiffeisen':
      return (
        <div 
          className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-yellow-500/50 shadow-xs ${className}`}
          style={{ width: s, height: s, background: 'linear-gradient(135deg, #facc15 0%, #eab308 100%)' }}
          title="Raiffeisen Bank"
        >
          {/* Raiffeisen Gable Cross (X) */}
          <svg width={s * 0.75} height={s * 0.75} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 5L12 11L18 5L19.5 6.5L13.5 12.5L19.5 18.5L18 20L12 14L6 20L4.5 18.5L10.5 12.5L4.5 6.5L6 5Z" fill="#000000" />
            <circle cx="5" cy="5" r="1.5" fill="#000000" />
            <circle cx="19" cy="5" r="1.5" fill="#000000" />
            <circle cx="5" cy="19" r="1.5" fill="#000000" />
            <circle cx="19" cy="19" r="1.5" fill="#000000" />
          </svg>
        </div>
      );

    case 'brd':
      return (
        <div 
          className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-red-500/40 shadow-xs ${className}`}
          style={{ width: s, height: s, backgroundColor: '#000000' }}
          title="BRD (Groupe Société Générale)"
        >
          {/* BRD Red & Black Split */}
          <div className="w-full h-full flex flex-col">
            <div className="w-full h-1/2 bg-[#dc2626] flex items-center justify-center" />
            <div className="w-full h-0.5 bg-white" />
            <div className="w-full h-1/2 bg-[#111827] flex items-center justify-center" />
          </div>
          <span className="absolute inset-0 flex items-center justify-center text-[7.5px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            BRD
          </span>
        </div>
      );

    case 'cec':
      return (
        <div 
          className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-emerald-600/40 shadow-xs ${className}`}
          style={{ width: s, height: s, background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
          title="CEC Bank"
        >
          <span className="text-[7.5px] font-black text-amber-300">
            CEC
          </span>
        </div>
      );

    default:
      return (
        <div 
          className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-600 dark:text-slate-300 shadow-xs ${className}`}
          style={{ width: s, height: s }}
          title={bank?.name || 'Alte Bănci'}
        >
          <svg width={s * 0.65} height={s * 0.65} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
      );
  }
}
