import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { CreditCard, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { formatThousands } from '../utils/formatters';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const STATUS_CONFIG = {
  approved: { label: 'Aprobat',  color: '#ffffff', bg: '#16a34a', icon: '✓' },
  declined: { label: 'Respins',  color: '#ffffff', bg: '#dc2626', icon: '✕' },
  timeout:  { label: 'Timeout',  color: '#ffffff', bg: '#d97706', icon: '' },
  refunded: { label: 'Returnat', color: '#ffffff', bg: '#2563eb', icon: '' },
  unsolicited: { label: 'POS Info', color: '#ffffff', bg: '#7c3aed', icon: '' },
};

export default function PosLogs({ orders = [], onGoToOrder }) {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [logs, setLogs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');     // all | approved | declined | timeout
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
  const socketRef = useRef(null);

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const logsRes = await fetchWithAuth(`${BACKEND}/api/pos-logs?limit=500`);
      if (!logsRes.ok) throw new Error('Failed to fetch POS logs');
      
      const logsData = await logsRes.json();
      setLogs(logsData.logs || []);
    } catch (err) {
      console.error('Failed to load POS logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  // Live updates via socket
  useEffect(() => {
    const socket = io(BACKEND, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', { role: 'admin' }));
    socket.on('pos_log_new', (entry) => {
      if (!entry || !entry._id || !entry.timestamp) return;
      if ((Number(entry.amount) === 0 || !entry.amount) && !entry.paid && !entry.authCode) return;
      setLogs(prev => [entry, ...prev]);
    });
    return () => socket.disconnect();
  }, []);

  const getOrderForLog = (log) => orders.find(o => 
    (log.authCode && o.paymentRef?.authCode === log.authCode) || 
    (log.refNum && o.paymentRef?.refNum === log.refNum) || 
    o._id === log.orderId
  );

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
    if (period === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === 'last_month') {
      let m = now.getMonth() - 1;
      let y = now.getFullYear();
      if (m < 0) { m = 11; y--; }
      return d.getFullYear() === y && d.getMonth() === m;
    }
    if (period === 'this_year') {
      return d.getFullYear() === now.getFullYear();
    }
    if (period === 'custom') {
      if (!customStart && !customEnd) return true;
      let startValid = true;
      let endValid = true;
      if (customStart) {
        const sd = new Date(customStart);
        sd.setHours(0, 0, 0, 0);
        if (d < sd) startValid = false;
      }
      if (customEnd) {
        const ed = new Date(customEnd);
        ed.setHours(23, 59, 59, 999);
        if (d > ed) endValid = false;
      }
      return startValid && endValid;
    }
    return true;
  };

  // Helper to detect failed payment attempts that were quickly retried and approved for the same amount & location
  const isSupersededRetry = useCallback((log, allLogs) => {
    if (log.status === 'approved' || log.paid === true) return false;
    const logAmt = parseFloat(log.amount) || 0;
    if (logAmt <= 0) return false;
    if (!log.timestamp) return false;
    const logTime = new Date(log.timestamp).getTime();
    if (isNaN(logTime)) return false;
    const logLoc = (log.locationId || '').trim();

    return allLogs.some(other => {
      if ((other._id || other.id) === (log._id || log.id)) return false;
      if (other.status !== 'approved' && other.paid !== true) return false;
      const otherAmt = parseFloat(other.amount) || 0;
      if (Math.abs(logAmt - otherAmt) > 0.05) return false;
      const otherLoc = (other.locationId || '').trim();
      if (logLoc && otherLoc && logLoc !== otherLoc) return false;
      if (!other.timestamp) return false;
      const otherTime = new Date(other.timestamp).getTime();
      if (isNaN(otherTime)) return false;
      const diffMs = otherTime - logTime;
      // Approved transaction happened within 2 minutes (120 seconds) after the failed attempt
      return diffMs >= -5000 && diffMs <= 120000;
    });
  }, []);

  // ── Filtered by Period, Location & Brands for StatCards ───────
  const periodFilteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (!l || !l._id || !l.timestamp) return false;
      if ((Number(l.amount) === 0 || !l.amount) && l.status !== 'approved' && !l.paid && !l.authCode) return false;
      if (isSupersededRetry(l, logs)) return false;
      if (locFilter !== 'all' && l.locationId !== locFilter) return false;
      if (brandFilter !== 'all' && getOrderForLog(l)?.brand !== brandFilter) return false;
      if (!isDateInPeriod(l.timestamp, periodFilter)) return false;
      return true;
    });
  }, [logs, locFilter, brandFilter, periodFilter, customStart, customEnd, orders, isSupersededRetry]);

  // Derived stats strictly reflect the selected period, location and brand
  const derivedStats = useMemo(() => {
    return {
      total: periodFilteredLogs.length,
      approved: periodFilteredLogs.filter(l => l.status === 'approved' || l.paid === true).length,
      declined: periodFilteredLogs.filter(l => l.status === 'declined' || l.status === 'timeout' || (l.status !== 'approved' && l.paid === false)).length,
      iikoFailed: periodFilteredLogs.filter(l => (l.status === 'approved' || l.paid === true) && !l.iikoSent).length
    };
  }, [periodFilteredLogs]);

  // Table filtering adds status filter on top of periodFilteredLogs
  const filtered = useMemo(() => {
    return periodFilteredLogs.filter(l => {
      if (filter !== 'all') {
        if (filter === 'approved') return l.status === 'approved' || l.paid === true;
        if (filter === 'declined') return l.status === 'declined' || (l.status !== 'approved' && l.paid === false);
        if (filter === 'timeout') return l.status === 'timeout';
        if (filter === 'iikoFailed') return (l.status === 'approved' || l.paid === true) && !l.iikoSent;
        if (l.status !== filter) return false;
      }
      return true;
    });
  }, [periodFilteredLogs, filter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Unique locations and brands for filter
  const locations = [...new Set(logs.map(l => l.locationId).filter(Boolean))];
  const brands = [...new Set(logs.map(l => getOrderForLog(l)?.brand).filter(Boolean))];

  const extractReceiptNo = (log) => {
    if (log.receiptNo) return log.receiptNo;
    if (!log.raw) return null;
    
    if (typeof log.raw === 'object') {
      if (log.raw.receiptNo) return log.raw.receiptNo;
      if (log.raw.InvoiceNum) return log.raw.InvoiceNum;
      if (log.raw.receipt_number) return log.raw.receipt_number;
    }
    
    let rawStr = typeof log.raw === 'string' ? log.raw : JSON.stringify(log.raw);
    
    // Check if it's a hex payload from verifone
    if (/^[0-9a-fA-F]+$/.test(rawStr) && rawStr.length % 2 === 0 && rawStr.length > 100) {
      try {
        let asciiStr = '';
        for (let i = 0; i < rawStr.length; i += 2) {
          asciiStr += String.fromCharCode(parseInt(rawStr.substr(i, 2), 16));
        }
        
        if (asciiStr.length >= 57) {
          const varStr = asciiStr.substring(57);
          const varFields = varStr.split(String.fromCharCode(0x1C)); // FS character
          if (varFields.length >= 4) {
            const pinReceip = (varFields[3] || '').trim();
            const receiptNo = pinReceip.length >= 7 ? pinReceip.slice(1) : pinReceip.slice(0, 6);
            if (receiptNo && /^[0-9]+$/.test(receiptNo)) {
              return receiptNo;
            }
          }
        }
      } catch (e) {}
    }

    const match = rawStr.match(/(?:CHITANTA\s+NR|BON\s+NR|RECEIPT\s+NO|TXN|STAN)\s*[:\.]?\s*(\d+)/i);
    if (match) return match[1];

    if (rawStr.startsWith('MOL11')) {
      const matches = rawStr.match(/\d{6}/g);
      if (matches) {
        const auth = log.authCode || '';
        const stan = matches.find(m => m !== auth && m !== '000000');
        if (stan) return stan;
      }
    }
    
    return null;
  };

  const prepareExportData = () => {
    return filtered.map(log => {
      const order = getOrderForLog(log);
      const rNo = extractReceiptNo(log);
      return {
        'Data/Ora': log.timestamp ? new Date(log.timestamp).toLocaleString('ro-RO') : '',
        'Brand': order?.brand || '',
        'ID Comanda': order?.orderNumber ? `#${order.orderNumber}` : (log.orderId || ''),
        'Nr. Bon': rNo || '',
        'Locatie': log.locationId || '',
        'Suma (RON)': Number((Number(log.amount) || 0).toFixed(2)),
        'Status POS': STATUS_CONFIG[log.status]?.label || log.status,
        'Auth Code': log.authCode || '',
        'Card': log.cardNo ? `****${log.cardNo.slice(-4)}` : '',
        'Ref#': log.refNum || '',
        'iiko': log.paid ? (log.iikoSent ? 'Trimis' : 'Netrimis') : '',
        'Eroare': log.error || ''
      };
    });
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    if (data.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "POS Logs");
    XLSX.writeFile(workbook, `pos_logs_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const periodLabel = 
    periodFilter === 'today' ? 'Total POS Azi' : 
    periodFilter === 'yesterday' ? 'Total POS Ieri' : 
    periodFilter === 'this_week' ? 'Total POS Săpt.' : 
    periodFilter === 'this_month' ? 'Total POS Lună' : 
    periodFilter === 'last_month' ? 'Total POS Luna Trec.' : 
    periodFilter === 'this_year' ? 'Total POS An' : 
    'Total POS Logs';

  return (
    <div className="space-y-6">
      {/* Stats Cards - Identical to Dashboard StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          label={periodLabel} 
          value={derivedStats.total} 
          color="#6366f1" 
          icon={CreditCard}
          onClick={() => { setFilter('all'); setCurrentPage(1); }}
          active={filter === 'all'}
        />
        <StatCard 
          label="Aprobate" 
          value={derivedStats.approved} 
          color="#10b981" 
          icon={CheckCircle2}
          onClick={() => { setFilter(filter === 'approved' ? 'all' : 'approved'); setCurrentPage(1); }}
          active={filter === 'approved'}
        />
        <StatCard 
          label="Respinse" 
          value={derivedStats.declined} 
          color="#ef4444" 
          icon={XCircle}
          onClick={() => { setFilter(filter === 'declined' ? 'all' : 'declined'); setCurrentPage(1); }}
          active={filter === 'declined'}
        />
        <StatCard 
          label="iiko Eșuat" 
          value={derivedStats.iikoFailed} 
          color="#f97316" 
          icon={AlertTriangle}
          onClick={() => { setFilter(filter === 'iikoFailed' ? 'all' : 'iikoFailed'); setCurrentPage(1); }}
          active={filter === 'iikoFailed'}
          highlight={derivedStats.iikoFailed > 0}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all',      label: 'Toate' },
            { id: 'approved', label: '✓ Aprobate' },
            { id: 'declined', label: '✕ Respinse' },
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
              <input 
                type="date" 
                value={customStart} 
                onChange={e => {setCustomStart(e.target.value); setCurrentPage(1);}} 
                className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500" 
              />
              <span className="text-slate-400 font-bold">-</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={e => {setCustomEnd(e.target.value); setCurrentPage(1);}} 
                className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500" 
              />
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
          <button
            onClick={handleExportExcel}
            className="px-4 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-sm font-bold transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12">Nr. Crt.</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Data / Ora</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Brand / Locație</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">ID Comandă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Sumă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status POS</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Auth Code</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Card</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Ref#</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">iiko</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Eroare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                  Nicio tranzacție POS înregistrată
                </td>
              </tr>
            ) : paginated.map((log, idx) => {
              const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG.declined;
              const dt = log.timestamp ? new Date(log.timestamp) : null;
              const order = getOrderForLog(log);
              return (
                <tr key={log._id} onClick={() => onGoToOrder && order && onGoToOrder(order._id)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-slate-500">
                    {(currentPage - 1) * itemsPerPage + idx + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {dt ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold">{dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="font-bold">{dt.toLocaleDateString('ro-RO')}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2 items-start">
                      {order?.brand || log.raw?.brand ? (
                        <div className="flex items-center gap-2">
                          <BrandLogo brandId={order?.brand || log.raw?.brand} size={20} />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{order?.brand || log.raw?.brand}</span>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        {log.locationName || log.locationId || 'Locație necunoscută'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 select-all">
                        {order?.orderNumber ? `#${order.orderNumber}` : (log.orderId || '—')}
                      </span>
                      {(() => {
                        const rNo = extractReceiptNo(log);
                        return rNo ? (
                          <span className="text-[10px] font-mono text-slate-400 mt-0.5 inline-block">
                            Bon POS: {rNo}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                    {formatThousands(Number(log.amount) || 0)} RON
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center gap-1 shadow-sm"
                      style={{ backgroundColor: sc.bg, color: sc.color }}
                    >
                      {sc.icon ? <span>{sc.icon}</span> : null} {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">
                    {log.authCode || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">
                    {log.cardNo ? `****${log.cardNo.slice(-4)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      <span>{log.refNum || '—'}</span>
                      {(() => {
                        const extra = log.raw?.extraFields;
                        if (extra && Array.isArray(extra) && extra.length > 2) {
                          const entryMode = extra[2]; // Usually the 3rd field is the application name or mode
                          if (entryMode && entryMode.toLowerCase().includes('contactless')) {
                            return <span className="text-[10px] text-blue-500 font-bold">CONTACTLESS</span>;
                          } else if (extra.some(f => typeof f === 'string' && f.toLowerCase().includes('contactless'))) {
                            return <span className="text-[10px] text-blue-500 font-bold">CONTACTLESS</span>;
                          } else if (extra.some(f => typeof f === 'string' && f.toLowerCase().includes('maestro') || f.toLowerCase().includes('mastercard') || f.toLowerCase().includes('visa'))) {
                            return <span className="text-[10px] text-slate-400 font-bold">CHIP/INSERT</span>;
                          }
                        }
                        return null;
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {log.paid ? (
                      <div className="flex flex-col gap-1 items-start">
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // prevent row click
                            
                            const successMessage = (
                              <div className="flex flex-col gap-4 text-left mt-2">
                                <p className="text-slate-600 dark:text-slate-300">Comanda a fost trimisă cu succes în iiko.</p>
                                {log.iikoOrderId && (
                                  <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/50 flex flex-col gap-1.5 mt-1">
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">ID Comandă iiko</span>
                                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-950 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-800">
                                      <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">
                                        {log.iikoOrderId}
                                      </span>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(log.iikoOrderId);
                                          const btn = e.currentTarget;
                                          const originalHTML = btn.innerHTML;
                                          btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#10b981" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
                                          setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors shrink-0"
                                        title="Copiază ID iiko"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );

                            const errorMessage = (
                              <div className="flex flex-col gap-3 text-left mt-2">
                                <p className="text-slate-600 dark:text-slate-300">Eroare la trimiterea comenzii în iiko:</p>
                                <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900/50">
                                  <span className="font-mono text-xs text-red-600 dark:text-red-400 break-all select-all">
                                    {log.iikoError || 'Eroare necunoscută. Vă rugăm să verificați manual.'}
                                  </span>
                                </div>
                              </div>
                            );

                            confirm(
                              log.iikoSent ? successMessage : errorMessage,
                              {
                                title: log.iikoSent ? 'Status iiko: Succes' : 'Status iiko: Eroare',
                                hideCancel: true,
                                danger: !log.iikoSent,
                                okLabel: 'Închide'
                              }
                            );
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-transform active:scale-95 cursor-pointer shadow-sm ${log.iikoSent ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                        >
                          {log.iikoSent ? 'Trimis' : 'Eroare'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {log.error ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirm(
                            <div className="flex flex-col gap-3 text-left mt-2">
                              <p className="text-slate-600 dark:text-slate-300">Detaliu eroare POS:</p>
                              <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900/50">
                                <span className="font-mono text-sm text-red-600 dark:text-red-400 break-all select-all whitespace-pre-wrap">
                                  {log.error}
                                </span>
                              </div>
                            </div>,
                            { title: 'Eroare POS', danger: true, hideCancel: true, okLabel: 'Închide' }
                          );
                        }}
                        className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-transform active:scale-95 cursor-pointer bg-red-600 hover:bg-red-700 text-white shadow-sm"
                      >
                        Detalii
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
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
          ? 'border-orange-300 dark:border-orange-500/50'
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
