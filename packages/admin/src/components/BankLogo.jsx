import React, { useState } from 'react';

/**
 * Componentă oficială pentru Avatar / Logo Bănci Emitente Carduri
 * (BT, Revolut, ING, BCR, Raiffeisen, BRD, CEC, Altele)
 * Încarcă logo-urile oficiale reale vector/PNG din /banks/
 */
export const BANK_ASSETS = {
  bt: {
    src: '/banks/bt.png',
    name: 'Banca Transilvania',
    short: 'BT',
    padding: 'p-[1.5px]',
    bgColor: 'bg-white dark:bg-slate-900',
    borderColor: 'border-amber-400/80',
    fallbackBg: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 60%, #d97706 100%)',
    fallbackColor: '#000000'
  },
  revolut: {
    src: '/banks/revolut.svg',
    name: 'Revolut',
    short: 'R',
    padding: 'p-0',
    bgColor: 'bg-black',
    borderColor: 'border-slate-800',
    fallbackBg: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
    fallbackColor: '#ffffff'
  },
  ing: {
    src: '/banks/ing.svg',
    name: 'ING Bank',
    short: 'ING',
    padding: 'p-0',
    bgColor: 'bg-white',
    borderColor: 'border-orange-400/80',
    fallbackBg: 'linear-gradient(135deg, #ff6200 0%, #ea580c 100%)',
    fallbackColor: '#ffffff'
  },
  bcr: {
    src: '/banks/bcr.svg',
    name: 'BCR (Erste Group)',
    short: 'BCR',
    padding: 'p-0',
    bgColor: 'bg-[#00497b]',
    borderColor: 'border-sky-500/80',
    fallbackBg: 'linear-gradient(135deg, #00497b 0%, #0284c7 100%)',
    fallbackColor: '#ffffff'
  },
  raiffeisen: {
    src: '/banks/raiffeisen.svg',
    name: 'Raiffeisen Bank',
    short: 'RB',
    padding: 'p-0',
    bgColor: 'bg-[#fee600]',
    borderColor: 'border-yellow-500/80',
    fallbackBg: 'linear-gradient(135deg, #fee600 0%, #eab308 100%)',
    fallbackColor: '#000000'
  },
  brd: {
    src: '/banks/brd.svg',
    name: 'BRD (Groupe Société Générale)',
    short: 'BRD',
    padding: 'p-0',
    bgColor: 'bg-[#231f20]',
    borderColor: 'border-red-500/80',
    fallbackBg: 'linear-gradient(135deg, #ed1a3a 0%, #231f20 100%)',
    fallbackColor: '#ffffff'
  },
  cec: {
    src: '/banks/cec.svg',
    name: 'CEC Bank',
    short: 'CEC',
    padding: 'p-0',
    bgColor: 'bg-[#004710]',
    borderColor: 'border-emerald-600/80',
    fallbackBg: 'linear-gradient(135deg, #004710 0%, #059669 100%)',
    fallbackColor: '#ffffff'
  }
};

export function resolveBankKey(bankId, bank) {
  const rawId = (bank?.id || bankId || '').toLowerCase().trim();
  if (rawId.includes('bt') || rawId.includes('transilvania') || rawId.includes('btrl')) return 'bt';
  if (rawId.includes('revo')) return 'revolut';
  if (rawId.includes('ing')) return 'ing';
  if (rawId.includes('bcr') || rawId.includes('erste') || rawId.includes('comerciala')) return 'bcr';
  if (rawId.includes('raif') || rawId.includes('rzb')) return 'raiffeisen';
  if (rawId.includes('brd') || rawId.includes('societe')) return 'brd';
  if (rawId.includes('cec')) return 'cec';
  return 'other';
}

export default function BankLogo({ bankId, bank, size = 20, className = "" }) {
  const [hasError, setHasError] = useState(false);
  const key = resolveBankKey(bankId, bank);
  const asset = BANK_ASSETS[key];
  const s = size;

  // Cazul generic / necunoscut / Altele
  if (!asset || key === 'other') {
    return (
      <div 
        className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-600 dark:text-slate-300 shadow-2xs select-none ${className}`}
        style={{ width: s, height: s, minWidth: s, minHeight: s }}
        title={bank?.name || 'Alte Bănci'}
      >
        <svg width={Math.max(10, Math.round(s * 0.6))} height={Math.max(10, Math.round(s * 0.6))} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </div>
    );
  }

  // Fallback text badge dacă imaginea nu se poate încărca
  if (hasError) {
    return (
      <div 
        className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border ${asset.borderColor} shadow-2xs font-black select-none ${className}`}
        style={{ 
          width: s, 
          height: s, 
          minWidth: s, 
          minHeight: s, 
          background: asset.fallbackBg, 
          color: asset.fallbackColor,
          fontSize: Math.max(8, Math.round(s * 0.38))
        }}
        title={asset.name}
      >
        {asset.short}
      </div>
    );
  }

  // Randare oficială Logo Avatar Real
  return (
    <div 
      className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-slate-200/80 dark:border-slate-700/80 shadow-2xs ${asset.bgColor} ${asset.padding} select-none ${className}`}
      style={{ width: s, height: s, minWidth: s, minHeight: s }}
      title={asset.name}
    >
      <img 
        src={asset.src} 
        alt={asset.name} 
        className="w-full h-full object-contain rounded-full"
        onError={() => setHasError(true)}
        loading="eager"
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
