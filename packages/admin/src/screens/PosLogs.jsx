import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthProvider';
import { io } from 'socket.io-client';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const STATUS_CONFIG = {
  approved: { label: 'Aprobat',  color: '#10b981', bg: '#10b98120', icon: '✓' },
  declined: { label: 'Respins',  color: '#ef4444', bg: '#ef444420', icon: '✕' },
  timeout:  { label: 'Timeout',  color: '#f59e0b', bg: '#f59e0b20', icon: '⏱' },
};

export default function PosLogs() {
  const { fetchWithAuth } = useAuth();
  const [logs, setLogs]   = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');     // all | approved | declined | timeout
  const [locFilter, setLocFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const socketRef = useRef(null);

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetchWithAuth(`${BACKEND}/api/pos-logs?limit=500`),
        fetchWithAuth(`${BACKEND}/api/pos-logs/stats`),
      ]);
      const logsData = await logsRes.json();
      const statsData = await statsRes.json();
      setLogs(logsData.logs || []);
      setStats(statsData);
    } catch (e) {
      console.error('Failed to load POS logs:', e);
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
      // Update stats
      setStats(prev => prev ? {
        ...prev,
        today: prev.today + 1,
        todayApproved: entry.paid ? prev.todayApproved + 1 : prev.todayApproved,
        todayDeclined: !entry.paid ? prev.todayDeclined + 1 : prev.todayDeclined,
        todayRevenue: entry.paid ? prev.todayRevenue + (entry.amount || 0) : prev.todayRevenue,
      } : prev);
    });
    return () => socket.disconnect();
  }, []);

  // Filter
  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (locFilter !== 'all' && l.locationId !== locFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  // Unique locations for filter
  const locations = [...new Set(logs.map(l => l.locationId).filter(Boolean))];

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
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Total" value={stats.total} color="#6366f1" />
          <StatCard label="Azi" value={stats.today} color="#3b82f6" />
          <StatCard label="Aprobate" value={stats.todayApproved} color="#10b981" />
          <StatCard label="Respinse" value={stats.todayDeclined} color="#ef4444" />
          <StatCard label="Venit Azi" value={`${(stats.todayRevenue || 0).toFixed(0)} RON`} color="#8b5cf6" />
          <StatCard label="Trimise iiko" value={stats.todayIikoSent} color="#06b6d4" />
          <StatCard label="iiko Eșuat" value={stats.todayIikoFailed} color="#f97316" highlight={stats.todayIikoFailed > 0} />
        </div>
      )}

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

        {locations.length > 1 && (
          <select
            value={locFilter}
            onChange={e => { setLocFilter(e.target.value); setCurrentPage(1); }}
            className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toate locațiile</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}

        <button
          onClick={fetchLogs}
          className="ml-auto px-4 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12">#</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Data / Ora</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Locație</th>
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
              return (
                <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-500">
                    {(currentPage - 1) * itemsPerPage + idx + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {dt ? (
                      <div className="flex flex-col">
                        <span className="font-bold">{dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="text-xs text-slate-400">{dt.toLocaleDateString('ro-RO')}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {log.locationId || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                    {(log.amount || 0).toFixed(2)} RON
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
                      log.iikoSent ? (
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                          ✓ Trimis
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
                          ⚠ Netrimis
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-red-500 max-w-[150px] truncate" title={log.error || ''}>
                    {log.error || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
          <span className="text-sm font-medium text-slate-500">
            {(currentPage - 1) * itemsPerPage + 1}–{Math.min(filtered.length, currentPage * itemsPerPage)} din {filtered.length}
          </span>
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
