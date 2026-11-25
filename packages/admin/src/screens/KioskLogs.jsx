import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { Lock, Unlock, ShieldAlert, ShieldCheck, Clock, RefreshCw, Download, Search, KeyRound } from 'lucide-react';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { ALL_BRAND_COLORS as BRAND_COLORS, ALL_BRAND_LABELS as BRAND_NAMES, getBrandColor, getBrandLabel } from '../utils/brandTheme';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';

const EVENT_CONFIG = {
  unlock_manager: {
    label: 'Deblocat PIN Manager',
    color: '#ffffff',
    bg: '#059669',
    icon: <ShieldCheck className="w-4 h-4 text-white shrink-0" />
  },
  unlock_vendor: {
    label: 'Deblocat PIN Vânzător',
    color: '#3b82f6',
    bg: '#3b82f618',
    icon: <Unlock className="w-4 h-4 text-blue-500 shrink-0" />
  },
  unlock_failed: {
    label: 'PIN Incorect',
    color: '#ffffff',
    bg: '#dc2626',
    icon: <ShieldAlert className="w-4 h-4 text-white shrink-0" />
  },
  auto_unlock: {
    label: 'Deblocare Automată Orar',
    color: '#06b6d4',
    bg: '#06b6d418',
    icon: <Clock className="w-4 h-4 text-cyan-500 shrink-0" />
  },
  auto_lock: {
    label: 'Blocare Automată Orar',
    color: '#f59e0b',
    bg: '#f59e0b18',
    icon: <Lock className="w-4 h-4 text-amber-500 shrink-0" />
  },
  manager_portal_access: {
    label: 'Acces Portal Manager',
    color: '#6366f1',
    bg: '#6366f118',
    icon: <KeyRound className="w-4 h-4 text-indigo-500 shrink-0" />
  },
  manager_portal_failed: {
    label: 'PIN Incorect Portal',
    color: '#ffffff',
    bg: '#dc2626',
    icon: <ShieldAlert className="w-4 h-4 text-white shrink-0" />
  }
};

export default function KioskLogs() {
  const { fetchWithAuth } = useAuth();
  const [logs, setLogs] = useState([]);
  const [locationsList, setLocationsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters matching PosLogs / Dashboard standard
  const [filter, setFilter] = useState('all');
  const [locFilter, setLocFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const socketRef = useRef(null);

  // Fetch logs
  const fetchLogs = async () => {
    setRefreshing(true);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/kiosk-logs?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('[KioskLogs] Fetch logs error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch locations for proper name and brand matching
  const fetchLocations = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/locations`);
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (data.locations || []);
        setLocationsList(arr);
      }
    } catch (e) {
      console.error('[KioskLogs] Fetch locations error:', e);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchLocations();
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

  // Helper to detect brand and clean location name
  const resolveLocationInfo = (log) => {
    const locId = log.location_id || log.locationId || '';
    const locNameRaw = log.location_name || log.locationName || '';

    const matched = locationsList.find(loc =>
      (loc.id && loc.id === locId) ||
      (loc.kioskUrl && loc.kioskUrl === locId) ||
      (loc.name && loc.name === locNameRaw)
    );

    let brand = 'smashme';
    if (matched?.brands?.[0]) {
      brand = matched.brands[0];
    } else if (matched?.brand) {
      brand = matched.brand;
    } else {
      const combined = `${locNameRaw} ${locId}`.toLowerCase();
      if (combined.includes('smash')) brand = 'smashme';
      else if (combined.includes('crunch')) brand = 'crunch';
      else if (combined.includes('roll') || combined.includes('master') || combined.includes('sushi') || combined.includes('ikura')) brand = 'rollmaster';
      else if (combined.includes('love')) brand = 'lovesushi';
      else if (combined.includes('poki')) brand = 'pokiwoki';
    }

    let cleanName = locNameRaw;
    if (!cleanName || cleanName === 'smashme-main' || cleanName.length > 30 && cleanName.includes('-')) {
      cleanName = matched?.name || 'Kiosk Central';
    }

    return { brand, cleanName, brandColor: BRAND_COLORS[brand] || '#ef4444' };
  };

  // Date in Period matching PosLogs & App.jsx standard
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
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
    }
    if (period === 'this_year') return d.getFullYear() === now.getFullYear();
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

  // Period, Location & Brand filtered logs (for StatCards)
  const periodFilteredLogs = useMemo(() => {
    return logs.filter(log => {
      const { brand, cleanName } = resolveLocationInfo(log);
      const locId = log.location_id || log.locationId;

      if (locFilter !== 'all' && locId !== locFilter && cleanName !== locFilter) return false;
      if (brandFilter !== 'all' && brand !== brandFilter) return false;
      if (!isDateInPeriod(log.timestamp, periodFilter)) return false;
      return true;
    });
  }, [logs, locFilter, brandFilter, periodFilter, customStart, customEnd, locationsList]);

  // Derived Stats strictly reflecting the period
  const derivedStats = useMemo(() => {
    return {
      total: periodFilteredLogs.length,
      manager: periodFilteredLogs.filter(l => (l.event_type || l.eventType) === 'unlock_manager').length,
      vendor: periodFilteredLogs.filter(l => (l.event_type || l.eventType) === 'unlock_vendor').length,
      autoUnlock: periodFilteredLogs.filter(l => (l.event_type || l.eventType) === 'auto_unlock').length,
      failed: periodFilteredLogs.filter(l => (l.event_type || l.eventType) === 'unlock_failed' || (l.event_type || l.eventType) === 'manager_portal_failed').length
    };
  }, [periodFilteredLogs]);

  // Table filtering adds status filter & search query
  const filteredLogs = useMemo(() => {
    return periodFilteredLogs.filter(log => {
      const evType = log.event_type || log.eventType;
      if (filter !== 'all') {
        if (filter === 'unlock_failed') {
          if (evType !== 'unlock_failed' && evType !== 'manager_portal_failed') return false;
        } else if (evType !== filter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const { cleanName, brand } = resolveLocationInfo(log);
        const role = log.role || '';
        const detailsStr = JSON.stringify(log.details || '');
        const evLabel = EVENT_CONFIG[evType]?.label || evType;

        if (
          !cleanName.toLowerCase().includes(q) &&
          !brand.toLowerCase().includes(q) &&
          !role.toLowerCase().includes(q) &&
          !detailsStr.toLowerCase().includes(q) &&
          !evLabel.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [periodFilteredLogs, filter, searchQuery]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Unique locations and brands for dropdowns
  const uniqueLocations = useMemo(() => {
    const set = new Set();
    locationsList.forEach(loc => {
      if (loc.name) set.add(loc.name);
    });
    logs.forEach(l => {
      const { cleanName } = resolveLocationInfo(l);
      if (cleanName) set.add(cleanName);
    });
    return Array.from(set);
  }, [locationsList, logs]);

  const uniqueBrands = useMemo(() => {
    return ['smashme', 'crunch', 'rollmaster', 'lovesushi', 'pokiwoki'];
  }, []);

  // Export to Excel handler
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) return;

    const exportData = filteredLogs.map((l, i) => {
      const { brand, cleanName } = resolveLocationInfo(l);
      const evType = l.event_type || l.eventType;
      const evLabel = EVENT_CONFIG[evType]?.label || evType;
      const dt = l.timestamp ? new Date(l.timestamp) : null;

      return {
        'Nr. Crt.': i + 1,
        'Data / Ora': dt ? dt.toLocaleString('ro-RO') : '',
        'Brand': BRAND_NAMES[brand] || brand,
        'Locație': cleanName,
        'Eveniment': evLabel,
        'Rol': l.role === 'manager' ? 'Manager' : l.role === 'vendor' ? 'Vânzător' : l.role || 'Sistem',
        'Detalii': l.details?.schedule || l.details?.reason || (typeof l.details === 'object' ? JSON.stringify(l.details) : String(l.details || ''))
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Loguri Kiosk');
    XLSX.writeFile(wb, `Loguri_Kiosk_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const periodLabel =
    periodFilter === 'today' ? 'Total Kiosk Azi' :
    periodFilter === 'yesterday' ? 'Total Kiosk Ieri' :
    periodFilter === 'this_week' ? 'Total Kiosk Săpt.' :
    periodFilter === 'this_month' ? 'Total Kiosk Lună' :
    periodFilter === 'last_month' ? 'Total Kiosk Luna Trec.' :
    periodFilter === 'this_year' ? 'Total Kiosk An' :
    'Total Evenimente';

  return (
    <div className="space-y-6">
      {/* ─── STAT CARDS (Identic cu PosLogs / IikoLogs / App.jsx) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label={periodLabel}
          value={derivedStats.total}
          color="#6366f1"
          icon={Clock}
          onClick={() => { setFilter('all'); setCurrentPage(1); }}
          active={filter === 'all'}
        />
        <StatCard
          label="Deblocat Manager"
          value={derivedStats.manager}
          color="#059669"
          icon={ShieldCheck}
          onClick={() => { setFilter(filter === 'unlock_manager' ? 'all' : 'unlock_manager'); setCurrentPage(1); }}
          active={filter === 'unlock_manager'}
        />
        <StatCard
          label="Deblocat Vânzător"
          value={derivedStats.vendor}
          color="#3b82f6"
          icon={Unlock}
          onClick={() => { setFilter(filter === 'unlock_vendor' ? 'all' : 'unlock_vendor'); setCurrentPage(1); }}
          active={filter === 'unlock_vendor'}
        />
        <StatCard
          label="Deblocare Orar"
          value={derivedStats.autoUnlock}
          color="#06b6d4"
          icon={Clock}
          onClick={() => { setFilter(filter === 'auto_unlock' ? 'all' : 'auto_unlock'); setCurrentPage(1); }}
          active={filter === 'auto_unlock'}
        />
        <StatCard
          label="PIN-uri Incorecte"
          value={derivedStats.failed}
          color="#ef4444"
          icon={ShieldAlert}
          onClick={() => { setFilter(filter === 'unlock_failed' ? 'all' : 'unlock_failed'); setCurrentPage(1); }}
          active={filter === 'unlock_failed'}
          highlight={derivedStats.failed > 0}
        />
      </div>

      {/* ─── CONTROLS & BARA DE FILTRE — STRICTLY 1 ROW Apple Capsule Toolbar ─── */}
      <div className={`apple-card p-2 ${periodFilter === 'custom' ? '!rounded-[22px]' : '!rounded-full'}`}>
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none w-full min-w-0">
          <div className="apple-segmented shrink-0">
            {[
              { id: 'all', label: 'Toate' },
              { id: 'unlock_manager', label: 'Manager' },
              { id: 'unlock_vendor', label: 'Vânzător' },
              { id: 'auto_unlock', label: 'Orar' },
              { id: 'unlock_failed', label: 'Incorect' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setFilter(f.id); setCurrentPage(1); }}
                className={`apple-segmented-item ${filter === f.id ? 'is-active' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            value={periodFilter}
            onChange={e => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
            className="apple-input shrink-0 h-8 px-2.5 text-[12px] font-medium cursor-pointer"
          >
            <option value="today">Azi</option>
            <option value="yesterday">Ieri</option>
            <option value="this_week">Săptămâna curentă</option>
            <option value="this_month">Luna curentă</option>
            <option value="last_month">Luna trecută</option>
            <option value="this_year">Anul curent</option>
            <option value="all">Toată perioada</option>
            <option value="custom">Interval...</option>
          </select>

          {uniqueLocations.length > 0 && (
            <select
              value={locFilter}
              onChange={e => { setLocFilter(e.target.value); setCurrentPage(1); }}
              className="apple-input shrink-0 h-8 px-2.5 text-[12px] font-medium cursor-pointer"
            >
              <option value="all">Toate locațiile</option>
              {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}

          {uniqueBrands.length > 0 && (
            <select
              value={brandFilter}
              onChange={e => { setBrandFilter(e.target.value); setCurrentPage(1); }}
              className="apple-input shrink-0 h-8 px-2.5 text-[12px] font-medium capitalize cursor-pointer"
            >
              <option value="all">Toate brandurile</option>
              {uniqueBrands.map(b => <option key={b} value={b}>{BRAND_NAMES[b] || b}</option>)}
            </select>
          )}

          <div className="relative flex-1 min-w-[125px]">
            <input
              type="text"
              placeholder="Caută în loguri..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="apple-input h-8 pl-8 pr-3 text-[12px] w-full"
            />
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button type="button" onClick={handleExportExcel} className="apple-btn-secondary shrink-0 h-8 px-3 text-[12px] flex items-center gap-1.5" title="Exportă în Excel">
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>

        {periodFilter === 'custom' && (
          <div className="mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2 flex-wrap">
            <input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setCurrentPage(1); }} className="apple-input h-8 px-2.5 text-[12px] tabular-nums" />
            <span className="text-[#86868B] text-xs">—</span>
            <input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setCurrentPage(1); }} className="apple-input h-8 px-2.5 text-[12px] tabular-nums" />
          </div>
        )}
      </div>

      {/* ─── TABEL EVENIMENTE (Cu Brand Avatar & Typography curată, FĂRĂ tabular-nums) ─── */}
      <div className="apple-card overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12 text-center">
                Nr. Crt.
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Data / Ora
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Brand & Locație
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Eveniment
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Inițiator / Rol
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Detalii Orar
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                  Se încarcă logurile de securitate...
                </td>
              </tr>
            ) : paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                  Niciun eveniment înregistrat pentru filtrele selectate.
                </td>
              </tr>
            ) : paginatedLogs.map((log, idx) => {
              const { brand, cleanName, brandColor } = resolveLocationInfo(log);
              const evType = log.event_type || log.eventType;
              const cfg = EVENT_CONFIG[evType] || {
                label: evType || 'Eveniment',
                color: '#64748b',
                bg: '#64748b18',
                icon: <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              };

              const dt = log.timestamp ? new Date(log.timestamp) : null;
              const rowIndex = (currentPage - 1) * itemsPerPage + idx + 1;

              const detailsStr = log.details
                ? (typeof log.details === 'object'
                    ? (log.details.schedule || log.details.reason || (log.details.isScheduleLock ? 'Orar Kiosk' : 'Comandă / Administrare'))
                    : String(log.details))
                : 'Comandă / Administrare';

              return (
                <tr
                  key={log.id || idx}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Nr. Crt. FĂRĂ tabular-nums */}
                  <td className="px-4 py-3 text-center text-sm font-medium text-slate-400">
                    {rowIndex}
                  </td>

                  {/* Data / Ora FĂRĂ tabular-nums */}
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {dt ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {dt.toLocaleDateString('ro-RO')}
                        </span>
                      </div>
                    ) : '—'}
                  </td>

                  {/* Brand & Locație */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <BrandLogo brandId={brand} size={26} className="shrink-0" />
                      <div className="flex flex-col items-start min-w-0">
                        <span style={{ color: getBrandColor(brand) }} className="text-[12px] font-semibold">
                          {getBrandLabel(brand)}
                        </span>
                        <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D]">
                          {cleanName}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Eveniment Badge */}
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </span>
                  </td>

                  {/* Rol Inițiator */}
                  <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                    {log.role === 'manager'
                      ? 'Manager'
                      : log.role === 'vendor'
                      ? 'Vânzător'
                      : log.role === 'system'
                      ? 'Sistem Automat'
                      : log.role || '—'}
                  </td>

                  {/* Detalii Orar */}
                  <td className="px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {detailsStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Pagina {currentPage} din {totalPages} (Total: {filteredLogs.length} înregistrări)
            </span>
            <div className="flex items-center gap-1">
              {[
                { label: '«', action: () => setCurrentPage(1), disabled: currentPage === 1 },
                { label: '‹', action: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1 },
                { label: '›', action: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages },
                { label: '»', action: () => setCurrentPage(totalPages), disabled: currentPage === totalPages }
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={btn.action}
                  disabled={btn.disabled}
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    btn.disabled
                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, brandId, icon: Icon, onClick, active, highlight }) {
  const isCurrency = typeof value === 'string' && value.includes('lei');
  const displayVal = isCurrency ? value.replace('lei', '').trim() : value;

  return (
    <div
      onClick={onClick}
      className={`apple-card px-4 py-3.5 flex items-center justify-between min-w-[120px] flex-1 transition-all duration-150 select-none ${
        active
          ? 'ring-2 ring-[#007AFF]'
          : highlight
          ? 'ring-1 ring-[#FF3B30]/40'
          : ''
      } ${onClick ? 'cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.03]' : ''}`}
    >
      <div className="flex flex-col justify-center min-w-0 pr-2 flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] truncate" title={label}>
          {label}
        </span>
        <div className="flex items-baseline gap-1 mt-1 whitespace-nowrap">
          <span className="text-[24px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight tabular-nums leading-none">
            {displayVal}
          </span>
          {isCurrency && (
            <span className="text-[11px] font-semibold text-[#86868B]">lei</span>
          )}
        </div>
      </div>

      {brandId ? (
        <BrandLogo brandId={brandId} size={28} className="shrink-0" />
      ) : Icon ? (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <Icon size={18} strokeWidth={2.2} />
        </div>
      ) : null}
    </div>
  );
}
