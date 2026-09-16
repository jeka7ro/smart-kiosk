import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, CheckCircle2, XCircle, CreditCard, Banknote, Sparkles, ChevronRight, ExternalLink, Clock } from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import { formatThousands } from '../utils/formatters';

const BRAND_COLORS = {
  smashme: '#ef4444',
  crunch: '#eab308',
  rollmaster: '#e31e24',
  lovesushi: '#ec4899',
  pokiwoki: '#f97316'
};

const BRAND_NAMES = {
  smashme: 'SmashMe',
  crunch: 'Crunch',
  rollmaster: 'RollMaster',
  lovesushi: 'LoveSushi',
  pokiwoki: 'PokiWoki'
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - ts) / 1000);

  if (diffSec < 45) return 'chiar acum';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `acum ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `acum ${diffHours} ore`;
  
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function OrdersNotificationBell({
  orders = [],
  onOpenOrder = () => {},
  onViewAllOrders = () => {},
  onTriggerTestOrder = () => {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [readOrderIds, setReadOrderIds] = useState(() => new Set());
  // Timestamp când a pornit sesiunea curentă (la pornire / refresh)
  const sessionStartTsRef = useRef(Date.now());
  const dropdownRef = useRef(null);

  // Get recent 12 orders (deduplicated by ID / orderNumber)
  const recentOrders = useMemo(() => {
    const seen = new Set();
    return (orders || []).filter(o => {
      const key = o._id || o.id || o.orderNumber;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
  }, [orders]);

  // Contorizează EXCLUSIV comenzile sosite în timp real după deschiderea / refresh-ul paginii
  const unreadCount = useMemo(() => {
    return recentOrders.filter(o => {
      const key = o._id || o.orderNumber;
      if (!key) return false;
      if (readOrderIds.has(key)) return false;

      // Dacă comanda a fost creată înainte de deschiderea/refresh-ul paginii, este istorică din baza de date
      const orderTs = new Date(o.createdAt || o.arrivedAt || 0).getTime();
      if (!orderTs || orderTs <= sessionStartTsRef.current) return false;

      return true;
    }).length;
  }, [recentOrders, readOrderIds]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      // Marchează toate comenzile curente ca citite și actualizează timestamp-ul de sesiune
      sessionStartTsRef.current = Date.now();
      setReadOrderIds(prev => {
        const next = new Set(prev);
        recentOrders.forEach(o => {
          if (o._id) next.add(o._id);
          if (o.orderNumber) next.add(o.orderNumber);
        });
        return next;
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Bell Icon Button (Identic cu butonul Theme & Logout) ── */}
      <button
        type="button"
        onClick={handleToggle}
        title="Notificări comenzi recente"
        className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all relative ${
          isOpen
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}
      >
        <Bell className="w-5 h-5" />

        {/* Badge notificări noi */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 min-w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm animate-in zoom-in-75">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel (Apple iOS Luxury Glass) ── */}
      {isOpen && (
        <div 
          className="absolute right-0 top-12 z-50 w-[390px] max-w-[calc(100vw-2rem)] rounded-3xl bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-slate-900/20 dark:shadow-black/60 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ maxHeight: 'calc(100vh - 6rem)' }}
        >
          {/* Header Panel */}
          <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                  Notificări Comenzi
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {recentOrders.length} recente
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
                Istoric flux comenzi kiosk în timp real
              </p>
            </div>

            {/* Buton Test Notificare */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTriggerTestOrder();
              }}
              className="px-2.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-500/25 transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
              title="Trimite o comandă de test și afișează popup-ul"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test</span>
            </button>
          </div>

          {/* Lista de comenzi recente */}
          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 space-y-1 flex-1">
            {recentOrders.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                Nu există comenzi recente în sistem.
              </div>
            ) : (
              recentOrders.map((order) => {
                const brandKey = (order.brand || '').toLowerCase();
                const brandColor = BRAND_COLORS[brandKey] || '#3b82f6';
                const brandName = BRAND_NAMES[brandKey] || order.brand || 'Kiosk';
                const hasSyrve = !!order.syrveOrderId;
                const isCard = order.paymentMethod === 'card' || !!order.paymentRef?.authCode;
                const timeLabel = formatRelativeTime(order.createdAt || order.arrivedAt);

                const items = Array.isArray(order.items) ? order.items : [];
                const itemsSnippet = items.map(i => `${i.quantity > 1 ? `${i.quantity}x ` : ''}${i.name}`).slice(0, 2).join(', ') + (items.length > 2 ? ` +încă ${items.length - 2}` : '');

                return (
                  <div
                    key={order._id || order.orderNumber || Math.random()}
                    onClick={() => {
                      setIsOpen(false);
                      onOpenOrder(order);
                    }}
                    className="p-3 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all cursor-pointer group flex items-start gap-3 select-none"
                  >
                    {/* Brand Logo */}
                    <div 
                      className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center p-0.5 shrink-0 shadow-xs mt-0.5"
                      style={{ border: `1.5px solid ${brandColor}` }}
                    >
                      <BrandLogo brandId={order.brand} size={22} />
                    </div>

                    {/* Order Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-black text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/25">
                            #{order.orderNumber || '---'}
                          </span>
                          <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate">
                            {brandName}
                          </span>
                        </div>

                        {/* Suma totală */}
                        <span className="font-black text-xs text-slate-900 dark:text-white shrink-0">
                          {formatThousands(order.totalAmount || 0)} <span className="text-[10px] text-slate-400 font-bold">lei</span>
                        </span>
                      </div>

                      {/* Products snippet */}
                      {itemsSnippet && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-1.5 font-medium">
                          {itemsSnippet}
                        </p>
                      )}

                      {/* Badges row: iiko, payment, time */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Status iiko */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          hasSyrve 
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25' 
                            : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25'
                        }`}>
                          {hasSyrve ? <CheckCircle2 size={10} /> : <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                          <span>{hasSyrve ? 'iiko OK' : 'iiko Sync'}</span>
                        </span>

                        {/* Status Plată */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isCard
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
                        }`}>
                          {isCard ? <CreditCard size={10} /> : <Banknote size={10} />}
                          <span>{isCard ? 'Card' : 'Cash'}</span>
                        </span>

                        {/* Timp */}
                        {timeLabel && (
                          <span className="text-[10.5px] text-slate-400 dark:text-slate-500 ml-auto flex items-center gap-0.5">
                            <Clock size={10} />
                            <span>{timeLabel}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Panel */}
          <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onViewAllOrders();
              }}
              className="w-full py-2 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Vezi toate comenzile</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
