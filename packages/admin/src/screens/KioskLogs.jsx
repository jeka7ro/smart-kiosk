import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { Lock, Unlock, ShieldAlert, ShieldCheck, Clock, RefreshCw, Download, Search, Filter } from 'lucide-react';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const EVENT_CONFIG = {
  unlock_manager: {
    label: 'Deblocat PIN Manager',
    color: '#10b981',
    bg: '#10b98120',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />
  },
  unlock_vendor: {
    label: 'Deblocat PIN Vânzător',
    color: '#3b82f6',
    bg: '#3b82f620',
    icon: <Unlock className="w-4 h-4 text-blue-500" />
  },
  unlock_failed: {
    label: 'Tentativă PIN Eșuată',
    color: '#ef4444',
    bg: '#ef444420',
    icon: <ShieldAlert className="w-4 h-4 text-red-500" />
  },
  auto_unlock: {
    label: 'Deblocat Automat (Orar)',
    color: '#06b6d4',
    bg: '#06b6d420',
    icon: <Clock className="w-4 h-4 text-cyan-500" />
  },
  auto_lock: {
    label: 'Blocat Automat (Orar)',
    color: '#f59e0b',
    bg: '#f59e0b20',
    icon: <Lock className="w-4 h-4 text-amber-500" />
  }
};

export default function KioskLogs() {
  const { fetchWithAuth } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [locFilter, setLocFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const socketRef = useRef(null);

  const fetchLogs = async () => {
    setRefreshing(true);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/kiosk-logs?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('[KioskLogs] Fetch failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Live Socket connection
  useEffect(() => {
    const socket = io(BACKEND, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { role: 'admin' });
    });

    socket.on('kiosk_log_new', (newLog) => {
      setLogs(prev => [newLog, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  // Unique locations for filter
  const uniqueLocations = useMemo(() => {
    const map = new Map();
    logs.forEach(l => {
      const id = l.location_id || l.locationId;
      const name = l.location_name || l.locationName || id;
      if (id && !map.has(id)) {
        map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const locId = log.location_id || log.locationId;
      const locName = log.location_name || log.locationName || '';
      const evType = log.event_type || log.eventType;
      const role = log.role || '';
      const details = JSON.stringify(log.details || '');

      if (locFilter !== 'all' && locId !== locFilter) return false;
      if (eventFilter !== 'all' && evType !== eventFilter) return false;

      // Period filter
      if (periodFilter !== 'all') {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        if (periodFilter === 'today') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (periodFilter === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          if (logDate.toDateString() !== yesterday.toDateString()) return false;
        } else if (periodFilter === 'thisWeek') {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          if (logDate < startOfWeek) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = locName.toLowerCase().includes(q) ||
                      locId.toLowerCase().includes(q) ||
                      role.toLowerCase().includes(q) ||
                      details.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [logs, locFilter, eventFilter, periodFilter, searchQuery]);

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const handleExport = () => {
    const exportData = filteredLogs.map((l, index) => {
      const cfg = EVENT_CONFIG[l.event_type || l.eventType] || { label: l.event_type || l.eventType };
      return {
        'Nr. Crt.': index + 1,
        'Data & Ora': new Date(l.timestamp).toLocaleString('ro-RO'),
        'Locație ID': l.location_id || l.locationId,
        'Locație Nume': l.location_name || l.locationName,
        'Kiosk ID': l.kiosk_id || l.kioskId || '-',
        'Eveniment': cfg.label,
        'Rol Inițiator': l.role || '-',
        'Detalii': l.details?.reason || l.details?.schedule || JSON.stringify(l.details || {})
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Loguri Kiosk');
    XLSX.writeFile(wb, `Loguri_Kiosk_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header Cards / Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Evenimente</span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {logs.length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Deblocări Reușite</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {logs.filter(l => (l.event_type || l.eventType) === 'unlock_manager' || (l.event_type || l.eventType) === 'unlock_vendor').length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">Deblocări Orare</span>
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-900/30">
              <Unlock className="w-4 h-4 text-cyan-500" />
            </div>
          </div>
          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
            {logs.filter(l => (l.event_type || l.eventType) === 'auto_unlock').length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">PIN-uri Incorecte</span>
            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-900/30">
              <ShieldAlert className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400">
            {logs.filter(l => (l.event_type || l.eventType) === 'unlock_failed').length}
          </div>
        </div>
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Caută în loguri..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Location Filter */}
          <select
            value={locFilter}
            onChange={e => { setLocFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">Toate Locațiile</option>
            {uniqueLocations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          {/* Event Filter */}
          <select
            value={eventFilter}
            onChange={e => { setEventFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">Toate Evenimentele</option>
            <option value="unlock_manager">Deblocat PIN Manager</option>
            <option value="unlock_vendor">Deblocat PIN Vânzător</option>
            <option value="unlock_failed">Tentative Eșuate (Cod Greșit)</option>
            <option value="auto_unlock">Deblocat Automat la Oră</option>
            <option value="auto_lock">Blocat Automat la Oră</option>
          </select>

          {/* Period Filter */}
          <select
            value={periodFilter}
            onChange={e => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">Toată perioada</option>
            <option value="today">Azi</option>
            <option value="yesterday">Ieri</option>
            <option value="thisWeek">Săptămâna aceasta</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={refreshing}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span>Reîmprospătează</span>
          </button>

          <button
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Înregistrări găsite: <span className="text-blue-600 dark:text-blue-400 font-black">{filteredLogs.length}</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Rânduri pe pagină:</span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Se încarcă logurile...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Niciun eveniment înregistrat pentru filtrele selectate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Data & Ora</th>
                  <th className="py-3 px-4">Locație</th>
                  <th className="py-3 px-4">Eveniment</th>
                  <th className="py-3 px-4">Inițiator / Rol</th>
                  <th className="py-3 px-4">Detalii Orar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedLogs.map((l, index) => {
                  const evType = l.event_type || l.eventType;
                  const cfg = EVENT_CONFIG[evType] || {
                    label: evType,
                    color: '#64748b',
                    bg: '#64748b20',
                    icon: <Clock className="w-4 h-4 text-slate-500" />
                  };

                  const rowIndex = (currentPage - 1) * itemsPerPage + index + 1;
                  const dateFormatted = new Date(l.timestamp).toLocaleString('ro-RO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <tr key={l.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {rowIndex}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {dateFormatted}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div>{l.location_name || l.locationName || l.location_id}</div>
                        {l.location_id && (
                          <div className="text-[10px] text-slate-400 font-mono">{l.location_id}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}
                        >
                          {cfg.icon}
                          <span>{cfg.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                          {l.role === 'manager' ? 'Manager' : l.role === 'vendor' ? 'Vânzător' : l.role === 'system' ? 'Sistem Automat' : l.role || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {l.details?.reason || l.details?.schedule || (l.details?.isScheduleLock ? 'Orar Kiosk' : 'Comandă / Administrare')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Pagina {currentPage} din {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 text-xs font-bold rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Următor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
