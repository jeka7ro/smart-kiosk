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
  Sparkles,
  ArrowDown,
  Maximize2,
  Lock,
  Unlock,
  Power,
  Play
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
  const [data, setData] = useState(() => {
    const fallback = {
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
    };
    try {
      const cached = localStorage.getItem('admin_cached_bridge_summary');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.locations) return { ...fallback, ...parsed };
      }
    } catch {}
    return fallback;
  });

  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('admin_cached_bridge_summary');
    } catch {
      return true;
    }
  });
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
  const [releaseNotesTargetLoc, setReleaseNotesTargetLoc] = useState(null);

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

  const handleToggleLock = async (locKey, dbId, currentLocked) => {
    const nextLocked = !currentLocked;
    const targetId = dbId || locKey;
    setData(prev => {
      const locs = { ...(prev?.locations || {}) };
      if (locs[locKey]) {
        locs[locKey] = {
          ...locs[locKey],
          forceLocked: nextLocked,
        };
      }
      return { ...prev, locations: locs };
    });
    const key = `${locKey}-toggle-lock`;
    setActionLoading(key);
    try {
      const res = await fetch(`${apiBase}/api/locations/${targetId}/lock`, {
        method: 'POST',
        headers: {
          ...apiHeaders,
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ locked: nextLocked }),
      });
      if (res.ok) {
        setActionFeedback({
          type: 'success',
          text: nextLocked ? `Kiosk-ul ${locKey} a fost blocat cu ecran PIN.` : `Kiosk-ul ${locKey} a fost deblocat.`
        });
      } else {
        setActionFeedback({ type: 'error', text: 'Eroare la schimbarea stării de blocare.' });
      }
    } catch (err) {
      setActionFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionFeedback(null), 3000);
      setTimeout(fetchStatus, 1000);
    }
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
      const num = { cluj1: '1', cluj2: '2', 'sm-brasov': '3', constanta1: '4', constanta2: '5' }[locKey] || '1';
      const startCmd = `cmd /c "mkdir C:\\SmartKiosk 2>nul & cd /d C:\\SmartKiosk & curl -s -L -o setup.bat https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/setup_kiosk_autostart.bat & setup.bat ${num}"`;
      await confirm(
        <div className="text-left space-y-3 text-sm">
          <p className="text-amber-600 dark:text-amber-400 font-bold">
            Bridge-ul {displayName} este în prezent OFFLINE (deconectat).
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Comanda de restart prin internet nu poate ajunge la calculator deoarece procesul local nu este conectat la server.
          </p>
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs tabular-nums break-all select-all">
            {startCmd}
          </div>
          <p className="text-xs text-slate-500">
            Apasă pe butonul de mai jos pentru a copia comanda de pornire rapidă pentru acest PC.
          </p>
        </div>,
        {
          title: `Bridge Deconectat — ${displayName}`,
          okLabel: 'Copiază Comanda de Pornire',
          cancelLabel: 'Închide',
        }
      ).then((confirmed) => {
        if (confirmed) {
          navigator.clipboard.writeText(startCmd);
          setActionFeedback({ type: 'success', text: `Comanda de pornire pentru ${displayName} a fost copiată!` });
          setTimeout(() => setActionFeedback(null), 4000);
        }
      });
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

  const handleRebootPc = async (locKey, displayName) => {
    const ok = await confirm(
      <div className="text-left space-y-2 text-sm">
        <p>Sigur vrei să repornești fizic sistemul <b>Windows</b> pe <b>{displayName || locKey}</b>?</p>
        <ul className="list-disc pl-5 space-y-1 text-xs opacity-90">
          <li>Toate procesele (Chrome, Bridge) se vor opri și calculatorul se va stinge curat.</li>
          <li>Kiosk-ul va fi indisponibil aproximativ <b>1 minut</b> până revine Windows-ul.</li>
          <li>La pornire, Kiosk-ul și POS Bridge vor porni automat.</li>
          <li><b>Nu reporni dacă un client comandă chiar acum!</b></li>
        </ul>
      </div>,
      {
        title: `Restart PC Windows — ${displayName || locKey}`,
        icon: <Power className="w-5 h-5 text-rose-500" />,
        okLabel: 'Da, repornește PC-ul',
        cancelLabel: 'Nu, renunță',
        danger: true,
      }
    );
    if (!ok) return;

    const key = `${locKey}-reboot-pc`;
    setActionLoading(key);
    try {
      const res = await fetch(`${apiBase}/api/bridge-monitoring/${locKey}/reboot-pc`, {
        method: 'POST',
        headers: apiHeaders,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setActionFeedback({
          type: 'success',
          text: `Comandă trimisă. Windows (${displayName || locKey}) se repornește acum.`
        });
      } else {
        setActionFeedback({ type: 'error', text: json.error || 'Eroare la trimiterea comenzii de restart PC.' });
      }
    } catch (err) {
      setActionFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionFeedback(null), 5000);
      setTimeout(fetchStatus, 3000);
    }
  };

  const handleRunStartBat = async (locKey, displayName, isBridgeOnline) => {
    const startCmd = `cmd /c "cd /d C:\\SmartKiosk & start-windows.bat"`;
    if (isBridgeOnline) {
      const ok = await confirm(
        `Vrei să lansezi / relansezi scriptul start-windows.bat pe ${displayName || locKey}?`,
        { title: `Lansare start-windows.bat — ${displayName || locKey}`, okLabel: 'Lansează start.bat' }
      );
      if (!ok) return;
      setActionLoading(`${locKey}-start-bat`);
      try {
        if (socket && socket.connected) {
          socket.emit('pc_remote_request', {
            requestId: `start_bat_${Date.now()}`,
            locationId: locKey,
            action: 'run_cmd',
            cmd: 'cmd.exe /c start-windows.bat'
          });
        }
        setActionFeedback({ type: 'success', text: `Comandă trimisă. start-windows.bat a fost lansat pe ${displayName || locKey}.` });
      } catch (err) {
        setActionFeedback({ type: 'error', text: err.message });
      } finally {
        setActionLoading(null);
        setTimeout(() => setActionFeedback(null), 4000);
      }
    } else {
      try {
        navigator.clipboard.writeText(startCmd);
      } catch (_) {}
      await confirm(
        <div className="text-left space-y-3 text-sm">
          <p className="text-amber-600 dark:text-amber-400 font-bold">
            Bridge-ul {displayName || locKey} este DECONECTAT.
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Comanda pentru pornirea manuală a fost <b>copiată în clipboard</b>:
          </p>
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs tabular-nums break-all select-all font-mono">
            {startCmd}
          </div>
          <p className="text-xs text-slate-500">
            Dacă PC-ul este pornit, watchdog-ul local de pe PC îl repornește automat în ~30 secunde. Poți rula această comandă și din Desktop Live (Terminal CMD).
          </p>
        </div>,
        {
          title: `Pornire start-windows.bat — ${displayName || locKey}`,
          okLabel: 'Am înțeles (Comandă copiată)',
          hideCancel: true
        }
      );
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
      return { total: 0, avgLatency: null, successRate: null, lastLatency: null, lastSuccess: null };
    }
    const total = signalLogs.length;
    const successes = signalLogs.filter(l => l.success);
    const successRate = Math.round((successes.length / total) * 100);
    const latencies = successes.map(l => l.latency_ms).filter(n => typeof n === 'number' && !isNaN(n));
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
    const lastLatency = signalLogs[0]?.latency_ms ?? null;
    const lastSuccess = signalLogs[0] ? !!signalLogs[0].success : null;
    return { total, avgLatency, successRate, lastLatency, lastSuccess };
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
    posCancellationAlerts: 'warning',
    ordersAlertsEnabled: true,
  });
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState(null);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [internalKiosksLive, setInternalKiosksLive] = useState(() => {
    try {
      const cached = localStorage.getItem('admin_cached_kiosks_live_status');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
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
            if (dbLoc.forceLocked !== undefined) {
              merged.locations[locKey].forceLocked = Boolean(dbLoc.forceLocked);
            }
            if (dbLoc.id) {
              merged.locations[locKey].dbLocId = dbLoc.id;
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
      try {
        if (merged?.locations && Object.keys(merged.locations).length > 0) {
          localStorage.setItem('admin_cached_bridge_summary', JSON.stringify(merged));
        }
      } catch (_) {}
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
          posCancellationAlerts: merged.telegramConfig.posCancellationAlerts || 'warning',
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
        if (updatedSummary?.locations) {
          setData(prev => {
            if (!prev?.locations) return updatedSummary;
            const mergedLocs = { ...prev.locations };
            for (const [k, loc] of Object.entries(updatedSummary.locations)) {
              const incomingOnline = Boolean(loc?.isBridgeOnline || loc?.status === 'online');
              const prevOnline = Boolean(mergedLocs[k]?.isBridgeOnline || mergedLocs[k]?.status === 'online');
              if (incomingOnline || !prevOnline) {
                mergedLocs[k] = { ...(mergedLocs[k] || {}), ...loc };
              }
            }
            return { ...prev, ...updatedSummary, locations: mergedLocs };
          });
          setLastRefreshed(new Date());
        }
      };
      const onKiosksLive = (statusMap) => {
        if (statusMap) {
          setInternalKiosksLive(prev => {
            const next = { ...prev };
            for (const [k, val] of Object.entries(statusMap)) {
              const incomingOnline = Boolean(val?.isLive || val?.online || (val?.onlineCount > 0));
              const prevOnline = Boolean(next[k]?.isLive || next[k]?.online || (next[k]?.onlineCount > 0));
              if (incomingOnline || !prevOnline) {
                next[k] = val;
              }
            }
            return next;
          });
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
        posCancellationAlerts: telegramForm.posCancellationAlerts || 'warning',
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

  const [sendingQuickPanel, setSendingQuickPanel] = useState(false);

  const handleSendQuickCommandsPanel = async () => {
    setSendingQuickPanel(true);
    setTelegramStatusMsg(null);
    try {
      const res = await fetch(`${backend}/api/bridge-monitoring/telegram-send-quick-commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-live-2024-secure',
        },
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setTelegramStatusMsg({ type: 'success', text: result.message || 'Panoul cu butoane rapide a fost trimis în Grupul de Alerte Telegram!' });
      } else {
        setTelegramStatusMsg({ type: 'error', text: result.error || 'Eroare la trimiterea panoului de comenzi rapide.' });
      }
    } catch (err) {
      setTelegramStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSendingQuickPanel(false);
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
      const isKioskVisible = typeof liveKiosk?.isVisible !== 'undefined'
        ? Boolean(liveKiosk.isVisible)
        : (typeof loc.isKioskVisible !== 'undefined' ? Boolean(loc.isKioskVisible) : true);
      const isUniversalConfig = Boolean(liveKiosk?.isUniversal);
      const kioskScriptVer = liveKiosk?.scriptVersion || null;
      const latestScriptVer = liveKiosk?.latestScriptVersion || '2.4.0';
      const isScriptUpToDate = Boolean(kioskScriptVer && kioskScriptVer === latestScriptVer);

      const bridgeOnlineNow = Boolean(loc.status === 'online' || loc.isBridgeOnline);
      const rawBridgeVersion = loc.bridgeVersion || loc.version || null;
      const latestBridgeVer = BRIDGE_RELEASE_NOTES[0]?.version || loc.latestBridgeVersion || '3.5.4';
      const bridgeVersion = (rawBridgeVersion && rawBridgeVersion !== '1.0.0') ? rawBridgeVersion : latestBridgeVer;
      const backendUpToDate = loc.isBridgeUpToDate !== false && loc.isCodeHashUpToDate !== false;
      const isBridgeUpToDate = bridgeOnlineNow
        ? Boolean(rawBridgeVersion && bridgeVersion === latestBridgeVer && backendUpToDate)
        : true;

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
        isKioskVisible,
        isUniversalConfig,
        kioskScriptVer,
        latestScriptVer,
        isScriptUpToDate,
        bridgeVersion,
        latestBridgeVer,
        codeHash: loc.codeHash || null,
        expectedCodeHash: loc.expectedCodeHash || null,
        isCodeHashUpToDate: loc.isCodeHashUpToDate !== false,
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

  const offlineScrollIndexRef = useRef(0);

  const handleScrollToOffline = useCallback(() => {
    const offlineList = sortedLocationKeys
      .map(k => computedLocations[k])
      .filter(l => l && (l.status !== 'online' || !l.isBridgeOnline));

    if (offlineList.length === 0) return;

    const targetIdx = offlineScrollIndexRef.current % offlineList.length;
    offlineScrollIndexRef.current = targetIdx + 1;
    const targetLoc = offlineList[targetIdx];

    const el = document.getElementById(`loc-card-${targetLoc.locationId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-rose-500', 'ring-offset-4', 'dark:ring-offset-slate-900');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-rose-500', 'ring-offset-4', 'dark:ring-offset-slate-900');
      }, 2500);
    }
  }, [sortedLocationKeys, computedLocations]);

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
    <div className="space-y-5 pb-12 w-full text-left">
      {/* Control & Status Bar - macOS System Settings Header Card */}
      <div className="apple-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white"
            style={{
              backgroundColor: '#007AFF',
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)',
              boxShadow: '0 2px 8px -1px rgba(0,122,255,0.42), inset 0 0.5px 0 rgba(255,255,255,0.35)'
            }}
          >
            <Server className="w-[18px] h-[18px]" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              Stare Echipamente & Conexiuni Locale
            </h1>
            <p className="text-[12px] text-[#86868B] mt-0.5">
              Telemetrie live POS Bridge, imprimante termice și ecrane kiosk
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-[10px] bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/[0.05] dark:border-white/[0.07] tabular-nums">
            <Clock className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
            <span className="font-semibold inline-flex items-center">
              <span>{currentClock.hrs}</span>
              <span className="animate-blink-colon text-[#007AFF] mx-[1px] select-none">:</span>
              <span>{currentClock.mins}</span>
              <span className="animate-blink-colon text-[#007AFF] mx-[1px] select-none">:</span>
              <span>{currentClock.secs}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-[10px] bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/[0.05] dark:border-white/[0.07] tabular-nums">
            <span className={`w-2 h-2 rounded-full shrink-0 ${totalOnlineCount > 0 ? 'bg-[#34C759]' : 'bg-[#8E8E93]'}`} />
            <span>Active: <strong>{totalOnlineCount}</strong></span>
            <span className="text-black/15 dark:text-white/15">|</span>
            {totalOfflineCount > 0 ? (
              <button
                type="button"
                onClick={handleScrollToOffline}
                className="text-[#FF3B30] font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                title="Navighează la kiosk-ul deconectat"
              >
                <span>Deconectate: {totalOfflineCount}</span>
                <ArrowDown className="w-3 h-3 shrink-0" />
              </button>
            ) : (
              <span className="text-[#86868B]">Deconectate: 0</span>
            )}
          </div>

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
                  onClick={() => {
                    setReleaseNotesTargetLoc(null);
                    setIsReleaseNotesOpen(true);
                  }}
                  disabled={actionLoading === 'all-update-all-bridges'}
                  className="apple-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[12px] disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {actionLoading === 'all-update-all-bridges' && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  )}
                  <span>Actualizează v{latestBridgeVerGlobal} ({outdatedLocations.length})</span>
                </button>
              );
            }

            return (
              <button 
                type="button"
                onClick={() => {
                  setReleaseNotesTargetLoc(null);
                  setIsReleaseNotesOpen(true);
                }}
                className="apple-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-[12px] whitespace-nowrap shrink-0"
                title={`Note versiune v${latestBridgeVerGlobal}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#34C759] shrink-0" />
                <span>Soft la zi (v{latestBridgeVerGlobal})</span>
              </button>
            );
          })()}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Reverifică conexiunile"
            className="apple-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-[12px] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#86868B] ${refreshing ? 'animate-spin text-[#007AFF]' : ''} shrink-0`} />
            <span>Reverifică</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className={`p-3.5 rounded-2xl text-[12.5px] font-medium flex items-center gap-2.5 border ${
          actionFeedback.type === 'success'
            ? 'bg-[#34C759]/10 text-[#1D6F32] dark:text-[#30D158] border-[#34C759]/20'
            : 'bg-[#FF3B30]/10 text-[#C41E15] dark:text-[#FF453A] border-[#FF3B30]/20'
        }`}>
          {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-[#34C759]" /> : <AlertCircle className="w-4 h-4 shrink-0 text-[#FF3B30]" />}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Listă Carduri Locații */}
      <div className="flex flex-col gap-4">
        {sortedLocationKeys.map(locKey => {
          const loc = computedLocations[locKey];
          const isOnline = loc.status === 'online';
          const { isKioskConnected, isKioskVisible, isUniversalConfig, kioskScriptVer, latestScriptVer, isScriptUpToDate, isBridgeOnline } = loc;

          return (
            <div
              key={locKey}
              id={`loc-card-${locKey}`}
              className="apple-card p-4 sm:p-5 flex flex-col justify-between scroll-mt-24"
            >
              <div className="space-y-4">
                {/* Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.07]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[11px] bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.05] dark:border-white/[0.08] flex items-center justify-center shrink-0">
                      <BrandLogo brandId={loc.brandId} size={24} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate tracking-tight" title={loc.displayName}>
                        {loc.displayName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11.5px] text-[#86868B]">
                        <span className="truncate select-all" title={loc.serverHost || serverHost}>
                          {loc.serverHost || serverHost}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    if (isBridgeOnline && isKioskConnected) {
                      if (!isKioskVisible) {
                        return (
                          <span className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5 bg-[#FF9500]/12 text-[#C96B00] dark:text-[#FF9F0A] animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
                            <span>Minimizat în bară</span>
                          </span>
                        );
                      }
                      return (
                        <span className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5 bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                          <span>Online</span>
                        </span>
                      );
                    }
                    if (!isBridgeOnline && isKioskConnected) {
                      return (
                        <span className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5 bg-[#FF9500]/12 text-[#C96B00] dark:text-[#FF9F0A]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
                          <span>{!isKioskVisible ? 'Minimizat / Fără POS' : 'POS Oprit'}</span>
                        </span>
                      );
                    }
                    if (isBridgeOnline && !isKioskConnected) {
                      return (
                        <span className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5 bg-[#FF9500]/12 text-[#C96B00] dark:text-[#FF9F0A]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
                          <span>Ecran Inactiv</span>
                        </span>
                      );
                    }
                    return (
                      <span className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5 bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#98989D]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8E8E93]" />
                        <span>Deconectat</span>
                      </span>
                    );
                  })()}
                </div>

                {/* 3-Column Apple Inset Grouped Hardware Sub-Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Coloana 1: Ecran Kiosk */}
                  <div className="apple-inset-group p-3.5 space-y-2.5 text-[12px] flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        <Monitor className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
                        <span>Ecran Kiosk</span>
                      </span>
                      <span className={`text-[11px] font-semibold whitespace-nowrap ${
                        isKioskConnected 
                          ? (isKioskVisible ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#C96B00] dark:text-[#FF9F0A]')
                          : 'text-[#86868B]'
                      }`}>
                        {isKioskConnected ? (isKioskVisible ? 'Conectat' : 'Minimizat') : 'Inactiv'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#6E6E73] dark:text-[#98989D]">Configurație</span>
                      <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {isUniversalConfig ? 'Universală' : 'Manuală'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <span className="text-[#6E6E73] dark:text-[#98989D]">Script Kiosk</span>
                      <div className="flex items-center gap-1.5 tabular-nums">
                        {isKioskConnected ? (
                          <>
                            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {kioskScriptVer ? `v${kioskScriptVer}` : 'Manual'}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-semibold ${
                              isScriptUpToDate
                                ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]'
                                : 'bg-[#FF9500]/15 text-[#C96B00] dark:text-[#FF9F0A]'
                            }`}>
                              {isScriptUpToDate ? 'La zi' : 'Update'}
                            </span>
                          </>
                        ) : (
                          <span className="text-[#86868B]">
                            {kioskScriptVer ? `v${kioskScriptVer}` : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Coloana 2: Terminal POS */}
                  <div className="apple-inset-group p-3.5 space-y-2.5 text-[12px] flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        <Cpu className="w-3.5 h-3.5 text-[#5856D6] shrink-0" />
                        <span>Terminal POS</span>
                      </span>
                      <span className={`text-[11px] font-semibold whitespace-nowrap ${
                        isBridgeOnline ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#C96B00] dark:text-[#FF9F0A]'
                      }`}>
                        {isBridgeOnline ? (loc.port ? `${loc.port} (${loc.gateway || 'raiffeisen'})` : 'Activ') : 'Oprit'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#6E6E73] dark:text-[#98989D]">Semnal POS</span>
                      {loc.posSignal?.testing ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#C96B00] dark:text-[#FF9F0A] animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
                          <span>Se testează...</span>
                        </span>
                      ) : (loc.isCashOnly || loc.isPosEnabled === false) ? (
                        <span className="text-[11.5px] font-medium text-[#86868B]">Doar Cash</span>
                      ) : loc.posSignal ? (
                        <button
                          type="button"
                          onClick={() => openSignalHistory(locKey, loc.displayName, loc.brandId)}
                          title="Vezi istoricul semnalului POS"
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold cursor-pointer hover:opacity-80 transition-opacity tabular-nums"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            loc.posSignal.success
                              ? (loc.posSignal.latencyMs < 100 ? 'bg-[#34C759]' : 'bg-[#FF9500]')
                              : 'bg-[#FF3B30]'
                          }`} />
                          <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {loc.posSignal.success ? `${loc.posSignal.latencyMs}ms` : (loc.posSignal.message || 'Eroare')}
                          </span>
                          <span className="text-[10.5px] font-medium text-[#007AFF] dark:text-[#0A84FF]">Istoric</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openSignalHistory(locKey, loc.displayName, loc.brandId)}
                          className="text-[11.5px] font-medium text-[#007AFF] dark:text-[#0A84FF] hover:underline cursor-pointer"
                        >
                          Netestat · Istoric
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <span className="text-[#6E6E73] dark:text-[#98989D]">Trezire Standby</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                          {loc.posWakeStandby ? `${loc.posWakeIntervalMinutes || 5}m` : 'Oprit'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(loc.posWakeStandby)}
                          onClick={() => handleToggleWake(locKey, loc.posWakeStandby, loc.posWakeIntervalMinutes)}
                          className={`apple-switch apple-switch-sm ${loc.posWakeStandby ? 'is-on' : ''}`}
                        >
                          <span className="apple-switch-thumb" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <span className="text-[#6E6E73] dark:text-[#98989D]">Instanță Duplicat</span>
                      {loc.duplicateDetected ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[#FF3B30]">Detectată</span>
                          <button
                            type="button"
                            onClick={() => handleResolveDuplicate(locKey, loc.displayName)}
                            disabled={actionLoading === `${locKey}-resolve-duplicate`}
                            className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white bg-[#FF3B30] hover:bg-[#D70015] cursor-pointer"
                          >
                            {actionLoading === `${locKey}-resolve-duplicate` ? '...' : 'Rezolvă'}
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-[#248A3D] dark:text-[#30D158]">Unică</span>
                      )}
                    </div>
                  </div>

                  {/* Coloana 3: Imprimantă & Uptime */}
                  <div className="apple-inset-group p-3.5 space-y-2.5 text-[12px] flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        <Printer className="w-3.5 h-3.5 text-[#AF52DE] shrink-0" />
                        <span>Imprimantă & Uptime</span>
                      </span>
                      <span className={`text-[11px] font-semibold whitespace-nowrap ${
                        loc.printerName && loc.printerName !== 'Nedetectată'
                          ? 'text-[#248A3D] dark:text-[#30D158]'
                          : 'text-[#86868B]'
                      }`}>
                        {loc.printerName && loc.printerName !== 'Nedetectată' ? 'Pregătită' : 'Nedetectată'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#6E6E73] dark:text-[#98989D]">Model</span>
                      <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate ml-2 text-right" title={loc.printerName || 'Nedetectată'}>
                        {loc.printerName || 'Nedetectată'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <span className="text-[#6E6E73] dark:text-[#98989D]">Soft PC</span>
                      <div className="flex items-center gap-1.5 tabular-nums">
                        {isBridgeOnline ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsReleaseNotesOpen(true)}
                              className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#007AFF] cursor-pointer"
                            >
                              v{loc.bridgeVersion || loc.latestBridgeVer || '3.5.4'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReleaseNotesTargetLoc(locKey);
                                setIsReleaseNotesOpen(true);
                              }}
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold cursor-pointer ${
                                loc.isBridgeUpToDate
                                  ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]'
                                  : 'bg-[#FF9500]/15 text-[#C96B00] dark:text-[#FF9F0A]'
                              }`}
                            >
                              {loc.isBridgeUpToDate
                                ? 'La zi'
                                : (loc.bridgeVersion === loc.latestBridgeVer ? 'Cod vechi' : `Nou v${loc.latestBridgeVer}`)}
                            </button>
                          </>
                        ) : (
                          <span className="text-[#86868B]">
                            v{loc.bridgeVersion || loc.latestBridgeVer || '3.5.4'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <span className="text-[#6E6E73] dark:text-[#98989D]">Ultimul Semnal</span>
                      <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                        {isBridgeOnline ? (
                          loc.lastPingSecondsAgo !== null && loc.lastPingSecondsAgo < 120 
                            ? `acum ${loc.lastPingSecondsAgo}s` 
                            : 'activ'
                        ) : (
                          <span className="text-[#86868B]">offline</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <span className="text-[#6E6E73] dark:text-[#98989D]">Uptime</span>
                      <div className="flex items-center justify-end text-right tabular-nums">
                        {isBridgeOnline && loc.uptimeSeconds > 0 ? (
                          renderDigitalTimer(loc.uptimeSeconds)
                        ) : (
                          <span className="text-[#86868B]">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actionable Alerts ONLY (Apple HIG: no redundant green banner on healthy cards) */}
                {loc.duplicateDetected && (
                  <div className="p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[12px] text-[#C41E15] dark:text-[#FF453A] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Instanță duplicat detectată în fundal. Oprește procesele extra pentru stabilitate POS.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResolveDuplicate(locKey, loc.displayName)}
                      disabled={actionLoading === `${locKey}-resolve-duplicate`}
                      className="px-3 py-1 rounded-full text-[11px] font-semibold text-white bg-[#FF3B30] hover:bg-[#D70015] shrink-0 cursor-pointer"
                    >
                      {actionLoading === `${locKey}-resolve-duplicate` ? 'Se oprește...' : 'Oprește Duplicat'}
                    </button>
                  </div>
                )}

                {!isOnline && (
                  <div className="p-3 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20 text-[12px] text-[#9A5200] dark:text-[#FF9F0A] flex items-center justify-between gap-2">
                    <span>POS Bridge deconectat pe această locație.</span>
                    <button
                      type="button"
                      onClick={() => {
                        const num = { cluj1: '1', cluj2: '2', 'sm-brasov': '3', constanta1: '4', constanta2: '5' }[locKey] || '3';
                        const cmd = `cmd /c "mkdir C:\\SmartKiosk 2>nul & cd /d C:\\SmartKiosk & curl -s -L -o setup.bat https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/setup_kiosk_autostart.bat & setup.bat ${num}"`;
                        navigator.clipboard.writeText(cmd);
                        setActionFeedback({ type: 'success', text: `Comanda de pornire pentru ${loc.displayName} a fost copiată!` });
                        setTimeout(() => setActionFeedback(null), 3000);
                      }}
                      className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#FF9500] hover:bg-[#E08300] text-white shrink-0 cursor-pointer transition-colors"
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

                {/* Action Buttons: 8-column responsive grid */}
                {/* Action Buttons: Unified Apple Control Center row */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2">
                    {!loc.isBridgeUpToDate ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReleaseNotesTargetLoc(locKey);
                          setIsReleaseNotesOpen(true);
                        }}
                        disabled={actionLoading === `${locKey}-restart-bridge` || restartProgress[locKey]?.status === 'pending'}
                        title={
                          loc.bridgeVersion === loc.latestBridgeVer
                            ? `Actualizează codul POS Bridge (${loc.codeHash ? `#${loc.codeHash}` : 'fără amprentă'} → #${loc.expectedCodeHash || 'oficial'})`
                            : `Actualizează POS Bridge la v${loc.latestBridgeVer} pe acest aparat`
                        }
                        className="flex items-center justify-center gap-1.5 py-2 px-1.5 sm:px-2 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${actionLoading === `${locKey}-restart-bridge` ? 'animate-spin' : ''}`} />
                        <span>{loc.bridgeVersion === loc.latestBridgeVer ? 'Update cod' : `Update v${loc.latestBridgeVer}`}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRestartBridge(locKey, loc.displayName, !!isBridgeOnline)}
                        disabled={actionLoading === `${locKey}-restart-bridge` || restartProgress[locKey]?.status === 'pending'}
                        title="Restart POS Bridge (repornește conexiunea POS & imprimantă) — cere confirmare"
                        className="apple-btn-secondary flex items-center justify-center gap-1.5 py-2 px-2.5 text-[12px] disabled:opacity-50 whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 shrink-0 text-[#007AFF] dark:text-[#0A84FF] ${actionLoading === `${locKey}-restart-bridge` ? 'animate-spin' : ''}`} />
                        <span>Bridge</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAction(locKey, 'reload-kiosk')}
                      disabled={actionLoading === `${locKey}-reload-kiosk`}
                      title="Refresh Ecran Kiosk (reîncarcă pagina Kiosk din browser)"
                      className="apple-btn-secondary flex items-center justify-center gap-1.5 py-2 px-2.5 text-[12px] disabled:opacity-50 whitespace-nowrap"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 shrink-0 text-[#007AFF] dark:text-[#0A84FF] ${actionLoading === `${locKey}-reload-kiosk` ? 'animate-spin' : ''}`} />
                      <span>Ecran</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(locKey, 'fullscreen-kiosk')}
                      disabled={actionLoading === `${locKey}-fullscreen-kiosk`}
                      title="Intră instant în modul Fullscreen pe ecranul Kiosk (fără reîncărcare de pagină, fără întrerupere comenzi)"
                      className="apple-btn-secondary flex items-center justify-center gap-1.5 py-2 px-2.5 text-[12px] disabled:opacity-50 whitespace-nowrap"
                    >
                      <Maximize2 className={`w-3.5 h-3.5 shrink-0 text-[#5856D6] dark:text-[#7D7AFF] ${actionLoading === `${locKey}-fullscreen-kiosk` ? 'animate-pulse' : ''}`} />
                      <span>Fullscreen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(locKey, 'test-pos-signal')}
                      disabled={actionLoading === `${locKey}-test-pos-signal`}
                      title="Testează semnalul și latența magistralei seriale cu POS-ul"
                      className="apple-btn-secondary flex items-center justify-center gap-1.5 py-2 px-2.5 text-[12px] disabled:opacity-50 whitespace-nowrap"
                    >
                      <Radio className={`w-3.5 h-3.5 shrink-0 ${actionLoading === `${locKey}-test-pos-signal` ? 'animate-pulse text-[#34C759]' : 'text-[#34C759]'}`} />
                      <span>Semnal POS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(locKey, 'test-print')}
                      disabled={actionLoading === `${locKey}-test-print`}
                      title="Scoate un bon de probă pe imprimanta termică din locație"
                      className="apple-btn-secondary flex items-center justify-center gap-1.5 py-2 px-2.5 text-[12px] disabled:opacity-50 whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#AF52DE] shrink-0" />
                      <span>Test Bon</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleLock(locKey, loc.dbLocId || locKey, loc.forceLocked)}
                      disabled={actionLoading === `${locKey}-toggle-lock`}
                      title={loc.forceLocked ? "Deblochează Kiosk-ul (înlătură ecranul PIN)" : "Blochează Kiosk-ul rapid cu ecran PIN"}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-full text-[12px] transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap active:scale-95 ${
                        loc.forceLocked
                          ? 'bg-[#34C759] hover:bg-[#28B34B] text-white font-semibold shadow-[0_2px_8px_-1px_rgba(52,199,89,0.4)]'
                          : 'apple-btn-secondary'
                      }`}
                    >
                      {loc.forceLocked ? (
                        <Unlock className={`w-3.5 h-3.5 shrink-0 ${actionLoading === `${locKey}-toggle-lock` ? 'animate-spin' : ''}`} />
                      ) : (
                        <Lock className={`w-3.5 h-3.5 shrink-0 text-[#FF9500] ${actionLoading === `${locKey}-toggle-lock` ? 'animate-spin' : ''}`} />
                      )}
                      <span>{loc.forceLocked ? 'Deblocat' : 'Blocare PIN'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRebootPc(locKey, loc.displayName)}
                      disabled={actionLoading === `${locKey}-reboot-pc`}
                      title="Repornește sistemul Windows fizic pe acest Kiosk (cere confirmare)"
                      className="apple-btn-secondary hover:!bg-[#FF3B30]/[0.09] hover:!border-[#FF3B30]/30 hover:!text-[#FF3B30] flex items-center justify-center gap-1.5 py-2 px-2.5 text-[12px] disabled:opacity-50 whitespace-nowrap"
                    >
                      <Power className={`w-3.5 h-3.5 text-[#FF3B30] shrink-0 ${actionLoading === `${locKey}-reboot-pc` ? 'animate-spin' : ''}`} />
                      <span>Restart PC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunStartBat(locKey, loc.displayName, !!isBridgeOnline)}
                      disabled={actionLoading === `${locKey}-start-bat`}
                      title="Lansează sau copiază comanda de pornire start-windows.bat"
                      className="apple-btn-secondary flex items-center justify-center gap-1.5 py-2 px-2.5 text-[12px] disabled:opacity-50 whitespace-nowrap"
                    >
                      <Play className={`w-3.5 h-3.5 text-[#34C759] shrink-0 ${actionLoading === `${locKey}-start-bat` ? 'animate-spin' : ''}`} />
                      <span>Start.bat</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Universal Command Box - Clean Apple Card */}
      <div className="apple-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white"
              style={{
                backgroundColor: '#1D1D1F',
                backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0.12) 100%)',
                boxShadow: '0 2px 8px -1px rgba(0,0,0,0.32), inset 0 0.5px 0 rgba(255,255,255,0.28)'
              }}
            >
              <Terminal className="w-4 h-4" strokeWidth={2.1} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                Comandă Universală Configurare Kiosk
              </h3>
              <p className="text-[11.5px] text-[#86868B]">Brașov, Cluj, Constanța — instalare & pornire automată Windows</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyCommand}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] shrink-0 ${
              copiedCommand
                ? 'rounded-[10px] bg-[#34C759] text-white font-semibold cursor-pointer'
                : 'apple-btn-primary'
            }`}
          >
            {copiedCommand ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCommand ? 'Copiat' : 'Copiază Comanda'}</span>
          </button>
        </div>

        <div className="apple-inset-group p-3.5 font-mono text-[11.5px] text-[#1D1D1F] dark:text-[#E5E5EA] select-all break-all leading-relaxed">
          <code>{UNIVERSAL_COMMAND}</code>
        </div>
      </div>

      {/* Telegram Alert Settings Panel — True macOS System Settings Inset Grouped Design */}
      <div className="apple-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white"
              style={{
                backgroundColor: '#007AFF',
                backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)',
                boxShadow: '0 2px 8px -1px rgba(0,122,255,0.42), inset 0 0.5px 0 rgba(255,255,255,0.35)'
              }}
            >
              <Sliders className="w-4 h-4" strokeWidth={2.1} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                Configurare Alerte Telegram
              </h2>
              <p className="text-[11.5px] text-[#86868B]">
                Notificări automate pentru hardware, plăți POS și comenzi live
              </p>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${
            data.telegramConfig?.enabled && data.telegramConfig?.botTokenConfigured
              ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]'
              : 'bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#98989D]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              data.telegramConfig?.enabled && data.telegramConfig?.botTokenConfigured ? 'bg-[#34C759]' : 'bg-[#8E8E93]'
            }`} />
            <span>{data.telegramConfig?.enabled ? 'Alerte Active' : 'Dezactivate'}</span>
          </span>
        </div>

        {telegramStatusMsg && (
          <div className={`mt-4 p-3.5 rounded-xl text-[12px] font-medium flex items-center gap-2.5 border ${
            telegramStatusMsg.type === 'success'
              ? 'bg-[#34C759]/10 text-[#1D6F32] dark:text-[#30D158] border-[#34C759]/20'
              : 'bg-[#FF3B30]/10 text-[#C41E15] dark:text-[#FF453A] border-[#FF3B30]/20'
          }`}>
            {telegramStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-[#34C759]" /> : <AlertCircle className="w-4 h-4 shrink-0 text-[#FF3B30]" />}
            <span>{telegramStatusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveTelegram} className="mt-5 space-y-5">
          {/* Master Toggle Row — Authentic Apple Toggle Switch (NO native checkbox!) */}
          <div className="apple-inset-group px-4 py-3.5 flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Trimitere automată alerte Telegram
              </div>
              <div className="text-[11.5px] text-[#86868B] mt-0.5">
                Activează notificările în timp real către grupurile configurate mai jos
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(telegramForm.enabled)}
              onClick={() => setTelegramForm(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`apple-switch ${telegramForm.enabled ? 'is-on' : ''}`}
            >
              <span className="apple-switch-thumb" />
            </button>
          </div>

          {/* Inset Grouped Credentials & Group IDs */}
          <div className="apple-inset-group p-4 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Bot & Grupuri Destinație
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  value={telegramForm.botToken}
                  onChange={(e) => setTelegramForm(prev => ({ ...prev, botToken: e.target.value }))}
                  placeholder={data.telegramConfig?.botTokenConfigured ? `Configurat: ${data.telegramConfig.botTokenMasked}` : 'Ex: 123456789:ABCdef...'}
                  className="apple-input w-full px-3 py-2 text-[12.5px] bg-white dark:bg-[#1C1C1E]"
                />
                <p className="text-[11px] text-[#86868B]">
                  Obținut din conversația cu @BotFather pe Telegram.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Grup 1 — Status & Hardware
                </label>
                <input
                  type="text"
                  value={telegramForm.chatId}
                  onChange={(e) => setTelegramForm(prev => ({ ...prev, chatId: e.target.value }))}
                  placeholder="Ex: -5489923676"
                  className="apple-input w-full px-3 py-2 text-[12.5px] bg-white dark:bg-[#1C1C1E] tabular-nums"
                />
                <p className="text-[11px] text-[#86868B]">
                  Alerte online/offline, erori iiko și imprimantă.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Grup 2 — Tranzacții POS
                </label>
                <input
                  type="text"
                  value={telegramForm.posChatId}
                  onChange={(e) => setTelegramForm(prev => ({ ...prev, posChatId: e.target.value }))}
                  placeholder="Ex: -5554201057"
                  className="apple-input w-full px-3 py-2 text-[12.5px] bg-white dark:bg-[#1C1C1E] tabular-nums"
                />
                <p className="text-[11px] text-[#86868B]">
                  Plăți POS live aprobate și respinse cu motiv detaliat.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Grup 3 — Comenzi Live
                </label>
                <input
                  type="text"
                  value={telegramForm.ordersChatId}
                  onChange={(e) => setTelegramForm(prev => ({ ...prev, ordersChatId: e.target.value }))}
                  placeholder="Ex: -5209173668"
                  className="apple-input w-full px-3 py-2 text-[12.5px] bg-white dark:bg-[#1C1C1E] tabular-nums"
                />
                <p className="text-[11px] text-[#86868B]">
                  Toate comenzile plasate pe kiosk (produse, opțiuni, total).
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12.5px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Perioadă antiflood alerte
                </div>
                <div className="text-[11px] text-[#86868B]">
                  Interval minim între două notificări identice (minute)
                </div>
              </div>
              <input
                type="number"
                min="1"
                max="60"
                value={telegramForm.alertCooldownMinutes}
                onChange={(e) => setTelegramForm(prev => ({ ...prev, alertCooldownMinutes: e.target.value }))}
                className="apple-input w-20 px-3 py-1.5 text-[13px] font-semibold text-center bg-white dark:bg-[#1C1C1E] tabular-nums"
              />
            </div>
          </div>

          {/* Apple System Settings Selection Lists (ZERO native radios, ZERO emojis, ZERO yellow box!) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Filtru Mesaje POS (Grup 2) */}
            <div className="apple-inset-group p-4 space-y-3">
              <div>
                <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Mesaje Notificări POS (Grup 2)
                </div>
                <p className="text-[11.5px] text-[#86868B] mt-0.5">
                  Tipurile de plăți trimise în grupul dedicat POS
                </p>
              </div>

              <div className="rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] overflow-hidden">
                {[
                  { id: 'all', label: 'Toate tranzacțiile', desc: 'Aprobate și respinse', dot: '#34C759' },
                  { id: 'approved_only', label: 'Doar aprobate', desc: 'Exclude refuzurile POS', dot: '#34C759' },
                  { id: 'rejected_only', label: 'Doar respinse', desc: 'Doar refuzuri și erori', dot: '#FF3B30' },
                  { id: 'none', label: 'Oprite', desc: 'Niciun mesaj în grupul POS', dot: '#8E8E93' },
                ].map(opt => {
                  const isChecked = (telegramForm.posAlertsFilter || 'all') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTelegramForm(prev => ({ ...prev, posAlertsFilter: opt.id }))}
                      className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-[#007AFF]/[0.06] dark:bg-[#0A84FF]/[0.12]'
                          : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dot }} />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{opt.label}</div>
                          <div className="text-[11px] text-[#86868B]">{opt.desc}</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isChecked
                          ? 'bg-[#007AFF] text-white'
                          : 'border border-black/20 dark:border-white/20'
                      }`}>
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Anulări Client + Toggle Comenzi Noi */}
            <div className="flex flex-col gap-4">
              <div className="apple-inset-group p-4 space-y-3">
                <div>
                  <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Alerte Anulări Client (Ecran / Tasta X)
                  </div>
                  <p className="text-[11.5px] text-[#86868B] mt-0.5">
                    Cum se raportează anulările făcute de clienți la kiosk
                  </p>
                </div>

                <div className="rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] overflow-hidden">
                  {[
                    {
                      id: 'warning',
                      label: 'Notificare informativă',
                      desc: 'Trimite ca [ANULATĂ DE CLIENT], fără alertă roșie',
                      dot: '#FF9500',
                    },
                    {
                      id: 'ignore',
                      label: 'Fără notificare',
                      desc: 'Ignoră anulările voluntare ale clienților pe Telegram',
                      dot: '#8E8E93',
                    },
                  ].map(opt => {
                    const isChecked = (telegramForm.posCancellationAlerts || 'warning') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTelegramForm(prev => ({ ...prev, posCancellationAlerts: opt.id }))}
                        className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-[#007AFF]/[0.06] dark:bg-[#0A84FF]/[0.12]'
                            : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dot }} />
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{opt.label}</div>
                            <div className="text-[11px] text-[#86868B]">{opt.desc}</div>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          isChecked
                            ? 'bg-[#007AFF] text-white'
                            : 'border border-black/20 dark:border-white/20'
                        }`}>
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle Alerte Comenzi Live (Grup 3) */}
              <div className="apple-inset-group p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Notificări Comenzi Noi (Grup 3)
                  </div>
                  <p className="text-[11.5px] text-[#86868B] mt-0.5">
                    {telegramForm.ordersAlertsEnabled !== false ? 'Comenzile finalizate sunt trimise pe Telegram' : 'Notificările pentru comenzi sunt oprite'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={telegramForm.ordersAlertsEnabled !== false}
                  onClick={() => setTelegramForm(prev => ({ ...prev, ordersAlertsEnabled: prev.ordersAlertsEnabled === false ? true : false }))}
                  className={`apple-switch ${telegramForm.ordersAlertsEnabled !== false ? 'is-on' : ''}`}
                >
                  <span className="apple-switch-thumb" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
            <button
              type="submit"
              disabled={savingTelegram}
              className="apple-btn-primary px-4 py-2 text-[12.5px] disabled:opacity-50"
            >
              {savingTelegram ? 'Se salvează...' : 'Salvează Setările'}
            </button>

            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTelegram}
              className="apple-btn-secondary flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${testingTelegram ? 'animate-pulse' : ''}`} />
              <span>{testingTelegram ? 'Se trimite...' : 'Trimite Test'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendQuickCommandsPanel}
              disabled={sendingQuickPanel || !data.telegramConfig?.enabled}
              className="apple-btn-secondary flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] disabled:opacity-40"
              title="Trimite panoul interactiv cu butoane rapide direct în Grupul 1"
            >
              <Zap className={`w-3.5 h-3.5 text-[#007AFF] ${sendingQuickPanel ? 'animate-spin' : ''}`} />
              <span>{sendingQuickPanel ? 'Se trimite...' : 'Trimite Butoane Rapide'}</span>
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
          if (st === 'completed') return { cls: 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]', txt: 'Repornit' };
          if (st === 'pending') return { cls: 'bg-[#007AFF]/12 text-[#007AFF] dark:text-[#0A84FF]', txt: 'În curs' };
          if (st === 'timeout') return { cls: 'bg-[#FF3B30]/12 text-[#D70015] dark:text-[#FF453A]', txt: 'Nu a revenit' };
          if (st === 'failed') return { cls: 'bg-[#FF3B30]/12 text-[#D70015] dark:text-[#FF453A]', txt: 'Nelivrat (offline)' };
          return { cls: 'bg-black/[0.06] dark:bg-white/[0.1] text-[#6E6E73]', txt: st || '—' };
        };
        return (
          <div className="apple-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
              <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#007AFF]" />
                <span>Jurnal Restartări POS Bridge</span>
              </h2>
              <select
                value={restartLogFilter}
                onChange={e => { setRestartLogFilter(e.target.value); setRestartLogLimit(15); }}
                className="apple-input text-[12px] font-medium px-3 py-1.5 cursor-pointer"
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
                                {manual ? 'Manual (Admin)' : 'Automat / din locație'}
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
      <div className="apple-card p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#007AFF]" />
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
        <div
          onClick={() => setSignalModalLoc(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-modal max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[11px] bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.05] dark:border-white/[0.08] flex items-center justify-center shrink-0">
                  <BrandLogo brandId={signalModalLoc.brandId} size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                      Istoric Semnal POS & Latență UART
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#007AFF]/12 text-[#007AFF] dark:text-[#0A84FF] shrink-0">
                      Live
                    </span>
                  </div>
                  <p className="text-[12px] text-[#86868B] truncate">
                    {signalModalLoc.displayName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSignalModalLoc(null)}
                className="apple-close-btn"
                title="Închide"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Quick Stats Cards */}
            <div className="p-5 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ultimul Semnal</span>
                <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block">
                  {signalStats.lastLatency !== null ? `${signalStats.lastLatency}ms` : '—'}
                </span>
                <span className={`text-[10px] font-semibold ${
                  signalStats.lastSuccess === false
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {signalStats.lastSuccess === false
                    ? 'Timeout / Fără răspuns'
                    : (signalStats.lastLatency !== null && signalStats.lastLatency < 100 ? 'Excelent' : (signalStats.lastLatency !== null ? 'Normal' : 'Netestat'))}
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
                  className="apple-btn-primary text-[12px] px-3 py-1.5"
                >
                  <Zap className={`w-3.5 h-3.5 ${actionLoading === `${signalModalLoc.locKey}-test-pos-signal` ? 'animate-spin' : ''}`} />
                  <span>{actionLoading === `${signalModalLoc.locKey}-test-pos-signal` ? 'Se testează...' : 'Testează Acum'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchSignalLogs(signalModalLoc.locKey)}
                  disabled={loadingSignalLogs}
                  className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 transition-colors"
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
                    className="px-3.5 py-2 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 cursor-pointer transition-colors"
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
                className="px-4 py-2 rounded-full text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer shadow-xs transition-colors"
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
        onClose={() => {
          setIsReleaseNotesOpen(false);
          setReleaseNotesTargetLoc(null);
        }}
        initialVersion={BRIDGE_RELEASE_NOTES[0]?.version || '3.5.0'}
        targetLocation={releaseNotesTargetLoc}
        canUpdate={Object.values(computedLocations).some(l => l.isBridgeOnline && (l.bridgeVersion !== (BRIDGE_RELEASE_NOTES[0]?.version || '3.5.0') || !l.isBridgeUpToDate))}
        outdatedCount={Object.values(computedLocations).filter(l => l.isBridgeOnline && (l.bridgeVersion !== (BRIDGE_RELEASE_NOTES[0]?.version || '3.5.0') || !l.isBridgeUpToDate)).length}
        isUpdating={actionLoading === 'all-update-all-bridges'}
        onUpdate={async (version, selectedIds) => {
          const isAll = !selectedIds || selectedIds.length === 0 || selectedIds.length === 4;
          try {
            await fetch(`${backend}/api/bridge-monitoring/update-all-bridges`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'sk-live-2024-secure',
              },
              body: JSON.stringify({ locations: isAll ? undefined : selectedIds }),
            });
          } catch (err) {
            console.error('Eroare actualizare bridge:', err);
          }
        }}
        onCompleteUpdate={handleCompleteUpdate}
      />
    </div>
  );
}
