import React, { useEffect } from 'react';
import { AlertTriangle, WifiOff, CheckCircle2, X, ChevronRight } from 'lucide-react';

function DeviceAlertToastItem({ item, onDismiss, onOpenLocation }) {
  const { id, locationId, locationName, statusTone, statusLabel, message, type } = item;

  // Auto-dismiss after 12 seconds for disconnects, 6 seconds for reconnects
  useEffect(() => {
    const duration = type === 'reconnected' ? 6000 : 12000;
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, type, onDismiss]);

  const isReconnected = type === 'reconnected';
  const isOffline = statusTone === 'offline';

  return (
    <div
      onClick={() => onOpenLocation(locationId)}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] animate-in slide-in-from-top-4 duration-300 max-w-md ${
        isReconnected
          ? 'bg-emerald-500/95 dark:bg-emerald-950/90 border-emerald-400 dark:border-emerald-600 text-white shadow-emerald-500/20'
          : isOffline
          ? 'bg-rose-600/95 dark:bg-rose-950/90 border-rose-400 dark:border-rose-600 text-white shadow-rose-600/25 ring-2 ring-rose-500/20'
          : 'bg-amber-500/95 dark:bg-amber-950/90 border-amber-400 dark:border-amber-600 text-white shadow-amber-500/25 ring-2 ring-amber-500/20'
      }`}
      role="alert"
    >
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
        {isReconnected ? (
          <CheckCircle2 size={20} className="text-white" />
        ) : isOffline ? (
          <WifiOff size={20} className="text-white animate-pulse" />
        ) : (
          <AlertTriangle size={20} className="text-white animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-wider uppercase opacity-90">
            {locationName || locationId}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/25 text-white uppercase tracking-tight">
            {statusLabel}
          </span>
        </div>
        <p className="text-xs font-medium text-white/95 truncate mt-0.5">
          {message}
        </p>
      </div>

      {/* Action CTA */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[11px] font-bold underline opacity-80 hover:opacity-100 hidden sm:inline">
          Detalii
        </span>
        <ChevronRight size={14} className="opacity-80" />
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(id);
        }}
        className="w-6 h-6 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors shrink-0 ml-1"
        title="Închide alerta"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function DeviceAlertToastStack({
  deviceAlerts = [],
  onDismiss = () => {},
  onOpenLocation = () => {}
}) {
  if (!deviceAlerts || deviceAlerts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-2 pointer-events-none w-full max-w-md px-4">
      {deviceAlerts.map(alert => (
        <DeviceAlertToastItem
          key={alert.id}
          item={alert}
          onDismiss={onDismiss}
          onOpenLocation={onOpenLocation}
        />
      ))}
    </div>
  );
}
