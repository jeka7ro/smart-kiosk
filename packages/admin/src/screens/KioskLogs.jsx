import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { Lock, Unlock, ShieldAlert, ShieldCheck, Clock, RefreshCw, Download, Search, KeyRound } from 'lucide-react';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import BrandLogo from '../components/BrandLogo.jsx';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const BRAND_COLORS = {
  smashme: '#ef4444',
  crunch: '#eab308',
  rollmaster: '#3b82f6',
  lovesushi: '#ec4899',
  pokiwoki: '#f97316',
  sushimaster: '#e31e24',
  ikura: '#8b5cf6'
};

const BRAND_NAMES = {
  smashme: 'SmashMe',
  crunch: 'Crunch',
  rollmaster: 'Roll Master',
  lovesushi: 'Love Sushi',
  pokiwoki: 'Poki-Woki',
  sushimaster: 'Sushi Master',
  ikura: 'Ikura'
};

const EVENT_CONFIG = {
  unlock_manager: {
    label: 'Deblocat PIN Manager',
    color: '#10b981',
    bg: '#10b98118',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
  },
  unlock_vendor: {
    label: 'Deblocat PIN Vânzător',
    color: '#3b82f6',
    bg: '#3b82f618',
    icon: <Unlock className="w-4 h-4 text-blue-500 shrink-0" />
  },
  unlock_failed: {
    label: 'PIN Incorect',
    color: '#ef4444',
    bg: '#ef444418',
    icon: <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
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
    color: '#f43f5e',
    bg: '#f43f5e18',
    icon: <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
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
      else if (combined.includes('roll') || combined.includes('master')) brand = 'rollmaster';
      else if (combined.includes('love') || combined.includes('sushi')) brand = 'lovesushi';
      else if (combined.includes('poki')) brand = 'pokiwoki';
      else if (combined.includes('ikura')) brand = 'ikura';
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
          color="#10b981"
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

      {/* ─── CONTROLS & BARA DE FILTRE (Standard Admin / PosLogs) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Filter buttons & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'Toate' },
            { id: 'unlock_manager', label: '✓ PIN Manager' },
            { id: 'unlock_vendor', label: '✓ PIN Vânzător' },
            { id: 'auto_unlock', label: '⏱ Deblocat Orar' },
            { id: 'unlock_failed', label: '✕ PIN Incorect' }
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

          {/* Period Filter Dropdown */}
          <select
            value={periodFilter}
            onChange={e => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
            className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Azi</option>
            <option value="yesterday">Ieri</option>
            <option value="this_week">Săptămâna curentă</option>
            <option value="this_month">Luna curentă</option>
            <option value="last_month">Luna trecută</option>
            <option value="this_year">Anul curent</option>
            <option value="all">Toată perioada</option>
            <option value="custom">Personalizat</option>
          </select>

          {periodFilter === 'custom' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customStart}
                onChange={e => { setCustomStart(e.target.value); setCurrentPage(1); }}
                className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => { setCustomEnd(e.target.value); setCurrentPage(1); }}
                className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {uniqueLocations.length > 0 && (
            <select
              value={locFilter}
              onChange={e => { setLocFilter(e.target.value); setCurrentPage(1); }}
              className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toate locațiile</option>
              {uniqueLocations.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}

          {uniqueBrands.length > 0 && (
            <select
              value={brandFilter}
              onChange={e => { setBrandFilter(e.target.value); setCurrentPage(1); }}
              className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 capitalize"
            >
              <option value="all">Toate brandurile</option>
              {uniqueBrands.map(b => (
                <option key={b} value={b}>{BRAND_NAMES[b] || b}</option>
              ))}
            </select>
          )}

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Caută în loguri..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="h-9 pl-9 pr-4 rounded-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Action Buttons: Export Excel (VERDE / EMERALD) & Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-4 h-9 rounded-full bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold transition-colors flex items-center gap-2 border border-emerald-200 dark:border-emerald-800/40"
            title="Exportă în Excel"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={refreshing}
            className="px-4 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors flex items-center gap-2"
            title="Reîmprospătează lista"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── TABEL EVENIMENTE (Cu Brand Avatar & Typography curată, FĂRĂ font-mono) ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
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
                  {/* Nr. Crt. FĂRĂ font-mono */}
                  <td className="px-4 py-3 text-center text-sm font-medium text-slate-400">
                    {rowIndex}
                  </td>

                  {/* Data / Ora FĂRĂ font-mono */}
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

                  {/* Brand & Locație cu BRAND AVATAR 3D */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* 3D Raised Bezel Brand Avatar */}
                      <div className="relative shrink-0">
                        <div
                          className="absolute -inset-0.5 rounded-full blur-[2px] opacity-40 pointer-events-none"
                          style={{ backgroundColor: brandColor }}
                        />
                        <div
                          className="relative w-8 h-8 rounded-full p-0.5 flex items-center justify-center bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 border border-white/80 dark:border-slate-600/60"
                          style={{
                            boxShadow: `0 2px 6px ${brandColor}35, inset 0 1px 1.5px rgba(255,255,255,0.8)`
                          }}
                        >
                          <BrandLogo brandId={brand} size={20} className="rounded-full" />
                        </div>
                      </div>

                      {/* Nume Curat Brand & Locatie FARA ID tehnice */}
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">
                          {BRAND_NAMES[brand] || brand}
                        </span>
                        <span className="px-2 py-0.5 mt-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
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

// ─── EXACT STATCARD COMPONENT FROM POSLOGS / DASHBOARD ───
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
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title={label}>
          {label}
        </span>
      </div>

      {brandId ? (
        <div className="relative shrink-0 ml-2">
          <div
            className="absolute -inset-1 rounded-full blur-sm opacity-35 group-hover:opacity-75 transition-opacity pointer-events-none"
            style={{ backgroundColor: color }}
          />
          <div
            className="relative w-9 h-9 rounded-full p-0.5 flex items-center justify-center bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 border border-white/80 dark:border-slate-600/60 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
            style={{
              boxShadow: `0 3px 8px ${color}40, 0 1px 2px rgba(0,0,0,0.1), inset 0 1.5px 2px rgba(255,255,255,0.85)`
            }}
          >
            <BrandLogo brandId={brandId} size={24} className="rounded-full shadow-inner" />
          </div>
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
