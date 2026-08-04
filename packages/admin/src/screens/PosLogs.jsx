import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import BrandLogo from '../components/BrandLogo.jsx';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const STATUS_CONFIG = {
  approved: { label: 'Aprobat',  color: '#10b981', bg: '#10b98120', icon: '✓' },
  declined: { label: 'Respins',  color: '#ef4444', bg: '#ef444420', icon: '✕' },
  timeout:  { label: 'Timeout',  color: '#f59e0b', bg: '#f59e0b20', icon: '⏱' },
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

  // Filter
  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (locFilter !== 'all' && l.locationId !== locFilter) return false;
    if (brandFilter !== 'all' && getOrderForLog(l)?.brand !== brandFilter) return false;
    if (!isDateInPeriod(l.timestamp, periodFilter)) return false;
    return true;
  });

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

    const match = rawStr.match(/(?:CHITANTA\s+NR|BON\s+NR|RECEIPT\s+NO|TXN)\s*[:\.]?\s*(\d+)/i);
    if (match) return match[1];
    
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

  const derivedStats = useMemo(() => {
    return {
      total: logs.length,
      approved: logs.filter(l => l.status === 'approved' || l.paid === true).length,
      declined: logs.filter(l => l.status === 'declined' || l.status === 'timeout' || (l.status !== 'approved' && l.paid === false)).length,
      iikoFailed: logs.filter(l => (l.status === 'approved' || l.paid === true) && !l.iikoSent).length
    };
  }, [logs]);

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
        <StatCard label="Total POS Logs" value={derivedStats.total} color="#6366f1" />
        <StatCard label="Aprobate (Total)" value={derivedStats.approved} color="#10b981" />
        <StatCard label="Respinse (Total)" value={derivedStats.declined} color="#ef4444" />
        <StatCard label="iiko Eșuat (Total)" value={derivedStats.iikoFailed} color="#f97316" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all',      label: 'Toate' },
            { id: 'approved', label: '✓ Aprobate' },
            { id: 'declined', label: '✕ Respinse' },
            { id: 'timeout',  label: '⏱ Timeout' },
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
            className="px-4 h-9 rounded-full bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Excel
          </button>
          <button
            onClick={fetchLogs}
            className="px-4 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Refresh
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
                        const displayNo = rNo || log.refNum;
                        return displayNo ? (
                          <span className="text-[10px] font-mono text-slate-400 mt-0.5 inline-block">
                            Bon POS: {displayNo}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                    {(Number(log.amount) || 0).toFixed(2)} RON
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center gap-1"
                      style={{ backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }}
                    >
                      {sc.icon} {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">
                    {log.authCode || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">
                    {log.cardNo ? `****${log.cardNo.slice(-4)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">
                    {log.refNum || '—'}
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
                                icon: log.iikoSent ? '✅' : '❌',
                                hideCancel: true,
                                okLabel: 'Închide'
                              }
                            );
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-transform active:scale-95 cursor-pointer ${log.iikoSent ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'}`}
                        >
                          {log.iikoSent ? '✓ Trimis' : '⚠ Eroare'}
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
                            { title: 'Eroare POS', icon: '❌', hideCancel: true, okLabel: 'Închide' }
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
      className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border p-4 flex flex-col justify-center ${highlight ? 'border-orange-300 dark:border-orange-500/50 animate-pulse' : 'border-slate-200 dark:border-slate-800'}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <span className="text-2xl font-bold text-slate-900 dark:text-white">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</span>
    </div>
  );
}
