import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { Printer, CheckCircle2, XCircle, Building2, Monitor, AlertTriangle } from 'lucide-react';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { formatThousands } from '../utils/formatters';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const STATUS_CONFIG = {
  success: { label: 'Succes',  color: '#ffffff', bg: '#059669', icon: '✓' },
  error:   { label: 'Eroare',  color: '#ffffff', bg: '#dc2626', icon: '✕' },
  unknown: { label: 'Necunoscut', color: '#ffffff', bg: '#d97706', icon: '?' },
};

const getReceiptBrandLogo = (brand) => {
  const b = String(brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (b.includes('smashme')) return { mono: '/brands/smashme-logo-mono.png', color: '/brands/smashme-logo.png' };
  if (b.includes('rollmaster') || b.includes('sushimaster') || b.includes('ikura')) return { mono: '/brands/rollmaster-logo-mono.png', color: '/brands/rollmaster-logo.png' };
  if (b.includes('crunch')) return { mono: null, color: '/brands/crunch-logo.png' };
  if (b.includes('lovesushi')) return { mono: null, color: '/brands/lovesushi-logo.png' };
  if (b.includes('welovesushi')) return { mono: null, color: '/brands/welovesushi-logo.png' };
  if (b.includes('pokiwoki')) return { mono: null, color: '/brands/pokiwoki-logo.png' };
  return { mono: null, color: `/brands/${b}-logo.png` };
};

function HardwareScanCard({ scan }) {
  const [showAllPorts, setShowAllPorts] = useState(false);
  const [showAllPrinters, setShowAllPrinters] = useState(false);

  // COM Ports
  const allPorts = scan.comPorts || [];
  const isPortPos = (p) => p.path && scan.posPort && p.path.toUpperCase() === scan.posPort.toUpperCase();
  const activePorts = allPorts.filter(isPortPos);
  const inactivePorts = allPorts.filter(p => !isPortPos(p));
  const displayedPorts = (activePorts.length > 0 && !showAllPorts) ? activePorts : allPorts;

  // Printers
  const allPrinters = scan.printers || [];
  const isPrinterActive = (p) => {
    if (!scan.printerName || !p.name) return false;
    const sName = scan.printerName.toLowerCase();
    const pName = p.name.toLowerCase();
    const matchTwo = scan.printerName.split(' ').slice(0, 2).join(' ').toLowerCase();
    return pName.includes(sName) || sName.includes(pName) || pName.includes(matchTwo);
  };
  const activePrinters = allPrinters.filter(isPrinterActive);
  const inactivePrinters = allPrinters.filter(p => !isPrinterActive(p));
  const displayedPrinters = (activePrinters.length > 0 && !showAllPrinters) ? activePrinters : allPrinters;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 font-sans">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 flex-wrap">
          <Monitor size={14} className="text-slate-500 shrink-0" />
          <span className="uppercase">{scan.locationId}</span>
          {scan.hostname && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {scan.hostname}
            </span>
          )}
          {scan.os && (
            <span className="text-[10px] text-slate-400">{scan.os}</span>
          )}
        </h4>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">
          {scan.timestamp ? new Date(scan.timestamp).toLocaleString('ro-RO') : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        {/* COM Ports */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Porturi COM ({allPorts.length})
            </p>
            {activePorts.length > 0 && inactivePorts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllPorts(prev => !prev)}
                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {showAllPorts ? 'Restrânge' : `+ ${inactivePorts.length} inactive`}
              </button>
            )}
          </div>

          <div className="space-y-1">
            {displayedPorts.map((p, i) => {
              const isPos = isPortPos(p);
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    isPos
                      ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30'
                      : 'bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{p.path}</span>
                    {isPos && (
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-bold">
                        POS
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-[10px] truncate max-w-[120px] text-right">
                    {p.manufacturer || '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Printers */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Imprimante ({allPrinters.length})
            </p>
            {activePrinters.length > 0 && inactivePrinters.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllPrinters(prev => !prev)}
                className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {showAllPrinters ? 'Restrânge' : `+ ${inactivePrinters.length} inactive`}
              </button>
            )}
          </div>

          <div className="space-y-1">
            {displayedPrinters.map((p, i) => {
              const isAct = isPrinterActive(p);
              return (
                <div
                  key={i}
                  className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    isAct
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {p.name}
                    </span>
                    {isAct && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold shrink-0">
                        ACTIV
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-[10px] truncate">
                    {p.driver} | {p.port}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

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

  // ── Filtered by Period, Location & Brands for StatCards ───────
  const periodFilteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (locFilter !== 'all' && l.locationId !== locFilter) return false;
      if (brandFilter !== 'all' && l.brand !== brandFilter) return false;
      if (!isDateInPeriod(l.timestamp, periodFilter)) return false;
      return true;
    });
  }, [logs, locFilter, brandFilter, periodFilter, customStart, customEnd]);

  // Derived stats strictly reflect the selected period, location and brand
  const derivedStats = useMemo(() => ({
    total: periodFilteredLogs.length,
    success: periodFilteredLogs.filter(l => l.status === 'success').length,
    errors: periodFilteredLogs.filter(l => l.status === 'error').length,
    locations: new Set(periodFilteredLogs.map(l => l.locationId).filter(Boolean)).size,
  }), [periodFilteredLogs]);

  // Table filtering adds status filter & search on top of periodFilteredLogs
  const filtered = useMemo(() => {
    return periodFilteredLogs.filter(l => {
      if (filter !== 'all' && l.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [l.orderNumber, l.locationId, l.locationName, l.brand, l.printerName, l.kioskId, l.error].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [periodFilteredLogs, filter, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const locations = [...new Set(logs.map(l => l.locationId).filter(Boolean))];
  const brands = [...new Set(logs.map(l => l.brand).filter(Boolean))];

  const getLogPort = (log) => {
    if (log.port) return log.port;
    const scan = portScans.find(s => s.locationId === log.locationId);
    if (scan?.printers?.length) {
      const match = scan.printers.find(p => p.Name === log.printerName);
      if (match?.PortName) return match.PortName;
      if (scan.printers[0]?.PortName) return scan.printers[0].PortName;
    }
    return '—';
  };

  const prepareExportData = () => {
    return filtered.map(log => ({
      'Data/Ora': log.timestamp ? new Date(log.timestamp).toLocaleString('ro-RO') : '',
      'Locație': log.locationId || '',
      'Brand': log.brand || '',
      'Kiosk': log.kioskId || '',
      'Comandă': log.orderNumber ? `#${log.orderNumber}` : '',
      'Status': STATUS_CONFIG[log.status]?.label || log.status,
      'Imprimantă': log.printerName || '',
      'Port': getLogPort(log),
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

  const periodLabel = 
    periodFilter === 'today' ? 'Printuri Azi' : 
    periodFilter === 'yesterday' ? 'Printuri Ieri' : 
    periodFilter === 'this_week' ? 'Printuri Săpt.' : 
    periodFilter === 'this_month' ? 'Printuri Lună' : 
    periodFilter === 'last_month' ? 'Printuri Luna Trec.' : 
    periodFilter === 'this_year' ? 'Printuri An' : 
    'Total Printuri';

  return (
    <div className="space-y-6">
      {/* Stats Cards - Identical to Dashboard StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          label={periodLabel} 
          value={derivedStats.total} 
          color="#6366f1" 
          icon={Printer}
          onClick={() => { setFilter('all'); setCurrentPage(1); }}
          active={filter === 'all'}
        />
        <StatCard 
          label="Reușite" 
          value={derivedStats.success} 
          color="#059669" 
          icon={CheckCircle2}
          onClick={() => { setFilter(filter === 'success' ? 'all' : 'success'); setCurrentPage(1); }}
          active={filter === 'success'}
        />
        <StatCard 
          label="Erori" 
          value={derivedStats.errors} 
          color="#ef4444" 
          icon={XCircle}
          onClick={() => { setFilter(filter === 'error' ? 'all' : 'error'); setCurrentPage(1); }}
          active={filter === 'error'}
          highlight={derivedStats.errors > 0}
        />
        <StatCard 
          label="Locații Active" 
          value={derivedStats.locations} 
          color="#3b82f6" 
          icon={Building2}
        />
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
              <HardwareScanCard key={scan.locationId} scan={scan} />
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
            className="px-4 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-sm font-bold transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel
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
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Port</th>
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
                <td colSpan={13} className="text-center py-12 text-slate-400">
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
                    <td className="px-4 py-3 text-center text-slate-400 text-xs font-medium">
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
                      {log.brand ? (
                        <div className="flex items-center" title={log.brand}>
                          <BrandLogo brandId={log.brand} size={28} />
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                      {log.printerName || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-[11px]">
                        {getLogPort(log)}
                      </span>
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
                      {formatThousands(Number(log.totalAmount || 0))} RON
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
                                  <span className="text-xs text-red-600 dark:text-red-400 break-all select-all whitespace-pre-wrap">
                                    {log.error}
                                  </span>
                                </div>
                              </div>,
                              { title: 'Eroare Imprimantă', danger: true, hideCancel: true, okLabel: 'Închide' }
                            );
                          }}
                          className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-transform active:scale-95 cursor-pointer bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1"
                        >
                          <AlertTriangle size={12} />
                          <span>Citește</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded row — receipt content */}
                  {isExpanded && log.receiptContent && (() => {
                    const rawOrderNum = String(log.receiptContent.orderNumber || log.orderNumber || '');
                    const kMatch = rawOrderNum.match(/^[a-zA-Z]+(\d+)-/);
                    const kioskTag = kMatch && kMatch[1]
                      ? `Kiosk ${kMatch[1]}`
                      : (log.kioskId ? `Kiosk ${String(log.kioskId).replace(/[^0-9]/g, '') || '1'}` : null);

                    const brandsList = (log.receiptContent.brands && log.receiptContent.brands.length > 0)
                      ? log.receiptContent.brands
                      : [log.brand || 'smashme'];

                    return (
                      <tr key={`${log._id}-expand`} className="bg-slate-50 dark:bg-slate-800/30">
                        <td colSpan={13} className="px-6 py-6">
                          {/* Thermal Receipt Paper Slip */}
                          <div className="w-full max-w-[320px] mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg p-5 text-xs text-slate-800 dark:text-slate-200 font-sans transition-all">
                            {/* Receipt header */}
                            <div className="flex flex-col items-center text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
                              {brandsList.map((b, i) => {
                                const logoInfo = getReceiptBrandLogo(b);
                                const initialSrc = logoInfo.mono || logoInfo.color;
                                return (
                                  <div key={i} className="mb-2 flex flex-col items-center justify-center">
                                    {initialSrc && (
                                      <img
                                        src={initialSrc}
                                        alt={b}
                                        className="h-11 max-w-[170px] object-contain dark:brightness-110 dark:invert transition-all"
                                        onError={(e) => {
                                          if (logoInfo.mono && e.target.src.includes('-mono.png')) {
                                            e.target.src = logoInfo.color;
                                          } else {
                                            e.target.style.display = 'none';
                                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                                          }
                                        }}
                                      />
                                    )}
                                    <div
                                      className="text-base font-extrabold uppercase text-slate-900 dark:text-white tracking-wider"
                                      style={{ display: initialSrc ? 'none' : 'block' }}
                                    >
                                      {b}
                                    </div>
                                  </div>
                                );
                              })}

                              {kioskTag && (
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                  {kioskTag}
                                </div>
                              )}

                              <div className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                                Comanda #{rawOrderNum}
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  log.receiptContent.paymentMethod === 'cash'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}>
                                  {log.receiptContent.paymentMethod === 'cash' ? 'NEACHITAT – ACHITAȚI LA CASĂ' : 'ACHITAT CARD POS'}
                                </span>

                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 uppercase tracking-wider">
                                  {log.receiptContent.orderType === 'takeaway' ? 'LA PACHET' : 'LA MASĂ'}
                                </span>
                              </div>
                            </div>

                            {/* Products Section */}
                            <div className="py-2.5">
                              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider pb-1.5 border-b border-slate-200 dark:border-slate-700/60">
                                Produse
                              </div>

                              <div className="py-2 space-y-2 border-b border-dashed border-slate-300 dark:border-slate-700">
                                {(log.receiptContent.items || []).map((item, i) => (
                                  <div key={i} className="text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                                        {item.qty}x {item.name}
                                      </span>
                                      <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                        {formatThousands(Number(item.price))} RON
                                      </span>
                                    </div>
                                    {item.modifiers && item.modifiers.length > 0 && item.modifiers.map((m, j) => (
                                      <div key={j} className="text-[11px] text-slate-500 dark:text-slate-400 pl-3 pt-0.5">
                                        + {m}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Total Section */}
                            <div className="flex items-center justify-between py-2 text-sm font-black text-slate-900 dark:text-white">
                              <span>TOTAL:</span>
                              <span className="text-base text-emerald-600 dark:text-emerald-400">
                                {formatThousands(Number(log.receiptContent.total || 0))} RON
                              </span>
                            </div>

                            {/* Date & Footer */}
                            <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-dashed border-slate-200 dark:border-slate-800">
                              <div>{log.receiptContent.date}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
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

function StatCard({ label, value, color, brandId, icon: Icon, onClick, active, highlight }) {
  const isCurrency = typeof value === 'string' && value.includes('lei');
  const displayVal = isCurrency ? value.replace('lei', '').trim() : value;
  const valLength = String(displayVal).length;

  let fontSizeClass = 'text-xl';
  if (isCurrency) {
    if (valLength > 8) fontSizeClass = 'text-sm';
    else if (valLength > 5) fontSizeClass = 'text-base';
    else fontSizeClass = 'text-lg';
  } else {
    fontSizeClass = valLength > 4 ? 'text-xl' : 'text-2xl';
  }

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border px-4 py-3 flex items-center justify-between min-w-[120px] flex-1 relative overflow-hidden transition-all duration-200 group select-none ${
        active 
          ? 'ring-2 ring-blue-500 border-blue-500 shadow-md scale-[1.02]' 
          : highlight
          ? 'border-red-300 dark:border-red-500/50'
          : 'border-slate-200 dark:border-slate-800'
      } ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`} 
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex flex-col justify-center min-w-0 pr-1 z-10 flex-1">
        <div className="flex items-baseline gap-1 whitespace-nowrap overflow-visible">
          <span className={`font-black text-slate-900 dark:text-white tracking-tight ${fontSizeClass}`}>
            {displayVal}
          </span>
          {isCurrency && (
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              lei
            </span>
          )}
        </div>
        {!brandId && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title={label}>
            {label}
          </span>
        )}
      </div>

      {brandId ? (
        <div className="flex flex-col items-center justify-center shrink-0 ml-2 z-10">
          <div className="relative">
            {/* 3D Atmosphere Glow behind avatar */}
            <div 
              className="absolute -inset-1 rounded-full blur-sm opacity-35 group-hover:opacity-75 transition-opacity pointer-events-none"
              style={{ backgroundColor: color }}
            />
            {/* 3D Raised Bezel Container with Specular Top Highlight */}
            <div 
              className="relative w-9 h-9 rounded-full p-0.5 flex items-center justify-center bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 border border-white/80 dark:border-slate-600/60 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
              style={{ 
                boxShadow: `0 3px 8px ${color}40, 0 1px 2px rgba(0,0,0,0.1), inset 0 1.5px 2px rgba(255,255,255,0.85)` 
              }}
            >
              <BrandLogo brandId={brandId} size={24} className="rounded-full shadow-inner" />
            </div>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap text-center max-w-[80px] overflow-hidden text-ellipsis" title={label}>
            {label}
          </span>
        </div>
      ) : Icon ? (
        <div className="relative shrink-0 ml-2">
          <div 
            className="absolute -inset-1 rounded-full blur-sm opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none"
            style={{ backgroundColor: color }}
          />
          <div 
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
            style={{ 
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              boxShadow: `0 3px 8px ${color}35, 0 1px 2px rgba(0,0,0,0.1), inset 0 1.5px 2px rgba(255,255,255,0.4)` 
            }}
          >
            <Icon size={18} strokeWidth={2.5} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
