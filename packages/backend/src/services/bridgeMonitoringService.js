/**
 * Bridge Monitoring Service
 * 
 * Tracks real-time status of POS Bridges across all locations.
 * Detects disconnections/crashes and triggers Telegram alerts and Socket.IO updates.
 */

const { pool } = require('../db');
const { getAllLocations, getLocationAliases } = require('../utils/locations');

// In-memory registry of bridges: locationKey -> bridge status
const bridges = new Map();

// History log of events (max 100 entries)
const eventLogs = [];

// Telegram settings cache
let telegramConfig = {
  enabled: false,
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  alertCooldownMinutes: 10,
};

// Cooldown tracking to prevent Telegram alert spam: locationKey -> lastAlertTimestamp
const lastAlertSent = new Map();

// Reference to Socket.IO instance
let _io = null;

function setIo(ioInstance) {
  _io = ioInstance;
}

/**
 * Load Telegram config from PostgreSQL app_settings
 */
async function loadTelegramConfig() {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'telegram_alerts' LIMIT 1`
    );
    if (rows.length > 0 && rows[0].value) {
      telegramConfig = {
        ...telegramConfig,
        ...rows[0].value,
      };
      console.log('[BridgeMonitor] Telegram config încărcat din DB (enabled:', telegramConfig.enabled, ')');
    }
  } catch (err) {
    console.warn('[BridgeMonitor] Nu s-a putut citi telegram_alerts din DB:', err.message);
  }
}

/**
 * Save Telegram config to PostgreSQL app_settings
 */
async function saveTelegramConfig(newConfig) {
  telegramConfig = {
    ...telegramConfig,
    ...newConfig,
  };
  try {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('telegram_alerts', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(telegramConfig)]
    );
    console.log('[BridgeMonitor] Telegram config salvat cu succes');
    return { ok: true, config: getPublicTelegramConfig() };
  } catch (err) {
    console.error('[BridgeMonitor] Eroare la salvarea telegram_alerts în DB:', err.message);
    return { ok: false, error: err.message };
  }
}

function getPublicTelegramConfig() {
  return {
    enabled: !!telegramConfig.enabled,
    botTokenConfigured: !!(telegramConfig.botToken && telegramConfig.botToken.length > 10),
    botTokenMasked: telegramConfig.botToken ? `${telegramConfig.botToken.substring(0, 7)}...${telegramConfig.botToken.slice(-4)}` : '',
    chatId: telegramConfig.chatId || '',
    alertCooldownMinutes: telegramConfig.alertCooldownMinutes || 10,
  };
}

/**
 * Format clean date-time string without emojis
 */
function formatDateTime(date = new Date()) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Send Telegram message using native fetch
 */
async function sendTelegramMessage(text, overrideConfig = null) {
  const cfg = overrideConfig || telegramConfig;
  if (!cfg.botToken || !cfg.chatId) {
    return { ok: false, error: 'Telegram Bot Token sau Chat ID lipseste' };
  }

  const url = `https://api.telegram.org/bot${cfg.botToken.trim()}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cfg.chatId.trim(),
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('[BridgeMonitor] Telegram API a returnat eroare:', data.description);
      return { ok: false, error: data.description };
    }
    return { ok: true };
  } catch (err) {
    console.error('[BridgeMonitor] Eroare la trimiterea mesajului Telegram:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Push an event to memory log
 */
function recordEvent(type, locationId, details) {
  const entry = {
    id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type,
    locationId,
    timestamp: Date.now(),
    dateTime: formatDateTime(),
    details: details || '',
  };
  eventLogs.unshift(entry);
  if (eventLogs.length > 100) eventLogs.pop();
  return entry;
}

/**
 * Normalise location ID to canonical key
 */
function normalizeLocationKey(locId) {
  if (!locId) return 'unknown';
  const str = String(locId).toLowerCase().trim();
  if (str.includes('cluj1') || str === 'smashme-main' || str === 'cluj-centru') return 'cluj1';
  if (str.includes('cluj2')) return 'cluj2';
  if (str.includes('brasov') || str.includes('bv') || str === 'sm-brasov') return 'sm-brasov';
  if (str.includes('constanta1') || str === 'smashme-constanta' || str === 'constanta') return 'constanta1';
  if (str.includes('constanta2') || str === 'constanta-2') return 'constanta2';
  return str;
}

function getLocationDisplayName(locKey) {
  switch (locKey) {
    case 'cluj1': return 'Cluj 1 (Centru)';
    case 'cluj2': return 'Cluj 2';
    case 'sm-brasov': return 'Brasov (RollMaster)';
    case 'constanta1': return 'Constanta 1';
    case 'constanta2': return 'Constanta 2';
    default: return locKey;
  }
}

/**
 * Called when a POS Bridge connects and registers
 */
function handleBridgeConnect(socket, { locationId, port, posGateway, printerName }) {
  const locKey = normalizeLocationKey(locationId);
  const now = Date.now();
  const prev = bridges.get(locKey);
  const wasOffline = !prev || prev.status !== 'online';

  const entry = {
    locationId: locKey,
    rawLocationId: locationId,
    displayName: getLocationDisplayName(locKey),
    port: port || prev?.port || '?',
    gateway: posGateway || prev?.gateway || 'raiffeisen',
    printerName: printerName || prev?.printerName || '',
    status: 'online',
    lastPing: now,
    connectedAt: now,
    disconnectTime: null,
    socketId: socket.id,
    ip: socket.handshake?.address || socket.conn?.remoteAddress || '',
    uptimeSeconds: 0,
  };

  bridges.set(locKey, entry);
  socket._monitoredLocKey = locKey;

  recordEvent('CONNECT', locKey, `POS Bridge conectat pe ${entry.port} (${entry.gateway})`);
  console.log(`[BridgeMonitor] POS Bridge CONECTAT: ${locKey} (${entry.displayName}) pe ${entry.port} (sid: ${socket.id})`);

  if (_io) {
    _io.to('admin').emit('bridge_status_update', getStatusSummary());
  }

  // If it was offline and recovery alerts are enabled, send info to Telegram
  if (wasOffline && telegramConfig.enabled && prev?.disconnectTime) {
    const downMinutes = Math.round((now - prev.disconnectTime) / 60000);
    const msg = [
      `<b>[INFO SMART KIOSK]</b>`,
      `Locatie: ${entry.displayName}`,
      `Dispozitiv: POS Bridge (start-windows.bat)`,
      `Stare: RECONECTAT`,
      `Port: ${entry.port}`,
      `Gateway: ${entry.gateway}`,
      `Imprimanta: ${entry.printerName || 'Nespecificata'}`,
      `Perioada inactivitate: ${downMinutes > 0 ? `${downMinutes} minute` : 'sub 1 minut'}`,
      `Timp: ${formatDateTime(now)}`,
    ].join('\n');

    sendTelegramMessage(msg).catch(e => console.error('[BridgeMonitor] Eroare telegram reconnect:', e.message));
  }
}

/**
 * Called on periodic heartbeat ping from POS Bridge
 */
function handleBridgeHeartbeat(socket, data) {
  const locKey = socket._monitoredLocKey || normalizeLocationKey(data?.locationId);
  const now = Date.now();
  const entry = bridges.get(locKey);

  if (entry) {
    entry.lastPing = now;
    entry.status = 'online';
    if (data?.port) entry.port = data.port;
    if (data?.printerName) entry.printerName = data.printerName;
    if (data?.posGateway) entry.gateway = data.posGateway;
    if (typeof data?.uptime === 'number') entry.uptimeSeconds = data.uptime;
    entry.socketId = socket.id;
  } else {
    // Auto-register if missed
    handleBridgeConnect(socket, data || { locationId: locKey });
  }
}

/**
 * Called when a socket disconnects
 */
function handleBridgeDisconnect(socketId) {
  const now = Date.now();
  for (const [locKey, b] of bridges.entries()) {
    if (b.socketId === socketId && b.status === 'online') {
      b.status = 'offline';
      b.disconnectTime = now;
      recordEvent('DISCONNECT', locKey, `Conexiunea socket s-a intrerupt (sid: ${socketId})`);
      console.warn(`[BridgeMonitor] POS Bridge DECONECTAT: ${locKey} (${b.displayName})`);

      if (_io) {
        _io.to('admin').emit('bridge_status_update', getStatusSummary());
      }

      // Check if Telegram alert should be dispatched
      triggerDisconnectAlert(locKey, b);
      break;
    }
  }
}

/**
 * Trigger disconnect alert with cooldown protection
 */
function triggerDisconnectAlert(locKey, bridgeInfo) {
  if (!telegramConfig.enabled) return;

  const now = Date.now();
  const cooldownMs = (telegramConfig.alertCooldownMinutes || 10) * 60000;
  const lastAlert = lastAlertSent.get(locKey) || 0;

  if (now - lastAlert < cooldownMs) {
    console.log(`[BridgeMonitor] Alerta Telegram pentru ${locKey} ignorata (in perioada de cooldown: ${Math.round((cooldownMs - (now - lastAlert)) / 1000)}s ramase)`);
    return;
  }

  lastAlertSent.set(locKey, now);

  const msg = [
    `<b>[ALERTA SMART KIOSK]</b>`,
    `Locatie: ${bridgeInfo.displayName || locKey}`,
    `Dispozitiv: POS Bridge (start-windows.bat)`,
    `Stare: DECONECTAT / OPRIT`,
    `Port: ${bridgeInfo.port || '?'}`,
    `Impact: Tranzactiile cu cardul sunt blocate`,
    `Timp: ${formatDateTime(now)}`,
    `Actiune necesara: Verificati PC-ul din locatie si porniti start-windows.bat.`,
  ].join('\n');

  sendTelegramMessage(msg).catch(e => console.error('[BridgeMonitor] Eroare telegram disconnect alert:', e.message));
}

const DEFAULT_BRIDGE_CONFIGS = {
  cluj1: { port: 'COM4', gateway: 'raiffeisen', printerName: 'EPSON TM-T20' },
  cluj2: { port: 'COM1', gateway: 'raiffeisen', printerName: 'EPSON TM-T20III' },
  'sm-brasov': { port: 'COM3', gateway: 'raiffeisen', printerName: 'EPSON TM-T20' },
  constanta1: { port: 'COM7', gateway: 'raiffeisen', printerName: 'XP-80' },
};

/**
 * Check if any Socket.IO connection is actively registered in the bridge room
 */
function isBridgeSocketConnected(locKey) {
  if (!_io || !_io.sockets || !_io.sockets.adapter || !_io.sockets.adapter.rooms) return false;
  try {
    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases(locKey) || [];
    const checkKeys = Array.from(new Set([locKey, ...aliases]));
    for (const k of checkKeys) {
      const room = _io.sockets.adapter.rooms.get(`pos-bridge-${k}`);
      if (room && room.size > 0) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * Periodic healthcheck loop (runs every 15s)
 * Catches bridges whose socket disconnected
 */
function runHealthCheck() {
  const now = Date.now();
  let hasChanges = false;

  for (const [locKey, b] of bridges.entries()) {
    const isSocketAlive = isBridgeSocketConnected(locKey);
    if (isSocketAlive) {
      if (b.status !== 'online') {
        b.status = 'online';
        b.lastPing = now;
        hasChanges = true;
      }
    } else if (b.status === 'online') {
      b.status = 'offline';
      b.disconnectTime = now;
      hasChanges = true;
      recordEvent('DISCONNECT', locKey, `Conexiunea socket s-a întrerupt`);
      console.warn(`[BridgeMonitor] POS Bridge DECONECTAT: ${locKey} (${b.displayName})`);
      triggerDisconnectAlert(locKey, b);
    }
  }

  if (hasChanges && _io) {
    _io.to('admin').emit('bridge_status_update', getStatusSummary());
  }
}

// Start health check timer
setInterval(runHealthCheck, 15000);

/**
 * Return complete telemetry summary for dashboard and dedicated screen
 */
function getStatusSummary() {
  const now = Date.now();
  const summary = {
    timestamp: now,
    locations: {},
    totalOnline: 0,
    totalOffline: 0,
    telegramConfig: getPublicTelegramConfig(),
    recentEvents: eventLogs.slice(0, 30),
  };

  // Known target locations (active production kiosks)
  const targetLocations = ['cluj1', 'cluj2', 'sm-brasov', 'constanta1'];

  targetLocations.forEach(locKey => {
    let b = bridges.get(locKey);
    const isSocketAlive = isBridgeSocketConnected(locKey);
    const defaults = DEFAULT_BRIDGE_CONFIGS[locKey] || {};

    if (isSocketAlive) {
      if (!b) {
        b = {
          locationId: locKey,
          displayName: getLocationDisplayName(locKey),
          status: 'online',
          port: defaults.port || '?',
          gateway: defaults.gateway || 'raiffeisen',
          printerName: defaults.printerName || '',
          lastPing: now,
          connectedAt: now,
        };
        bridges.set(locKey, b);
      } else {
        b.status = 'online';
        if (!b.lastPing) b.lastPing = now;
      }
    }

    const isOnline = isSocketAlive || (b && b.status === 'online');
    if (isOnline) summary.totalOnline++;
    else summary.totalOffline++;

    const lastPingAge = (b?.lastPing && !isOnline) ? Math.max(0, Math.round((now - b.lastPing) / 1000)) : null;
    const offlineDurationMinutes = (!isOnline && b?.disconnectTime) ? Math.round((now - b.disconnectTime) / 60000) : null;

    summary.locations[locKey] = {
      locationId: locKey,
      displayName: getLocationDisplayName(locKey),
      status: isOnline ? 'online' : 'offline',
      port: b?.port || defaults.port || 'N/A',
      gateway: b?.gateway || defaults.gateway || 'raiffeisen',
      printerName: b?.printerName || defaults.printerName || 'N/A',
      lastPing: b?.lastPing || null,
      lastPingSecondsAgo: isOnline ? 0 : lastPingAge,
      offlineDurationMinutes,
      connectedAt: b?.connectedAt || null,
      ip: b?.ip || '',
      uptimeSeconds: b?.uptimeSeconds || 0,
    };
  });

  return summary;
}

/**
 * Seed initial state from recent port_scans table so restarted backend doesn't show blank
 */
async function seedFromRecentScans() {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (location_id) location_id, pos_port, pos_gateway, printer_name, created_at
       FROM port_scans
       ORDER BY location_id, created_at DESC`
    );

    const now = Date.now();
    rows.forEach(r => {
      const locKey = normalizeLocationKey(r.location_id);
      const defaults = DEFAULT_BRIDGE_CONFIGS[locKey] || {};
      const isSocketAlive = isBridgeSocketConnected(locKey);

      bridges.set(locKey, {
        locationId: locKey,
        rawLocationId: r.location_id,
        displayName: getLocationDisplayName(locKey),
        port: r.pos_port || defaults.port || '?',
        gateway: r.pos_gateway || defaults.gateway || 'raiffeisen',
        printerName: r.printer_name || defaults.printerName || '',
        status: isSocketAlive ? 'online' : 'offline',
        lastPing: now,
        connectedAt: now,
        disconnectTime: isSocketAlive ? null : now,
        socketId: null,
        ip: '',
        uptimeSeconds: 0,
      });
    });
    console.log(`[BridgeMonitor] Inițializat starea a ${bridges.size} bridge-uri din scanările anterioare.`);
  } catch (err) {
    console.warn('[BridgeMonitor] Nu s-au putut pre-încărca port_scans:', err.message);
  }
}

module.exports = {
  setIo,
  loadTelegramConfig,
  saveTelegramConfig,
  getPublicTelegramConfig,
  sendTelegramMessage,
  handleBridgeConnect,
  handleBridgeHeartbeat,
  handleBridgeDisconnect,
  getStatusSummary,
  seedFromRecentScans,
  formatDateTime,
};
