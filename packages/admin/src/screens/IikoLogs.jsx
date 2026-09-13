import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { ChevronDown, ChevronUp, Copy, Search } from 'lucide-react';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const STATUS_CONFIG = {
  success: { label: 'Succes', color: '#10b981', bg: '#10b98120', icon: '✓' },
  error:   { label: 'Eroare', color: '#ef4444', bg: '#ef444420', icon: '✕' },
};

export default function IikoLogs() {
  const { fetchWithAuth } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [search, setSearch] = useState('');
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(tomorrowStr);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [retryingId, setRetryingId] = useState(null);

  const handleRetry = async (log, e) => {
    e.stopPropagation();
    const orderId = log.id || log.order_id;
    if (!orderId) return;
    setRetryingId(orderId);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/orders/${encodeURIComponent(orderId)}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Comanda #${orderId} a fost retrimisă cu succes!\nSyrve ID: ${data.syrveOrderId}`);
        fetchLogs();
      } else {
        alert(`❌ Eroare la retriimitere: ${data.error || JSON.stringify(data)}`);
      }
    } catch (err) {
      alert(`❌ Eroare: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/iiko-logs`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : (data.logs || []));
    } catch (e) {
      console.error('Failed to load iiko logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const isDateInPeriod = (dateStr, period) => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (period === 'today') return d >= startOfToday;
    if (period === 'yesterday') return d >= startOfYesterday && d < startOfToday;
    if (period === 'this_week') {
      const day = now.getDay() || 7;
      return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    }
    if (period === 'this_month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (period === 'last_month') {
      let m = now.getMonth() - 1, y = now.getFullYear();
      if (m < 0) { m = 11; y--; }
      return d.getFullYear() === y && d.getMonth() === m;
    }
    if (period === 'this_year') return d.getFullYear() === now.getFullYear();
    if (period === 'custom') {
      if (!customStart && !customEnd) return true;
      let ok = true;
      if (customStart) { const sd = new Date(customStart); sd.setHours(0,0,0,0); if (d < sd) ok = false; }
      if (customEnd) { const ed = new Date(customEnd); ed.setHours(23,59,59,999); if (d > ed) ok = false; }
      return ok;
    }
    return true;
  };

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filter !== 'all' && l.status !== filter) return false;
      if (brandFilter !== 'all' && l.brandId !== brandFilter) return false;
      if (!isDateInPeriod(l.timestamp, periodFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [l.id, l.brandId, l.order_id, l.status].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, filter, brandFilter, periodFilter, customStart, customEnd, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const brands = [...new Set(logs.map(l => l.brandId).filter(Boolean))];

  const derivedStats = useMemo(() => ({
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    errors: logs.filter(l => l.status === 'error').length,
  }), [logs]);

  const handleExportExcel = () => {
    const data = filtered.map(l => ({
      'Data/Ora': l.timestamp ? new Date(l.timestamp).toLocaleString('ro-RO') : '',
      'ID Comandă': l.id || '',
      'Brand': l.brandId || '',
      'Status': STATUS_CONFIG[l.status]?.label || l.status,
    }));
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "iiko Logs");
    XLSX.writeFile(wb, `iiko_logs_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Loguri iiko" value={derivedStats.total} color="#6366f1" />
        <StatCard label="Succes" value={derivedStats.success} color="#10b981" />
        <StatCard label="Erori" value={derivedStats.errors} color="#ef4444" highlight={derivedStats.errors > 0} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all',     label: 'Toate' },
            { id: 'success', label: '✓ Succes' },
            { id: 'error',   label: '✕ Erori' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setCurrentPage(1); }}
              className={`px-4 h-9 rounded-full text-sm font-bold border transition-colors ${
                filter === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}

          <select
            value={periodFilter}
            onChange={e => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
            className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toată perioada</option>
            <option value="today">Azi</option>
            <option value="yesterday">Ieri</option>
            <option value="this_week">Săptămâna curentă</option>
            <option value="this_month">Luna curentă</option>
            <option value="last_month">Luna trecută</option>
            <option value="this_year">Anul curent</option>
            <option value="custom">Personalizat</option>
          </select>

          {periodFilter === 'custom' && (
            <div className="flex items-center gap-1">
              <input type="date" value={customStart} onChange={e => {setCustomStart(e.target.value); setCurrentPage(1);}} className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-400 font-bold">-</span>
              <input type="date" value={customEnd} onChange={e => {setCustomEnd(e.target.value); setCurrentPage(1);}} className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {brands.length > 0 && (
            <select
              value={brandFilter}
              onChange={e => { setBrandFilter(e.target.value); setCurrentPage(1); }}
              className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 capitalize"
            >
              <option value="all">Toate brandurile</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search className="w-3.5 h-3.5 text-slate-400" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              placeholder="Caută..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="h-9 pl-8 pr-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              style={{ width: 160 }}
            />
            {search && (
              <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: '#6366f1', color: 'white', borderRadius: 9999, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                {filtered.length} / {logs.length}
              </div>
            )}
          </div>
          <button
            onClick={handleExportExcel}
            className="px-4 h-9 rounded-full bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel
          </button>
          <button
            onClick={fetchLogs}
            className="px-4 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12">Nr.</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Data / Ora</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">ID Comandă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Brand</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Acțiune</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  Nu există loguri iiko
                </td>
              </tr>
            )}
            {paginated.map((log, idx) => {
              const globalIdx = (currentPage - 1) * itemsPerPage + idx;
              const logKey = log._id || `${log.id || log.order_id || ''}-${log.created_at || ''}-${globalIdx}`;
              const isExpanded = expandedId === logKey;
              const statusInfo = STATUS_CONFIG[log.status] || STATUS_CONFIG.error;

              return (
                <React.Fragment key={logKey}>
                  <tr
                    className={`border-b border-slate-100 dark:border-slate-800/50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                    onClick={() => setExpandedId(isExpanded ? null : logKey)}
                  >
                    <td className="px-4 py-3 text-center text-slate-400 text-xs font-mono">
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {log.timestamp ? new Date(log.timestamp).toLocaleDateString('ro-RO') : '—'}
                      </div>
                      <div className="text-slate-400">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('ro-RO') : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-blue-600 dark:text-blue-400">
                      #{log.id || log.order_id || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="capitalize font-medium text-slate-600 dark:text-slate-400">{log.brandId || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: statusInfo.bg, color: statusInfo.color }}
                      >
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {log.status === 'error' && (
                          <button
                            onClick={(e) => handleRetry(log, e)}
                            disabled={retryingId === (log.id || log.order_id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                              retryingId === (log.id || log.order_id)
                                ? 'bg-amber-100 text-amber-600 cursor-wait'
                                : 'bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {retryingId === (log.id || log.order_id) ? (
                              <>
                                <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                Se trimite...
                              </>
                            ) : (
                              <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                Retrimite
                              </>
                            )}
                          </button>
                        )}
                        <button className="text-slate-400 hover:text-slate-600 transition-colors">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-50 dark:bg-slate-800/30">
                      <td colSpan={6} className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Request Payload */}
                          <div>
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              Cerere (Payload Trimis)
                            </h4>
                            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700 max-h-80">
                              <pre className="text-xs text-blue-300 font-mono" style={{ margin: 0 }}>
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          </div>

                          {/* Response */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 m-0">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusInfo.color }}></span>
                                Răspuns (Syrve)
                              </h4>
                              <button
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(log.response, null, 2)); }}
                                className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
                              >
                                <Copy size={14} /> Copiază
                              </button>
                            </div>
                            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700 max-h-80">
                              <pre className="text-xs font-mono" style={{ margin: 0, color: log.status === 'error' ? '#fca5a5' : '#86efac' }}>
                                {JSON.stringify(log.response, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              Afișează
              <select
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toți</option>
              </select>
            </span>
            <span>Total înregistrări: <strong className="text-slate-700 dark:text-slate-300">{filtered.length}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Pagina {currentPage} din {totalPages}</span>
            <div className="flex gap-1">
              {[
                { label: '«', action: () => setCurrentPage(1),           disabled: currentPage === 1 },
                { label: '‹', action: () => setCurrentPage(p => p - 1),  disabled: currentPage === 1 },
                { label: '›', action: () => setCurrentPage(p => p + 1),  disabled: currentPage === totalPages },
                { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} disabled={btn.disabled}
                  className={`w-8 h-8 rounded-lg border text-sm font-bold flex items-center justify-center transition-colors ${btn.disabled ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'}`}
                >{btn.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, highlight }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border p-4 flex flex-col justify-center ${highlight ? 'border-red-300 dark:border-red-500/50 animate-pulse' : 'border-slate-200 dark:border-slate-800'}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <span className="text-2xl font-bold text-slate-900 dark:text-white">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</span>
    </div>
  );
}
