import React from 'react';

/**
 * InactivityWarningModal (McDonald's / KFC Style)
 * Shows a friendly, prominent countdown before the kiosk resets to the screensaver.
 */
export default function InactivityWarningModal({
  secondsLeft = 20,
  onKeepOrdering,
  onCancelOrder,
  lang = 'ro',
}) {
  const isEn = lang === 'en';

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
      onClick={onKeepOrdering}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-slate-100 dark:border-slate-800 transform transition-all scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Countdown Circle */}
        <div className="relative w-24 h-24 mx-auto mb-5 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-amber-200 dark:border-amber-950/60 animate-ping opacity-25" />
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/30 text-white">
            <span className="text-4xl font-black tracking-tight">
              {secondsLeft}
            </span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
          {isEn ? 'Are you still ordering?' : 'Mai dorești să comanzi?'}
        </h2>
        
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-7 leading-relaxed">
          {isEn 
            ? `Your order will reset in ${secondsLeft} seconds of inactivity.` 
            : `Sesiunea se va reseta automat în ${secondsLeft} secunde dacă nu atingi ecranul.`}
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={onKeepOrdering}
            className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-extrabold text-base shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>{isEn ? 'CONTINUE ORDERING' : 'CONTINUĂ COMANDA'}</span>
          </button>

          <button
            type="button"
            onClick={onCancelOrder}
            className="w-full py-3 px-4 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            {isEn ? 'Cancel and leave' : 'Renunță și resetează'}
          </button>
        </div>
      </div>
    </div>
  );
}
