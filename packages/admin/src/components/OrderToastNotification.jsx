import React, { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo.jsx';
import { CheckCircle2, XCircle, CreditCard, Banknote, X } from 'lucide-react';
import { formatThousands } from '../utils/formatters';

const BRAND_COLORS = {
  smashme: '#ef4444',
  crunch: '#eab308',
  rollmaster: '#e31e24',
  lovesushi: '#ec4899',
  pokiwoki: '#f97316'
};

/**
 * Sound muted as requested by user ("fara sunet")
 */
export function playNewOrderSound() {
  // Silent - user requested no audio
}

/**
 * Compact Pill Order Toast Notification (Capsule design inspired by kiosk bar)
 * - Adapts cleanly to both Light and Dark themes
 * - Taller (+20%) for comfortable spacing and readability
 */
function OrderToastItem({ item, onDismiss, onOpenOrder }) {
  const { order, id } = item;
  const [isPaused, setIsPaused] = useState(false);

  const durationMs = 6000;

  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(() => {
      onDismiss(id);
    }, durationMs);

    return () => clearTimeout(timer);
  }, [id, isPaused, onDismiss]);

  const brandKey = (order.brand || '').toLowerCase();
  const brandColor = BRAND_COLORS[brandKey] || '#3b82f6';

  // Status iiko/Syrve
  const hasSyrve = !!order.syrveOrderId;
  const isSyrveFailed = order.syrveStatus === 'error' || order.syrveError;

  // Status POS / Plată
  const isCard = order.paymentMethod === 'card' || !!order.paymentRef?.authCode;
  const isCancelled = order.status === 'cancelled';
  const isPaymentApproved = !isCancelled;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={() => {
        if (onOpenOrder) onOpenOrder(order);
      }}
      className="group relative flex items-center gap-2.5 sm:gap-3 px-4 py-2.5 rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl shadow-slate-900/10 dark:shadow-black/50 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 cursor-pointer pointer-events-auto animate-in slide-in-from-top-3 fade-in"
      style={{
        boxShadow: `0 10px 25px -5px rgba(0,0,0,0.12), 0 0 0 1.5px ${brandColor}40`
      }}
    >
      {/* Brand Logo in circle with brand border */}
      <div 
        className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center p-0.5 shrink-0 shadow-sm"
        style={{ border: `1.5px solid ${brandColor}` }}
      >
        <BrandLogo brandId={order.brand} size={20} />
      </div>

      {/* Order Number pill */}
      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 whitespace-nowrap shadow-xs">
        #{order.orderNumber || '---'}
      </span>

      {/* Total Amount */}
      <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
        {formatThousands(order.totalAmount || 0)} <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400">lei</span>
      </span>

      {/* Status iiko pill */}
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap shadow-xs ${
        hasSyrve 
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' 
          : isSyrveFailed
          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
          : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
      }`}>
        {hasSyrve ? (
          <>
            <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>iiko: OK</span>
          </>
        ) : isSyrveFailed ? (
          <>
            <XCircle size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>iiko: Err</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping shrink-0" />
            <span>iiko...</span>
          </>
        )}
      </span>

      {/* Status POS pill */}
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap shadow-xs ${
        !isCard
          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
          : isPaymentApproved
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
      }`}>
        {!isCard ? (
          <>
            <Banknote size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Cash</span>
          </>
        ) : isPaymentApproved ? (
          <>
            <CreditCard size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Card OK</span>
          </>
        ) : (
          <>
            <XCircle size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Refuz</span>
          </>
        )}
      </span>

      {/* Dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(id);
        }}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 ml-0.5"
        title="Închide"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Toast Stack Container fixed in top-right corner
 */
export default function OrderToastNotificationStack({
  orderToasts = [],
  onDismiss = () => {},
  onOpenOrder = () => {}
}) {
  if (!orderToasts || orderToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      {orderToasts.map(item => (
        <OrderToastItem 
          key={item.id}
          item={item} 
          onDismiss={onDismiss} 
          onOpenOrder={onOpenOrder} 
        />
      ))}
    </div>
  );
}
