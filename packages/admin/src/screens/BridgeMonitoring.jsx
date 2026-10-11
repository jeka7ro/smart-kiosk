import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  RotateCcw
} from 'lucide-react';

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

  // Hardware action state
  const [actionLoading, setActionLoading] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  const handleAction = async (locationId, actionType) => {
    const key = `${locationId}-${actionType}`;
    setActionLoading(key);
    setActionFeedback(null);
    try {
      const endpoint = locationId === 'all' && actionType === 'reload-kiosk'
        ? `${backend}/api/bridge-monitoring/reload-all-kiosks`
        : `${backend}/api/bridge-monitoring/${locationId}/${actionType}`;
      const ttEndpoint = locationId === 'all' && actionType === 'reload-kiosk'
        ? 'https://smart-kiosk-ttut.onrender.com/api/bridge-monitoring/reload-all-kiosks'
        : `https://smart-kiosk-ttut.onrender.com/api/bridge-monitoring/${locationId}/${actionType}`;

      const [resPrimary, resTt] = await Promise.all([
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'sk-live-2024-secure',
          },
        }).catch(() => null),
        fetch(ttEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'sk-live-2024-secure',
          },
        }).catch(() => null),
      ]);

      const res = resPrimary && resPrimary.ok ? resPrimary : (resTt || resPrimary);
      const json = res ? await res.json().catch(() => ({})) : {};
      if (res && res.ok) {
        setActionFeedback({ type: 'success', text: json.message || 'Comandă transmisă cu succes.' });
      } else {
        setActionFeedback({ type: 'error', text: json.error || 'Eroare la transmiterea comenzii.' });
      }
    } catch (err) {
      setActionFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  // Telegram form state
  const [telegramForm, setTelegramForm] = useState({
    enabled: false,
    botToken: '',
    chatId: '',
    alertCooldownMinutes: 10,
  });
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState(null);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [internalKiosksLive, setInternalKiosksLive] = useState({});

  const fetchStatus = useCallback(async () => {
    try {
      const [resBridge, resTtBridge, resKiosks] = await Promise.all([
        fetch(`${backend}/api/bridge-monitoring/status`, {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }),
        fetch('https://smart-kiosk-ttut.onrender.com/api/bridge-monitoring/status', {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).catch(() => null),
        fetch(`${backend}/api/locations/live-status`, {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).catch(() => null)
      ]);

      if (resBridge && resBridge.ok) {
        const json = await resBridge.json();
        if (resTtBridge && resTtBridge.ok) {
          try {
            const ttJson = await resTtBridge.json();
            if (ttJson?.locations) {
              for (const [k, loc] of Object.entries(ttJson.locations)) {
                if (loc.isBridgeOnline && (!json.locations[k] || !json.locations[k].isBridgeOnline)) {
                  json.locations[k] = { ...json.locations[k], ...loc, isBridgeOnline: true, status: 'online' };
                }
              }
            }
          } catch (_) {}
        }
        setData(json);
        if (json.telegramConfig) {
          setTelegramForm(prev => ({
            ...prev,
            enabled: !!json.telegramConfig.enabled,
            chatId: json.telegramConfig.chatId || '',
            alertCooldownMinutes: json.telegramConfig.alertCooldownMinutes || 10,
          }));
        }
        setLastRefreshed(new Date());
      }

      if (resKiosks && resKiosks.ok) {
        const kJson = await resKiosks.json();
        if (kJson?.liveStatus) {
          setInternalKiosksLive(kJson.liveStatus);
        }
      }
    } catch (err) {
      console.error('[BridgeMonitoring] Fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [backend]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // Auto-refresh every 15s

    // Real-time Socket.IO listener
    if (socket) {
      const onBridgeUpdate = (updatedSummary) => {
        if (updatedSummary) {
          setData(prev => {
            const merged = { ...updatedSummary, locations: { ...(updatedSummary.locations || {}) } };
            if (prev?.locations) {
              for (const [k, loc] of Object.entries(prev.locations)) {
                if (loc.isBridgeOnline && (!merged.locations[k] || !merged.locations[k].isBridgeOnline)) {
                  merged.locations[k] = { ...merged.locations[k], ...loc, isBridgeOnline: true, status: 'online' };
                }
              }
            }
            return merged;
          });
          setLastRefreshed(new Date());
        }
      };
      const onKiosksLive = (statusMap) => {
        if (statusMap) {
          setInternalKiosksLive(statusMap);
        }
      };

      socket.on('bridge_status_update', onBridgeUpdate);
      socket.on('kiosks_live_status', onKiosksLive);

      return () => {
        clearInterval(interval);
        socket.off('bridge_status_update', onBridgeUpdate);
        socket.off('kiosks_live_status', onKiosksLive);
      };
    }

    return () => {
      clearInterval(interval);
    };
  }, [fetchStatus, socket]);

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
        alertCooldownMinutes: Number(telegramForm.alertCooldownMinutes) || 10,
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

  const formatUptime = (seconds) => {
    if (!seconds || seconds <= 0) return 'Sub 1 minut';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const locationKeys = useMemo(() => ['cluj1', 'cluj2', 'sm-brasov', 'constanta1'], []);

  const computedLocations = useMemo(() => {
    const friendlyNames = {
      cluj1: 'Cluj 1 (Centru)',
      cluj2: 'Cluj 2',
      'sm-brasov': 'Brașov (RollMaster)',
      constanta1: 'Constanța 1',
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

      const displayName = loc.displayName && loc.displayName !== locKey ? loc.displayName : (friendlyNames[locKey] || locKey);
      const isBridgeOnline = Boolean(loc.status === 'online' || loc.isBridgeOnline);
      const hasRecentConnection = Boolean(loc.connectedAt && (Date.now() - loc.connectedAt < 12 * 3600 * 1000) && loc.port && loc.port !== 'N/A');
      const isOnline = isBridgeOnline || isKioskConnected || hasRecentConnection;

      result[locKey] = {
        ...loc,
        displayName,
        status: isOnline ? 'online' : 'offline',
        isBridgeOnline,
        isKioskConnected,
        isUniversalConfig,
        kioskScriptVer,
        latestScriptVer,
        isScriptUpToDate,
        hasRecentConnection,
      };
    });
    return result;
  }, [data.locations, kiosksLiveStatus, internalKiosksLive, locationKeys]);

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
    <div className="space-y-6 px-4 md:px-8 pb-12">
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
          <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-600/50 shadow-inner">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Active: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{totalOnlineCount}</strong></span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className={totalOfflineCount > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400'}>
              Deconectate: <strong>{totalOfflineCount}</strong>
            </span>
          </div>

          {/* Buton Global Actualizează Toate Kiosk-urile */}
          <button
            type="button"
            onClick={() => handleAction('all', 'reload-kiosk')}
            disabled={actionLoading === 'all-reload-kiosk'}
            title="Trimite semnalul de reload și actualizare pe toate Kiosk-urile"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${actionLoading === 'all-reload-kiosk' ? 'animate-spin' : ''} shrink-0`} />
            <span className="whitespace-nowrap">Actualizează Toate Kiosk-urile</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-xs transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''} shrink-0`} />
            <span className="whitespace-nowrap">Actualizează</span>
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

      {/* Grid Status Locații */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4.5">
        {locationKeys.map(locKey => {
          const loc = computedLocations[locKey];
          const isOnline = loc.status === 'online';
          const { isKioskConnected, isUniversalConfig, kioskScriptVer, latestScriptVer, isScriptUpToDate, isBridgeOnline } = loc;

          return (
            <div
              key={locKey}
              className="group p-4 md:p-5 rounded-3xl border transition-all duration-300 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500 shadow-xs hover:shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Card Header with Location Pill & Online State */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="min-w-0 flex-1">
                    <span className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 mb-1">
                      {loc.locationId}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight" title={loc.displayName}>
                      {loc.displayName}
                    </h3>
                  </div>

                  <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shrink-0 shadow-xs whitespace-nowrap ${
                    isOnline
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="whitespace-nowrap">{isOnline ? 'ONLINE' : 'DECONECTAT'}</span>
                  </div>
                </div>

                {/* Sub-container 1: Ecran Kiosk & OTA Status */}
                <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2 text-xs">
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
                    <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Versiune Script:</span>
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

                {/* Sub-container 2: Hardware POS & Imprimanta */}
                <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2 text-xs">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="whitespace-nowrap">POS & Imprimantă</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                      isBridgeOnline 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' 
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                    }`}>
                      {isBridgeOnline ? 'Bridge activ' : 'Oprit'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                    <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Port Serial:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {loc.port || 'COM?'} ({loc.gateway || 'raiffeisen'})
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                    <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Imprimantă:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px] whitespace-nowrap text-right" title={loc.printerName || 'Nedetectată'}>
                      {loc.printerName || 'Nedetectată'}
                    </span>
                  </div>

                  {isBridgeOnline && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Ultimul Semnal:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-right">
                        {loc.lastPingSecondsAgo !== null && loc.lastPingSecondsAgo < 120 
                          ? `acum ${loc.lastPingSecondsAgo}s` 
                          : 'activ'}
                      </span>
                    </div>
                  )}

                  {isOnline && loc.uptimeSeconds > 0 && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Timp rulare:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatUptime(loc.uptimeSeconds)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Note Indicator */}
                {isOnline ? (
                  <div className="p-2.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 leading-tight flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Sistem operațional și sincronizat.</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 leading-tight">
                    <span className="font-bold">Notă:</span> Bridge deconectat pe acest PC.
                  </div>
                )}
              </div>

              {/* Action Buttons: 3 Rounded Squircles */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(locKey, 'test-print')}
                  disabled={actionLoading === `${locKey}-test-print`}
                  title="Scoate un bon de probă pe imprimanta termică din locație"
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl text-[10px] font-bold bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:border-emerald-800 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-600/70 transition-all duration-200 disabled:opacity-50 cursor-pointer text-center"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-600 shrink-0" />
                  <span className="truncate whitespace-nowrap">Test Bon</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(locKey, 'restart-bridge')}
                  disabled={actionLoading === `${locKey}-restart-bridge`}
                  title="Repornește programul Windows din fundal (Bridge-ul de pe PC, nu POS-ul fizic)"
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl text-[10px] font-bold bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:border-blue-800 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-600/70 transition-all duration-200 disabled:opacity-50 cursor-pointer text-center"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${actionLoading === `${locKey}-restart-bridge` ? 'animate-spin' : ''} shrink-0`} />
                  <span className="truncate whitespace-nowrap">Restart Bridge</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(locKey, 'reload-kiosk')}
                  disabled={actionLoading === `${locKey}-reload-kiosk`}
                  title="Reîncarcă (F5 / Refresh) ecranul Kiosk din browser"
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl text-[10px] font-bold bg-slate-50 dark:bg-slate-700/50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:border-indigo-800 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-600/70 transition-all duration-200 disabled:opacity-50 cursor-pointer text-center"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${actionLoading === `${locKey}-reload-kiosk` ? 'animate-spin' : ''} shrink-0`} />
                  <span className="truncate whitespace-nowrap">Refresh Ecran</span>
                </button>
              </div>
            </div>
          );
        })}
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
                Telegram Chat ID (sau ID Grup):
              </label>
              <input
                type="text"
                value={telegramForm.chatId}
                onChange={(e) => setTelegramForm(prev => ({ ...prev, chatId: e.target.value }))}
                placeholder="Ex: -100123456789 sau ID utilizator"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                ID-ul canalului sau grupului unde se livrează alertele.
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
    </div>
  );
}
