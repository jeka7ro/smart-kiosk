import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { 
  Clock, RefreshCw, ShoppingBag, CreditCard, 
  CheckCircle2, AlertTriangle, Trash2, Send, X, Eye, 
  Banknote, ArrowRight, ChevronDown, ChevronUp, Copy, Check, Sparkles
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

export default function PendingOrders({ backend, onGoToOrder }) {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isProcessingId, setIsProcessingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

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

  // Unique locations for filter
  const uniqueLocations = useMemo(() => {
    const set = new Set();
    pendingList.forEach(p => {
      const loc = p.payload?.locationName || p.location_id;
      if (loc) set.add(loc);
    });
    return Array.from(set);
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
    let awaitingCash = 0;
    let finalized = 0;
    let cardInProgress = 0;
    groupedList.forEach(item => {
      if (item.kind === 'cash_awaiting') awaitingCash++;
      else if (item.kind === 'finalized_success') finalized++;
      else if (item.kind === 'pos_in_progress') cardInProgress++;
    });
    return {
      total: groupedList.length,
      awaitingCash,
      finalized,
      cardInProgress
    };
  }, [groupedList]);

  // Filtered List
  const filteredList = useMemo(() => {
    return groupedList.filter(item => {
      const p = item.payload || {};
      const brand = (p.brand || 'smashme').toLowerCase();
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
        const itemLoc = p.locationName || item.location_id;
        if (itemLoc !== locationFilter) return false;
      }

      // Status filter
      if (statusFilter === 'cash' && item.kind !== 'cash_awaiting') {
        return false;
      }
      if (statusFilter === 'finalized' && item.kind !== 'finalized_success') {
        return false;
      }
      if (statusFilter === 'card_approved' && (item.kind !== 'pos_paid_pending_iiko' && !item.paid)) {
        return false;
      }
      if (statusFilter === 'card_waiting' && item.kind !== 'pos_in_progress') {
        return false;
      }
      if (statusFilter === 'iiko_pending' && item.kind !== 'iiko_pending') {
        return false;
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

  // Actions
  const handleMarkPaid = async (orderId) => {
    const ok = await confirm(`Confirmi că suma a fost încasată și comanda #${orderId} este finalizată cu succes?`, {
      title: 'Finalizare Încasare Cash',
      okLabel: 'Confirmă Încasat',
    });
    if (!ok) return;

    setIsProcessingId(orderId);
    try {
      const res = await fetchWithAuth(`${backend}/api/payment/pending-orders/${encodeURIComponent(orderId)}/mark-paid`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        confirm(`Comanda #${data.order?.orderNumber || orderId} a fost marcată ca finalizată cu succes!`, {
          title: 'Succes',
          type: 'info',
          hideCancel: true,
        });
        fetchPendingOrders(true);
      } else {
        // Fallback to push-iiko
        const pushRes = await fetchWithAuth(`${backend}/api/payment/pending-orders/${encodeURIComponent(orderId)}/push-iiko`, {
          method: 'POST',
        });
        const pushData = await pushRes.json();
        if (pushRes.ok && pushData.success) {
          confirm(`Comanda #${pushData.order?.orderNumber || orderId} a fost finalizată cu succes!`, {
            title: 'Succes',
            type: 'info',
            hideCancel: true,
          });
          fetchPendingOrders(true);
        } else {
          confirm(`Eroare: ${data.error || pushData.error || 'Necunoscută'}`, {
            title: 'Eroare',
            type: 'error',
            hideCancel: true,
          });
        }
      }
    } catch (err) {
      confirm(`Eroare de rețea: ${err.message}`, { title: 'Eroare', type: 'error', hideCancel: true });
    } finally {
      setIsProcessingId(null);
    }
  };

  const handlePushToIiko = async (orderId, isCash = false) => {
    const actionLabel = isCash ? 'Confirmare Cash & Trimitere iiko' : 'Trimitere în iiko';
    const ok = await confirm(`Sigur dorești să transmiți comanda ${orderId} în iiko și la bucătărie?`, {
      title: actionLabel,
      okLabel: 'Trimite Acum',
    });
    if (!ok) return;

    setIsProcessingId(orderId);
    try {
      const res = await fetchWithAuth(`${backend}/api/payment/pending-orders/${orderId}/push-iiko`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        confirm(`Comanda #${data.order?.orderNumber || ''} a fost transmisă cu succes în iiko!`, {
          title: 'Succes',
          type: 'info',
          hideCancel: true,
        });
        setSelectedDraft(null);
        fetchPendingOrders();
        if (onGoToOrder && data.order?._id) onGoToOrder(data.order._id);
      } else {
        confirm(`Eroare la transmitere: ${data.error || 'Necunoscută'}`, {
          title: 'Eroare',
          type: 'error',
          hideCancel: true,
        });
      }
    } catch (err) {
      confirm(`Eroare de rețea: ${err.message}`, { title: 'Eroare', type: 'error', hideCancel: true });
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleDeleteDraft = async (orderId) => {
    const ok = await confirm('Ești sigur că vrei să elimini această comandă din listă?', {
      title: 'Eliminare Comandă',
      danger: true,
      okLabel: 'Șterge',
    });
    if (!ok) return;

    try {
      const res = await fetchWithAuth(`${backend}/api/payment/pending-orders/${orderId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPendingList(prev => prev.filter(p => p.order_id !== orderId));
        if (selectedDraft?.order_id === orderId) setSelectedDraft(null);
      }
    } catch (err) {
      console.error('Failed to delete pending order', err);
    }
  };

  return (
    <div className="space-y-4 px-4 md:px-8 pb-10">
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
          label="În Așteptare Cash" 
          value={stats.awaitingCash} 
          color="#d97706" 
          icon={Banknote}
          onClick={() => { setStatusFilter(statusFilter === 'cash' ? 'all' : 'cash'); setCurrentPage(1); }}
          active={statusFilter === 'cash'}
          highlight={stats.awaitingCash > 0}
        />
        <StatCard 
          label="Finalizate cu Succes" 
          value={stats.finalized} 
          color="#059669" 
          icon={CheckCircle2}
          onClick={() => { setStatusFilter(statusFilter === 'finalized' ? 'all' : 'finalized'); setCurrentPage(1); }}
          active={statusFilter === 'finalized'}
        />
        <StatCard 
          label="Card în Curs POS" 
          value={stats.cardInProgress} 
          color="#3b82f6" 
          icon={CreditCard}
          onClick={() => { setStatusFilter(statusFilter === 'card_waiting' ? 'all' : 'card_waiting'); setCurrentPage(1); }}
          active={statusFilter === 'card_waiting'}
        />
      </div>

      {/* ── Filters Bar (Matching Orders Page) ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Brand Switcher Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
          {['all', 'smashme', 'crunch', 'rollmaster', 'lovesushi', 'pokiwoki'].map(b => (
            <button
              key={b}
              title={b === 'all' ? 'Toate Brandurile' : b}
              className={`shrink-0 h-10 rounded-full flex items-center justify-center border transition-colors ${
                brandFilter === b 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              } ${b === 'all' ? 'px-5 text-sm font-bold' : 'w-10'}`}
              onClick={() => { setBrandFilter(b); setCurrentPage(1); }}
            >
              {b === 'all' ? 'Toate' : <BrandLogo brandId={b} size={20} />}
            </button>
          ))}
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Caută comandă, iiko, locație..."
            className="h-10 pl-10 pr-4 rounded-full text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition-all"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-4 top-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Location Filter */}
        <select 
          className="shrink-0 px-4 h-10 rounded-full text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
          className="shrink-0 px-4 h-10 rounded-full text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="all">Toate statusurile</option>
          <option value="cash">Cash la Casierie (Neachitat)</option>
          <option value="finalized">✓ Finalizate cu Succes</option>
          <option value="card_approved">Card Aprobat (Netrimis iiko)</option>
          <option value="card_waiting">Card în Curs pe POS</option>
          <option value="iiko_pending">În Așteptare iiko</option>
        </select>

        {/* Refresh Button */}
        <button
          onClick={() => fetchPendingOrders()}
          disabled={loading}
          className="shrink-0 px-4 h-10 rounded-full text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-2"
          title="Reîmprospătează lista"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Reîmprospătează</span>
        </button>
      </div>

      {/* ── Table Container (Matching IikoLogs / Orders 1:1 with Accordion) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="w-14 px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">Nr.</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500"># Comandă</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Brand</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Locație</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Produse / Coș</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Acțiuni</th>
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
                const brand = p.brand || 'smashme';
                const rowNumber = (safePage - 1) * itemsPerPage + index + 1;
                const dt = item.created_at ? new Date(item.created_at) : null;
                const items = p.items || [];
                const total = Number(p.totalAmount) || Number(item.pos_amount) || 0;
                const isProcessing = isProcessingId === item.order_id;
                const isCash = item.kind === 'cash_awaiting';
                const itemKey = item.order_id || index;
                const isExpanded = expandedId === itemKey;
                const hasInitialAttempt = !!item.initialAttempt;

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
                      <td className="w-14 px-4 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                        {rowNumber}
                      </td>

                      {/* # Comandă / ID & Grouping Badge */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            #{item.orderNumber || item.order_id}
                          </span>
                          {dt && (
                            <span className="text-[10px] text-slate-400">
                              {dt.toLocaleString('ro-RO')}
                            </span>
                          )}

                          {/* Grouping Badge: Tentativă anterioară (Card ➔ Cash) */}
                          {hasInitialAttempt && (
                            <span 
                              className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                              title="Clientul a încercat plata cu cardul pe POS înainte de finalizarea comenzii"
                            >
                              <CreditCard size={10} />
                              <span>Card ➔ Cash (Grupate)</span>
                            </span>
                          )}

                          {/* Finalizată cu Succes Badge */}
                          {item.kind === 'finalized_success' && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                              <CheckCircle2 size={10} />
                              <span>Finalizată cu Succes</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Brand */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <BrandLogo brandId={brand} size={28} className="shadow-xs shrink-0" />
                          <span style={{ color: BRAND_COLORS[brand] || '#e11d48' }} className="text-sm font-bold capitalize">
                            {brand}
                          </span>
                        </div>
                      </td>

                      {/* Locație */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                          {p.locationName || item.location_id || '—'}
                        </span>
                      </td>

                      {/* Produse / Coș */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {items.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'Coș fără detalii'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {items.length} {items.length === 1 ? 'produs' : 'produse'}
                          </span>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatThousands(total)} <span className="text-xs font-normal text-slate-400">lei</span>
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.kind === 'finalized_success' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Finalizat cu Succes</span>
                          </span>
                        )}
                        {item.kind === 'cash_awaiting' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <Banknote className="w-3.5 h-3.5" />
                            <span>Cash Neachitat</span>
                          </span>
                        )}
                        {item.kind === 'pos_paid_pending_iiko' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Card Aprobat (Netrimis iiko)</span>
                          </span>
                        )}
                        {item.kind === 'pos_in_progress' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            <span>Card în Curs POS</span>
                          </span>
                        )}
                        {item.kind === 'iiko_pending' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>În Așteptare iiko</span>
                          </span>
                        )}
                      </td>

                      {/* Acțiuni & Expand Toggle */}
                      <td className="px-6 py-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          {item.kind === 'cash_awaiting' && (
                            <button
                              onClick={() => handleMarkPaid(item.order_id)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm cursor-pointer"
                              title="Confirmă încasarea cash și marchează ca finalizată cu succes"
                            >
                              <CheckCircle2 className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                              <span>Încasează & Finalizează</span>
                            </button>
                          )}

                          {(!item.iiko_sent && !p.syrveOrderId && (item.paid || item.kind === 'iiko_pending')) && (
                            <button
                              onClick={() => handlePushToIiko(item.order_id, isCash)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm cursor-pointer"
                              title="Trimite comanda în iiko"
                            >
                              <Send className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                              <span>Trimite iiko</span>
                            </button>
                          )}

                          <button
                            onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isExpanded ? 'Restrânge detaliile' : 'Deschide detaliile'}
                          >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Accordion Expanded Detail View (Exact ca în IikoLogs) */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                        <td colSpan={8} className="px-6 py-5">
                          <div className="space-y-4">
                            {/* Accordion Header */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                              <div className="flex items-center gap-3">
                                <BrandLogo brandId={brand} size={28} />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-bold text-slate-900 dark:text-white">
                                      Comandă #{item.orderNumber || item.order_id}
                                    </span>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                      {p.locationName || item.location_id}
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-400">
                                    {dt ? dt.toLocaleString('ro-RO') : '—'} • {p.orderType === 'takeaway' ? 'La Pachet' : 'În Restaurant'}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total de Plată</span>
                                <span className="text-xl font-black text-slate-900 dark:text-white">
                                  {formatThousands(total)} lei
                                </span>
                              </div>
                            </div>

                            {/* ── TIMELINE: ÎNAINTE DE FINALIZARE vs DUPĂ FINALIZARE ── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              
                              {/* 1. ÎNAINTE DE FINALIZARE */}
                              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-amber-200/80 dark:border-amber-900/50 shadow-xs flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-amber-100 dark:border-amber-900/30">
                                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                                      <Clock className="w-4 h-4" />
                                      <span>1. Înainte de Finalizare (Kiosk)</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                      {item.initialAttempt ? 'Tentativă Card POS' : 'Coș Inițiat'}
                                    </span>
                                  </div>

                                  {item.initialAttempt ? (
                                    <div className="space-y-2 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">ID Draft Kiosk:</span>
                                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                          {item.initialAttempt.order_id || item.initialAttempt.orderId}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Ora tentativă:</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                          {new Date(item.initialAttempt.created_at).toLocaleTimeString('ro-RO')}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Metodă inițială:</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                          <CreditCard className="w-3.5 h-3.5" /> Plată Card la POS
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Rezultat terminal:</span>
                                        <span className="font-bold text-slate-600 dark:text-slate-400">
                                          {item.initialAttempt.error || 'Tranzacție refuzată sau clientul a comutat la Cash'}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Inițiat la:</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                          {dt ? dt.toLocaleTimeString('ro-RO') : '—'}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Coș generat:</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">
                                          {items.length} produse ({formatThousands(total)} lei)
                                        </span>
                                      </div>
                                      <div className="text-slate-500 italic mt-1">
                                        Comanda a fost configurată pe ecranul Kiosk și transmisă direct.
                                      </div>
                                    </div>
                                  )}

                                  {/* Produse din coș */}
                                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                      Produse selectate pe ecran:
                                    </span>
                                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                      {items.map((it, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-[11px] py-0.5">
                                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                            <strong className="text-blue-600 mr-1">{it.quantity}x</strong> {it.name}
                                          </span>
                                          <span className="font-semibold text-slate-900 dark:text-white shrink-0">
                                            {formatThousands(it.totalPrice || it.unitPrice || 0)} lei
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 2. DUPĂ FINALIZARE */}
                              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-emerald-200/80 dark:border-emerald-900/50 shadow-xs flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-100 dark:border-emerald-900/30">
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>2. După Finalizare (Comandă & iiko)</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      item.kind === 'finalized_success' 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    }`}>
                                      {item.kind === 'finalized_success' ? '✓ Finalizată cu Succes' : 'Așteaptă Încasare'}
                                    </span>
                                  </div>

                                  <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400">Număr Bon / Ordine:</span>
                                      <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                                        #{item.orderNumber || item.order_id}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400">Metodă Plată Aleasă:</span>
                                      <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                        {p.paymentMethod === 'cash' ? <><Banknote className="w-3.5 h-3.5 text-amber-500" /> Numerar (Cash la Casierie)</> : <><CreditCard className="w-3.5 h-3.5 text-blue-500" /> Card Bancar</>}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400">Stare Sincronizare iiko:</span>
                                      {item.iiko_sent || p.syrveOrderId ? (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5" /> Transmis cu Succes
                                        </span>
                                      ) : (
                                        <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                          <AlertTriangle className="w-3.5 h-3.5" /> Netrimis încă
                                        </span>
                                      )}
                                    </div>

                                    {(item.iiko_order_id || p.syrveOrderId) && (
                                      <div className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 mt-2">
                                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate">
                                          ID iiko: <strong>{item.iiko_order_id || p.syrveOrderId}</strong>
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(item.iiko_order_id || p.syrveOrderId);
                                            const btn = e.currentTarget;
                                            const prev = btn.innerText;
                                            btn.innerText = 'Copiat!';
                                            setTimeout(() => { btn.innerText = prev; }, 1500);
                                          }}
                                          className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded text-[10px] font-bold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                                        >
                                          Copiază
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Stare casierie */}
                                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                  <span className="text-slate-500 text-xs">Stare Încasare:</span>
                                  {item.paid || item.kind === 'finalized_success' ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Încasat & Confirmat
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" /> Așteaptă plata la casierie
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* ── ACTION BUTTONS ── */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-3 rounded-2xl">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedDraft(item)}
                                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Vezi Bon / Coș Complet</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteDraft(item.order_id)}
                                  className="px-3 py-1.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Elimină</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                {item.kind === 'cash_awaiting' && (
                                  <button
                                    onClick={() => handleMarkPaid(item.order_id)}
                                    disabled={isProcessing}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                                  >
                                    <CheckCircle2 className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                                    <span>Marchează Finalizat cu Succes (Încasat)</span>
                                  </button>
                                )}

                                {(!item.iiko_sent && !p.syrveOrderId) && (
                                  <button
                                    onClick={() => handlePushToIiko(item.order_id, isCash)}
                                    disabled={isProcessing}
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                                  >
                                    <Send className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                                    <span>Trimite în iiko</span>
                                  </button>
                                )}
                              </div>
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

      {/* ── Detail Modal for Selected Draft ── */}
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
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Detalii Comandă</h3>
              </div>
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
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Locație & Brand</span>
                  <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 capitalize">
                    {selectedDraft.payload?.brand} • {selectedDraft.payload?.locationName || selectedDraft.location_id}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tip Servire</span>
                  <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {selectedDraft.payload?.orderType === 'takeaway' ? 'La Pachet' : 'În Restaurant'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ID Tranzacție / Comandă</span>
                  <div className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {selectedDraft.orderNumber ? `#${selectedDraft.orderNumber}` : selectedDraft.order_id}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stare Plată</span>
                  <div className="font-bold mt-0.5">
                    {selectedDraft.paid || selectedDraft.kind === 'finalized_success' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Finalizată cu Succes</span>
                      </span>
                    ) : selectedDraft.kind === 'cash_awaiting' ? (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Cash la Casierie (Neachitat)</span>
                      </span>
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>În Curs POS</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2.5 flex items-center justify-between">
                  <span>Produse în Coș</span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {selectedDraft.payload?.items?.length || 0} articole
                  </span>
                </h4>

                <div className="space-y-2 border border-slate-100 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-900/50">
                  {(selectedDraft.payload?.items || []).map((it, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          <span className="text-blue-600 dark:text-blue-400 mr-1.5">{it.quantity}x</span>
                          <span>{it.name}</span>
                        </div>
                        {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {it.selectedModifiers.map((m, mIdx) => (
                              <span key={mIdx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-300">
                                {m.optionName || m.name || m.modId}
                              </span>
                            ))}
                          </div>
                        )}
                        {it.comment && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 italic">
                            Instrucțiuni: {it.comment}
                          </div>
                        )}
                      </div>
                      <span className="font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {formatThousands(it.totalPrice || it.unitPrice || 0)} RON
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-600 dark:text-slate-400">Total de Plată:</span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {formatThousands(selectedDraft.payload?.totalAmount || selectedDraft.pos_amount || 0)} RON
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => handleDeleteDraft(selectedDraft.order_id)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              >
                Șterge
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDraft(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Închide
                </button>

                {selectedDraft.kind === 'cash_awaiting' && (
                  <button
                    onClick={() => handleMarkPaid(selectedDraft.order_id)}
                    disabled={isProcessingId === selectedDraft.order_id}
                    className="px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isProcessingId === selectedDraft.order_id ? 'animate-spin' : ''}`} />
                    <span>Marchează Finalizat cu Succes</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
