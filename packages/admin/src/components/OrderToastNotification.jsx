import React, { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo.jsx';
import { CheckCircle2, XCircle, CreditCard, Banknote, X } from 'lucide-react';
import { formatThousands } from '../utils/formatters';
import { ALL_BRAND_COLORS as BRAND_COLORS } from '../utils/brandTheme';

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
      className="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.18)] hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 cursor-pointer pointer-events-auto animate-in slide-in-from-top-3 fade-in select-none"
    >
      {/* Brand Logo in clean squircle */}
      <div 
        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center p-1 shrink-0 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs"
      >
        <BrandLogo brandId={order.brand} size={20} />
      </div>

      {/* Main Order Info & Status */}
      <div className="flex flex-col min-w-0 pr-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs tracking-tight text-slate-900 dark:text-white">
            #{order.orderNumber || '---'}
          </span>
          <span className="text-slate-300 dark:text-slate-600 text-xs">•</span>
          <span className="font-bold text-xs tracking-tight text-slate-900 dark:text-white">
            {formatThousands(order.totalAmount || 0)} <span className="text-[10px] font-normal text-slate-500">lei</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {hasSyrve ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>iiko OK</span>
            </span>
          ) : isSyrveFailed ? (
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>iiko Err</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span>iiko...</span>
            </span>
          )}

          <span className="text-slate-300 dark:text-slate-600">•</span>

          <span className="font-normal">
            {!isCard ? 'Cash la casă' : isPaymentApproved ? 'Card POS' : 'Refuz card'}
          </span>
        </div>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(id);
        }}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 ml-1 cursor-pointer"
        title="Închide"
      >
        <X size={13} strokeWidth={2.2} />
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
