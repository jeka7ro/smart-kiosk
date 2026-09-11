import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const STATUS_CONFIG = {
  success: { label: 'Succes',  color: '#10b981', bg: '#10b98120', icon: '✓' },
  error:   { label: 'Eroare',  color: '#ef4444', bg: '#ef444420', icon: '✕' },
  unknown: { label: 'Necunoscut', color: '#f59e0b', bg: '#f59e0b20', icon: '?' },
};

export default function PrinterLogs() {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [logs, setLogs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [locFilter, setLocFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(tomorrowStr);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  const [portScans, setPortScans] = useState([]);
  const socketRef = useRef(null);

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/printer-logs?limit=500`);
      if (!res.ok) throw new Error('Failed to fetch printer logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load printer logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPortScans = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/port-scans?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setPortScans(data.scans || []);
      }
    } catch (_) {}
  };

  useEffect(() => { fetchLogs(); fetchPortScans(); }, []);

  // Live updates via socket
  useEffect(() => {
    const socket = io(BACKEND, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', { role: 'admin' }));
    socket.on('printer_log_new', (entry) => {
      setLogs(prev => [entry, ...prev]);
    });
    return () => socket.disconnect();
  }, []);

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
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      return d >= startOfWeek;
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

  // Filter + search
  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filter !== 'all' && l.status !== filter) return false;
      if (locFilter !== 'all' && l.locationId !== locFilter) return false;
      if (brandFilter !== 'all' && l.brand !== brandFilter) return false;
      if (!isDateInPeriod(l.timestamp, periodFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [l.orderNumber, l.locationId, l.locationName, l.brand, l.printerName, l.kioskId, l.error].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, filter, locFilter, brandFilter, periodFilter, customStart, customEnd, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const locations = [...new Set(logs.map(l => l.locationId).filter(Boolean))];
  const brands = [...new Set(logs.map(l => l.brand).filter(Boolean))];

  const derivedStats = useMemo(() => ({
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    errors: logs.filter(l => l.status === 'error').length,
    locations: new Set(logs.map(l => l.locationId).filter(Boolean)).size,
  }), [logs]);

  const prepareExportData = () => {
    return filtered.map(log => ({
      'Data/Ora': log.timestamp ? new Date(log.timestamp).toLocaleString('ro-RO') : '',
      'Locație': log.locationId || '',
      'Brand': log.brand || '',
      'Kiosk': log.kioskId || '',
      'Comandă': log.orderNumber ? `#${log.orderNumber}` : '',
      'Status': STATUS_CONFIG[log.status]?.label || log.status,
      'Imprimantă': log.printerName || '',
      'Metoda': log.method || '',
      'Produse': log.itemsCount || 0,
      'Total (RON)': Number((Number(log.totalAmount) || 0).toFixed(2)),
      'Plată': log.paymentMethod || '',
      'Eroare': log.error || '',
    }));
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    if (data.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Printer Logs");
    XLSX.writeFile(workbook, `printer_logs_${new Date().toISOString().slice(0,10)}.xlsx`);
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Printuri" value={derivedStats.total} color="#6366f1" />
        <StatCard label="Reușite" value={derivedStats.success} color="#10b981" />
        <StatCard label="Erori" value={derivedStats.errors} color="#ef4444" highlight={derivedStats.errors > 0} />
        <StatCard label="Locații Active" value={derivedStats.locations} color="#3b82f6" />
      </div>

      {/* Hardware Scan Info */}
      {portScans.length > 0 && (() => {
        // Group by locationId, keep only latest per location
        const latestByLoc = {};
        portScans.forEach(s => {
          if (!latestByLoc[s.locationId] || new Date(s.timestamp) > new Date(latestByLoc[s.locationId].timestamp)) {
            latestByLoc[s.locationId] = s;
          }
        });
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.values(latestByLoc).map(scan => (
              <div key={scan.locationId} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    🖥️ {scan.locationId}
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{scan.hostname}</span>
                    <span className="text-[10px] text-slate-400">{scan.os}</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">{scan.timestamp ? new Date(scan.timestamp).toLocaleString('ro-RO') : ''}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* COM Ports */}
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">🔌 Porturi COM ({(scan.comPorts||[]).length})</p>
                    <div className="space-y-1">
                      {(scan.comPorts||[]).map((p,i) => (
                        <div key={i} className={`flex items-center justify-between text-xs px-2 py-1 rounded-lg ${p.path === scan.posPort ? 'bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{p.path}</span>
                          {p.path === scan.posPort && <span className="px-1.5 py-0.5 rounded-full bg-purple-500 text-white text-[9px] font-bold">POS</span>}
                          <span className="text-slate-400 text-[10px]">{p.manufacturer || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Printers */}
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">🖨️ Imprimante ({(scan.printers||[]).length})</p>
                    <div className="space-y-1">
                      {(scan.printers||[]).map((p,i) => (
                        <div key={i} className={`text-xs px-2 py-1 rounded-lg ${scan.printerName && p.name.includes(scan.printerName.split(' ').slice(0,2).join(' ')) ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{p.name}</span>
                            {scan.printerName && p.name.includes(scan.printerName.split(' ').slice(0,2).join(' ')) && <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold">ACTIV</span>}
                          </div>
                          <span className="text-slate-400 text-[10px]">{p.driver} | {p.port}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all',     label: 'Toate' },
            { id: 'success', label: '✓ Reușite' },
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

          {/* Period Filter */}
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

          {locations.length > 0 && (
            <select
              value={locFilter}
              onChange={e => { setLocFilter(e.target.value); setCurrentPage(1); }}
              className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toate locațiile</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12">Nr.</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Data / Ora</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Locație</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Brand</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Comandă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Imprimantă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Metoda</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Produse</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Plată</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Eroare</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center py-12 text-slate-400">
                  Niciun log de imprimantă găsit
                </td>
              </tr>
            )}
            {paginated.map((log, idx) => {
              const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG.unknown;
              const isExpanded = expandedId === log._id;
              return (
                <>
                  <tr
                    key={log._id}
                    onClick={() => setExpandedId(isExpanded ? null : log._id)}
                    className={`border-b border-slate-100 dark:border-slate-800/50 transition-colors cursor-pointer ${
                      isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
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
                    <td className="px-4 py-3 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{log.locationName || log.locationId || '—'}</span>
                      {log.kioskId && <div className="text-slate-400 text-[10px]">Kiosk: {log.kioskId}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="capitalize font-medium text-slate-600 dark:text-slate-400">{log.brand || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {log.orderNumber ? (
                        <span className="font-bold text-blue-600 dark:text-blue-400">#{log.orderNumber}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: sc.bg, color: sc.color }}
                      >
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {log.printerName || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px] uppercase">
                        {log.method || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-center font-bold text-slate-600 dark:text-slate-400">
                      {log.itemsCount || 0}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {Number(log.totalAmount || 0).toFixed(2)} RON
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {log.paymentMethod === 'cash' ? (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-bold text-[10px] uppercase">Cash</span>
                      ) : log.paymentMethod === 'card' ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase">Card</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {log.error ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirm(
                              <div className="flex flex-col gap-3 text-left mt-2">
                                <p className="text-slate-600 dark:text-slate-300">Eroare imprimantă:</p>
                                <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900/50">
                                  <span className="font-mono text-sm text-red-600 dark:text-red-400 break-all select-all whitespace-pre-wrap">
                                    {log.error}
                                  </span>
                                </div>
                              </div>,
                              { title: 'Eroare Imprimantă', icon: '❌', hideCancel: true, okLabel: 'Închide' }
                            );
                          }}
                          className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-transform active:scale-95 cursor-pointer bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                        >
                          ⚠ Citește
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded row — receipt content */}
                  {isExpanded && log.receiptContent && (
                    <tr key={`${log._id}-expand`} className="bg-slate-50 dark:bg-slate-800/30">
                      <td colSpan={12} className="px-6 py-4">
                        <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 font-mono text-sm">
                          {/* Receipt header */}
                          <div className="text-center mb-3">
                            {(log.receiptContent.brands || []).map((b, i) => (
                              <div key={i} className="text-lg font-black uppercase text-slate-800 dark:text-slate-200">{b}</div>
                            ))}
                            <div className="text-base font-bold mt-1">Comanda #{log.receiptContent.orderNumber}</div>
                            <div className="text-xs font-bold mt-1" style={{ color: log.receiptContent.paymentMethod === 'cash' ? '#f59e0b' : '#10b981' }}>
                              {log.receiptContent.paymentMethod === 'cash' ? 'NEACHITAT - ACHITAȚI LA CASĂ' : 'ACHITAT CARD POS'}
                            </div>
                            <div className="text-xs mt-1 text-slate-500 font-bold uppercase">
                              {log.receiptContent.orderType === 'takeaway' ? 'LA PACHET' : 'LA MASĂ'}
                            </div>
                          </div>

                          <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-2" />

                          {/* Items */}
                          <div className="text-xs mb-1 font-bold text-slate-500">Produse:</div>
                          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                          {(log.receiptContent.items || []).map((item, i) => (
                            <div key={i} className="mb-1">
                              <div className="flex justify-between">
                                <span className="text-slate-700 dark:text-slate-300">{item.qty}x {item.name}</span>
                                <span className="text-slate-600 dark:text-slate-400 font-bold">{Number(item.price).toFixed(2)} RON</span>
                              </div>
                              {item.modifiers && item.modifiers.length > 0 && item.modifiers.map((m, j) => (
                                <div key={j} className="text-slate-400 text-[11px] ml-4">+ {m}</div>
                              ))}
                            </div>
                          ))}
                          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

                          {/* Total */}
                          <div className="flex justify-end text-sm font-black text-slate-800 dark:text-slate-200 mt-1">
                            TOTAL: {Number(log.receiptContent.total || 0).toFixed(2)} RON
                          </div>

                          {/* Date */}
                          <div className="text-center text-[11px] text-slate-400 mt-3">
                            {log.receiptContent.date}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
