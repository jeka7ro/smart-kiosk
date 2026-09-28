import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { 
  Clock, Search, RefreshCw, ShoppingBag, CreditCard, 
  CheckCircle2, AlertTriangle, Trash2, Send, X, Eye, 
  Receipt, ArrowRight, Store, DollarSign
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';
import { formatThousands } from '../utils/formatters';

export default function PendingOrders({ backend, onGoToOrder }) {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isProcessingId, setIsProcessingId] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all, paid_not_sent, awaiting_card

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

  // Extract unique locations & brands for filter dropdowns
  const availableLocations = useMemo(() => {
    const set = new Set();
    pendingList.forEach(p => {
      const loc = p.payload?.locationName || p.location_id;
      if (loc) set.add(loc);
    });
    return Array.from(set);
  }, [pendingList]);

  const availableBrands = useMemo(() => {
    const set = new Set();
    pendingList.forEach(p => {
      const b = p.payload?.brand;
      if (b) set.add(b);
    });
    return Array.from(set);
  }, [pendingList]);

  // Filtered List
  const filteredList = useMemo(() => {
    return pendingList.filter(item => {
      const p = item.payload || {};
      const loc = (p.locationName || item.location_id || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const orderId = (item.order_id || '').toLowerCase();
      const itemsText = (p.items || []).map(i => i.name).join(' ').toLowerCase();

      // Search match
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches = loc.includes(q) || brand.includes(q) || orderId.includes(q) || itemsText.includes(q);
        if (!matches) return false;
      }

      // Location match
      if (filterLocation !== 'all') {
        const itemLoc = p.locationName || item.location_id;
        if (itemLoc !== filterLocation) return false;
      }

      // Brand match
      if (filterBrand !== 'all') {
        if (p.brand !== filterBrand) return false;
      }

      // Status match
      if (filterStatus === 'paid_not_sent') {
        if (!item.paid || item.iiko_sent) return false;
      } else if (filterStatus === 'awaiting_card') {
        if (item.paid) return false;
      }

      return true;
    });
  }, [pendingList, searchTerm, filterLocation, filterBrand, filterStatus]);

  // Stats
  const totalAmount = useMemo(() => {
    return filteredList.reduce((sum, item) => sum + (Number(item.payload?.totalAmount) || Number(item.pos_amount) || 0), 0);
  }, [filteredList]);

  const paidAwaitingIikoCount = useMemo(() => {
    return filteredList.filter(item => item.paid && !item.iiko_sent).length;
  }, [filteredList]);

  // Actions
  const handlePushToIiko = async (orderId) => {
    const ok = await confirm('Sigur dorești să trimiți această comandă salvată în iiko și la bucătărie?', {
      title: 'Trimitere Manuală în iiko',
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
        confirm(`Comanda #${data.order?.orderNumber || ''} a fost trimisă cu succes în iiko!`, {
          title: 'Succes Trimitere iiko',
          type: 'info',
          hideCancel: true,
        });
        setSelectedDraft(null);
        fetchPendingOrders();
        if (onGoToOrder && data.order?._id) onGoToOrder(data.order._id);
      } else {
        confirm(`Eroare la trimiterea în iiko: ${data.error || 'Necunoscută'}`, {
          title: 'Eroare iiko',
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
    const ok = await confirm('Ești sigur că vrei să elimini această comandă temporară? Fă asta doar dacă clientul a renunțat sau plata nu s-a finalizat.', {
      title: 'Eliminare Comandă Temporară',
      danger: true,
      okLabel: 'Șterge Definitiv',
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
    <div className="space-y-6">
      {/* ── Header & Action Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Clock className="w-7 h-7 text-amber-500" />
            <span>Comenzi În Așteptare (Pending Coșuri)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Coșuri reale pre-salvate pe server înainte și în timpul plății cu cardul pe POS.
          </p>
        </div>

        <button
          onClick={() => fetchPendingOrders()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-sm shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Reîmprospătează</span>
        </button>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Coșuri Salvate</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{filteredList.length}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plăți Card Aprobate</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{paidAwaitingIikoCount}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Valoare Totală Coșuri</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{formatThousands(totalAmount)} RON</div>
          </div>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Caută după produs, ID tranzacție sau oraș..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Location Filter */}
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
        >
          <option value="all">Toate Locațiile</option>
          {availableLocations.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>

        {/* Brand Filter */}
        <select
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer capitalize"
        >
          <option value="all">Toate Brandurile</option>
          {availableBrands.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
        >
          <option value="all">Toate Statusurile</option>
          <option value="paid_not_sent">Card Aprobat (Netrimis iiko)</option>
          <option value="awaiting_card">În Așteptare Card</option>
        </select>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3.5">Nr.</th>
                <th className="px-4 py-3.5">Dată & Oră</th>
                <th className="px-4 py-3.5">Locație & Brand</th>
                <th className="px-4 py-3.5">ID Tranzacție</th>
                <th className="px-4 py-3.5">Produse din Coș</th>
                <th className="px-4 py-3.5 text-right">Sumă</th>
                <th className="px-4 py-3.5 text-center">Status Card POS</th>
                <th className="px-4 py-3.5 text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="text-sm font-semibold">Nicio comandă în așteptare găsită</p>
                    <p className="text-xs text-slate-400 mt-0.5">Toate comenzile sunt finalizate sau nu există plăți active în acest moment.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const p = item.payload || {};
                  const dt = item.created_at ? new Date(item.created_at) : null;
                  const brand = p.brand || 'smashme';
                  const items = p.items || [];
                  const total = Number(p.totalAmount) || Number(item.pos_amount) || 0;
                  const isPaid = item.paid;
                  const isProcessing = isProcessingId === item.order_id;

                  return (
                    <tr 
                      key={item.order_id || idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedDraft(item)}
                    >
                      <td className="px-4 py-3.5 text-xs font-semibold text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {dt ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">
                              {dt.toLocaleDateString('ro-RO')}
                            </span>
                          </div>
                        ) : '—'}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <BrandLogo brandId={brand} size={22} />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                              {brand}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              {p.locationName || item.location_id || 'Kiosk'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                            {item.order_id}
                          </span>
                          {item.auth_code && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Auth: {item.auth_code}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {items.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'Fără produse'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {items.length} {items.length === 1 ? 'produs' : 'produse'} în coș
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {formatThousands(total)} <span className="text-xs font-normal text-slate-400">RON</span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Card Aprobat</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            <span>În Așteptare Card</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedDraft(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Vezi detalii coș complet"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isPaid && (
                            <button
                              onClick={() => handlePushToIiko(item.order_id)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                              title="Trimite comanda originală în iiko"
                            >
                              <Send className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                              <span>Trimite iiko</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteDraft(item.order_id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Elimină draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Detalii Coș Salvat</h3>
              </div>
              <button
                onClick={() => setSelectedDraft(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ID Tranzacție POS</span>
                  <div className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {selectedDraft.order_id}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stare Plată Card</span>
                  <div className="font-bold mt-0.5">
                    {selectedDraft.paid ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aprobat (Auth: {selectedDraft.auth_code})</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>În Așteptare</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2.5 flex items-center justify-between">
                  <span>Produse în Coș (Originale)</span>
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
                className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                Șterge Coș
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDraft(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Închide
                </button>

                {selectedDraft.paid && (
                  <button
                    onClick={() => handlePushToIiko(selectedDraft.order_id)}
                    disabled={isProcessingId === selectedDraft.order_id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Send className={`w-3.5 h-3.5 ${isProcessingId === selectedDraft.order_id ? 'animate-spin' : ''}`} />
                    <span>Trimite în iiko</span>
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
