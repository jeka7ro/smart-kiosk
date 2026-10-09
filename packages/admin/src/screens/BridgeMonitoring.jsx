import React, { useState, useEffect, useCallback } from 'react';
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
  Radio
} from 'lucide-react';

export default function BridgeMonitoring({ backend = '', socket = null }) {
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

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${backend}/api/bridge-monitoring/status`, {
        headers: { 'x-api-key': 'sk-live-2024-secure' }
      });
      if (res.ok) {
        const json = await res.json();
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
      socket.on('bridge_status_update', (updatedSummary) => {
        if (updatedSummary) {
          setData(updatedSummary);
          setLastRefreshed(new Date());
        }
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('bridge_status_update');
      }
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

  const locationKeys = ['cluj1', 'cluj2', 'sm-brasov', 'constanta1'];

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
      {/* Control & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Stare Echipamente și Conexiuni Locale
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Urmărire proces start-windows.bat, porturi seriale POS și imprimante bonuri per locație
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Active: {data.totalOnline}</span>
            <span className="text-slate-400">|</span>
            <span className={data.totalOffline > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}>
              Deconectate: {data.totalOffline}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizează</span>
          </button>
        </div>
      </div>

      {/* Grid Status Locații */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {locationKeys.map(locKey => {
          const loc = data.locations[locKey] || {
            locationId: locKey,
            displayName: locKey,
            status: 'offline',
            port: 'N/A',
            gateway: 'raiffeisen',
            printerName: 'N/A',
            lastPingSecondsAgo: null,
            offlineDurationMinutes: null,
            uptimeSeconds: 0,
          };

          const isOnline = loc.status === 'online';

          return (
            <div
              key={locKey}
              className={`p-4 rounded-xl border transition-all ${
                isOnline
                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {loc.locationId}
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {loc.displayName}
                  </div>
                </div>

                <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>{isOnline ? 'ONLINE' : 'DECONECTAT'}</span>
                </div>
              </div>

              {/* Status Details */}
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-700/40">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    <span>POS Bridge (start.bat):</span>
                  </span>
                  <span className={`font-semibold ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400 font-bold'}`}>
                    {isOnline ? 'Rulare activă' : 'Oprit / Deconectat'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-700/40">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    <span>Port Serial POS:</span>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {loc.port || 'COM?'} ({loc.gateway || 'raiffeisen'})
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-700/40">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-slate-400" />
                    <span>Imprimantă Bonuri:</span>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                    {loc.printerName || 'Nedetectată'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-700/40">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ultimul Semnal (Ping):</span>
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {isOnline
                      ? (loc.lastPingSecondsAgo !== null ? `acum ${loc.lastPingSecondsAgo}s` : 'recent')
                      : (loc.offlineDurationMinutes !== null
                          ? `inactiv de ${loc.offlineDurationMinutes}m`
                          : 'fără conexiune recentă'
                        )
                    }
                  </span>
                </div>

                {isOnline && loc.uptimeSeconds > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 dark:text-slate-400">Timp de rulare continuu:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatUptime(loc.uptimeSeconds)}
                    </span>
                  </div>
                )}
              </div>

              {/* Status footer message */}
              {isOnline ? (
                <div className="mt-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 leading-tight flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Procesul de plată POS și imprimanta sunt operaționale.</span>
                </div>
              ) : (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 leading-tight">
                  <span className="font-bold">Notă:</span> Bridge-ul nu este conectat pe socket. Dacă un client dorește să plătească cu cardul, verificați ca <span className="font-semibold bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">start-windows.bat</span> să fie pornit pe PC.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Telegram Alert Settings Panel */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>Configurare Alerte Telegram</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Trimite automat notificări tehnice pe canalul sau grupul tău de Telegram când un POS Bridge cade sau revine online
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
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
          <div className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
            telegramStatusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}>
            {telegramStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{telegramStatusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveTelegram} className="mt-4 space-y-4">
          <div className="flex items-center gap-3 py-2">
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
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                ID-ul canalului sau grupului unde se livrează alertele.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
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
                className="w-24 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="submit"
              disabled={savingTelegram}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {savingTelegram ? 'Se salvează...' : 'Salvează Setările'}
            </button>

            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTelegram}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${testingTelegram ? 'animate-pulse' : ''}`} />
              <span>{testingTelegram ? 'Trimit mesaj...' : 'Trimite Test pe Telegram'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Istoric Evenimente Recente */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Jurnal Evenimente Hardware Recente</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Istoric al conexiunilor, deconectărilor și incidentelor detectate
        </p>

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
