import React, { useState } from 'react';

/**
 * Componentă oficială pentru Avatar / Logo Bănci Emitente Carduri
 * (BT, Revolut, ING, BCR, Raiffeisen, UniCredit, BRD, CEC, Patria, Salt, Libra, Tichete Masă, Internațional, Altele)
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
  unicredit: {
    src: '/banks/unicredit.svg',
    name: 'UniCredit Bank',
    short: 'UCB',
    padding: 'p-0',
    bgColor: 'bg-[#e2001a]',
    borderColor: 'border-red-600/80',
    fallbackBg: 'linear-gradient(135deg, #e2001a 0%, #b91c1c 100%)',
    fallbackColor: '#ffffff'
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
  },
  patria: {
    src: '/banks/patria.png',
    name: 'Patria Bank',
    short: 'PAT',
    padding: 'p-[1px]',
    bgColor: 'bg-white',
    borderColor: 'border-blue-700/80',
    fallbackBg: 'linear-gradient(135deg, #002e6d 0%, #1e40af 100%)',
    fallbackColor: '#ffffff'
  },
  salt: {
    src: '/banks/salt.svg',
    name: 'Salt Bank',
    short: 'SALT',
    padding: 'p-0',
    bgColor: 'bg-black',
    borderColor: 'border-emerald-400/80',
    fallbackBg: 'linear-gradient(135deg, #052e16 0%, #000000 100%)',
    fallbackColor: '#10b981'
  },
  libra: {
    src: '/banks/libra.svg',
    name: 'Libra Bank',
    short: 'LIB',
    padding: 'p-[1px]',
    bgColor: 'bg-white',
    borderColor: 'border-slate-200 dark:border-slate-700',
    fallbackBg: 'linear-gradient(135deg, #0a2540 0%, #0284c7 100%)',
    fallbackColor: '#ffffff'
  },
  meal_vouchers: {
    src: '/banks/meal_vouchers.svg',
    name: 'Card Masă (Tichete)',
    short: 'Tichete',
    padding: 'p-0',
    bgColor: 'bg-orange-600',
    borderColor: 'border-orange-500/80',
    fallbackBg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
    fallbackColor: '#ffffff'
  },
  international: {
    src: '/banks/international.svg',
    name: 'Card Internațional',
    short: 'INT',
    padding: 'p-0',
    bgColor: 'bg-blue-600',
    borderColor: 'border-blue-500/80',
    fallbackBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
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
  if (rawId.includes('unicredit') || rawId.includes('ucb') || rawId.includes('tiriac')) return 'unicredit';
  if (rawId.includes('brd') || rawId.includes('societe')) return 'brd';
  if (rawId.includes('cec')) return 'cec';
  if (rawId.includes('patria') || rawId.includes('carpatica')) return 'patria';
  if (rawId.includes('salt')) return 'salt';
  if (rawId.includes('libra')) return 'libra';
  if (rawId.includes('meal') || rawId.includes('tichete') || rawId.includes('edenred') || rawId.includes('pluxee') || rawId.includes('sodexo') || rawId.includes('up')) return 'meal_vouchers';
  if (rawId.includes('internat') || rawId.includes('global') || rawId.includes('foreign')) return 'international';
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
          fontSize: Math.max(7, Math.round(s * 0.35))
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
