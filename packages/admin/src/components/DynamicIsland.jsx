import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  X,
  ChevronRight,
  Bell,
  ExternalLink,
  CreditCard,
  Banknote,
  Clock,
  Server,
  Radio,
} from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import { formatThousands } from '../utils/formatters';
import { ALL_BRAND_LABELS as BRAND_NAMES } from '../utils/brandTheme';

function isSameLocalDay(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const ts = typeof dateStr === 'number' ? dateStr : new Date(dateStr).getTime();
  if (isNaN(ts)) return '';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 45) return 'acum';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Apple Dynamic Island & Unified Notification Center
 * - Lives centered in the top macOS header bar
 * - Resting compact pill shows real-time hardware health & unread counter
 * - Smooth spring morph expansion for incoming Orders, Device Alerts, and System Messages
 * - Click opens the Apple Notification Center panel anchored directly beneath the island
 */
export default function DynamicIsland({
  orderToasts = [],
  deviceAlerts = [],
  systemNotifications = [],
  orders = [],
  locationsHealth = { onlineCount: 0, totalCount: 4, issues: [] },
  connected = true,
  onDismissOrderToast = () => { },
  onDismissDeviceAlert = () => { },
  onOpenOrder = () => { },
  onOpenLocation = () => { },
  onViewAllOrders = () => { },
  onOpenLiveStatus = () => { },
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [centerTab, setCenterTab] = useState('all'); // 'all' | 'orders' | 'alerts'
  const [isHovered, setIsHovered] = useState(false);
  const [exitingKey, setExitingKey] = useState(null);
  const [restingSlot, setRestingSlot] = useState('status'); // 'status' | 'lastOrder'
  const [readOrderIds, setReadOrderIds] = useState(() => new Set());
  const sessionStartTsRef = useRef(Date.now());
  const containerRef = useRef(null);

  const dismissOrderRef = useRef(onDismissOrderToast);
  const dismissAlertRef = useRef(onDismissDeviceAlert);
  dismissOrderRef.current = onDismissOrderToast;
  dismissAlertRef.current = onDismissDeviceAlert;

  // Auto-purge any stale order toast that is NOT from today
  useEffect(() => {
    if (!orderToasts || orderToasts.length === 0) return;
    orderToasts.forEach((t) => {
      const dt = t?.order?.createdAt || t?.order?.arrivedAt;
      if (dt && !isSameLocalDay(dt)) {
        dismissOrderRef.current(t.id);
      }
    });
  }, [orderToasts]);

  // Determine highest-priority active Live Activity inside Dynamic Island
  // Priority: 1. Incoming Order Toast (STRICTLY TODAY) -> 2. Device Alert Toast -> 3. System Toast
  const activeActivity = useMemo(() => {
    const validTodayOrderToast = (orderToasts || []).find((t) => {
      const dt = t?.order?.createdAt || t?.order?.arrivedAt;
      return !dt || isSameLocalDay(dt);
    });
    if (validTodayOrderToast) {
      return {
        kind: 'order',
        key: `order-${validTodayOrderToast.id}`,
        id: validTodayOrderToast.id,
        order: validTodayOrderToast.order,
        durationMs: 5500,
      };
    }
    if (deviceAlerts && deviceAlerts.length > 0) {
      const top = deviceAlerts[0];
      return {
        kind: 'alert',
        key: `alert-${top.id}`,
        id: top.id,
        alert: top,
        durationMs: top.type === 'reconnected' ? 5500 : 9000,
      };
    }
    if (systemNotifications && systemNotifications.length > 0) {
      const top = systemNotifications[0];
      return {
        kind: 'system',
        key: `sys-${top.id}`,
        id: top.id,
        msg: top.msg,
        durationMs: 4000,
      };
    }
    return null;
  }, [orderToasts, deviceAlerts, systemNotifications]);

  const activeKey = activeActivity?.key || null;
  const activeId = activeActivity?.id || null;
  const activeKind = activeActivity?.kind || null;
  const activeDurationMs = activeActivity?.durationMs || 5500;

  // Recent 15 deduplicated orders placed STRICTLY TODAY, sorted newest first
  const todayOrders = useMemo(() => {
    const seen = new Set();
    return (orders || [])
      .filter((o) => {
        if (!isSameLocalDay(o.createdAt || o.arrivedAt)) return false;
        const key = o._id || o.id || o.orderNumber;
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || b.arrivedAt || 0).getTime() - new Date(a.createdAt || a.arrivedAt || 0).getTime())
      .slice(0, 15);
  }, [orders]);

  const latestTodayOrder = todayOrders[0] || null;
  const hasLatestTodayOrder = Boolean(latestTodayOrder);

  // Alternate resting capsule smoothly between LIVE Status & Latest Order FROM TODAY ONLY
  useEffect(() => {
    if (!hasLatestTodayOrder) {
      setRestingSlot('status');
      return;
    }
    if (activeKey || isExpanded || isHovered) return;
    const interval = setInterval(() => {
      setRestingSlot((prev) => (prev === 'status' ? 'lastOrder' : 'status'));
    }, 4200);
    return () => clearInterval(interval);
  }, [activeKey, isExpanded, isHovered, hasLatestTodayOrder]);

  // Auto-dismiss active live activity: keyed strictly on primitive IDs so background socket updates NEVER reset the timer!
  useEffect(() => {
    if (!activeKey || isHovered || isExpanded) return;
    if (activeKind === 'system') return; // managed by parent timer

    let retractTimer = null;
    const dismissTimer = setTimeout(() => {
      setExitingKey(activeKey);
      retractTimer = setTimeout(() => {
        if (activeKind === 'order') {
          setRestingSlot('lastOrder');
          dismissOrderRef.current(activeId);
        } else if (activeKind === 'alert') {
          setRestingSlot('status');
          dismissAlertRef.current(activeId);
        }
        setExitingKey(null);
      }, 320);
    }, activeDurationMs);

    return () => {
      clearTimeout(dismissTimer);
      if (retractTimer) clearTimeout(retractTimer);
    };
  }, [activeKey, activeId, activeKind, activeDurationMs, isHovered, isExpanded]);

  // Unread live orders since session start (strictly today)
  const unreadOrdersCount = useMemo(() => {
    return todayOrders.filter((o) => {
      const key = o._id || o.orderNumber;
      if (!key || readOrderIds.has(key)) return false;
      const orderTs = new Date(o.createdAt || o.arrivedAt || 0).getTime();
      return orderTs > sessionStartTsRef.current;
    }).length;
  }, [todayOrders, readOrderIds]);

  const activeIssues = locationsHealth?.issues || [];
  const totalBadgeCount = unreadOrdersCount + activeIssues.length;

  // Click outside + Escape closes Notification Center
  useEffect(() => {
    if (!isExpanded) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isExpanded]);

  const handleToggleCenter = () => {
    if (!isExpanded) {
      sessionStartTsRef.current = Date.now();
      setReadOrderIds((prev) => {
        const next = new Set(prev);
        todayOrders.forEach((o) => {
          if (o._id) next.add(o._id);
          if (o.orderNumber) next.add(o.orderNumber);
        });
        return next;
      });
    }
    setIsExpanded((v) => !v);
  };

  const handleDismissCurrent = (e) => {
    e.stopPropagation();
    if (!activeActivity) return;
    setExitingKey(activeActivity.key);
    setTimeout(() => {
      if (activeActivity.kind === 'order') {
        setRestingSlot('lastOrder');
        onDismissOrderToast(activeActivity.id);
      }
      if (activeActivity.kind === 'alert') {
        setRestingSlot('status');
        onDismissDeviceAlert(activeActivity.id);
      }
      setExitingKey(null);
    }, 320);
  };

  const isLiveExpanded = Boolean(activeActivity && !isExpanded);
  const isExiting = Boolean(activeActivity && exitingKey === activeActivity.key);
  const isVisuallyExpanded = isLiveExpanded && !isExiting;

  // Resting pill state summary
  const primaryIssue = activeIssues[0] || null;
  const showRestingOrder = Boolean(restingSlot === 'lastOrder' && latestTodayOrder);

  return (
    <div ref={containerRef} className="relative flex flex-col items-center justify-center z-50">
      {/* ─── THE THEME-ADAPTIVE APPLE LIQUID GLASS DYNAMIC ISLAND CAPSULE ─── */}
      <div
        role="button"
        tabIndex={0}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (isLiveExpanded && activeActivity?.kind === 'order') {
            onOpenOrder(activeActivity.order);
            onDismissOrderToast(activeActivity.id);
            return;
          }
          handleToggleCenter();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleCenter();
          }
        }}
        title="Centru Notificări & Activitate Live (Click pentru deschidere)"
        className={`di-capsule di-surface relative flex items-center justify-between overflow-hidden rounded-full cursor-pointer select-none ${isVisuallyExpanded
          ? 'is-live h-[42px] px-4 min-w-[270px] sm:min-w-[345px] max-w-[92vw] sm:max-w-[440px]'
          : isExpanded
            ? 'h-[36px] px-4 min-w-[220px] ring-2 ring-[#007AFF]/35'
            : 'h-[36px] px-3.5 min-w-[195px] sm:min-w-[232px] max-w-[300px] hover:scale-[1.02] active:scale-[0.97]'
          }`}
      >
        {/* ─── STATE A: LIVE ORDER POP-OUT (emerges from Dynamic Island, then retracts back in) ─── */}
        {isLiveExpanded && activeActivity.kind === 'order' && (() => {
          const ord = activeActivity.order;
          const hasSyrve = !!ord.syrveOrderId;
          const isSyrveErr = ord.syrveStatus === 'error' || ord.syrveError;
          const isCard = ord.paymentMethod === 'card' || !!ord.paymentRef?.authCode;
          return (
            <div
              key={activeActivity.key}
              className={`flex items-center gap-2.5 w-full min-w-0 ${isExiting ? 'di-content-out' : 'di-content-in'}`}
            >
              <div className="w-6 h-6 rounded-full bg-white border border-black/[0.08] flex items-center justify-center p-0.5 shrink-0 shadow-2xs">
                <BrandLogo brandId={ord.brand} size={16} />
              </div>

              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[12.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-white whitespace-nowrap tabular-nums">
                  #{ord.orderNumber || '---'}
                </span>
                <span className="text-black/20 dark:text-white/30 text-[10px]">•</span>
                <span className="text-[12.5px] font-bold text-[#1F7A33] dark:text-[#30D158] whitespace-nowrap tabular-nums">
                  {formatThousands(ord.totalAmount || 0)} lei
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D] whitespace-nowrap ml-auto px-2 py-0.5 rounded-full bg-black/[0.045] dark:bg-white/[0.08]">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${hasSyrve ? 'bg-[#34C759]' : isSyrveErr ? 'bg-[#FF3B30]' : 'bg-[#007AFF] animate-pulse'
                      }`}
                  />
                  <span>{hasSyrve ? 'iiko' : isSyrveErr ? 'Err' : 'Sync'}</span>
                  <span className="opacity-40">·</span>
                  <span>{isCard ? 'Card' : 'Cash'}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={handleDismissCurrent}
                className="w-5 h-5 rounded-full bg-black/[0.07] hover:bg-black/[0.14] dark:bg-white/12 dark:hover:bg-white/22 flex items-center justify-center text-[#1D1D1F]/70 hover:text-[#1D1D1F] dark:text-white/75 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
                title="Închide"
              >
                <X size={11} strokeWidth={2.6} />
              </button>

              {/* Micro countdown line */}
              <div
                style={{ '--di-duration': `${activeActivity.durationMs}ms` }}
                className={`di-progress-bar absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-[#007AFF]/70 dark:bg-[#30D158]/80 ${isHovered ? 'is-paused' : ''
                  }`}
              />
            </div>
          );
        })()}

        {/* ─── STATE B: LIVE DEVICE ALERT POP-OUT ─── */}
        {isLiveExpanded && activeActivity.kind === 'alert' && (() => {
          const al = activeActivity.alert;
          const isReconnected = al.type === 'reconnected';
          const isOffline = al.statusTone === 'offline';
          const accentColor = isReconnected ? '#34C759' : isOffline ? '#FF3B30' : '#FF9500';

          return (
            <div
              key={activeActivity.key}
              className={`flex items-center gap-2.5 w-full min-w-0 ${isExiting ? 'di-content-out' : 'di-content-in'}`}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
              >
                {isReconnected ? (
                  <CheckCircle2 size={14} />
                ) : isOffline ? (
                  <WifiOff size={13} className="animate-pulse" />
                ) : (
                  <AlertTriangle size={13} className="animate-pulse" />
                )}
              </div>

              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white whitespace-nowrap truncate">
                  {al.locationName || al.locationId}
                </span>
                <span
                  className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                  style={{ backgroundColor: `${accentColor}1E`, color: accentColor }}
                >
                  {al.statusLabel}
                </span>
                <span className="hidden md:inline text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate">
                  {al.message}
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLocation(al.locationId);
                  onDismissDeviceAlert(al.id);
                }}
                className="text-[11px] font-semibold text-[#007AFF] dark:text-[#0A84FF] hover:opacity-80 inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
              >
                <span>Detalii</span>
                <ChevronRight size={12} />
              </button>

              <button
                type="button"
                onClick={handleDismissCurrent}
                className="w-5 h-5 rounded-full bg-black/[0.07] hover:bg-black/[0.14] dark:bg-white/12 dark:hover:bg-white/22 flex items-center justify-center text-[#1D1D1F]/70 hover:text-[#1D1D1F] dark:text-white/75 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
                title="Închide"
              >
                <X size={11} strokeWidth={2.6} />
              </button>

              <div
                style={{ '--di-duration': `${activeActivity.durationMs}ms`, backgroundColor: `${accentColor}99` }}
                className={`di-progress-bar absolute bottom-0 left-4 right-4 h-[2px] rounded-full ${isHovered ? 'is-paused' : ''
                  }`}
              />
            </div>
          );
        })()}

        {/* ─── STATE C: SYSTEM FEEDBACK MESSAGE ─── */}
        {isLiveExpanded && activeActivity.kind === 'system' && (
          <div
            key={activeActivity.key}
            className="flex items-center justify-center gap-2 w-full min-w-0 di-content-in"
          >
            <CheckCircle2 size={14} className="text-[#34C759] shrink-0" />
            <span className="text-[12px] font-medium text-[#1D1D1F] dark:text-white truncate">
              {activeActivity.msg}
            </span>
          </div>
        )}

        {/* ─── STATE D: RESTING COMPACT CAPSULE (Alternates cleanly: LIVE Status ↔ Logo + #Order + Sum) ─── */}
        {!isLiveExpanded && (
          <div className="flex items-center justify-between gap-2.5 w-full min-w-0">
            {showRestingOrder ? (
              <div
                key={`slot-order-${latestTodayOrder._id || latestTodayOrder.orderNumber}`}
                className="flex items-center gap-2 min-w-0 di-slot-in"
              >
                <div className="w-5 h-5 rounded-full bg-white border border-black/[0.08] flex items-center justify-center p-0.5 shrink-0">
                  <BrandLogo brandId={latestTodayOrder.brand} size={14} />
                </div>
                <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white whitespace-nowrap tabular-nums">
                  #{latestTodayOrder.orderNumber || '---'}
                </span>
                <span className="text-black/20 dark:text-white/30 text-[10px]">·</span>
                <span className="text-[12px] font-bold text-[#1F7A33] dark:text-[#30D158] whitespace-nowrap tabular-nums">
                  {formatThousands(latestTodayOrder.totalAmount || 0)} lei
                </span>
              </div>
            ) : (
              <div
                key="slot-status"
                className="flex items-center gap-2 min-w-0 di-slot-in"
              >
                {!connected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#FF3B30] shrink-0" />
                    <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white/95 truncate">Server Offline</span>
                  </>
                ) : primaryIssue ? (
                  <>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${primaryIssue.statusTone === 'offline' ? 'bg-[#FF3B30]' : 'bg-[#FF9500]'
                        }`}
                    />
                    <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white truncate">
                      {primaryIssue.name}
                    </span>
                    <span
                      className={`text-[11px] font-semibold whitespace-nowrap ${primaryIssue.statusTone === 'offline' ? 'text-[#FF3B30]' : 'text-[#C96B00] dark:text-[#FF9F0A]'
                        }`}
                    >
                      {primaryIssue.statusLabel}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#34C759] shrink-0 animate-pulse" />
                    <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white whitespace-nowrap tabular-nums">
                      {locationsHealth.onlineCount}/{locationsHealth.totalCount} Online
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-black/[0.08] dark:border-white/14">
              <Bell size={13} className={totalBadgeCount > 0 ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#6E6E73] dark:text-white/60'} />
              {totalBadgeCount > 0 && (
                <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-[#FF3B30] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── EXPANDED APPLE NOTIFICATION CENTER PANEL ─── */}
      {isExpanded && (
        <>
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/45 backdrop-blur-[2px] z-40 sm:hidden"
            onClick={() => setIsExpanded(false)}
          />
          <div
            className="di-panel-open fixed sm:absolute top-[58px] sm:top-[44px] left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-20px)] sm:w-[430px] max-w-[440px] rounded-[24px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.32)] overflow-hidden flex flex-col"
            style={{ maxHeight: 'calc(100vh - 84px)' }}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-black/[0.06] dark:border-white/[0.08] space-y-3 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Centru Notificări
                  </h3>
                  {activeIssues.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FF9500]/15 text-[#C96B00] dark:text-[#FF9F0A] tabular-nums">
                      {activeIssues.length} {activeIssues.length === 1 ? 'alertă' : 'alerte'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="apple-close-btn !w-7 !h-7"
                  title="Închide"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Apple Segmented Control */}
              <div className="apple-segmented w-full grid grid-cols-3">
                {[
                  { id: 'all', label: 'Toate' },
                  { id: 'orders', label: `Azi (${todayOrders.length})` },
                  { id: 'alerts', label: `Alerte (${activeIssues.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCenterTab(t.id)}
                    className={`apple-segmented-item text-center ${centerTab === t.id ? 'is-active' : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {/* Hardware Alerts Section */}
              {(centerTab === 'all' || centerTab === 'alerts') && activeIssues.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-1.5 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    Stare Echipamente
                  </div>
                  <div className="rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]/70 border border-black/[0.05] dark:border-white/[0.06] divide-y divide-black/[0.05] dark:divide-white/[0.06] overflow-hidden">
                    {activeIssues.map((issue) => {
                      const isOff = issue.statusTone === 'offline';
                      return (
                        <div
                          key={issue.id}
                          onClick={() => {
                            setIsExpanded(false);
                            onOpenLocation(issue.id);
                          }}
                          className="p-3 flex items-center gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isOff
                              ? 'bg-[#FF3B30]/12 text-[#FF3B30]'
                              : 'bg-[#FF9500]/15 text-[#D97706] dark:text-[#FF9F0A]'
                              }`}
                          >
                            {isOff ? <WifiOff size={15} /> : <AlertTriangle size={15} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white truncate">
                                {issue.name}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isOff
                                  ? 'bg-[#FF3B30]/12 text-[#FF3B30]'
                                  : 'bg-[#FF9500]/15 text-[#C96B00] dark:text-[#FF9F0A]'
                                  }`}
                              >
                                {issue.statusLabel}
                              </span>
                            </div>
                            <p className="text-[11.5px] text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                              {issue.message}
                            </p>
                          </div>
                          <ChevronRight size={15} className="text-[#86868B] shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {centerTab === 'alerts' && activeIssues.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#34C759]/12 text-[#34C759] flex items-center justify-center mx-auto">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-white">
                    Toate echipamentele sunt operaționale
                  </p>
                  <p className="text-[11.5px] text-[#86868B]">
                    Nicio alertă activă de POS sau Kiosk.
                  </p>
                </div>
              )}

              {/* Today's Orders Section */}
              {(centerTab === 'all' || centerTab === 'orders') && (
                <div className="space-y-1.5">
                  <div className="px-1.5 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    Comenzi Azi
                  </div>

                  {todayOrders.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-[#86868B]">
                      Nicio comandă plasată astăzi.
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]/70 border border-black/[0.05] dark:border-white/[0.06] divide-y divide-black/[0.05] dark:divide-white/[0.06] overflow-hidden">
                      {todayOrders.map((order) => {
                        const brandKey = (order.brand || '').toLowerCase();
                        const brandName = BRAND_NAMES[brandKey] || order.brand || 'Kiosk';
                        const hasSyrve = !!order.syrveOrderId;
                        const isCard = order.paymentMethod === 'card' || !!order.paymentRef?.authCode;
                        const timeLabel = formatRelativeTime(order.createdAt || order.arrivedAt);
                        const items = Array.isArray(order.items) ? order.items : [];
                        const snippet =
                          items
                            .map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.name}`)
                            .slice(0, 2)
                            .join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '');

                        return (
                          <div
                            key={order._id || order.orderNumber || Math.random()}
                            onClick={() => {
                              setIsExpanded(false);
                              onOpenOrder(order);
                            }}
                            className="p-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors cursor-pointer flex items-start gap-2.5"
                          >
                            <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                              <BrandLogo brandId={order.brand} size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[12.5px] font-semibold text-[#1D1D1F] dark:text-white tabular-nums">
                                    #{order.orderNumber || '---'}
                                  </span>
                                  <span className="text-[11.5px] text-[#6E6E73] dark:text-[#98989D] truncate">
                                    {brandName}
                                  </span>
                                </div>
                                <span className="text-[12.5px] font-semibold text-[#1D1D1F] dark:text-white shrink-0 tabular-nums">
                                  {formatThousands(order.totalAmount || 0)}{' '}
                                  <span className="text-[10.5px] font-normal text-[#86868B]">lei</span>
                                </span>
                              </div>
                              {snippet && (
                                <p className="text-[11.5px] text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                                  {snippet}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-[#86868B]">
                                <span className="inline-flex items-center gap-1">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${hasSyrve ? 'bg-[#34C759]' : 'bg-[#007AFF]'
                                      }`}
                                  />
                                  <span>{hasSyrve ? 'iiko OK' : 'Sync'}</span>
                                </span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                  {isCard ? <CreditCard size={10.5} /> : <Banknote size={10.5} />}
                                  <span>{isCard ? 'Card' : 'Cash'}</span>
                                </span>
                                {timeLabel && (
                                  <span className="ml-auto inline-flex items-center gap-0.5 tabular-nums">
                                    <Clock size={10} />
                                    <span>{timeLabel}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7]/70 dark:bg-[#161618]/80 grid grid-cols-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  onViewAllOrders();
                }}
                className="apple-btn-secondary py-2 px-3 text-[12px] flex items-center justify-center gap-1.5"
              >
                <span>Toate Comenzile</span>
                <ExternalLink size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  onOpenLiveStatus();
                }}
                className="apple-btn-secondary py-2 px-3 text-[12px] flex items-center justify-center gap-1.5"
              >
                <Server size={12} />
                <span>LIVE Status</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
