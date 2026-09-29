import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthProvider';
import { 
  Clock, RefreshCw, ShoppingBag, CreditCard, 
  CheckCircle2, XCircle, AlertTriangle, Send, X, Eye, 
  Banknote, ArrowRight, ChevronDown, ChevronUp, Copy, Check, Sparkles, Utensils, Monitor
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';
import { formatThousands } from '../utils/formatters';

const BRAND_COLORS = {
  smashme: '#e11d48',
  crunch: '#d97706',
  rollmaster: '#059669',
  lovesushi: '#dc2626',
  sushimaster: '#dc2626',
  pokiwoki: '#7c3aed',
  ikura: '#ea580c',
};

const BRAND_LABELS = {
  smashme: 'SmashMe',
  crunch: 'Crunch',
  rollmaster: 'Roll Master',
  lovesushi: 'Love Sushi',
  sushimaster: 'Sushi Master',
  pokiwoki: 'Poki Woki',
  ikura: 'Ikura',
};

// ─── Standard Status Labels & Helper (Identic cu Gestionare Comenzi / App.jsx) ───
const STATUS_LABELS = {
  pending:          { label: 'Achitată cu succes',  color: '#059669' },
  awaiting_payment: { label: 'Trimis la bucătărie', color: '#059669' },
  confirmed:        { label: 'Trimis la bucătărie', color: '#059669' },
  preparing:        { label: 'În preparare',        color: '#3b82f6' },
  ready:            { label: 'Gata',                color: '#059669' },
  delivered:        { label: 'Livrat',              color: '#8b5cf6' },
  cancelled:        { label: 'Anulată',             color: '#ef4444' },
};

function getOrderStatus(item, isTimeoutUnfinalized) {
  if (!item) return { label: '—', color: '#6b7a99' };
  const p = item.payload || {};

  if (isTimeoutUnfinalized || item.kind === 'unfinalized_abandoned' || item.status === 'cancelled' || p.status === 'cancelled') {
    return { label: 'Anulată', color: '#ef4444' };
  }
  if (item.status === 'delivered' || p.status === 'delivered') return { label: 'Livrat', color: '#8b5cf6' };
  if (item.status === 'ready' || p.status === 'ready')         return { label: 'Gata', color: '#059669' };
  if (item.status === 'preparing' || p.status === 'preparing') return { label: 'În preparare', color: '#3b82f6' };

  // Comenzi plătite cu cardul -> Achitată cu succes
  if (item.paid || p.paymentMethod === 'card' || p.paymentRef?.authCode || item.auth_code || item.kind === 'finalized_success' || item.kind === 'pos_paid_pending_iiko') {
    return { label: 'Achitată cu succes', color: '#059669' };
  }

  // Comenzi trimise la bucătărie (Syrve / iiko) sau cash
  if (item.iiko_order_id || p.syrveOrderId || p.status === 'awaiting_payment' || item.status === 'awaiting_payment' || p.paymentMethod === 'cash' || item.kind === 'cash_awaiting') {
    return { label: 'Trimis la bucătărie', color: '#059669' };
  }

  if (item.kind === 'pos_in_progress') {
    return { label: 'Comandă în curs', color: '#3b82f6' };
  }

  return STATUS_LABELS[p.status || item.status] || { label: 'Achitată cu succes', color: '#059669' };
}

function CopyIconButton({ text, title = "Copiază ID iiko" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
      title={copied ? "Copiat!" : title}
      aria-label={copied ? "Copiat!" : title}
    >
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

function StatCard({ label, value, color, icon: Icon, onClick, active, highlight }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border px-4 py-3 flex items-center justify-between min-w-[120px] flex-1 relative overflow-hidden transition-all duration-200 group select-none ${
        active 
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md' 
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <span 
          className="text-2xl font-black mt-0.5 tracking-tight transition-transform duration-200 group-hover:scale-105"
          style={{ color: highlight ? '#ef4444' : (color || 'currentColor') }}
        >
          {value}
        </span>
      </div>
      {Icon && (
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

// ─── HELPER: Detecție Unificată Brand ───
export function detectBrand(item) {
  if (!item) return 'smashme';
  const p = item.payload || {};
  const bRaw = String(p.brand || item.brand || p.brandId || item.brand_id || '').toLowerCase().trim();
  if (bRaw) {
    if (bRaw.includes('sushi') || bRaw.includes('ikura') || bRaw.includes('roll')) return 'rollmaster';
    if (bRaw.includes('crunch')) return 'crunch';
    if (bRaw.includes('poki')) return 'pokiwoki';
    if (bRaw.includes('smash')) return 'smashme';
    return bRaw;
  }
  const orderNum = String(item.orderNumber || p.orderNumber || '').toUpperCase();
  const locCombined = `${item.location_id || ''} ${item.locationId || ''} ${p.locationName || ''} ${orderNum}`.toLowerCase();
  if (locCombined.includes('roll') || locCombined.includes('sushi') || locCombined.includes('ikura') || locCombined.includes('bv') || locCombined.includes('brasov') || orderNum.startsWith('BV')) {
    return 'rollmaster';
  }
  if (locCombined.includes('crunch')) return 'crunch';
  return 'smashme';
}

// ─── HELPER: Formatează Locația curată (fără brand) și Kiosk-ul ───
export function formatLocationAndKiosk(item) {
  const p = item?.payload || {};
  const rawLoc = p.locationName || item?.location_id || item?.locationId || p.locationId || '';
  const locIdStr = String(item?.location_id || item?.locationId || p.locationId || '').toLowerCase();
  const orderNum = String(item?.orderNumber || p.orderNumber || '').toUpperCase();
  const rawLocLower = String(rawLoc).toLowerCase();
  const normStr = `${rawLocLower} ${locIdStr} ${orderNum}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Curățare Nume Oraș / Locație (strict orașul, fără niciun brand repetat)
  let clean = '';
  if (normStr.includes('brasov') || normStr.includes('bv') || orderNum.startsWith('BV')) {
    clean = 'Brașov';
  } else if (normStr.includes('cluj') || normStr.includes('cj') || orderNum.startsWith('CJ')) {
    clean = normStr.includes('centru') ? 'Cluj (Centru)' : 'Cluj';
  } else if (normStr.includes('constanta') || normStr.includes('ct') || orderNum.startsWith('CT')) {
    clean = 'Constanța';
  } else if (normStr.includes('oradea') || normStr.includes('ikura') || orderNum.startsWith('OR')) {
    clean = 'Oradea';
  } else if (normStr.includes('balotesti') || orderNum.startsWith('BAL')) {
    clean = 'Balotești';
  } else if (normStr.includes('bacau') || orderNum.startsWith('BC')) {
    clean = 'Bacău';
  } else if (normStr.includes('mures') || normStr.includes('targu') || orderNum.startsWith('MS')) {
    clean = 'Târgu Mureș';
  } else {
    clean = rawLoc
      .replace(/roll\s*master/gi, '')
      .replace(/smash\s*me/gi, '')
      .replace(/love\s*sushi/gi, '')
      .replace(/sushi\s*master/gi, '')
      .replace(/we\s*love\s*sushi/gi, '')
      .replace(/poki\s*woki/gi, '')
      .replace(/crunch/gi, '')
      .replace(/ikura/gi, '')
      .replace(/\bsm\b/gi, '')
      .replace(/[-_]/g, ' ')
      .trim();
    if (!clean) clean = rawLoc || '—';
  }

  // 2. Detecție Kiosk (Kiosk 1, Kiosk 2, etc.)
  let kNum = String(p.kioskId || item?.kioskId || p.kiosk_id || item?.kiosk_id || '')
    .toLowerCase()
    .replace('kiosk', '')
    .replace(/[-_]/g, '')
    .trim();

  if (!kNum) {
    if (orderNum.startsWith('CJ2-') || orderNum.startsWith('CT2-') || orderNum.startsWith('BV2-')) {
      kNum = '2';
    } else if (orderNum.startsWith('CJ1-') || orderNum.startsWith('CT1-') || orderNum.startsWith('BV1-')) {
      kNum = '1';
    } else if (['cluj2', 'cj2', 'constanta2', 'ct2', 'kiosk2', 'kiosk-2'].some(k => normStr.includes(k))) {
      kNum = '2';
    } else if (['cluj3', 'cj3', 'kiosk3', 'kiosk-3'].some(k => normStr.includes(k))) {
      kNum = '3';
    } else {
      kNum = '1';
    }
  }

  const kioskLabel = `Kiosk ${kNum}`;

  return {
    locationName: clean,
    kioskLabel,
    fullDisplay: `${clean} • ${kioskLabel}`
  };
}

export default function PendingOrders({ backend, onGoToOrder }) {
  const { fetchWithAuth } = useAuth();

  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isProcessingId, setIsProcessingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Products and overrides for photos and rich descriptions
  const [menuProducts, setMenuProducts] = useState({});
  const [menuImages, setMenuImages] = useState({});

  // Filters matching Orders page style
  const [brandFilter, setBrandFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const fetchPendingOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetchWithAuth(`${backend}/api/payment/pending-orders`);
      if (res.ok) {
        const data = await res.json();
        setPendingList(data.pendingOrders || []);
      }
    } catch (err) {
      console.error('Error fetching pending orders:', err);
    } finally {
      setLoading(false);
    }
  }, [backend, fetchWithAuth]);

  useEffect(() => {
    fetchPendingOrders();
    const interval = setInterval(() => fetchPendingOrders(true), 15000);
    return () => clearInterval(interval);
  }, [fetchPendingOrders]);

  // Load menu products and images
  useEffect(() => {
    Promise.all([
      fetch(`${backend}/api/menu/all`).then(r => r.json()).catch(() => ({})),
      fetch(`${backend}/api/products/overrides/smashme`).then(r => r.json()).catch(() => ({})),
      fetch(`${backend}/api/products/overrides/rollmaster`).then(r => r.json()).catch(() => ({})),
      fetch(`${backend}/api/products/overrides/crunch`).then(r => r.json()).catch(() => ({})),
      fetch(`${backend}/api/products/overrides/lovesushi`).then(r => r.json()).catch(() => ({})),
      fetch(`${backend}/api/products/overrides/pokiwoki`).then(r => r.json()).catch(() => ({}))
    ]).then(([allMenuData, ovSmash, ovRoll, ovCrunch, ovLove, ovPoki]) => {
      const prodMap = {};
      Object.keys(allMenuData || {}).forEach(b => {
        const prods = allMenuData[b]?.menu?.products || [];
        prods.forEach(p => {
          if (p.id) prodMap[p.id] = p;
          if (p.name) prodMap[p.name.toLowerCase().trim()] = p;
        });
      });
      setMenuProducts(prodMap);

      const imgMap = {};
      [ovSmash, ovRoll, ovCrunch, ovLove, ovPoki].forEach(ovSet => {
        if (ovSet && typeof ovSet === 'object') {
          Object.entries(ovSet).forEach(([pid, val]) => {
            if (val?.imageUrl) imgMap[pid] = val.imageUrl;
          });
        }
      });
      setMenuImages(imgMap);
    }).catch(() => {});
  }, [backend]);

  const resolveProductImage = useCallback((item) => {
    if (!item) return null;
    const fullProd = menuProducts[item.productId] || (item.name && menuProducts[item.name.toLowerCase().trim()]);
    const overrideImg = menuImages[item.productId];
    let imgSrc = overrideImg || item.imageUrl || item.image || (fullProd?.imageLinks && fullProd.imageLinks[0]) || fullProd?.image || null;
    if (imgSrc && imgSrc.startsWith('/uploads')) imgSrc = `${backend}${imgSrc}`;
    return imgSrc;
  }, [menuProducts, menuImages, backend]);

  // Unique locations for filter (nume curate de locații)
  const uniqueLocations = useMemo(() => {
    const set = new Set();
    pendingList.forEach(item => {
      const info = formatLocationAndKiosk(item);
      if (info.locationName && info.locationName !== '—') set.add(info.locationName);
    });
    return Array.from(set).sort();
  }, [pendingList]);

  // Group related drafts (înainte de finalizare) with their finalized orders (după finalizare)
  const groupedList = useMemo(() => {
    const ordersWithAttempts = [];
    const drafts = [];

    // Separate orders from standalone drafts
    pendingList.forEach(item => {
      if (item.kind === 'pos_in_progress' || String(item.order_id).startsWith('kiosk-')) {
        drafts.push(item);
      } else {
        ordersWithAttempts.push({ ...item });
      }
    });

    const usedDraftIds = new Set();

    // Correlate drafts into orders if not already done
    ordersWithAttempts.forEach(order => {
      if (order.initialAttempt) {
        usedDraftIds.add(order.initialAttempt.order_id || order.initialAttempt.orderId);
        return;
      }

      const p = order.payload || {};
      const orderTotal = Number(p.totalAmount) || Number(order.pos_amount) || 0;
      const orderTime = new Date(order.created_at).getTime();
      const orderLoc = (p.locationName || order.location_id || '').toLowerCase();
      const posOrderId = p.posOrderId || p.paymentRef?.orderId;

      for (const draft of drafts) {
        if (usedDraftIds.has(draft.order_id)) continue;
        const dPayload = draft.payload || {};
        const draftTotal = Number(dPayload.totalAmount) || Number(draft.pos_amount) || 0;
        const draftTime = new Date(draft.created_at).getTime();
        const draftLoc = (dPayload.locationName || draft.location_id || '').toLowerCase();

        const isExactMatch = posOrderId && (draft.order_id === posOrderId);
        const isProximityMatch = (orderLoc && draftLoc && (orderLoc.includes(draftLoc) || draftLoc.includes(orderLoc))) &&
                                 Math.abs(orderTotal - draftTotal) < 0.05 &&
                                 Math.abs(orderTime - draftTime) < 20 * 60 * 1000;

        if (isExactMatch || isProximityMatch) {
          order.initialAttempt = draft;
          usedDraftIds.add(draft.order_id);
          break;
        }
      }
    });

    // Add remaining standalone drafts
    drafts.forEach(draft => {
      if (!usedDraftIds.has(draft.order_id)) {
        ordersWithAttempts.push(draft);
      }
    });

    return ordersWithAttempts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [pendingList]);

  // Derived stats
  const stats = useMemo(() => {
    let kitchen = 0;
    let finalized = 0;
    let inProgress = 0;
    let unfinalized = 0;
    groupedList.forEach(item => {
      const isFin = item.kind === 'finalized_success' || item.paid || (item.kind === 'cash_awaiting' && item.orderNumber);
      const ageMs = item.created_at ? (Date.now() - new Date(item.created_at).getTime()) : 0;
      const isTimeout = !isFin && (item.kind === 'unfinalized_abandoned' || item.isUnfinalized || ageMs > 2.5 * 60 * 1000);
      const sc = getOrderStatus(item, isTimeout);

      if (sc.label === 'Trimis la bucătărie') kitchen++;
      else if (sc.label === 'Achitată cu succes') finalized++;
      else if (sc.label === 'Comandă în curs') inProgress++;
      else if (sc.label === 'Anulată') unfinalized++;
    });
    return {
      total: groupedList.length,
      kitchen,
      finalized,
      inProgress,
      unfinalized,
    };
  }, [groupedList]);

  // Filtered List
  const filteredList = useMemo(() => {
    return groupedList.filter(item => {
      const p = item.payload || {};
      const brand = detectBrand(item);
      const loc = (p.locationName || item.location_id || '').toLowerCase();
      const orderId = (item.order_id || '').toLowerCase();
      const orderNum = (item.orderNumber || p.orderNumber || '').toLowerCase();
      const itemsText = (p.items || []).map(i => i.name).join(' ').toLowerCase();

      // Brand filter
      if (brandFilter !== 'all' && brand !== brandFilter.toLowerCase()) {
        return false;
      }

      // Location filter
      if (locationFilter !== 'all') {
        const info = formatLocationAndKiosk(item);
        if (info.locationName !== locationFilter && !loc.includes(locationFilter.toLowerCase())) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const isFin = item.kind === 'finalized_success' || item.paid || (item.kind === 'cash_awaiting' && item.orderNumber);
        const ageMs = item.created_at ? (Date.now() - new Date(item.created_at).getTime()) : 0;
        const isTimeout = !isFin && (item.kind === 'unfinalized_abandoned' || item.isUnfinalized || ageMs > 2.5 * 60 * 1000);
        const itemSc = getOrderStatus(item, isTimeout);

        if (statusFilter === 'kitchen' && itemSc.label !== 'Trimis la bucătărie') return false;
        if (statusFilter === 'success' && itemSc.label !== 'Achitată cu succes') return false;
        if (statusFilter === 'in_progress' && itemSc.label !== 'Comandă în curs') return false;
        if (statusFilter === 'cancelled' && itemSc.label !== 'Anulată') return false;
      }

      // Search match
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches = loc.includes(q) || brand.includes(q) || orderId.includes(q) || orderNum.includes(q) || itemsText.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [groupedList, brandFilter, locationFilter, statusFilter, searchTerm]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  if (safePage !== currentPage && totalPages > 0) {
    setCurrentPage(safePage);
  }
  const paginated = filteredList.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  // Actions (Fără pop-up-uri invazive sau fluxuri inventate de casierie)
  const handlePushToIiko = async (orderId, isCash = false) => {
    setIsProcessingId(orderId);
    try {
      const res = await fetchWithAuth(`${backend}/api/payment/pending-orders/${orderId}/push-iiko`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedDraft(null);
        fetchPendingOrders();
        if (onGoToOrder && data.order?._id) onGoToOrder(data.order._id);
      } else {
        alert(`Eroare la transmitere în iiko: ${data.error || 'Necunoscută'}`);
      }
    } catch (err) {
      alert(`Eroare de rețea: ${err.message}`);
    } finally {
      setIsProcessingId(null);
    }
  };

  return (
    <div className="space-y-4 px-3 sm:px-4 md:px-6 pb-10">
      {/* ── Stats Cards Bar (Matching IikoLogs / Dashboard) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard 
          label="Total Comenzi" 
          value={stats.total} 
          color="#6366f1" 
          icon={ShoppingBag}
          onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
          active={statusFilter === 'all'}
        />
        <StatCard 
          label="Trimis la Bucătărie" 
          value={stats.kitchen} 
          color="#059669" 
          icon={ShoppingBag}
          onClick={() => { setStatusFilter(statusFilter === 'kitchen' ? 'all' : 'kitchen'); setCurrentPage(1); }}
          active={statusFilter === 'kitchen'}
        />
        <StatCard 
          label="Achitată cu Succes" 
          value={stats.finalized} 
          color="#059669" 
          icon={CheckCircle2}
          onClick={() => { setStatusFilter(statusFilter === 'success' ? 'all' : 'success'); setCurrentPage(1); }}
          active={statusFilter === 'success'}
        />
        <StatCard 
          label="Comenzi în Curs" 
          value={stats.inProgress} 
          color="#3b82f6" 
          icon={Clock}
          onClick={() => { setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress'); setCurrentPage(1); }}
          active={statusFilter === 'in_progress'}
        />
      </div>

      {/* ── Filters Bar (Matching Orders Page) ── */}
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        {/* Brand Switcher Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
          {['all', 'smashme', 'crunch', 'rollmaster', 'lovesushi', 'pokiwoki'].map(b => (
            <button
              key={b}
              title={b === 'all' ? 'Toate Brandurile' : BRAND_LABELS[b] || b}
              className={`shrink-0 h-10 rounded-full flex items-center justify-center border transition-colors ${
                brandFilter === b 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              } ${b === 'all' ? 'px-4 text-xs font-bold' : 'w-10'}`}
              onClick={() => { setBrandFilter(b); setCurrentPage(1); }}
            >
              {b === 'all' ? 'Toate' : <BrandLogo brandId={b} size={22} />}
            </button>
          ))}
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 min-w-[170px] max-w-[280px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Caută comandă, iiko, locație..."
            className="h-10 pl-9 pr-3 rounded-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition-all"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Location Filter */}
        <select 
          className="shrink-0 px-3 h-10 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          value={locationFilter}
          onChange={(e) => { setLocationFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="all">Toate locațiile</option>
          {uniqueLocations.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select 
          className="shrink-0 px-3 h-10 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="all">Toate statusurile</option>
          <option value="kitchen">Trimis la bucătărie</option>
          <option value="success">Achitată cu succes</option>
          <option value="in_progress">Comandă în curs</option>
          <option value="cancelled">Anulată</option>
        </select>

        {/* Refresh Button - Icon Only */}
        <button
          onClick={() => fetchPendingOrders()}
          disabled={loading}
          className="shrink-0 w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
          title="Reîmprospătează lista"
          aria-label="Reîmprospătează lista"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Table Container (Matching IikoLogs / Orders 1:1 with Accordion) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse table-auto">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="w-8 px-1.5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 text-center">Nr.</th>
              <th className="px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500"># Comandă</th>
              <th className="px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Brand</th>
              <th className="px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Locație & Kiosk</th>
              <th className="px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Produse / Coș</th>
              <th className="px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Total</th>
              <th className="px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th className="w-8 px-1.5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm font-medium">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  <span>Nicio comandă găsită pentru filtrele selectate.</span>
                </td>
              </tr>
            ) : (
              paginated.map((item, index) => {
                const p = item.payload || {};
                const brand = detectBrand(item);
                const rowNumber = (safePage - 1) * itemsPerPage + index + 1;
                const dt = item.created_at ? new Date(item.created_at) : null;
                const items = p.items || [];
                const total = Number(p.totalAmount) || Number(item.pos_amount) || 0;
                const isProcessing = isProcessingId === item.order_id;
                const isCash = item.kind === 'cash_awaiting';
                const itemKey = item.order_id || index;
                const isExpanded = expandedId === itemKey;
                const isFinalized = item.kind === 'finalized_success' || item.paid || (item.kind === 'cash_awaiting' && item.orderNumber);
                const locInfo = formatLocationAndKiosk(item);
                const ageMs = item.created_at ? (Date.now() - new Date(item.created_at).getTime()) : 0;
                const isTimeoutUnfinalized = !isFinalized && (item.kind === 'unfinalized_abandoned' || item.isUnfinalized || ageMs > 2.5 * 60 * 1000);
                const ageMinutes = Math.max(1, Math.round(ageMs / 60000));
                const sc = getOrderStatus(item, isTimeoutUnfinalized);

                return (
                  <div key={itemKey} style={{ display: 'contents' }}>
                    {/* Main Row */}
                    <tr 
                      className={`transition-colors cursor-pointer select-none ${
                        isExpanded 
                          ? 'bg-blue-50/70 dark:bg-blue-900/20' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                    >
                      {/* Nr. */}
                      <td className="w-8 px-1.5 py-2 text-center text-xs font-bold text-slate-400">
                        {rowNumber}
                      </td>

                      {/* # Comandă */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5 max-w-[110px] lg:max-w-[135px]">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate w-full" title={item.orderNumber || item.order_id}>
                            #{item.orderNumber || item.order_id}
                          </span>
                          {dt && (
                            <span className="text-[9.5px] text-slate-400">
                              {dt.toLocaleString('ro-RO')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Brand cu Logo Prominent */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <BrandLogo brandId={brand} size={20} className="shadow-2xs shrink-0" />
                          <span style={{ color: BRAND_COLORS[brand] || '#e11d48' }} className="text-xs font-bold truncate max-w-[90px]">
                            {BRAND_LABELS[brand] || brand}
                          </span>
                        </div>
                      </td>

                      {/* Locație & Kiosk */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-xs text-slate-900 dark:text-white font-bold truncate max-w-[95px] lg:max-w-[120px]" title={locInfo.locationName}>
                            {locInfo.locationName}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <Monitor size={9} className="text-blue-500" />
                            <span>{locInfo.kioskLabel}</span>
                          </span>
                        </div>
                      </td>

                      {/* Produse / Coș cu preview imagini mici */}
                      <td className="px-2 py-2 max-w-[130px] lg:max-w-[180px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {/* Mini imagini produse */}
                          <div className="flex -space-x-1 shrink-0">
                            {items.slice(0, 3).map((it, pIdx) => {
                              const img = resolveProductImage(it);
                              return (
                                <div key={pIdx} className="w-5 h-5 rounded-full border border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                                  {img ? (
                                    <img src={img} alt={it.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <Utensils className="w-2.5 h-2.5 text-slate-400" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={items.map(i => `${i.quantity}x ${i.name}`).join(', ')}>
                              {items.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'Coș fără detalii'}
                            </span>
                            <span className="text-[9.5px] text-slate-400">
                              {items.length} {items.length === 1 ? 'produs' : 'produse'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {formatThousands(total)} <span className="text-[10px] font-normal text-slate-400">lei</span>
                        </span>
                      </td>

                      {/* Status - Standard Comenzi (App.jsx) */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span 
                          className="px-2 py-0.5 rounded-full text-[10.5px] font-bold whitespace-nowrap inline-block" 
                          style={{ backgroundColor: `${sc.color}20`, color: sc.color, border: `1px solid ${sc.color}40` }}
                        >
                          ● {sc.label}
                        </span>
                      </td>

                      {/* Expand Toggle */}
                      <td className="w-8 px-1.5 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title={isExpanded ? 'Restrânge detaliile' : 'Deschide detaliile'}
                          aria-label={isExpanded ? 'Restrânge detaliile' : 'Deschide detaliile'}
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </td>
                    </tr>

                    {/* Accordion Expanded Detail View (Exact ca în IikoLogs cu poze și informații complete) */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                        <td colSpan={8} className="px-2.5 py-2.5 sm:px-3 sm:py-3">
                          <div className="space-y-2.5">
                            {/* Accordion Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]" title={item.orderNumber || item.order_id}>
                                  Comandă #{item.orderNumber || item.order_id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDraft(item)}
                                  className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                                  title="Vezi bon / coș complet"
                                  aria-label="Vezi bon / coș complet"
                                >
                                  <Eye size={14} />
                                </button>
                                <span 
                                  style={{ color: BRAND_COLORS[brand] || '#e11d48' }}
                                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs"
                                >
                                  <BrandLogo brandId={brand} size={13} />
                                  <span>{BRAND_LABELS[brand] || brand}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                  <Monitor size={9} className="text-blue-500" />
                                  <span>{locInfo.locationName} • {locInfo.kioskLabel}</span>
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {dt ? dt.toLocaleTimeString('ro-RO') : '—'} • {p.orderType === 'takeaway' ? 'La Pachet' : 'În Restaurant'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                                {(!item.iiko_sent && !p.syrveOrderId) && (
                                  <button
                                    onClick={() => handlePushToIiko(item.order_id, isCash)}
                                    disabled={isProcessing}
                                    className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                                    title="Trimite comanda în iiko"
                                  >
                                    <Send className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                                    <span>Trimite în iiko</span>
                                  </button>
                                )}
                                <div className="text-right">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Total</span>
                                  <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                                    {formatThousands(total)} lei
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* ── TIMELINE: ÎNAINTE DE FINALIZARE vs DUPĂ FINALIZARE (2 CARDURI COMPACTE) ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                              
                              {/* 1. ÎNAINTE DE FINALIZARE */}
                              <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold text-[10.5px] uppercase tracking-wider">
                                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                                      <span>1. Sesiune Kiosk</span>
                                    </div>
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                      {item.initialAttempt ? 'Tentativă Anterioară' : 'Sesiune Kiosk'}
                                    </span>
                                  </div>

                                  {item.initialAttempt ? (
                                    <div className="space-y-1.5 text-[11px]">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">ID Draft Kiosk:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                                          {item.initialAttempt.order_id || item.initialAttempt.orderId}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">Ora tentativă:</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                          {new Date(item.initialAttempt.created_at).toLocaleTimeString('ro-RO')}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">Metodă inițială:</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                          <CreditCard className="w-3 h-3" /> Plată Card la POS
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">Rezultat terminal:</span>
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 text-right truncate max-w-[200px]" title={item.initialAttempt.error || 'Tranzacție card refuzată / clientul a trecut la Cash'}>
                                          {item.initialAttempt.error || 'Tranzacție card refuzată / trecere Cash'}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5 text-[11px]">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">Terminal Kiosk:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                          <Monitor size={11} className="text-blue-500" />
                                          <span>{locInfo.locationName} • {locInfo.kioskLabel}</span>
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">Inițiat la:</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                          {dt ? dt.toLocaleTimeString('ro-RO') : '—'}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">Coș generat:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                          {items.length} produse ({formatThousands(total)} lei)
                                        </span>
                                      </div>
                                      <div className="text-slate-400 italic mt-0.5 text-[10px]">
                                        Comanda a fost configurată pe ecranul Kiosk și transmisă direct.
                                      </div>
                                    </div>
                                  )}

                                  {/* Produse din coș cu POZE complete - varianta compactă */}
                                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                      Produse în Coș ({items.length})
                                    </span>
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                      {items.map((it, idx) => {
                                        const img = resolveProductImage(it);
                                        return (
                                          <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                                            {/* Foto Produs */}
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                                              {img ? (
                                                <img src={img} alt={it.name} className="w-full h-full object-cover" />
                                              ) : (
                                                <Utensils className="w-3.5 h-3.5 text-slate-400" />
                                              )}
                                            </div>

                                            {/* Info Produs */}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 py-0.2 rounded">
                                                  {it.quantity}x
                                                </span>
                                                <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                                                  {it.name}
                                                </span>
                                              </div>
                                              {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                  {it.selectedModifiers.map((m, mIdx) => (
                                                    <span key={mIdx} className="px-1 py-0.2 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[9px] text-slate-600 dark:text-slate-300">
                                                      + {m.optionName || m.name || m.modId} {Number(m.price) > 0 ? `(${formatThousands(m.price)} lei)` : ''}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                              {it.comment && (
                                                <div className="text-[9.5px] text-slate-400 italic mt-0.5">
                                                  Notă: {it.comment}
                                                </div>
                                              )}
                                            </div>

                                            {/* Preț Produs */}
                                            <div className="text-right shrink-0">
                                              <span className="text-[11px] font-black text-slate-900 dark:text-white block">
                                                {formatThousands(it.totalPrice || it.unitPrice || 0)} lei
                                              </span>
                                              {it.quantity > 1 && (
                                                <span className="text-[9px] text-slate-400 block">
                                                  {formatThousands(it.unitPrice || 0)} / buc
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 2. DUPĂ FINALIZARE */}
                              {isTimeoutUnfinalized ? (
                                <div className="bg-slate-50/70 dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200/80 dark:border-slate-800">
                                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-bold text-[10.5px] uppercase tracking-wider">
                                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                        <span>2. Sincronizare & iiko</span>
                                      </div>
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 whitespace-nowrap">
                                        ✕ Nefinalizată
                                      </span>
                                    </div>

                                    <div className="py-2 px-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-center space-y-1">
                                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 mx-auto flex items-center justify-center">
                                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                          Comanda nu a fost finalizată de client
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm mx-auto leading-normal">
                                          În termen de 2-3 minute nu a venit nicio confirmare a plății. Clientul a părăsit ecranul sau a anulat plata la POS.
                                        </p>
                                      </div>
                                      <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                        <span>Fără bon emis • Netransmis în iiko</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[10.5px]">
                                    <span className="text-slate-400 font-medium">Stare Kiosk:</span>
                                    <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" /> Abandonată ({ageMinutes} min)
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-emerald-200/80 dark:border-emerald-900/50 shadow-xs flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-emerald-100 dark:border-emerald-900/30">
                                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[10.5px] uppercase tracking-wider">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>2. Sincronizare & iiko</span>
                                      </div>
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold whitespace-nowrap ${
                                        item.kind === 'finalized_success' 
                                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                      }`}>
                                        {item.kind === 'finalized_success' ? '✓ Finalizată' : 'Așteaptă Încasare'}
                                      </span>
                                    </div>

                                    <div className="space-y-1.5 text-[11px]">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">Număr Bon / Ordine:</span>
                                        <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                                          #{item.orderNumber || item.order_id}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">Metodă Plată Aleasă:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                          {p.paymentMethod === 'cash' ? <><Banknote className="w-3.5 h-3.5 text-slate-500" /> Numerar (Cash la Casierie)</> : <><CreditCard className="w-3.5 h-3.5 text-blue-500" /> Card Bancar</>}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium">Stare Sincronizare iiko:</span>
                                        {item.iiko_sent || p.syrveOrderId ? (
                                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Transmis cu Succes
                                          </span>
                                        ) : (
                                          <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3 text-slate-400" /> Netrimis încă
                                          </span>
                                        )}
                                      </div>

                                      {(() => {
                                        const iikoId = item.iiko_order_id || p.syrveOrderId;
                                        if (!iikoId) return null;
                                        const shortId = iikoId.length > 12 ? `${iikoId.slice(0, 8)}...` : iikoId;
                                        return (
                                          <div className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-1.5 mt-1">
                                            <span className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 truncate" title={iikoId}>
                                              <span>ID iiko:</span>
                                              <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold" title={iikoId}>
                                                {shortId}
                                              </strong>
                                            </span>
                                            <CopyIconButton text={iikoId} title="Copiază ID iiko complet" />
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* Stare casierie */}
                                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-400 font-medium">Stare Încasare:</span>
                                    {item.paid || item.kind === 'finalized_success' ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Încasat & Confirmat
                                      </span>
                                    ) : (
                                      <span className="text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-400" /> Așteaptă plata la casierie
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </div>
                );
              })
            )}
          </tbody>
        </table>

        {/* ── Pagination Footer (Matching OrdersTable 1:1) ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 gap-4">
          <div className="flex items-center gap-4">
            <span>
              Afișează&nbsp;
              <select 
                value={itemsPerPage} 
                onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} 
                className="bg-transparent border border-slate-200 dark:border-slate-800 rounded-full px-2 py-1 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={999999}>Toți</option>
              </select>
            </span>
            <span>Total comenzi: <strong className="text-slate-700 dark:text-slate-300">{filteredList.length}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Pagina {safePage} din {totalPages}</span>
            <div className="flex gap-1">
              {[
                { label: '«', action: () => setCurrentPage(1), disabled: safePage === 1 },
                { label: '‹', action: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: safePage === 1 },
                { label: '›', action: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: safePage === totalPages },
                { label: '»', action: () => setCurrentPage(totalPages), disabled: safePage === totalPages },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={btn.action}
                  disabled={btn.disabled}
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    btn.disabled 
                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 cursor-pointer'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail Modal for Selected Draft (cu Logo Brand și Poze Produse) ── */}
      {selectedDraft && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedDraft(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              {(() => {
                const mBrand = detectBrand(selectedDraft);
                const sInfo = formatLocationAndKiosk(selectedDraft);
                return (
                  <div className="flex items-center gap-3">
                    <BrandLogo brandId={mBrand} size={32} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Detalii Comandă #{selectedDraft.orderNumber || selectedDraft.order_id}
                        </h3>
                        <span 
                          style={{ color: BRAND_COLORS[mBrand] || '#e11d48' }}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs"
                        >
                          <BrandLogo brandId={mBrand} size={12} />
                          <span>{BRAND_LABELS[mBrand] || mBrand}</span>
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-0.5">
                        <Monitor size={11} className="text-blue-500" />
                        <span>{sInfo.locationName} • {sInfo.kioskLabel}</span>
                      </span>
                    </div>
                  </div>
                );
              })()}
              <button
                onClick={() => setSelectedDraft(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Meta Info Box */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Locație & Kiosk</span>
                  {(() => {
                    const sInfo = formatLocationAndKiosk(selectedDraft);
                    return (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <Monitor size={13} className="text-blue-500" />
                          <span>{sInfo.locationName} • {sInfo.kioskLabel}</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tip Servire</span>
                  <div className="font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {selectedDraft.payload?.orderType === 'takeaway' ? 'La Pachet' : 'În Restaurant'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ID Tranzacție / Comandă</span>
                  <div className="font-bold text-slate-700 dark:text-slate-300 mt-1">
                    {selectedDraft.orderNumber ? `#${selectedDraft.orderNumber}` : selectedDraft.order_id}
                  </div>
                </div>
                {(selectedDraft.iiko_order_id || selectedDraft.payload?.syrveOrderId) && (
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ID iiko</span>
                    {(() => {
                      const mIikoId = selectedDraft.iiko_order_id || selectedDraft.payload?.syrveOrderId;
                      const mShortId = mIikoId.length > 12 ? `${mIikoId.slice(0, 8)}...` : mIikoId;
                      return (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs" title={mIikoId}>
                            {mShortId}
                          </span>
                          <CopyIconButton text={mIikoId} title="Copiază ID iiko complet" />
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status Comandă</span>
                  <div className="mt-1">
                    {(() => {
                      const mAge = selectedDraft.created_at ? (Date.now() - new Date(selectedDraft.created_at).getTime()) : 0;
                      const mTimeout = mAge > 2.5 * 60 * 1000;
                      const mSc = getOrderStatus(selectedDraft, mTimeout);
                      return (
                        <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-block" style={{ backgroundColor: `${mSc.color}20`, color: mSc.color, border: `1px solid ${mSc.color}40` }}>
                          ● {mSc.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Items List cu POZE și MODIFICATORI */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2.5 flex items-center justify-between">
                  <span>Produse în Coș</span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {selectedDraft.payload?.items?.length || 0} articole
                  </span>
                </h4>

                <div className="space-y-2 border border-slate-100 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-900/50 max-h-72 overflow-y-auto">
                  {(selectedDraft.payload?.items || []).map((it, idx) => {
                    const img = resolveProductImage(it);
                    return (
                      <div key={idx} className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Poza Produsului */}
                          <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                            {img ? (
                              <img src={img} alt={it.name} className="w-full h-full object-cover" />
                            ) : (
                              <Utensils className="w-6 h-6 text-slate-400" />
                            )}
                          </div>

                          {/* Detalii Nume & Modificatori */}
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                                {it.quantity}x
                              </span>
                              <span className="truncate">{it.name}</span>
                            </div>
                            {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {it.selectedModifiers.map((m, mIdx) => (
                                  <span key={mIdx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-600">
                                    + {m.optionName || m.name || m.modId} {Number(m.price) > 0 ? `(${formatThousands(m.price)} lei)` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                            {it.comment && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">
                                Notă: {it.comment}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Preț Produs */}
                        <div className="text-right shrink-0">
                          <span className="font-black text-sm text-slate-900 dark:text-white block">
                            {formatThousands(it.totalPrice || it.unitPrice || 0)} RON
                          </span>
                          {it.quantity > 1 && (
                            <span className="text-[10px] text-slate-400 block">
                              {formatThousands(it.unitPrice || 0)} / buc
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-600 dark:text-slate-400 text-sm">Total de Plată:</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {formatThousands(selectedDraft.payload?.totalAmount || selectedDraft.pos_amount || 0)} RON
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedDraft(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Închide
              </button>

              {(!selectedDraft.iiko_sent && !selectedDraft.payload?.syrveOrderId) && (
                <button
                  onClick={() => handlePushToIiko(selectedDraft.order_id, selectedDraft.kind === 'cash_awaiting')}
                  disabled={isProcessingId === selectedDraft.order_id}
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md bg-blue-600 hover:bg-blue-700 cursor-pointer"
                >
                  <Send className={`w-3.5 h-3.5 ${isProcessingId === selectedDraft.order_id ? 'animate-spin' : ''}`} />
                  <span>Trimite în iiko</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
