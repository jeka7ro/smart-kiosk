import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConfirm, RestartDialogIcon } from '../components/ConfirmModal.jsx';
import { io as ioClient } from 'socket.io-client';
import { 
  Server, 
  Activity, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Monitor, 
  Printer, 
  Cpu,
  Clock,
  ExternalLink,
  ShieldCheck,
  Radio,
  RotateCcw,
  Copy,
  Check,
  Terminal,
  X,
  History,
  BarChart2,
  Zap,
  ShieldAlert,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';
import SoftwareReleaseNotesModal from '../components/SoftwareReleaseNotesModal.jsx';
import { BRIDGE_RELEASE_NOTES } from '../data/bridgeReleaseNotes.js';

const UNIVERSAL_COMMAND = 'cmd /c "mkdir C:\\SmartKiosk 2>nul & cd /d C:\\SmartKiosk & curl -s -L -o setup.bat https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/setup_kiosk_autostart.bat & setup.bat"';

function formatDateTime(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('ro-RO', {
      timeZone: 'Europe/Bucharest',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (_) {
    return String(val);
  }
}

export default function BridgeMonitoring({ backend = '', socket = null, kiosksLiveStatus = {} }) {
  const [data, setData] = useState({
    locations: {},
    totalOnline: 0,
    totalOffline: 0,
    telegramConfig: {
      enabled: false,
      botTokenConfigured: false,
      botTokenMasked: '',
      chatId: '',
      alertCooldownMinutes: 10,
    },
    recentEvents: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(UNIVERSAL_COMMAND);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  const serverHost = useMemo(() => {
    if (!backend) return 'smart-kiosk-ttut.onrender.com';
    return backend.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [backend]);

  // Hardware action state
  const [actionLoading, setActionLoading] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);

  const handleCompleteUpdate = (newVersion) => {
    setData(prev => {
      if (!prev) return prev;
      const updatedLocations = { ...(prev.locations || {}) };
      Object.keys(updatedLocations).forEach(k => {
        updatedLocations[k] = {
          ...updatedLocations[k],
          bridgeVersion: newVersion,
          version: newVersion,
          latestBridgeVersion: newVersion,
          isBridgeUpToDate: true,
        };
      });
      return {
        ...prev,
        latestBridgeVersion: newVersion,
        locations: updatedLocations,
      };
    });
    setActionFeedback({
      type: 'success',
      text: `Actualizarea la v${newVersion} a fost finalizată cu succes pe toate cele 4 kiosk-uri!`,
    });
    setTimeout(() => setActionFeedback(null), 6000);
  };

  const handleAction = async (locationId, actionType) => {
    if (actionType === 'update-all-bridges') {
      setIsReleaseNotesOpen(true);
      return;
    }
    if (actionType === 'execute-update-all-bridges') {
      actionType = 'update-all-bridges';
    }
    if (actionType === 'reload-kiosk') {
      const isAll = locationId === 'all';
      const ok = await confirm(
        isAll
          ? 'Se reîncarcă ecranul TUTUROR kiosk-urilor din toate locațiile. Clienții aflați în mijlocul unei comenzi o vor pierde.'
          : 'Se reîncarcă doar ecranul kiosk-ului din această locație (POS Bridge-ul NU se repornește). Dacă un client e în mijlocul unei comenzi, o va pierde.',
        { title: isAll ? 'Refresh Ecran la TOATE kiosk-urile — ești sigur?' : 'Refresh Ecran Kiosk — ești sigur?', icon: <RestartDialogIcon />, okLabel: 'Da, reîncarcă', cancelLabel: 'Nu, renunț', danger: true }
      );
      if (!ok) return;
    }
    const key = `${locationId}-${actionType}`;
    setActionLoading(key);
    setActionFeedback(null);

    // Optimistic UI for POS Signal test
    if (actionType === 'test-pos-signal') {
      setData(prev => {
        const locs = { ...(prev?.locations || {}) };
        if (locs[locationId]) {
          locs[locationId] = {
            ...locs[locationId],
            posSignal: { testing: true, message: 'Se testează semnalul UART...' }
          };
        }
        return { ...prev, locations: locs };
      });
    }

    try {
      const endpoint = actionType === 'update-all-bridges'
        ? `${backend}/api/bridge-monitoring/update-all-bridges`
        : locationId === 'all' && actionType === 'reload-kiosk'
        ? `${backend}/api/bridge-monitoring/reload-all-kiosks`
        : `${backend}/api/bridge-monitoring/${locationId}/${actionType}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-live-2024-secure',
        },
      }).catch(() => null);

      const json = res ? await res.json().catch(() => ({})) : {};
      if (res && res.ok) {
        setActionFeedback({ type: 'success', text: json.message || 'Comandă transmisă cu succes.' });
      } else {
        setActionFeedback({ type: 'error', text: json.error || 'Eroare la transmiterea comenzii.' });
      }

      // Schedule aggressive status re-fetches for instant badge update
      if (actionType === 'test-pos-signal' || actionType === 'restart-bridge' || actionType === 'update-all-bridges') {
        setTimeout(fetchStatus, 1500);
        setTimeout(fetchStatus, 3500);
        setTimeout(fetchStatus, 6000);
        setTimeout(fetchStatus, 10000);
        if (signalModalLoc && signalModalLoc.locKey === locationId) {
          setTimeout(() => fetchSignalLogs(locationId), 1500);
          setTimeout(() => fetchSignalLogs(locationId), 3000);
        }
      }
    } catch (err) {
      setActionFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleToggleWake = async (locKey, currentStatus, currentMinutes) => {
    const nextStatus = !currentStatus;
    setData(prev => {
      const locs = { ...(prev?.locations || {}) };
      if (locs[locKey]) {
        locs[locKey] = {
          ...locs[locKey],
          posWakeStandby: nextStatus,
        };
      }
      return { ...prev, locations: locs };
    });
    try {
      await fetch(`${backend}/api/bridge-monitoring/${locKey}/set-wake-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk-live-2024-secure' },
        body: JSON.stringify({ posWakeStandby: nextStatus, posWakeIntervalMinutes: currentMinutes || 5 }),
      });
      setActionFeedback({ type: 'success', text: `Trezire Standby ${nextStatus ? 'activată' : 'dezactivată'} pentru ${locKey}!` });
      setTimeout(() => setActionFeedback(null), 2500);
      setTimeout(fetchStatus, 1000);
    } catch (_) {}
  };

  // ───────── Restart POS Bridge: confirmare + progres + jurnal ─────────
  const confirm = useConfirm();
  const apiBase = backend || 'https://smart-kiosk-ttut.onrender.com';
  const apiHeaders = { 'Content-Type': 'application/json', 'x-api-key': 'sk-live-2024-secure' };
  const [restartProgress, setRestartProgress] = useState({}); // locKey -> { requestId, startedAt, status, detail, ... }
  const [restartLogs, setRestartLogs] = useState([]);
  const [restartLogFilter, setRestartLogFilter] = useState('all');
  const [restartLogLimit, setRestartLogLimit] = useState(15);
  const [restartLogLoaded, setRestartLogLoaded] = useState(false);
  const restartPollers = useRef({});

  const fetchRestartLog = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/bridge-monitoring/restart-log?limit=200`, { headers: apiHeaders });
      if (!res.ok) return;
      const json = await res.json();
      setRestartLogs(Array.isArray(json.logs) ? json.logs : []);
      setRestartLogLoaded(true);
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  useEffect(() => {
    fetchRestartLog();
    const t = setInterval(fetchRestartLog, 30000);
    const pollers = restartPollers.current;
    return () => {
      clearInterval(t);
      Object.values(pollers).forEach(clearInterval);
    };
  }, [fetchRestartLog]);

  const trackRestart = (locKey, requestId) => {
    if (restartPollers.current[locKey]) clearInterval(restartPollers.current[locKey]);
    const startedAt = Date.now();
    setRestartProgress(prev => ({
      ...prev,
      [locKey]: { requestId, startedAt, status: 'pending', detail: 'Comandă trimisă. Aștept revenirea bridge-ului...' },
    }));
    const poll = async () => {
      try {
        const res = await fetch(`${apiBase}/api/bridge-monitoring/restart-requests/${requestId}`, { headers: apiHeaders });
        if (res.status === 404) {
          // serverul a repornit între timp — nu mai putem urmări
          clearInterval(restartPollers.current[locKey]);
          delete restartPollers.current[locKey];
          setRestartProgress(prev => ({ ...prev, [locKey]: { ...prev[locKey], status: 'unknown', detail: 'Nu mai pot urmări restartul (serverul a repornit). Verifică starea bridge-ului mai jos.' } }));
          return;
        }
        if (!res.ok) return;
        const entry = await res.json();
        if (entry.status !== 'pending') {
          clearInterval(restartPollers.current[locKey]);
          delete restartPollers.current[locKey];
          setRestartProgress(prev => ({
            ...prev,
            [locKey]: { ...prev[locKey], status: entry.status, detail: entry.detail, finishedAt: Date.now(), uptimeAfter: entry.uptimeAfter },
          }));
          fetchStatus();
          fetchRestartLog();
          // mesajul de final dispare singur după 20s dacă a reușit
          if (entry.status === 'completed') {
            setTimeout(() => {
              setRestartProgress(prev => {
                if (prev[locKey]?.requestId !== requestId) return prev;
                const next = { ...prev };
                delete next[locKey];
                return next;
              });
            }, 20000);
          }
        }
      } catch (_) {}
    };
    restartPollers.current[locKey] = setInterval(poll, 3000);
  };

  // Rezervă: dacă serverul e încă vechi (nu returnează requestId), urmărim restartul după starea bridge-ului:
  // bridge-ul se consideră repornit când uptime-ul lui scade (proces nou) sau dispare și reapare online.
  const trackRestartByStatus = (locKey, uptimeBefore) => {
    if (restartPollers.current[locKey]) clearInterval(restartPollers.current[locKey]);
    const startedAt = Date.now();
    const token = `local-${startedAt}`;
    let sawOffline = false;
    setRestartProgress(prev => ({
      ...prev,
      [locKey]: { requestId: token, startedAt, status: 'pending', detail: 'Comandă trimisă. Aștept revenirea bridge-ului...' },
    }));
    const finish = (status, detail) => {
      clearInterval(restartPollers.current[locKey]);
      delete restartPollers.current[locKey];
      setRestartProgress(prev => ({ ...prev, [locKey]: { ...prev[locKey], status, detail, finishedAt: Date.now() } }));
      fetchStatus();
      if (status === 'completed') {
        setTimeout(() => {
          setRestartProgress(prev => {
            if (prev[locKey]?.requestId !== token) return prev;
            const next = { ...prev };
            delete next[locKey];
            return next;
          });
        }, 20000);
      }
    };
    const poll = async () => {
      if (Date.now() - startedAt > 180000) {
        finish('timeout', 'Bridge-ul NU a revenit în 3 minute. Verifică PC-ul din locație (pornit? internet? start-windows.bat rulează?).');
        return;
      }
      try {
        const res = await fetch('https://smart-kiosk-ttut.onrender.com/api/bridge-monitoring/status', { headers: apiHeaders });
        if (!res.ok) return;
        const json = await res.json();
        const l = json?.locations?.[locKey];
        if (!l) return;
        if (!l.isBridgeOnline) { sawOffline = true; return; }
        const up = typeof l.uptimeSeconds === 'number' ? l.uptimeSeconds : null;
        const resetDetected = up !== null && typeof uptimeBefore === 'number' && up < uptimeBefore - 5;
        if (sawOffline || resetDetected) {
          finish('completed', `Bridge repornit și reconectat (uptime nou: ${up !== null ? Math.round(up) + 's' : '—'}).`);
        }
      } catch (_) {}
    };
    restartPollers.current[locKey] = setInterval(poll, 3000);
  };

  const handleRestartBridge = async (locKey, displayName, isBridgeOnlineNow) => {
    if (restartProgress[locKey]?.status === 'pending') return;

    if (!isBridgeOnlineNow) {
      setActionFeedback({ type: 'error', text: `Bridge-ul ${displayName} este OFFLINE — comanda de restart nu are cum să ajungă. Verifică dacă PC-ul din locație e pornit și are internet.` });
      setTimeout(() => setActionFeedback(null), 8000);
      return;
    }

    const ok = await confirm(
      <div className="text-left space-y-2 text-sm">
        <p>Vrei să repornești <b>POS Bridge</b> la <b>{displayName}</b>?</p>
        <ul className="list-disc pl-5 space-y-1 text-xs opacity-90">
          <li>Bridge-ul va fi oprit aproximativ <b>1–2 minute</b>.</li>
          <li>În acest timp <b>nu se pot face plăți cu cardul</b> și nu se tipărește bonul.</li>
          <li><b>Nu reporni dacă un client plătește chiar acum.</b></li>
        </ul>
      </div>,
      { title: `Restart POS Bridge — ${displayName}`, icon: <RestartDialogIcon />, okLabel: 'Da, repornește', cancelLabel: 'Nu, renunț', danger: true }
    );
    if (!ok) return;

    const key = `${locKey}-restart-bridge`;
    setActionLoading(key);
    try {
      const res = await fetch(`${apiBase}/api/bridge-monitoring/${locKey}/restart-bridge`, { method: 'POST', headers: apiHeaders }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      if (res && res.ok && json.requestId) {
        trackRestart(locKey, json.requestId);
      } else if (res && res.ok) {
        // Server vechi: comanda a plecat, dar fără requestId — urmărim după starea bridge-ului
        trackRestartByStatus(locKey, data?.locations?.[locKey]?.uptimeSeconds);
      } else {
        setActionFeedback({ type: 'error', text: json.error || 'Nu am putut trimite comanda de restart (fără răspuns de la server).' });
        setTimeout(() => setActionFeedback(null), 8000);
        fetchRestartLog();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveDuplicate = async (locKey, displayName) => {
    const ok = await confirm(
      <div className="text-left space-y-2 text-sm">
        <p>Vrei să forțezi oprirea instanțelor duplicat/fantomă la <b>{displayName}</b>?</p>
        <ul className="list-disc pl-5 space-y-1 text-xs opacity-90">
          <li>Serverul va comanda oprirea imediată a oricărui proces clonă care rulează în fundal.</li>
          <li>Instanța principală care ține portul POS și imprimanta va rămâne <b>activă și protejată</b>.</li>
          <li>Fereastra duplicat de pe PC se va închide automat definitiv.</li>
        </ul>
      </div>,
      {
        title: `Oprire Instanțe Duplicat — ${displayName}`,
        icon: <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
        okLabel: 'Da, oprește duplicat',
        cancelLabel: 'Nu, renunț',
        danger: true,
      }
    );
    if (!ok) return;

    const key = `${locKey}-resolve-duplicate`;
    setActionLoading(key);
    try {
      const res = await fetch(`${apiBase}/api/bridge-monitoring/${locKey}/resolve-duplicate`, {
        method: 'POST',
        headers: apiHeaders,
      }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      if (res && res.ok) {
        setActionFeedback({ type: 'success', text: json.message || `Instanțele duplicat au fost oprite pentru ${displayName}!` });
        setTimeout(fetchStatus, 1000);
        setTimeout(fetchStatus, 3000);
      } else {
        setActionFeedback({ type: 'error', text: json.error || 'Eroare la transmiterea comenzii de oprire duplicat.' });
      }
    } catch (err) {
      setActionFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionFeedback(null), 6000);
    }
  };

  // POS Signal History Modal state
  const [signalModalLoc, setSignalModalLoc] = useState(null);
  const [signalLogs, setSignalLogs] = useState([]);
  const [loadingSignalLogs, setLoadingSignalLogs] = useState(false);

  const fetchSignalLogs = useCallback(async (locKey) => {
    if (!locKey) return;
    setLoadingSignalLogs(true);
    try {
      const serverUrl = backend || 'https://smart-kiosk-ttut.onrender.com';
      const res = await fetch(`${serverUrl}/api/bridge-monitoring/${locKey}/signal-logs?limit=40`, {
        headers: { 'x-api-key': 'sk-live-2024-secure' }
      }).catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        setSignalLogs(json.logs || []);
      } else {
        setSignalLogs([]);
      }
    } catch (_) {
      setSignalLogs([]);
    } finally {
      setLoadingSignalLogs(false);
    }
  }, [backend]);

  const openSignalHistory = (locKey, displayName, brandId) => {
    setSignalModalLoc({ locKey, displayName, brandId });
    fetchSignalLogs(locKey);
  };

  const signalStats = useMemo(() => {
    if (!signalLogs || signalLogs.length === 0) {
      return { total: 0, avgLatency: null, successRate: null, lastLatency: null };
    }
    const total = signalLogs.length;
    const successes = signalLogs.filter(l => l.success);
    const successRate = Math.round((successes.length / total) * 100);
    const latencies = successes.map(l => l.latency_ms).filter(n => typeof n === 'number' && !isNaN(n));
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
    const lastLatency = signalLogs[0]?.latency_ms ?? null;
    return { total, avgLatency, successRate, lastLatency };
  }, [signalLogs]);

  useEffect(() => {
    if (!socket) return;
    const handleSignalResult = (evt) => {
      if (signalModalLoc && evt && (evt.locationId === signalModalLoc.locKey)) {
        fetchSignalLogs(signalModalLoc.locKey);
      }
    };
    socket.on('pos_signal_result', handleSignalResult);
    return () => {
      socket.off('pos_signal_result', handleSignalResult);
    };
  }, [socket, signalModalLoc, fetchSignalLogs]);

  // Telegram form state
  const [telegramForm, setTelegramForm] = useState({
    enabled: false,
    botToken: '',
    chatId: '',
    posChatId: '',
    ordersChatId: '',
    alertCooldownMinutes: 10,
    posAlertsFilter: 'all',
    ordersAlertsEnabled: true,
  });
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState(null);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [internalKiosksLive, setInternalKiosksLive] = useState({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [dataReceivedAt, setDataReceivedAt] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const serverUrl = 'https://smart-kiosk-ttut.onrender.com';
      const legacyUrl = 'https://smart-kiosk-v7ws.onrender.com';

      const [resBridge, resKiosks, resV7, resLocations] = await Promise.all([
        fetch(`${serverUrl}/api/bridge-monitoring/status`, {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).catch(() => null),
        fetch(`${serverUrl}/api/locations/live-status`, {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).catch(() => null),
        fetch(`${legacyUrl}/api/bridge-monitoring/status`, {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).catch(() => null),
        fetch(`${serverUrl}/api/locations`, {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).catch(() => null),
      ]);

      let json = null;
      if (resBridge && resBridge.ok) {
        try { json = await resBridge.json(); } catch (_) {}
      }
      let v7Json = null;
      if (resV7 && resV7.ok) {
        try { v7Json = await resV7.json(); } catch (_) {}
      }
      let dbLocationsList = [];
      if (resLocations && resLocations.ok) {
        try {
          const lData = await resLocations.json();
          dbLocationsList = Array.isArray(lData) ? lData : (lData?.locations || []);
        } catch (_) {}
      }

      const merged = json ? JSON.parse(JSON.stringify(json)) : { locations: {} };
      if (!merged.locations) merged.locations = {};

      for (const [k, loc] of Object.entries(merged.locations)) {
        merged.locations[k] = { ...loc, serverHost: 'smart-kiosk-ttut.onrender.com' };
      }

      // Sincronizează setările din baza de date a fiecărei locații (inclusiv Trezire Standby salvată în DB)
      if (dbLocationsList.length > 0) {
        for (const locKey of ['cluj1', 'cluj2', 'sm-brasov', 'constanta1']) {
          const dbLoc = dbLocationsList.find(l => 
            l.id === locKey || 
            l.kioskUrl === locKey || 
            (Array.isArray(l.aliases) && l.aliases.includes(locKey)) ||
            (locKey === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov'))) ||
            (locKey === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
            (locKey === 'cluj1' && (l.id === 'smashme-main' || l.name?.toLowerCase().includes('centru'))) ||
            (locKey === 'cluj2' && (l.id === 'cluj2' || l.name?.toLowerCase().includes('cj-2')))
          );
          if (dbLoc) {
            if (!merged.locations[locKey]) {
              merged.locations[locKey] = { locationId: locKey };
            }
            if (dbLoc.posWakeStandby !== undefined) {
              merged.locations[locKey].posWakeStandby = Boolean(dbLoc.posWakeStandby);
            }
            if (dbLoc.posWakeIntervalMinutes !== undefined) {
              merged.locations[locKey].posWakeIntervalMinutes = Number(dbLoc.posWakeIntervalMinutes) || 5;
            }
          }
        }
      }

      // Daca vreo locatie (ex: Constanta 1) ruleaza inca pe serverul anterior, preia starea activa
      if (v7Json?.locations) {
        for (const [k, v7Loc] of Object.entries(v7Json.locations)) {
          if (v7Loc.isBridgeOnline && !merged.locations[k]?.isBridgeOnline) {
            merged.locations[k] = {
              ...merged.locations[k],
              ...v7Loc,
              serverHost: 'smart-kiosk-ttut.onrender.com',
              status: 'online',
              isBridgeOnline: true,
              isKioskOnline: v7Loc.isKioskOnline ?? true
            };
          }
        }
      }

      // Recompute totals
      let totalOn = 0;
      let totalOff = 0;
      for (const loc of Object.values(merged.locations)) {
        if (loc.isBridgeOnline) totalOn++;
        else totalOff++;
      }
      merged.totalOnline = totalOn;
      merged.totalOffline = totalOff;

      setData(merged);
      setDataReceivedAt(Date.now());
      if (merged.telegramConfig) {
        setTelegramForm(prev => ({
          ...prev,
          enabled: !!merged.telegramConfig.enabled,
          chatId: merged.telegramConfig.chatId || '',
          posChatId: merged.telegramConfig.posChatId || '',
          ordersChatId: merged.telegramConfig.ordersChatId || '',
          alertCooldownMinutes: merged.telegramConfig.alertCooldownMinutes || 10,
          posAlertsFilter: merged.telegramConfig.posAlertsFilter || 'all',
          ordersAlertsEnabled: merged.telegramConfig.ordersAlertsEnabled !== undefined ? !!merged.telegramConfig.ordersAlertsEnabled : true,
        }));
      }
      setLastRefreshed(new Date());

      // Kiosks live status (websockets)
      const kLive = {};
      if (resKiosks && resKiosks.ok) {
        try {
          const kj = await resKiosks.json();
          if (kj?.liveStatus) Object.assign(kLive, kj.liveStatus);
        } catch (_) {}
      }
      for (const [k, loc] of Object.entries(merged.locations)) {
        if (loc.isKioskOnline && !kLive[k]?.isLive) {
          kLive[k] = { isLive: true, online: true };
        }
      }
      setInternalKiosksLive(kLive);
    } catch (err) {
      console.error('[BridgeMonitoring] Fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [backend]);

  const [internalSocket, setInternalSocket] = useState(socket);

  useEffect(() => {
    if (socket) {
      setInternalSocket(socket);
      return;
    }
    const targetUrl = backend || 'https://smart-kiosk-ttut.onrender.com';
    try {
      const s = ioClient(targetUrl, { transports: ['websocket', 'polling'] });
      setInternalSocket(s);
      return () => {
        try { s.disconnect(); } catch (_) {}
      };
    } catch (_) {}
  }, [socket, backend]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // Auto-refresh every 15s

    // Real-time Socket.IO listener
    const activeSocket = internalSocket || socket;
    if (activeSocket) {
      const onBridgeUpdate = (updatedSummary) => {
        if (updatedSummary) {
          setData(updatedSummary);
          setLastRefreshed(new Date());
        }
      };
      const onKiosksLive = (statusMap) => {
        if (statusMap) {
          setInternalKiosksLive(statusMap);
        }
      };

      const onPosSignalResult = (res) => {
        if (res && res.locationId) {
          const lKey = res.locationId;
          const isOk = !!res.success;
          setActionFeedback({
            type: isOk ? 'success' : 'error',
            text: `[${lKey}] ${res.message || (isOk ? `Semnal POS OK (${res.latencyMs}ms)` : 'Eroare semnal POS')}`
          });
          setData(prev => {
            const locs = { ...(prev.locations || {}) };
            if (locs[lKey]) {
              locs[lKey] = {
                ...locs[lKey],
                posSignal: {
                  success: isOk,
                  latencyMs: res.latencyMs,
                  message: res.message,
                  testedAt: Date.now()
                }
              };
            }
            return { ...prev, locations: locs };
          });
        }
      };

      activeSocket.on('bridge_status_update', onBridgeUpdate);
      activeSocket.on('kiosks_live_status', onKiosksLive);
      activeSocket.on('pos_signal_result', onPosSignalResult);

      return () => {
        clearInterval(interval);
        activeSocket.off('bridge_status_update', onBridgeUpdate);
        activeSocket.off('kiosks_live_status', onKiosksLive);
        activeSocket.off('pos_signal_result', onPosSignalResult);
      };
    }

    return () => {
      clearInterval(interval);
    };
  }, [fetchStatus, socket, internalSocket]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  const handleSaveTelegram = async (e) => {
    e.preventDefault();
    setSavingTelegram(true);
    setTelegramStatusMsg(null);
    try {
      const payload = {
        enabled: telegramForm.enabled,
        chatId: telegramForm.chatId,
        posChatId: telegramForm.posChatId,
        ordersChatId: telegramForm.ordersChatId,
        alertCooldownMinutes: Number(telegramForm.alertCooldownMinutes) || 10,
        posAlertsFilter: telegramForm.posAlertsFilter || 'all',
        ordersAlertsEnabled: telegramForm.ordersAlertsEnabled !== undefined ? !!telegramForm.ordersAlertsEnabled : true,
      };
      if (telegramForm.botToken && telegramForm.botToken.trim()) {
        payload.botToken = telegramForm.botToken.trim();
      }

      const res = await fetch(`${backend}/api/bridge-monitoring/telegram-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-live-2024-secure',
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setTelegramStatusMsg({ type: 'success', text: 'Configurația Telegram a fost salvată cu succes.' });
        setTelegramForm(prev => ({ ...prev, botToken: '' }));
        fetchStatus();
      } else {
        setTelegramStatusMsg({ type: 'error', text: result.error || 'Eroare la salvare.' });
      }
    } catch (err) {
      setTelegramStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSavingTelegram(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramStatusMsg(null);
    try {
      const payload = {};
      if (telegramForm.botToken && telegramForm.botToken.trim()) {
        payload.botToken = telegramForm.botToken.trim();
      }
      if (telegramForm.chatId && telegramForm.chatId.trim()) {
        payload.chatId = telegramForm.chatId.trim();
      }

      const res = await fetch(`${backend}/api/bridge-monitoring/telegram-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-live-2024-secure',
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setTelegramStatusMsg({ type: 'success', text: result.message || 'Mesaj de test trimis pe Telegram cu succes.' });
      } else {
        setTelegramStatusMsg({ type: 'error', text: result.error || 'Eroare la trimiterea mesajului de test.' });
      }
    } catch (err) {
      setTelegramStatusMsg({ type: 'error', text: err.message });
    } finally {
      setTestingTelegram(false);
    }
  };

  const renderDigitalTimer = (seconds) => {
    if (!seconds || seconds <= 0) return <span className="text-[12px] font-semibold text-slate-400">00:00:00</span>;
    const totalHrs = Math.floor(seconds / 3600);
    const days = Math.floor(totalHrs / 24);
    const hrs = days > 0 ? totalHrs % 24 : totalHrs;
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const pad = (n) => String(n).padStart(2, '0');
    return (
      <span className="inline-flex items-center text-[12px] font-semibold text-slate-800 dark:text-slate-100">
        {days > 0 && <span className="mr-1 text-[11px] font-medium text-slate-500">{days}z</span>}
        <span>{pad(hrs)}</span>
        <span className="animate-blink-colon text-blue-600 dark:text-blue-400 font-bold mx-[1px] select-none">:</span>
        <span>{pad(mins)}</span>
        <span className="animate-blink-colon text-blue-600 dark:text-blue-400 font-bold mx-[1px] select-none">:</span>
        <span>{pad(secs)}</span>
      </span>
    );
  };

  const currentClock = useMemo(() => {
    const d = new Date(currentTime);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      hrs: pad(d.getHours()),
      mins: pad(d.getMinutes()),
      secs: pad(d.getSeconds()),
    };
  }, [currentTime]);

  const locationKeys = useMemo(() => ['cluj1', 'cluj2', 'sm-brasov', 'constanta1'], []);

  const computedLocations = useMemo(() => {
    const friendlyNames = {
      cluj1: 'Cluj 1',
      cluj2: 'Cluj 2',
      'sm-brasov': 'Brașov',
      constanta1: 'Constanța 1',
    };

    const brandMap = {
      cluj1: 'smashme',
      cluj2: 'smashme',
      'sm-brasov': 'rollmaster',
      constanta1: 'smashme',
    };

    const result = {};
    locationKeys.forEach(locKey => {
      const loc = data.locations[locKey] || {
        locationId: locKey,
        displayName: friendlyNames[locKey] || locKey,
        status: 'offline',
        port: 'N/A',
        gateway: 'raiffeisen',
        printerName: 'N/A',
        lastPingSecondsAgo: null,
        offlineDurationMinutes: null,
        uptimeSeconds: 0,
      };

      const allLive = { ...internalKiosksLive, ...kiosksLiveStatus };
      const liveKiosk = allLive[locKey] || 
                       (locKey === 'cluj1' ? (allLive['smashme-main'] || allLive['cluj-centru'] || allLive['cluj']) : null) ||
                       (locKey === 'cluj2' ? (allLive['cluj-2'] || allLive['cj2']) : null) ||
                       (locKey === 'constanta1' ? (allLive['smashme-constanta'] || allLive['constanta']) : null) ||
                       (locKey === 'sm-brasov' ? (allLive['rollmaster'] || allLive['brasov'] || allLive['sm-brasov']) : null);
      const isKioskConnected = Boolean(liveKiosk?.isLive || liveKiosk?.online || (liveKiosk?.onlineCount > 0) || loc.isKioskOnline);
      const isUniversalConfig = Boolean(liveKiosk?.isUniversal);
      const kioskScriptVer = liveKiosk?.scriptVersion || null;
      const latestScriptVer = liveKiosk?.latestScriptVersion || '2.4.0';
      const isScriptUpToDate = Boolean(kioskScriptVer && kioskScriptVer === latestScriptVer);

      const rawBridgeVersion = loc.bridgeVersion || loc.version || null;
      const bridgeVersion = (rawBridgeVersion && rawBridgeVersion !== '1.0.0') ? rawBridgeVersion : '3.4.0';
      const latestBridgeVer = BRIDGE_RELEASE_NOTES[0]?.version || loc.latestBridgeVersion || '3.5.0';
      const isBridgeUpToDate = Boolean(rawBridgeVersion && bridgeVersion === latestBridgeVer);

      const cleanKioskName = friendlyNames[locKey] || (loc.displayName ? loc.displayName.replace(/\s*\([^)]*\)/g, '').trim() : locKey);
      const brandId = loc.brand || loc.brandId || brandMap[locKey] || (locKey.includes('brasov') ? 'rollmaster' : 'smashme');

      const hasRecentConnection = Boolean(loc.lastPingSecondsAgo !== null && loc.lastPingSecondsAgo < 300);
      const isBridgeOnline = Boolean(loc.status === 'online' || loc.isBridgeOnline);
      const isOnline = isBridgeOnline;

      const elapsedSinceFetch = Math.max(0, Math.floor((currentTime - dataReceivedAt) / 1000));
      const effectiveUptime = isBridgeOnline && loc.uptimeSeconds > 0 
        ? (loc.uptimeSeconds + elapsedSinceFetch) 
        : (loc.uptimeSeconds || 0);
      const effectiveLastPing = loc.lastPingSecondsAgo !== null && isBridgeOnline
        ? (loc.lastPingSecondsAgo + elapsedSinceFetch)
        : loc.lastPingSecondsAgo;

      result[locKey] = {
        ...loc,
        displayName: cleanKioskName,
        brandId,
        status: isOnline ? 'online' : 'offline',
        isBridgeOnline,
        isKioskConnected,
        isUniversalConfig,
        kioskScriptVer,
        latestScriptVer,
        isScriptUpToDate,
        bridgeVersion,
        latestBridgeVer,
        isBridgeUpToDate,
        hasRecentConnection,
        uptimeSeconds: effectiveUptime,
        lastPingSecondsAgo: effectiveLastPing,
      };
    });
    return result;
  }, [data.locations, kiosksLiveStatus, internalKiosksLive, locationKeys, currentTime, dataReceivedAt]);

  const sortedLocationKeys = useMemo(() => {
    const brandOrder = ['smashme', 'crunch', 'rollmaster', 'lovesushi', 'pokiwoki'];
    return [...locationKeys].sort((a, b) => {
      const locA = computedLocations[a];
      const locB = computedLocations[b];
      const brandA = locA?.brandId || '';
      const brandB = locB?.brandId || '';

      const idxA = brandOrder.indexOf(brandA);
      const idxB = brandOrder.indexOf(brandB);
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;

      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return (locA?.displayName || a).localeCompare(locB?.displayName || b, 'ro', { numeric: true });
    });
  }, [locationKeys, computedLocations]);

  const totalOnlineCount = Object.values(computedLocations).filter(l => l.status === 'online').length;
  const totalOfflineCount = locationKeys.length - totalOnlineCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm font-medium">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Se încarcă datele de telemetrie hardware...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 w-full text-left">
      {/* Control & Status Bar - Premium Design with OTA Actions */}
      <div className="relative overflow-hidden bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-5 md:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/20 border border-blue-200/60 dark:border-blue-700/50 flex items-center justify-center shrink-0 shadow-inner">
            <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Stare Echipamente și Conexiuni Locale
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-600/50 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-slate-800 dark:text-slate-100 font-bold inline-flex items-center text-[12px]">
              <span>{currentClock.hrs}</span>
              <span className="animate-blink-colon text-blue-600 dark:text-blue-400 font-bold mx-[1px] select-none">:</span>
              <span>{currentClock.mins}</span>
              <span className="animate-blink-colon text-blue-600 dark:text-blue-400 font-bold mx-[1px] select-none">:</span>
              <span>{currentClock.secs}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-600/50 shadow-inner">
            <Radio className={`w-3.5 h-3.5 ${totalOnlineCount > 0 ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
            <span>POS Active: <strong className={totalOnlineCount > 0 ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500'}>{totalOnlineCount}</strong></span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className={totalOfflineCount > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400'}>
              Deconectate: <strong>{totalOfflineCount}</strong>
            </span>
          </div>

          {/* Indicator Status Soft stil macOS */}
          {(() => {
            const latestBridgeVerGlobal = BRIDGE_RELEASE_NOTES[0]?.version || Object.values(computedLocations)[0]?.latestBridgeVersion || '3.5.0';
            const outdatedLocations = Object.values(computedLocations).filter(
              l => l.isBridgeOnline && (l.bridgeVersion !== latestBridgeVerGlobal || !l.isBridgeUpToDate)
            );
            const hasUpdatesPending = outdatedLocations.length > 0;

            if (hasUpdatesPending) {
              return (
                <button
                  type="button"
                  onClick={() => setIsReleaseNotesOpen(true)}
                  disabled={actionLoading === 'all-update-all-bridges'}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 active:scale-95"
                  title={`Click pentru a vedea noutățile și a actualiza ${outdatedLocations.length} kiosk-uri la v${latestBridgeVerGlobal}`}
                >
                  {actionLoading === 'all-update-all-bridges' && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  )}
                  <span>Actualizează la v{latestBridgeVerGlobal} ({outdatedLocations.length})</span>
                </button>
              );
            }

            // Exact ca pe macOS: Când totul e la zi, este o insignă curată și clicabilă pentru detalii versiune
            return (
              <button 
                type="button"
                onClick={() => setIsReleaseNotesOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 whitespace-nowrap shrink-0 shadow-xs transition-all cursor-pointer group active:scale-98"
                title={`Click pentru a vedea noutățile versiunii oficiale (v${latestBridgeVerGlobal})`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" />
                <span>Soft la zi (v{latestBridgeVerGlobal})</span>
              </button>
            );
          })()}

          {/* Buton Refresh date panou (stil macOS: Reverifică) */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Reinteroghează serverul pentru a actualiza timpii de ping și starea conexiunilor"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-xs transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''} shrink-0 text-slate-400`} />
            <span className="whitespace-nowrap">Reverifică</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 border shadow-xs ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        }`}>
          {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Listă Carduri Locații - Fiecare locație pe un rând complet (1 per row) */}
      <div className="flex flex-col gap-4">
        {sortedLocationKeys.map(locKey => {
          const loc = computedLocations[locKey];
          const isOnline = loc.status === 'online';
          const { isKioskConnected, isUniversalConfig, kioskScriptVer, latestScriptVer, isScriptUpToDate, isBridgeOnline } = loc;

          return (
            <div
              key={locKey}
              className="group p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400/80 dark:hover:border-blue-500/80 shadow-xs hover:shadow-md flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                {/* Card Header with Brand Logo Avatar, Clean Kiosk Name, Server & Online State */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <BrandLogo 
                      brandId={loc.brandId} 
                      size={36} 
                      className="shrink-0 shadow-xs" 
                    />
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate tracking-tight" title={loc.displayName}>
                        {loc.displayName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Server:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold truncate select-all" title={loc.serverHost || serverHost}>
                          {loc.serverHost || serverHost}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    if (isBridgeOnline && isKioskConnected) {
                      return (
                        <div className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs whitespace-nowrap bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-500 animate-pulse" />
                          <span>ONLINE</span>
                        </div>
                      );
                    }
                    if (!isBridgeOnline && isKioskConnected) {
                      return (
                        <div className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs whitespace-nowrap bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-amber-500" />
                          <span>POS OPRIT</span>
                        </div>
                      );
                    }
                    if (isBridgeOnline && !isKioskConnected) {
                      return (
                        <div className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs whitespace-nowrap bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-amber-500" />
                          <span>ECRAN INACTIV</span>
                        </div>
                      );
                    }
                    return (
                      <div className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs whitespace-nowrap bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                        <span className="w-2 h-2 rounded-full shrink-0 bg-slate-400" />
                        <span>DECONECTAT</span>
                      </div>
                    );
                  })()}
                </div>

                {/* 3-Column Balanced Hardware Grid (Egalizate, zero spațiu irosit) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Coloana 1: Ecran Kiosk & OTA */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2 text-xs flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="whitespace-nowrap">Ecran Kiosk</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                        isKioskConnected 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' 
                          : 'bg-slate-200/60 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {isKioskConnected ? 'Conectat' : 'Inactiv'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Configurație:</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                        isUniversalConfig 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                          : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {isUniversalConfig ? 'Universală' : 'Manuală'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Versiune Script (Kiosk):</span>
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {isKioskConnected ? (
                          <>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                              kioskScriptVer 
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' 
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {kioskScriptVer ? `v${kioskScriptVer}` : 'Deschis manual'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold whitespace-nowrap ${
                              isScriptUpToDate
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                            }`}>
                              {isScriptUpToDate ? 'La zi' : 'Update'}
                            </span>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 whitespace-nowrap">
                            {kioskScriptVer ? `v${kioskScriptVer}` : '— (offline)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Coloana 2: Terminal POS */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2 text-xs flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="whitespace-nowrap">Terminal POS</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                        isBridgeOnline 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' 
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                      }`}>
                        {isBridgeOnline ? (loc.port ? `${loc.port} (${loc.gateway || 'raiffeisen'})` : 'Activ') : 'Oprit'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Semnal POS:</span>
                      {loc.posSignal?.testing ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 animate-pulse border border-amber-300 dark:border-amber-700">
                          🟡 Se testează...
                        </span>
                      ) : (loc.isCashOnly || loc.isPosEnabled === false) ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                          Inactiv (Doar Cash 💵)
                        </span>
                      ) : loc.posSignal ? (
                        <button
                          type="button"
                          onClick={() => openSignalHistory(locKey, loc.displayName, loc.brandId)}
                          title="Apasă pentru istoricul detaliat al semnalului POS"
                          className={`group/sig px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all duration-150 hover:shadow-xs hover:scale-105 active:scale-95 inline-flex items-center gap-1 ${
                            loc.posSignal.success
                              ? (loc.posSignal.latencyMs < 100 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900')
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900'
                          }`}
                        >
                          <span>{loc.posSignal.success ? `🟢 ${loc.posSignal.latencyMs}ms (activ)` : `🔴 ${loc.posSignal.message || 'Eroare'}`}</span>
                          <span className="text-[9px] opacity-70 underline decoration-dotted font-semibold">istoric</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openSignalHistory(locKey, loc.displayName, loc.brandId)}
                          title="Apasă pentru a vedea istoricul sau a efectua un test"
                          className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 cursor-pointer transition-colors inline-flex items-center gap-1"
                        >
                          <span>Netestat</span>
                          <span className="underline decoration-dotted text-[9px] font-medium">(vezi istoric)</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Trezire Standby:</span>
                      <button
                        type="button"
                        onClick={() => handleToggleWake(locKey, loc.posWakeStandby, loc.posWakeIntervalMinutes)}
                        title={loc.posWakeStandby ? "Trezire automată Standby este ACTIVĂ. Click pentru a comuta pe OFF." : "Trezire automată Standby este INACTIVĂ. Click pentru a comuta pe ON."}
                        className="inline-flex items-center gap-2 cursor-pointer group py-0.5 select-none"
                      >
                        <span className={`text-[11px] font-bold tracking-tight transition-colors ${
                          loc.posWakeStandby ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : 'text-slate-400 dark:text-slate-500 font-semibold'
                        }`}>
                          {loc.posWakeStandby ? `ON (${loc.posWakeIntervalMinutes || 5}m)` : 'OFF'}
                        </span>
                        <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ease-in-out p-0.5 ${
                          loc.posWakeStandby ? 'bg-emerald-500 group-hover:bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400'
                        }`}>
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-xs ${
                            loc.posWakeStandby ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Instanță Duplicat:</span>
                      {loc.duplicateDetected ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700 animate-pulse">
                            DA ⚠️
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResolveDuplicate(locKey, loc.displayName)}
                            disabled={actionLoading === `${locKey}-resolve-duplicate`}
                            title="Oprește procesele duplicat din fundal și păstrează o singură instanță activă"
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>{actionLoading === `${locKey}-resolve-duplicate` ? 'Se oprește...' : 'Rezolvă'}</span>
                          </button>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                          Nu (Unic)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Coloana 3: Imprimantă & Uptime */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2 text-xs flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Printer className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="whitespace-nowrap">Imprimantă & Uptime</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                        loc.printerName && loc.printerName !== 'Nedetectată'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-slate-200/60 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {loc.printerName && loc.printerName !== 'Nedetectată' ? 'Pregătită' : 'Nedetectată'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Model:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate ml-2 text-right" title={loc.printerName || 'Nedetectată'}>
                        {loc.printerName || 'Nedetectată'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Versiune Soft (PC):</span>
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {isBridgeOnline ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsReleaseNotesOpen(true)}
                              title="Click pentru a vedea noutățile acestei versiuni"
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900 transition-colors cursor-pointer"
                            >
                              v{loc.bridgeVersion || '3.4.0'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsReleaseNotesOpen(true)}
                              title={loc.isBridgeUpToDate ? "Soft la zi" : `Actualizare disponibilă la v${loc.latestBridgeVer}. Click pentru noutăți și instalare.`}
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold whitespace-nowrap cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                                loc.isBridgeUpToDate
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 ring-1 ring-amber-300 dark:ring-amber-700/60'
                              }`}
                            >
                              {loc.isBridgeUpToDate ? 'La zi' : `Nou: v${loc.latestBridgeVer}`}
                            </button>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 whitespace-nowrap">
                            v{loc.bridgeVersion || '3.4.0'} (offline)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Ultimul Semnal:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap text-right">
                        {isBridgeOnline ? (
                          loc.lastPingSecondsAgo !== null && loc.lastPingSecondsAgo < 120 
                            ? `acum ${loc.lastPingSecondsAgo}s` 
                            : 'activ'
                        ) : (
                          <span className="text-slate-400 italic">offline</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Uptime (Pornit de):</span>
                      <div className="flex items-center justify-end text-right">
                        {isBridgeOnline && loc.uptimeSeconds > 0 ? (
                          renderDigitalTimer(loc.uptimeSeconds)
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Avertisment Prominent Instanță Duplicat Detectată */}
                {loc.duplicateDetected && (
                  <div className="p-2.5 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300 leading-tight flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>⚠️ <b>Atenție:</b> A fost detectată o instanță clonă/fantomă în fundal! Rata de succes POS poate fi degradată.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResolveDuplicate(locKey, loc.displayName)}
                      disabled={actionLoading === `${locKey}-resolve-duplicate`}
                      className="px-3 py-1 rounded-full text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer inline-flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{actionLoading === `${locKey}-resolve-duplicate` ? 'Se oprește...' : 'Oprește Duplicat'}</span>
                    </button>
                  </div>
                )}

                {/* Status Note Indicator */}
                {isOnline ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 leading-tight flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium">Sistem operațional & sincronizat</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 leading-tight flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold">Notă:</span> Bridge deconectat.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const num = { cluj1: '1', cluj2: '2', 'sm-brasov': '3', constanta1: '4', constanta2: '5' }[locKey] || '3';
                        const cmd = `cmd /c "mkdir C:\\SmartKiosk 2>nul & cd /d C:\\SmartKiosk & curl -s -L -o setup.bat https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/setup_kiosk_autostart.bat & setup.bat ${num}"`;
                        navigator.clipboard.writeText(cmd);
                        setActionFeedback({ type: 'success', text: `Comanda de pornire pentru ${loc.displayName} a fost copiată!` });
                        setTimeout(() => setActionFeedback(null), 3000);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0 cursor-pointer shadow-xs transition-colors"
                    >
                      Copiază Comandă Pornire
                    </button>
                  </div>
                )}

                {/* Progres restart POS Bridge */}
                {restartProgress[locKey] && (() => {
                  const rp = restartProgress[locKey];
                  const elapsed = Math.max(0, Math.round(((rp.finishedAt || currentTime) - rp.startedAt) / 1000));
                  const isPending = rp.status === 'pending';
                  const isDone = rp.status === 'completed';
                  const pct = isDone ? 100 : isPending ? Math.min(95, Math.round((elapsed / 90) * 100)) : 100;
                  const tone = isDone
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : isPending
                      ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
                  const bar = isDone ? 'bg-emerald-500' : isPending ? 'bg-blue-500' : 'bg-rose-500';
                  return (
                    <div className={`p-3 rounded-xl border text-xs space-y-2 ${tone}`}>
                      <div className="font-bold flex items-center gap-2">
                        {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {!isPending && !isDone && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                        <span>
                          {isPending && `Se repornește POS Bridge… ${elapsed}s (durează de obicei 1–2 minute, nu închide pagina)`}
                          {isDone && `POS Bridge repornit cu succes în ${elapsed}s`}
                          {!isPending && !isDone && 'Restartul nu s-a confirmat'}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${bar} ${isPending ? 'animate-pulse' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                      {!isPending && rp.detail && <div className="opacity-90">{rp.detail}</div>}
                    </div>
                  );
                })()}

                {/* Action Buttons: 4-column responsive grid */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestartBridge(locKey, loc.displayName, !!isBridgeOnline)}
                      disabled={actionLoading === `${locKey}-restart-bridge` || restartProgress[locKey]?.status === 'pending'}
                      title="Restart POS Bridge (repornește conexiunea POS & imprimantă) — cere confirmare"
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 transition-colors disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${actionLoading === `${locKey}-restart-bridge` ? 'animate-spin' : ''}`} />
                      <span>Bridge</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(locKey, 'reload-kiosk')}
                      disabled={actionLoading === `${locKey}-reload-kiosk`}
                      title="Refresh Ecran Kiosk (reîncarcă pagina Kiosk din browser)"
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 transition-colors disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${actionLoading === `${locKey}-reload-kiosk` ? 'animate-spin' : ''}`} />
                      <span>Ecran</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(locKey, 'test-pos-signal')}
                      disabled={actionLoading === `${locKey}-test-pos-signal`}
                      title="Testează semnalul și latența magistralei seriale cu POS-ul"
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 transition-colors disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Radio className={`w-3.5 h-3.5 shrink-0 ${actionLoading === `${locKey}-test-pos-signal` ? 'animate-pulse text-emerald-600' : 'text-emerald-600 dark:text-emerald-400'}`} />
                      <span>Semnal POS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(locKey, 'test-print')}
                      disabled={actionLoading === `${locKey}-test-print`}
                      title="Scoate un bon de probă pe imprimanta termică din locație"
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600/80 transition-colors disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Test Bon</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Universal Command Box with 1-Click Copy - Clean Light Design, No Black Background, No Scrollbar */}
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-5 md:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center shrink-0 shadow-inner">
              <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Comandă Universală Configurare Kiosk (Brașov, Cluj, Constanța)
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyCommand}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs shrink-0 ${
              copiedCommand
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
            }`}
            title="Copiază comanda universală în clipboard"
          >
            {copiedCommand ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Copiat în Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-white" />
                <span>Copiază Comanda</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl p-3.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 select-all break-all overflow-hidden leading-relaxed">
          <code>{UNIVERSAL_COMMAND}</code>
        </div>
      </div>

      {/* Telegram Alert Settings Panel */}
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700/60">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>Configurare Alerte Telegram</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              data.telegramConfig?.enabled && data.telegramConfig?.botTokenConfigured
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{data.telegramConfig?.enabled ? 'Alerte Active' : 'Dezactivate'}</span>
            </span>
          </div>
        </div>

        {telegramStatusMsg && (
          <div className={`mt-4 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
            telegramStatusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}>
            {telegramStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{telegramStatusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveTelegram} className="mt-5 space-y-4">
          <div className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              id="telegram_enabled"
              checked={telegramForm.enabled}
              onChange={(e) => setTelegramForm(prev => ({ ...prev, enabled: e.target.checked }))}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <label htmlFor="telegram_enabled" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
              Activează trimiterea automată a alertelor pe Telegram
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telegram Bot Token:
              </label>
              <input
                type="text"
                value={telegramForm.botToken}
                onChange={(e) => setTelegramForm(prev => ({ ...prev, botToken: e.target.value }))}
                placeholder={data.telegramConfig?.botTokenConfigured ? `Configurat: ${data.telegramConfig.botTokenMasked}` : 'Ex: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ'}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Obținut gratuit din conversația cu <span className="font-semibold">@BotFather</span> pe Telegram.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Grup 1: Status & Hardware (ID Chat / Grup):
              </label>
              <input
                type="text"
                value={telegramForm.chatId}
                onChange={(e) => setTelegramForm(prev => ({ ...prev, chatId: e.target.value }))}
                placeholder="Ex: -5489923676"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Alerte Hardware (Online/Offline/Reconectat), erori iiko și imprimantă.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Grup 2: Tranzacții POS (ID Chat / Grup):
              </label>
              <input
                type="text"
                value={telegramForm.posChatId}
                onChange={(e) => setTelegramForm(prev => ({ ...prev, posChatId: e.target.value }))}
                placeholder="Ex: -5554201057"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Plăți POS live (🟢 Aprobate vs 🔴 Respinse cu motiv detaliat în română).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Grup 3: Comenzi Live (ID Chat / Grup):
              </label>
              <input
                type="text"
                value={telegramForm.ordersChatId}
                onChange={(e) => setTelegramForm(prev => ({ ...prev, ordersChatId: e.target.value }))}
                placeholder="Ex: -5209173668"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Toate comenzile plasate pe kiosk (număr comandă, produse, opțiuni, total).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Perioadă antiflood alerte (minute):
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={telegramForm.alertCooldownMinutes}
                onChange={(e) => setTelegramForm(prev => ({ ...prev, alertCooldownMinutes: e.target.value }))}
                className="w-24 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filtre Notificări Specifice (POS & Comenzi) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Filtru Mesaje POS (Grup 2) */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Mesaje Notificări POS (Grup 2):
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                Alege ce tip de plăți vrei să fie trimise în grupul dedicat POS.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'all', label: '🟢+🔴 Toate', desc: 'Aprobate + Respinse' },
                  { id: 'approved_only', label: '🟢 Doar Aprobate', desc: 'Fără refuzuri' },
                  { id: 'rejected_only', label: '🔴 Doar Respinse', desc: 'Fără aprobate' },
                  { id: 'none', label: '⚪ Oprite (Nu)', desc: 'Niciun mesaj POS' },
                ].map(opt => {
                  const isChecked = (telegramForm.posAlertsFilter || 'all') === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`flex flex-col p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold shadow-xs ring-1 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="posAlertsFilter"
                          value={opt.id}
                          checked={isChecked}
                          onChange={(e) => setTelegramForm(prev => ({ ...prev, posAlertsFilter: e.target.value }))}
                          className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-slate-300"
                        />
                        <span className="font-bold text-[11px]">{opt.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 pl-5 mt-0.5">{opt.desc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Toggle Alerte Comenzi Live (Grup 3) */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Notificări Comenzi Noi (Grup 3):
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Trimite detaliile fiecărei comenzi finalizate de clienți pe chioșcuri.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {telegramForm.ordersAlertsEnabled !== false ? '✅ Comenzi active pe Telegram' : '❌ Notificări comenzi oprite'}
                </span>
                <button
                  type="button"
                  onClick={() => setTelegramForm(prev => ({ ...prev, ordersAlertsEnabled: prev.ordersAlertsEnabled === false ? true : false }))}
                  className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    telegramForm.ordersAlertsEnabled !== false ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      telegramForm.ordersAlertsEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="submit"
              disabled={savingTelegram}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {savingTelegram ? 'Se salvează...' : 'Salvează Setările'}
            </button>

            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTelegram}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${testingTelegram ? 'animate-pulse' : ''}`} />
              <span>{testingTelegram ? 'Trimit mesaj...' : 'Trimite Test pe Telegram'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Jurnal Restartări POS Bridge: manual (Admin) vs automat (din locație) */}
      {(() => {
        const filtered = restartLogs.filter(r => restartLogFilter === 'all' || r.locationId === restartLogFilter);
        const shown = filtered.slice(0, restartLogLimit);
        const locOptions = Array.from(new Set([...Object.keys(computedLocations || {}), ...restartLogs.map(r => r.locationId)]));
        const isManual = (s) => typeof s === 'string' && s.startsWith('admin');
        const statusBadge = (st) => {
          if (st === 'completed') return { cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', txt: '✅ Repornit' };
          if (st === 'pending') return { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300', txt: '⏳ În curs' };
          if (st === 'timeout') return { cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', txt: '❌ Nu a revenit' };
          if (st === 'failed') return { cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', txt: '❌ Nelivrat (offline)' };
          return { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', txt: st || '—' };
        };
        return (
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-blue-600" />
                <span>Jurnal Restartări POS Bridge</span>
              </h2>
              <select
                value={restartLogFilter}
                onChange={e => { setRestartLogFilter(e.target.value); setRestartLogLimit(15); }}
                className="text-xs rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5"
              >
                <option value="all">Toate locațiile</option>
                {locOptions.map(k => <option key={k} value={k}>{computedLocations?.[k]?.displayName || k}</option>)}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
              <b>Manual (Admin)</b> = a apăsat cineva butonul din Admin. <b>Automat / din locație</b> = bridge-ul a repornit fără comandă din Admin (singur, repornire PC, update, crash). Se înregistrează doar restartările de la această versiune încoace.
            </p>

            {!restartLogLoaded ? (
              <div className="py-6 text-center text-xs text-slate-400">Se încarcă…</div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Nicio restartare înregistrată încă.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                        <th className="py-2 px-3 font-semibold">Nr.</th>
                        <th className="py-2 px-3 font-semibold">Data / Ora</th>
                        <th className="py-2 px-3 font-semibold">Locație</th>
                        <th className="py-2 px-3 font-semibold">Cine a repornit</th>
                        <th className="py-2 px-3 font-semibold">Rezultat</th>
                        <th className="py-2 px-3 font-semibold">Detalii</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {shown.map((r, idx) => {
                        const sb = statusBadge(r.status);
                        const manual = isManual(r.source);
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                            <td className="py-2.5 px-3 text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDateTime(r.requestedAt)}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{r.displayName || r.locationId}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${manual ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                                {manual ? '👤 Manual (Admin)' : '🤖 Automat / din locație'}
                              </span>
                              {manual && r.sourceLabel && <div className="text-[10px] text-slate-500 mt-0.5">{r.sourceLabel}</div>}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${sb.cls}`}>{sb.txt}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                              {r.detail}
                              {manual && r.requestedBy && <div className="text-[10px] text-slate-400">IP: {String(r.requestedBy).split(',')[0]}</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Afișate {shown.length} din {filtered.length} restartări</span>
                  {filtered.length > restartLogLimit && (
                    <button type="button" onClick={() => setRestartLogLimit(l => l + 15)} className="px-4 py-1.5 whitespace-nowrap rounded-full font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer">
                      Arată mai multe
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Istoric Evenimente Recente */}
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Jurnal Evenimente Hardware Recente</span>
        </h2>

        {(!data.recentEvents || data.recentEvents.length === 0) ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Nu sunt evenimente înregistrate în această sesiune.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-3 font-semibold">Timp</th>
                  <th className="py-2 px-3 font-semibold">Locație</th>
                  <th className="py-2 px-3 font-semibold">Eveniment</th>
                  <th className="py-2 px-3 font-semibold">Detalii</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.recentEvents.map(evt => {
                  const isErr = evt.type === 'DISCONNECT' || evt.type === 'TIMEOUT';
                  return (
                    <tr key={evt.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 px-3 font-normal text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {evt.dateTime}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {evt.locationId}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          isErr 
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' 
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {evt.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-normal">
                        {evt.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Interactiv Istoric Semnal POS & Latenta UART */}
      {signalModalLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <BrandLogo brandId={signalModalLoc.brandId} size={36} className="shrink-0 shadow-xs" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      Istoric Semnal POS & Latență UART
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Locație: <strong className="text-slate-800 dark:text-slate-200">{signalModalLoc.displayName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSignalModalLoc(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Quick Stats Cards */}
            <div className="p-5 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ultimul Semnal</span>
                <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block">
                  {signalStats.lastLatency !== null ? `${signalStats.lastLatency}ms` : '—'}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {signalStats.lastLatency !== null && signalStats.lastLatency < 100 ? 'Excelent' : (signalStats.lastLatency !== null ? 'Normal' : 'Netestat')}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Latență Medie</span>
                <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block">
                  {signalStats.avgLatency !== null ? `${signalStats.avgLatency}ms` : '—'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">timp răspuns POS</span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rată Succes</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {signalStats.successRate !== null ? `${signalStats.successRate}%` : '—'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">fără pachete pierdute</span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Măsurători</span>
                <span className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                  {signalStats.total}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">înregistrate în DB</span>
              </div>
            </div>

            {/* Modal Actions Bar */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3 bg-white dark:bg-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Ultimele măsurători înregistrate
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(signalModalLoc.locKey, 'test-pos-signal')}
                  disabled={actionLoading === `${signalModalLoc.locKey}-test-pos-signal`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 cursor-pointer shadow-xs disabled:opacity-50 transition-all active:scale-95"
                >
                  <Zap className={`w-3.5 h-3.5 ${actionLoading === `${signalModalLoc.locKey}-test-pos-signal` ? 'animate-spin' : ''}`} />
                  <span>{actionLoading === `${signalModalLoc.locKey}-test-pos-signal` ? 'Se testează...' : 'Testează Acum'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchSignalLogs(signalModalLoc.locKey)}
                  disabled={loadingSignalLogs}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 transition-colors"
                  title="Reîmprospătează lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSignalLogs ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Modal Logs Table / List */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingSignalLogs && signalLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Se descarcă istoricul din baza de date...</span>
                </div>
              ) : signalLogs.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Radio className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nu s-au înregistrat încă teste de semnal pentru această locație.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleAction(signalModalLoc.locKey, 'test-pos-signal')}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 cursor-pointer transition-colors"
                  >
                    Efectuează primul test de semnal
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-semibold">
                        <th className="py-2 px-3">Data / Ora</th>
                        <th className="py-2 px-3">Port</th>
                        <th className="py-2 px-3">Latență Răspuns</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {signalLogs.map(log => {
                        const dateFormatted = log.tested_at ? formatDateTime(log.tested_at) : '—';
                        const isFast = log.latency_ms !== null && log.latency_ms < 60;
                        const isNormal = log.latency_ms !== null && log.latency_ms >= 60 && log.latency_ms <= 150;
                        const isSlow = log.latency_ms !== null && log.latency_ms > 150;

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {dateFormatted}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                              {log.port || 'COM'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {log.latency_ms !== null ? (
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold ${
                                    isFast ? 'text-emerald-600 dark:text-emerald-400' : (isNormal ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')
                                  }`}>
                                    {log.latency_ms} ms
                                  </span>
                                  <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        isFast ? 'bg-emerald-500' : (isNormal ? 'bg-amber-500' : 'bg-rose-500')
                                      }`}
                                      style={{ width: `${Math.min(100, Math.max(10, Math.round((log.latency_ms / 300) * 100)))}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.success
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}>
                                {log.success ? 'Activ / OK' : (log.message || 'Eșuat')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Pachetele utilizează comanda standard ENQ (0x05) pe protocol serial Printec ECR v3.9.3.
              </span>
              <button
                type="button"
                onClick={() => setSignalModalLoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer shadow-xs transition-colors"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Apple macOS Software Release Notes & Action */}
      <SoftwareReleaseNotesModal
        isOpen={isReleaseNotesOpen}
        onClose={() => setIsReleaseNotesOpen(false)}
        initialVersion={BRIDGE_RELEASE_NOTES[0]?.version || '3.5.0'}
        canUpdate={Object.values(computedLocations).some(l => l.isBridgeOnline && (l.bridgeVersion !== (BRIDGE_RELEASE_NOTES[0]?.version || '3.5.0') || !l.isBridgeUpToDate))}
        outdatedCount={Object.values(computedLocations).filter(l => l.isBridgeOnline && (l.bridgeVersion !== (BRIDGE_RELEASE_NOTES[0]?.version || '3.5.0') || !l.isBridgeUpToDate)).length}
        isUpdating={actionLoading === 'all-update-all-bridges'}
        onUpdate={() => handleAction('all', 'execute-update-all-bridges')}
        onCompleteUpdate={handleCompleteUpdate}
      />
    </div>
  );
}
