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
  botToken: process.env.TELEGRAM_BOT_TOKEN || '8809773703:AAG3m6otWfFa0cO_bU6cy_oqqe1EWsLgOOk',
  chatId: process.env.TELEGRAM_CHAT_ID || '-5489923676', // Grup 1: Kiosk Alerts (hardware, status, iiko)
  posChatId: process.env.TELEGRAM_POS_CHAT_ID || '-5554201057', // Grup 2: Kiosk POS
  ordersChatId: process.env.TELEGRAM_ORDERS_CHAT_ID || '-5209173668', // Grup 3: Kiosk Comenzi
  alertCooldownMinutes: 10,
  posAlertsFilter: 'all', // 'all' | 'approved_only' | 'rejected_only' | 'none'
  ordersAlertsEnabled: true, // boolean
};

// Cooldown tracking to prevent Telegram alert spam: locationKey -> lastAlertTimestamp
const lastAlertSent = new Map();

// Pending disconnect alert timers (grație de 60s pentru a preveni alerte false la fluctuații de rețea)
const pendingDisconnectTimers = new Map();

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
        posChatId: rows[0].value.posChatId || telegramConfig.posChatId || '-5554201057',
        ordersChatId: rows[0].value.ordersChatId || telegramConfig.ordersChatId || '-5209173668',
        posAlertsFilter: rows[0].value.posAlertsFilter || 'all',
        ordersAlertsEnabled: rows[0].value.ordersAlertsEnabled !== undefined ? !!rows[0].value.ordersAlertsEnabled : true,
      };
      console.log('[BridgeMonitor] Telegram config încărcat din DB (enabled:', telegramConfig.enabled, ', pos:', telegramConfig.posAlertsFilter, ', orders:', telegramConfig.ordersAlertsEnabled, ')');
    }
    // Auto-register Telegram webhook for incoming /status commands
    if (telegramConfig.botToken) {
      registerTelegramWebhook().catch(() => {});
    }
  } catch (err) {
    console.warn('[BridgeMonitor] Nu s-a putut citi telegram_alerts din DB:', err.message);
  }
}

/**
 * Register incoming webhook with Telegram API
 */
async function registerTelegramWebhook(serverBaseUrl = 'https://smart-kiosk-ttut.onrender.com') {
  if (!telegramConfig.botToken) return;
  const webhookUrl = `${serverBaseUrl}/api/bridge-monitoring/telegram-webhook`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: true,
        allowed_updates: ['message']
      })
    });
    const data = await res.json();
    console.log('[BridgeMonitor] Telegram Webhook registration:', data.ok, data.description || '');
    return data;
  } catch (err) {
    console.warn('[BridgeMonitor] Eroare înregistrare webhook Telegram:', err.message);
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
    posChatId: telegramConfig.posChatId || '',
    ordersChatId: telegramConfig.ordersChatId || '',
    alertCooldownMinutes: telegramConfig.alertCooldownMinutes || 10,
    posAlertsFilter: telegramConfig.posAlertsFilter || 'all',
    ordersAlertsEnabled: telegramConfig.ordersAlertsEnabled !== undefined ? !!telegramConfig.ordersAlertsEnabled : true,
  };
}

/**
 * Format clean date-time string in Romania timezone (Europe/Bucharest)
 */
function formatDateTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('ro-RO', {
      timeZone: 'Europe/Bucharest',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(date)).replace(',', '');
  } catch (_) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}

/**
 * Send Telegram message using native fetch
 */
async function sendTelegramMessage(text, overrideConfig = null, targetChatId = null) {
  const cfg = overrideConfig || telegramConfig;
  const destinationChatId = targetChatId || cfg.chatId;
  if (!cfg.botToken || !destinationChatId) {
    return { ok: false, error: 'Telegram Bot Token sau Chat ID lipseste' };
  }

  const url = `https://api.telegram.org/bot${cfg.botToken.trim()}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(destinationChatId).trim(),
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
    return { ok: true, messageId: data.result?.message_id };
  } catch (err) {
    console.error('[BridgeMonitor] Eroare la trimiterea mesajului Telegram:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send Telegram photo with caption using native fetch
 */
async function sendTelegramPhoto(photoUrl, caption, targetChatId = null) {
  const cfg = telegramConfig;
  const destinationChatId = targetChatId || cfg.ordersChatId || cfg.chatId;
  if (!cfg.botToken || !destinationChatId || !photoUrl) {
    return { ok: false, error: 'Telegram Bot Token, Chat ID sau photoUrl lipseste' };
  }

  // Ensure absolute URL if relative
  let fullPhotoUrl = String(photoUrl).trim();
  if (fullPhotoUrl.startsWith('/')) {
    const baseUrl = process.env.BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';
    fullPhotoUrl = `${baseUrl.replace(/\/$/, '')}${fullPhotoUrl}`;
  }

  // Telegram caption limit is 1024 characters
  let safeCaption = caption;
  if (safeCaption && safeCaption.length > 1000) {
    safeCaption = safeCaption.substring(0, 995) + '...';
  }

  const url = `https://api.telegram.org/bot${cfg.botToken.trim()}/sendPhoto`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(destinationChatId).trim(),
        photo: fullPhotoUrl,
        caption: safeCaption,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('[BridgeMonitor] Telegram sendPhoto eroare:', data.description);
      return { ok: false, error: data.description };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch (err) {
    console.error('[BridgeMonitor] Eroare la trimiterea pozei Telegram:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Translate bank error codes to clear Romanian descriptions
 */
function getPosReasonText(reason, code) {
  const rawStr = String(reason || '').trim();
  const c = String(code || '').trim().replace(/^0+/, '');

  if (c === '51') return 'Fonduri insuficiente';
  if (c === '55') return 'PIN incorect';
  if (c === '54') return 'Card expirat';
  if (c === '41') return 'Card pierdut';
  if (c === '43') return 'Card furat';
  if (c === '5')  return 'Refuz bancă (Contactați banca emitentă)';
  if (c === '61') return 'Depășire limită retragere/plată';
  if (c === '14') return 'Număr card invalid';
  if (c === '91') return 'Banca emitentă nu răspunde';
  if (c === '96') return 'Eroare sistem bancar';
  if (c.toUpperCase() === 'A0' || rawStr.includes('0xA0') || rawStr.toLowerCase().includes('tasta') || rawStr.toLowerCase().includes('anulat')) {
    return 'Anulat de client (Tasta roșie X)';
  }
  if (rawStr.includes('Timp expirat citire card') || rawStr.includes('2 minute')) {
    return 'Timp expirat citire card (Clientul nu a apropiat cardul)';
  }
  if (rawStr.toLowerCase().includes('nu este deschis') || rawStr.toLowerCase().includes('port')) {
    return 'Port POS nedeschis (Cablu USB scos / POS oprit / Reinițializare)';
  }
  if (rawStr.toLowerCase().includes('timeout') || rawStr.toLowerCase().includes('nu răspunde')) {
    return 'POS-ul nu răspunde pe USB (Standby / Cablu serial)';
  }
  return rawStr || 'Tranzacție respinsă de bancă';
}

/**
 * Send alert to Grup 2: Kiosk POS
 */
async function sendPosAlert(data) {
  if (!telegramConfig.enabled) return;

  const filter = telegramConfig.posAlertsFilter || 'all';
  if (filter === 'none') return;

  const { paid, amount, locationName, orderId, cardNo, authCode, receiptNo, error, responseCode, code } = data;

  if (!paid && filter === 'approved_only') return;
  if (paid && filter === 'rejected_only') return;

  const amtStr = Number(amount || 0).toFixed(2);
  const timeStr = formatDateTime();
  const loc = locationName || 'Kiosk';

  if (!paid) {
    // 🔴 Plățile respinse POS au fost scoase din Grupul de Alerte (chatId) la cererea expresă a utilizatorului.
    const alertsChat = telegramConfig.chatId;
    if (telegramConfig.posChatId && telegramConfig.posChatId !== alertsChat) {
      const reasonText = getPosReasonText(error, responseCode || code);
      const rejectMsg = [
        `🔴 <b>[PLATĂ RESPINSĂ - POS]</b>`,
        `Locație: <b>${loc}</b>`,
        `Sumă: <b>${amtStr} RON</b>`,
        `Comandă: #${orderId || '-'}`,
        `Motiv exact: <b>${reasonText}</b>`,
        `Timp: ${timeStr}`
      ].join('\n');
      await sendTelegramMessage(rejectMsg, null, telegramConfig.posChatId).catch(() => {});
    }
    return;
  } else {
    // 🟢 Plățile aprobate se trimit EXCLUSIV în grupul dedicat POS (NU poluează grupul de alerte)
    if (telegramConfig.posChatId && telegramConfig.posChatId !== telegramConfig.chatId) {
      const approvedMsg = [
        `🟢 <b>[PLATĂ APROBATĂ - POS]</b>`,
        `Locație: <b>${loc}</b>`,
        `Sumă: <b>${amtStr} RON</b>`,
        `Bon: ${receiptNo || '-'} | Comandă: #${orderId || '-'}`,
        `Card: ${cardNo || 'Card'} | Auth: ${authCode || '-'}`,
        `Timp: ${timeStr}`
      ].join('\n');

      await sendTelegramMessage(approvedMsg, null, telegramConfig.posChatId).catch(e => {
        console.error('[Telegram] Eroare trimitere plată aprobată POS:', e.message);
      });
    }
  }
}

/**
 * Send alert to Grup 3: Kiosk Comenzi
 */
async function sendOrderAlert(order) {
  if (!telegramConfig.enabled) return;
  if (telegramConfig.ordersAlertsEnabled === false) return;
  const targetChat = telegramConfig.ordersChatId || telegramConfig.chatId;
  if (!targetChat) return;

  const loc = order.locationName || order.locationId || 'Kiosk';
  const brand = (order.brand || '').toUpperCase();
  const orderNum = order.orderNumber || order._id || '-';
  const orderTypeStr = order.orderType === 'dine_in' ? '🍽️ Aici (La masă)' : '🥡 La pachet';
  const totalStr = Number(order.totalAmount || 0).toFixed(2);
  const timeStr = formatDateTime(order.createdAt || new Date());

  const itemsLines = (order.items || []).slice(0, 15).map(it => {
    const q = it.quantity || 1;
    const price = Number(it.totalPrice || it.unitPrice || 0).toFixed(2);
    let str = `• ${q}x <b>${it.name || 'Produs'}</b> (${price} RON)`;
    if (it.selectedModifiers && it.selectedModifiers.length > 0) {
      const mods = it.selectedModifiers
        .filter(m => m.modId !== 'custom_comment')
        .map(m => m.name || m.modName)
        .filter(Boolean)
        .join(', ');
      if (mods) str += `\n   └ <i>${mods}</i>`;
    }
    return str;
  });

  const msg = [
    `🍔 <b>COMANDĂ NOUĂ #${orderNum}</b>`,
    `🏢 <b>${brand ? `${brand} — ` : ''}${loc}</b>`,
    `📦 Tip: <b>${orderTypeStr}</b> | Plată: <b>${order.paymentMethod === 'card' ? 'Card POS' : 'Numerar'}</b>`,
    `💰 Total: <b>${totalStr} RON</b>`,
    `🛒 <b>Produse (${order.items?.length || 0}):</b>`,
    ...itemsLines,
    `🕒 Timp: ${timeStr}`,
  ].join('\n');

  // Pozele de pe comenzile Telegram au fost eliminate conform cerinței
  return sendTelegramMessage(msg, null, targetChat).catch(e => {
    console.error('[Telegram] Eroare trimitere alertă comandă:', e.message);
  });
}

/**
 * Send alert to Grup 1: Kiosk Alerts (iiko error)
 */
async function sendIikoAlert(order, errorMsg) {
  if (!telegramConfig.enabled) return;
  const targetChat = telegramConfig.chatId; // Grupul 1: Kiosk Alerts
  if (!targetChat) return;

  const loc = order.locationName || order.locationId || 'Kiosk';
  const orderNum = order.orderNumber || order._id || '-';
  const totalStr = Number(order.totalAmount || 0).toFixed(2);
  const timeStr = formatDateTime();

  const msg = [
    `⚠️ <b>[URGENT - EROARE SINCRONIZARE IIKO]</b>`,
    `🏢 Locație: <b>${loc}</b>`,
    `🧾 Comandă: <b>#${orderNum}</b> (${totalStr} RON)`,
    `💳 Status plată: <b>Card încasat cu succes</b>`,
    `❌ Problemă: Comanda <b>NU a putut fi transmisă în iiko</b>!`,
    `💡 Detalii: <i>${errorMsg || 'iiko order push failed'}</i>`,
    `🚨 <b>Acțiune necesară:</b> Introduceți comanda manual la bucătărie!`,
    `🕒 Timp: ${timeStr}`,
  ].join('\n');

  return sendTelegramMessage(msg, null, targetChat).catch(e => {
    console.error('[Telegram] Eroare trimitere alertă iiko:', e.message);
  });
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
    case 'cluj1': return 'Cluj 1 (SmashMe 🍔)';
    case 'cluj2': return 'Cluj 2 (SmashMe 🍔)';
    case 'sm-brasov': return 'Brașov (RollMaster 🍣)';
    case 'constanta1': return 'Constanța 1 (SmashMe 🍔)';
    case 'constanta2': return 'Constanța 2 (SmashMe 🍔)';
    default: return locKey;
  }
}

/**
 * Check if a location is actively configured with POS (not cash_only and gateway !== 'none')
 */
function isPosEnabled(locKey) {
  try {
    const allLocs = typeof getAllLocations === 'function' ? getAllLocations() : [];
    const cfg = allLocs.find(l => 
      l.id === locKey || 
      l.kioskUrl === locKey || 
      (Array.isArray(l.aliases) && l.aliases.includes(locKey)) ||
      (locKey === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
      (locKey === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov'))) ||
      (locKey === 'cluj1' && (l.id === 'smashme-main' || l.name?.toLowerCase().includes('centru'))) ||
      (locKey === 'cluj2' && (l.id === 'cluj2' || l.name?.toLowerCase().includes('cj-2')))
    );
    if (!cfg) return true;
    return Boolean(
      cfg.paymentMode !== 'cash_only' &&
      !cfg.cashOnly &&
      cfg.paymentGateway !== 'none'
    );
  } catch (_) {
    return true;
  }
}

/**
 * Called when a POS Bridge connects and registers
 */
function handleBridgeConnect(socket, { locationId, port, posGateway, printerName, hostname, posWakeStandby, posWakeIntervalMinutes }) {
  if ((locationId === 'sm-brasov' || !locationId) && (port === 'COM5' || port === 'COM1' || String(printerName).includes('TM-T20III') || hostname === 'DESKTOP-VNTDBO0')) {
    locationId = 'cluj2';
  }
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
    hostname: hostname || prev?.hostname || '',
    status: 'online',
    lastPing: now,
    connectedAt: now,
    disconnectTime: null,
    socketId: socket.id,
    ip: socket.handshake?.address || socket.conn?.remoteAddress || '',
    uptimeSeconds: 0,
    posWakeStandby: posWakeStandby !== undefined ? !!posWakeStandby : (prev?.posWakeStandby ?? true),
    posWakeIntervalMinutes: posWakeIntervalMinutes !== undefined ? Number(posWakeIntervalMinutes) : (prev?.posWakeIntervalMinutes || 5),
    posSignal: prev?.posSignal || null,
  };

  bridges.set(locKey, entry);
  socket._monitoredLocKey = locKey;

  recordEvent('CONNECT', locKey, `POS Bridge conectat pe ${entry.port} (${entry.gateway})`);
  console.log(`[BridgeMonitor] POS Bridge CONECTAT: ${locKey} (${entry.displayName}) pe ${entry.port} (sid: ${socket.id})`);

  if (_io) {
    _io.to('admin').emit('bridge_status_update', getStatusSummary());
  }

  // Anulează timerul de deconectare dacă bridge-ul s-a reconectat rapid în perioada de grație de 60s
  if (pendingDisconnectTimers.has(locKey)) {
    clearTimeout(pendingDisconnectTimers.get(locKey));
    pendingDisconnectTimers.delete(locKey);
    console.log(`[BridgeMonitor] Reconectare rapidă în perioada de grație pentru ${locKey}. Alerta de deconectare a fost anulată.`);
  }

  // Notificare reconectare doar dacă a fost offline PESTE 1 MINUT (previne mesaje spam la fluctuații rapide)
  if (wasOffline && telegramConfig.enabled && prev?.disconnectTime) {
    const downSeconds = Math.round((now - prev.disconnectTime) / 1000);
    if (downSeconds >= 60) {
      const downMinutes = Math.round(downSeconds / 60);
      const msg = [
        `🟢 <b>[INFO SMART KIOSK]</b>`,
        `Locatie: ${entry.displayName}`,
        `Dispozitiv: POS Bridge (start-windows.bat)`,
        `Stare: RECONECTAT`,
        `Port: ${entry.port}`,
        `Gateway: ${entry.gateway}`,
        `Imprimanta: ${entry.printerName || 'Nespecificata'}`,
        `Perioada inactivitate: ${downMinutes} minute`,
        `Timp: ${formatDateTime(now)}`,
      ].join('\n');

      sendTelegramMessage(msg).catch(e => console.error('[BridgeMonitor] Eroare telegram reconnect:', e.message));
    } else {
      console.log(`[BridgeMonitor] Reconectare rapidă (${downSeconds}s) pentru ${locKey}. Omit notificare Telegram (sub 1 minut).`);
    }
  }

  // Auto-verificare live a semnalului POS pe bune la conectarea bridge-ului (dacă locația are POS activat)
  if (isPosEnabled(locKey) && _io) {
    const lastTested = entry.posSignal?.testedAt || 0;
    if (now - lastTested > 3 * 60 * 1000) {
      setTimeout(() => {
        try {
          const { getLocationAliases } = require('../utils/locations');
          const aliases = getLocationAliases ? getLocationAliases(locKey) : [locKey];
          const targets = new Set([locKey, ...aliases].filter(Boolean));
          for (const tid of targets) {
            _io.to(`pos-bridge-${tid}`).emit('test_pos_signal', { locationId: tid });
          }
          console.log(`[BridgeMonitor] 📡 Auto-test live semnal POS inițiat la conectare pentru ${locKey}`);
        } catch (_) {}
      }, 3000);
    }
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
    if (data?.hostname) entry.hostname = data.hostname;
    if (typeof data?.uptime === 'number') entry.uptimeSeconds = data.uptime;
    if (data?.posWakeStandby !== undefined) entry.posWakeStandby = !!data.posWakeStandby;
    if (data?.posWakeIntervalMinutes !== undefined) entry.posWakeIntervalMinutes = Number(data.posWakeIntervalMinutes);
    entry.socketId = socket.id;

    // Asigurăm apartenența la cameră la fiecare heartbeat
    if (socket && socket.connected && locKey) {
      try {
        socket.join(`pos-bridge-${locKey}`);
        const { getLocationAliases } = require('../utils/locations');
        const aliases = getLocationAliases(locKey) || [];
        for (const a of aliases) socket.join(`pos-bridge-${a}`);
      } catch (_) {}
    }
  } else {
    // Auto-register if missed
    handleBridgeConnect(socket, data || { locationId: locKey });
  }
}

/**
 * Updates physical hardware characteristics when detected via port scan or heartbeat
 */
function updateBridgeHardware(locationId, { hostname, port, posGateway, printerName }) {
  if (!locationId) return;
  const locKey = normalizeLocationKey(locationId);
  const entry = bridges.get(locKey);
  if (entry) {
    if (hostname) entry.hostname = hostname;
    if (port) entry.port = port;
    if (posGateway) entry.gateway = posGateway;
    if (printerName) entry.printerName = printerName;
  }
}

/**
 * Updates location-specific config when admin saves changes
 */
function updateLocationConfig(locId, locData) {
  if (!locId && !locData) return;
  const locKey = normalizeLocationKey(locId || locData?.kioskUrl || locData?.id);
  const entry = bridges.get(locKey);
  if (entry) {
    if (locData?.posWakeStandby !== undefined) {
      entry.posWakeStandby = Boolean(locData.posWakeStandby);
    }
    if (locData?.posWakeIntervalMinutes !== undefined) {
      entry.posWakeIntervalMinutes = Number(locData.posWakeIntervalMinutes);
    }
  }
  if (_io) {
    _io.to('admin').emit('bridge_status_update', getStatusSummary());
  }
}

/**
 * Record real-time POS signal and latency test result
 */
function recordPosSignalResult(data) {
  if (!data || !data.locationId) return;
  const locKey = normalizeLocationKey(data.locationId);
  const now = Date.now();
  let entry = bridges.get(locKey);
  const signalInfo = {
    success: !!data.success,
    latencyMs: data.latencyMs ?? null,
    message: data.message || '',
    testedAt: now,
  };
  if (entry) {
    entry.posSignal = signalInfo;
  } else {
    entry = {
      locationId: locKey,
      displayName: getLocationDisplayName(locKey),
      status: 'online',
      posSignal: signalInfo,
    };
    bridges.set(locKey, entry);
  }
  recordEvent('INFO', locKey, `Test semnal POS: ${signalInfo.success ? `Activ (${signalInfo.latencyMs}ms)` : (signalInfo.message || 'Eșuat')}`);
  console.log(`[BridgeMonitor] 📡 POS Signal rezultat pt ${locKey}:`, signalInfo);

  // Ignorăm duplicatele provocate de comenzi paralele de test
  if (signalInfo.message && signalInfo.message.includes('WAIT_ENQ_ACK')) {
    return;
  }

  // Salvare in PostgreSQL pos_signal_logs pentru istoric si statistici
  const logId = `SIG-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const port = data.port || entry.port || 'COM';
  pool.query(
    `INSERT INTO pos_signal_logs (id, location_id, port, latency_ms, success, message, tested_at)
     VALUES ($1, $2, $3, $4, $5, $6, TO_TIMESTAMP($7 / 1000.0))`,
    [logId, locKey, port, signalInfo.latencyMs, signalInfo.success, signalInfo.message || (signalInfo.success ? 'Activ' : 'Eșuat'), now]
  ).catch(err => {
    console.warn('[BridgeMonitor] Eroare la salvarea în pos_signal_logs:', err.message);
  });

  if (_io) {
    _io.to('admin').emit('bridge_status_update', getStatusSummary());
    _io.to('admin').emit('pos_signal_result', { locationId: locKey, ...signalInfo });
  }
}

/**
 * Called when a socket disconnects
 */
function handleBridgeDisconnect(socketId) {
  const now = Date.now();
  for (const [locKey, b] of bridges.entries()) {
    if (b.socketId === socketId && b.status === 'online') {
      b.disconnectTime = now;
      recordEvent('DISCONNECT', locKey, `Conexiunea socket s-a întrerupt (sid: ${socketId})`);
      console.warn(`[BridgeMonitor] Socket deconectat pentru: ${locKey} (${b.displayName}). Aștept 60s grație înainte de alertă...`);

      // Anulează orice timer anterior pe această locație
      if (pendingDisconnectTimers.has(locKey)) {
        clearTimeout(pendingDisconnectTimers.get(locKey));
      }

      // Setează perioada de grație de 60 secunde (previne alertele false la reconectări automate de rețea)
      const timer = setTimeout(() => {
        pendingDisconnectTimers.delete(locKey);
        if (!isBridgeSocketConnected(locKey)) {
          b.status = 'offline';
          if (_io) {
            _io.to('admin').emit('bridge_status_update', getStatusSummary());
          }
          triggerDisconnectAlert(locKey, b);
        } else {
          console.log(`[BridgeMonitor] ${locKey} este activ prin alt socket. Alerta de deconectare anulată.`);
        }
      }, 60000);

      pendingDisconnectTimers.set(locKey, timer);
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
    `🔴 <b>[ALERTA SMART KIOSK]</b>`,
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
  cluj2: { port: 'COM5', gateway: 'raiffeisen', printerName: 'EPSON TM-T20III' },
  'sm-brasov': { port: 'COM3', gateway: 'raiffeisen', printerName: 'EPSON TM-T20' },
  constanta1: { port: 'COM7', gateway: 'raiffeisen', printerName: 'XP-80' },
};

/**
 * Amprente fizice hardware cunoscute per restaurant (pentru a detecta dacă cineva a copiat .env de la altă sală)
 */
const EXPECTED_PHYSICAL_HARDWARE = {
  cluj1: {
    expectedHostname: 'DESKTOP-44PEN14',
    expectedPort: 'COM4',
    printerName: 'EPSON TM-T20',
    locationName: 'SmashMe Centru (Cluj 1)',
  },
  cluj2: {
    expectedHostname: 'DESKTOP-VNTDBO0',
    expectedPort: 'COM5',
    printerName: 'EPSON TM-T20III',
    locationName: 'SmashMe CJ-2 (Cluj 2)',
  },
  'sm-brasov': {
    expectedHostname: 'DESKTOP-FT5PA0E',
    expectedPort: 'COM3',
    printerName: 'EPSON TM-T20',
    locationName: 'RollMaster Brașov',
  },
  constanta1: {
    expectedHostname: 'DESKTOP-19BUSUH',
    expectedPort: 'COM7',
    printerName: 'XP-80',
    locationName: 'SmashMe Constanța 1',
  },
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

    // Siguranță: dacă podul trimite ping-uri recente (< 45 secunde) pe un socket conectat, este ONLINE
    const b = bridges.get(locKey);
    if (b && b.lastPing && (Date.now() - b.lastPing) < 45000 && b.socketId) {
      const s = _io.sockets.sockets.get(b.socketId);
      if (s && s.connected) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

function isKioskSocketConnected(locKey) {
  try {
    const { getLiveKiosksSummary } = require('./socketService');
    const summary = getLiveKiosksSummary();
    if (!summary) return false;
    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases(locKey) || [];
    const checkKeys = Array.from(new Set([locKey, ...aliases]));
    for (const k of checkKeys) {
      if (summary[k] && (summary[k].isLive || summary[k].online || summary[k].onlineCount > 0)) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

function isLocationActive(locKey) {
  return isBridgeSocketConnected(locKey);
}

/**
 * Return Bucharest current time components
 */
function getBucharestTime() {
  try {
    const formatter = new Intl.DateTimeFormat('ro-RO', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const m = {};
    parts.forEach(p => m[p.type] = p.value);
    return {
      hour: parseInt(m.hour, 10),
      minute: parseInt(m.minute, 10),
      second: parseInt(m.second, 10),
      dateStr: `${m.day}.${m.month}.${m.year}`
    };
  } catch (_) {
    const d = new Date();
    return {
      hour: d.getHours(),
      minute: d.getMinutes(),
      second: d.getSeconds(),
      dateStr: d.toLocaleDateString('ro-RO')
    };
  }
}

function getBridgeSocketCount(locKey) {
  if (!_io || !_io.sockets || !_io.sockets.adapter || !_io.sockets.adapter.rooms) return 0;
  try {
    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases(locKey) || [];
    const checkKeys = Array.from(new Set([locKey, ...aliases]));
    const uniqueSockets = new Set();
    for (const k of checkKeys) {
      const room = _io.sockets.adapter.rooms.get(`pos-bridge-${k}`);
      if (room) {
        for (const sid of room) {
          uniqueSockets.add(sid);
        }
      }
    }
    return uniqueSockets.size;
  } catch (_) {
    return 0;
  }
}

function getKioskSocketCount(locKey) {
  try {
    const { getLiveKiosksSummary } = require('./socketService');
    const summary = getLiveKiosksSummary();
    if (!summary) return 0;
    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases(locKey) || [];
    const checkKeys = Array.from(new Set([locKey, ...aliases]));
    const uniqueDevices = new Set();
    for (const k of checkKeys) {
      if (summary[k] && Array.isArray(summary[k].devices)) {
        for (const dev of summary[k].devices) {
          if (dev.socketId) uniqueDevices.add(dev.socketId);
        }
      }
    }
    return uniqueDevices.size;
  } catch (_) {
    return 0;
  }
}

let lastCheck1000Date = null;
let lastCheck1015Date = null;

/**
 * Morning Pre-Flight Healthcheck (Automated at 10:00 and 10:15 or on-demand)
 * Verifies live POS, UART signal/latency, Kiosk screen, .env config, and checks for duplicate processes
 */
async function runMorningPreflightCheck(targetChatId = null, isManual = false) {
  const destinationChat = targetChatId || telegramConfig.chatId;
  if (!destinationChat || (!telegramConfig.enabled && !isManual)) {
    console.log('[MorningCheck] Omit verificare: Telegram dezactivat sau lipsă chatId.');
    return { ok: false, error: 'Telegram dezactivat sau chatId lipsă' };
  }

  const { dateStr, hour, minute } = getBucharestTime();
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  console.log(`[MorningCheck] 🌅 Rulare verificare matinală la ${timeStr} (data: ${dateStr}, manual: ${isManual})...`);

  const targetLocations = ['cluj1', 'cluj2', 'sm-brasov', 'constanta1'];

  const dbLocs = await getDbLocationsList();

  // 1. Declanșăm testul semnalului POS doar pe bridge-urile unde POS-ul este activat în setările sălii
  if (_io) {
    for (const locKey of targetLocations) {
      const cfg = dbLocs.find(l => 
        l.id === locKey || 
        l.kioskUrl === locKey || 
        (Array.isArray(l.aliases) && l.aliases.includes(locKey)) ||
        (locKey === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
        (locKey === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov'))) ||
        (locKey === 'cluj1' && (l.id === 'smashme-main' || l.name?.toLowerCase().includes('centru'))) ||
        (locKey === 'cluj2' && (l.id === 'cluj2' || l.name?.toLowerCase().includes('cj-2')))
      );
      const isPosEnabled = Boolean(
        cfg &&
        cfg.paymentMode !== 'cash_only' &&
        !cfg.cashOnly &&
        cfg.paymentGateway !== 'none'
      );
      if (isPosEnabled) {
        _io.to(`pos-bridge-${locKey}`).emit('test_pos_signal', { locationId: locKey });
      }
    }
  }

  // 2. Așteptăm 3 secunde pentru recepționarea latenței POS
  await new Promise(r => setTimeout(r, 3000));

  // 3. Compilăm raportul
  const summary = getStatusSummary();
  const { getLiveKiosksSummary } = require('./socketService');
  const kiosksSummary = getLiveKiosksSummary() || {};

  const lines = [
    `🌅 <b>[VERIFICARE SISTEM — ${timeStr}]</b>`,
    `📅 <b>Data:</b> ${dateStr} | 🕒 <b>Ora:</b> ${timeStr}`,
    `⏰ <i>Program deschidere restaurante: 10:00</i>`,
    ``
  ];

  let readyCount = 0;
  const issues = [];
  const failedLocationKeys = [];

  for (const locKey of targetLocations) {
    const loc = summary.locations[locKey] || {};
    const b = bridges.get(locKey);
    const isBridgeAlive = isBridgeSocketConnected(locKey);
    const isKioskAlive = isKioskSocketConnected(locKey);

    const bridgeCount = getBridgeSocketCount(locKey);
    const kioskCount = getKioskSocketCount(locKey);

    const hasDuplicate = bridgeCount > 1 || kioskCount > 1;

    const cfg = dbLocs.find(l => 
      l.id === locKey || 
      l.kioskUrl === locKey || 
      (Array.isArray(l.aliases) && l.aliases.includes(locKey)) ||
      (locKey === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
      (locKey === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov'))) ||
      (locKey === 'cluj1' && (l.id === 'smashme-main' || l.name?.toLowerCase().includes('centru'))) ||
      (locKey === 'cluj2' && (l.id === 'cluj2' || l.name?.toLowerCase().includes('cj-2')))
    );

    // Verificăm dacă POS-ul este activat în setările sălii
    // Dacă paymentMode este 'cash_only' sau cashOnly e true sau paymentGateway e 'none', POS-ul este decuplat / dezactivat intenționat!
    const isPosEnabled = Boolean(
      cfg &&
      cfg.paymentMode !== 'cash_only' &&
      !cfg.cashOnly &&
      cfg.paymentGateway !== 'none'
    );

    // Verificare .env vs PC Fizic (Hostname, Port)
    const expected = EXPECTED_PHYSICAL_HARDWARE[locKey];
    const actualHost = b?.hostname || loc.hostname;
    let hardwareMismatch = false;
    let hardwareDetail = '';

    if (actualHost && expected) {
      if (actualHost.toUpperCase() === expected.expectedHostname.toUpperCase()) {
        hardwareDetail = `PC: <code>${actualHost}</code> (Fizic Corect ✅)`;
      } else {
        hardwareMismatch = true;
        // Identificăm unde ar trebui să fie de fapt acest PC
        const realOwnerKey = Object.keys(EXPECTED_PHYSICAL_HARDWARE).find(
          k => EXPECTED_PHYSICAL_HARDWARE[k].expectedHostname.toUpperCase() === actualHost.toUpperCase()
        );
        const realOwnerName = realOwnerKey ? EXPECTED_PHYSICAL_HARDWARE[realOwnerKey].locationName : 'Alt PC necunoscut';
        hardwareDetail = `🚨 <b>NEPOTRIVIRE .ENV!</b> (PC: <code>${actualHost}</code> de la ${realOwnerName})`;
        issues.push(`• <b>${loc.displayName || locKey}:</b> 🚨 <b>EROARE GRAVĂ CONFIGURARE .ENV!</b> PC-ul fizic (<code>${actualHost}</code>) aparține locației <b>${realOwnerName}</b>, dar în fișierul .env este setat <code>${locKey}</code>! Comenzile vor fi direcționate eronat!`);
      }
    } else if (actualHost) {
      hardwareDetail = `PC: <code>${actualHost}</code>`;
    }

    const isPosReady = !isPosEnabled || isBridgeAlive;
    const is100Ready = isKioskAlive && isPosReady && !hasDuplicate && !hardwareMismatch;
    if (is100Ready) {
      readyCount++;
    } else {
      failedLocationKeys.push(locKey);
    }

    const dot = is100Ready ? '🟢' : ((isBridgeAlive || isKioskAlive) ? '🟡' : '🔴');
    lines.push(`${dot} <b>${loc.displayName || getLocationDisplayName(locKey)}</b>`);

    // Ecran Kiosk
    if (isKioskAlive) {
      const kData = kiosksSummary[locKey] || {};
      const verStr = kData.scriptVersion ? `v${kData.scriptVersion}` : 'Universal';
      const screenStr = kData.screen ? ` • Ecran: ${kData.screen}` : '';
      lines.push(`   ├ 🖥️ <b>Ecran Kiosk:</b> Conectat (${verStr}${screenStr})`);
    } else {
      lines.push(`   ├ 🖥️ <b>Ecran Kiosk:</b> 🔴 Oprit / Deconectat`);
      issues.push(`• <b>${loc.displayName || locKey}:</b> Ecranul Kiosk este oprit.`);
    }

    // Terminal POS & Semnal
    if (!isPosEnabled) {
      lines.push(`   ├ 💳 <b>POS:</b> Inactiv din setări Kiosk (Plată doar Cash / Numerar 💵)`);
    } else if (isBridgeAlive) {
      const portName = loc.port && loc.port !== 'N/A' ? loc.port : (b?.port || 'COM');
      const gatewayName = (loc.gateway || 'raiffeisen').toUpperCase();
      let signalText = 'activ';
      if (b?.posSignal) {
        if (b.posSignal.success) {
          signalText = `${b.posSignal.latencyMs}ms (activ)`;
        } else {
          signalText = `⚠️ ${b.posSignal.message || 'fără răspuns'}`;
        }
      }
      lines.push(`   ├ 💳 <b>POS (${gatewayName}):</b> Conectat pe ${portName} • Semnal: <b>${signalText}</b>`);
    } else {
      lines.push(`   ├ 💳 <b>POS:</b> 🔴 Bridge / PC Deconectat`);
      issues.push(`• <b>${loc.displayName || locKey}:</b> POS Bridge este oprit (start-windows.bat nu rulează).`);
    }

    // Imprimantă
    const printer = (loc.printerName && loc.printerName !== 'N/A' && loc.printerName !== 'Nedetectată')
      ? loc.printerName
      : (isBridgeAlive ? 'Nedetectată' : 'Offline');
    lines.push(`   ├ 🖨️ <b>Imprimantă:</b> ${printer}`);

    // Verificare .env & Procese duplicate
    const sysChecks = [];
    sysChecks.push('Server: <code>ttut.onrender.com</code>');
    if (hardwareDetail) {
      sysChecks.push(hardwareDetail);
    }

    if (bridgeCount > 1) {
      sysChecks.push(`⚠️ <b>${bridgeCount} procese Bridge duplicate!</b>`);
      issues.push(`• <b>${loc.displayName || locKey}:</b> Rulează ${bridgeCount} procese Bridge simultan! Necesită restart.`);
    } else if (bridgeCount === 1) {
      sysChecks.push('Proces unic ✅');
    }

    if (kioskCount > 1) {
      sysChecks.push(`⚠️ <b>${kioskCount} ferestre Kiosk duplicate!</b>`);
      issues.push(`• <b>${loc.displayName || locKey}:</b> Sunt deschise ${kioskCount} ferestre Kiosk.`);
    }

    lines.push(`   └ 🛡️ <b>Sistem & .env:</b> ${sysChecks.join(' • ')}`);
    lines.push(``);
  }

  // Rezumat final
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📊 <b>Status General:</b> <b>${readyCount} din ${targetLocations.length}</b> locații pregătite 100%`);

  if (issues.length > 0) {
    lines.push(``);
    lines.push(`🚨 <b>ACȚIUNI NECESARE:</b>`);
    issues.forEach(iss => lines.push(iss));
    if (!isManual && failedLocationKeys.length > 0 && minute < 15) {
      lines.push(``);
      lines.push(`🔁 <i>Sistemul va repeta verificarea automat la ora 10:15 pentru toate locațiile.</i>`);
    }
  } else {
    lines.push(`🎉 <b>Toate sistemele sunt funcționale!</b>`);
  }

  const reportText = lines.join('\n');
  await sendTelegramMessage(reportText, null, destinationChat);

  return { ok: true, report: reportText, failedLocations: failedLocationKeys };
}

/**
 * Retry check at 10:05 (10 minutes after 09:55) strictly for locations that were offline
 */
async function runMorningRetryCheck(failedKeys, destinationChat) {
  if (!failedKeys || failedKeys.length === 0) return;
  const { dateStr, hour, minute } = getBucharestTime();
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  console.log(`[MorningCheck] 🔁 Rulare re-verificare pentru: ${failedKeys.join(', ')} la ${timeStr}...`);

  const dbLocs = await getDbLocationsList();

  // Trimitere impuls de test semnal (doar dacă POS-ul este activat)
  if (_io) {
    for (const locKey of failedKeys) {
      const cfg = dbLocs.find(l => 
        l.id === locKey || 
        l.kioskUrl === locKey || 
        (Array.isArray(l.aliases) && l.aliases.includes(locKey)) ||
        (locKey === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
        (locKey === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov'))) ||
        (locKey === 'cluj1' && (l.id === 'smashme-main' || l.name?.toLowerCase().includes('centru'))) ||
        (locKey === 'cluj2' && (l.id === 'cluj2' || l.name?.toLowerCase().includes('cj-2')))
      );
      const isPosEnabled = Boolean(
        cfg &&
        cfg.paymentMode !== 'cash_only' &&
        !cfg.cashOnly &&
        cfg.paymentGateway !== 'none'
      );
      if (isPosEnabled) {
        _io.to(`pos-bridge-${locKey}`).emit('test_pos_signal', { locationId: locKey });
      }
    }
  }

  await new Promise(r => setTimeout(r, 2500));

  const summary = getStatusSummary();

  const lines = [
    `⏰ <b>[RE-VERIFICARE MATINALĂ — ${timeStr}]</b>`,
    `<i>Verificare automată la 10 minute după deschidere pentru locațiile restante</i>`,
    ``
  ];

  let stillFailedCount = 0;

  for (const locKey of failedKeys) {
    const loc = summary.locations[locKey] || {};
    const isBridgeAlive = isBridgeSocketConnected(locKey);
    const isKioskAlive = isKioskSocketConnected(locKey);
    const bridgeCount = getBridgeSocketCount(locKey);
    const kioskCount = getKioskSocketCount(locKey);

    const cfg = dbLocs.find(l => 
      l.id === locKey || 
      l.kioskUrl === locKey || 
      (Array.isArray(l.aliases) && l.aliases.includes(locKey)) ||
      (locKey === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
      (locKey === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov'))) ||
      (locKey === 'cluj1' && (l.id === 'smashme-main' || l.name?.toLowerCase().includes('centru'))) ||
      (locKey === 'cluj2' && (l.id === 'cluj2' || l.name?.toLowerCase().includes('cj-2')))
    );
    const isPosEnabled = Boolean(
      cfg &&
      cfg.paymentMode !== 'cash_only' &&
      !cfg.cashOnly &&
      cfg.paymentGateway !== 'none'
    );

    const b = bridges.get(locKey);
    const expected = EXPECTED_PHYSICAL_HARDWARE[locKey];
    const actualHost = b?.hostname || loc.hostname;
    let hardwareMismatch = false;
    if (actualHost && expected && actualHost.toUpperCase() !== expected.expectedHostname.toUpperCase()) {
      hardwareMismatch = true;
    }

    const isPosReady = !isPosEnabled || isBridgeAlive;
    const is100Ready = isKioskAlive && isPosReady && bridgeCount <= 1 && kioskCount <= 1 && !hardwareMismatch;

    if (is100Ready) {
      const hostStr = actualHost ? ` • PC: <code>${actualHost}</code> ✅` : '';
      const posStr = isPosEnabled ? `💳 POS: Activ pe ${loc.port || 'COM'}` : '💳 POS: Inactiv din setări (Mod: Doar Numerar 💵)';
      lines.push(`🟢 <b>${loc.displayName || getLocationDisplayName(locKey)}</b>: S-a conectat cu succes!`);
      lines.push(`   └ ${posStr} • 🖥️ Ecran Kiosk: Activ${hostStr}`);
    } else {
      stillFailedCount++;
      if (hardwareMismatch) {
        lines.push(`🚨 <b>${loc.displayName || getLocationDisplayName(locKey)}</b>: Conectat dar cu .ENV GREȘIT! PC fizic necorespunzător.`);
      } else {
        lines.push(`🔴 <b>${loc.displayName || getLocationDisplayName(locKey)}</b>: În continuare DECONECTAT!`);
      }
      if (!isBridgeAlive && !isKioskAlive) {
        lines.push(`   └ ⚠️ PC-ul este oprit complet sau nu are internet.`);
      } else if (isPosEnabled && !isBridgeAlive) {
        lines.push(`   └ ⚠️ POS Bridge este oprit (start-windows.bat).`);
      } else if (!isKioskAlive) {
        lines.push(`   └ ⚠️ Ecranul Kiosk este închis.`);
      }
    }
    lines.push(``);
  }

  if (stillFailedCount > 0) {
    lines.push(`🚨 <b>Atenție:</b> ${stillFailedCount} locație(i) nu au pornit chioșcul. Contactați personalul din restaurant!`);
  } else {
    lines.push(`🎉 <b>Excelent! Toate locațiile sunt acum 100% active și funcționale!</b>`);
  }

  await sendTelegramMessage(lines.join('\n'), null, destinationChat);
}

// Verificare automata orar zilnic la 10:00 si 10:15 Europe/Bucharest
setInterval(() => {
  const { hour, minute, dateStr } = getBucharestTime();
  if (hour === 10 && minute === 0) {
    if (lastCheck1000Date !== dateStr) {
      lastCheck1000Date = dateStr;
      console.log(`[BridgeMonitor] ⏰ Este 10:00 Europe/Bucharest! Declanșez verificarea automată de la 10:00...`);
      runMorningPreflightCheck().catch(e => console.error('[MorningCheck 10:00] Eroare:', e.message));
    }
  }
  if (hour === 10 && minute === 15) {
    if (lastCheck1015Date !== dateStr) {
      lastCheck1015Date = dateStr;
      console.log(`[BridgeMonitor] ⏰ Este 10:15 Europe/Bucharest! Declanșez verificarea automată de la 10:15...`);
      runMorningPreflightCheck().catch(e => console.error('[MorningCheck 10:15] Eroare:', e.message));
    }
  }
}, 20000);

/**
 * Periodic healthcheck loop (runs every 15s)
 * Catches bridges whose socket disconnected for longer than grace period
 */
function runHealthCheck() {
  const now = Date.now();
  let hasChanges = false;

  for (const [locKey, b] of bridges.entries()) {
    const isSocketAlive = isBridgeSocketConnected(locKey);
    if (isSocketAlive) {
      b._missingSince = null;
      if (b.status !== 'online') {
        b.status = 'online';
        b.lastPing = now;
        hasChanges = true;
      }
    } else if (b.status === 'online') {
      // Grace period (45 seconds) to prevent false alarms on brief network reconnects
      if (!b._missingSince) {
        b._missingSince = now;
      } else if (now - b._missingSince > 45000) {
        b.status = 'offline';
        b.disconnectTime = now;
        b._missingSince = null;
        hasChanges = true;
        recordEvent('DISCONNECT', locKey, `Conexiunea socket s-a întrerupt`);
        console.warn(`[BridgeMonitor] POS Bridge DECONECTAT: ${locKey} (${b.displayName})`);
        triggerDisconnectAlert(locKey, b);
      }
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
    const isBridgeAlive = isBridgeSocketConnected(locKey);
    const isKioskAlive = isKioskSocketConnected(locKey);
    const defaults = DEFAULT_BRIDGE_CONFIGS[locKey] || {};

    if (isBridgeAlive) {
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
    } else if (b && b.status === 'online') {
      b.status = 'offline';
      if (!b.disconnectTime) b.disconnectTime = now;
    }

    const isOnline = isBridgeAlive;
    if (isOnline) summary.totalOnline++;
    else summary.totalOffline++;

    const lastPingAge = (b?.lastPing && !isOnline) ? Math.max(0, Math.round((now - b.lastPing) / 1000)) : null;
    const offlineDurationMinutes = (!isOnline && b?.disconnectTime) ? Math.round((now - b.disconnectTime) / 60000) : null;

      summary.locations[locKey] = {
        locationId: locKey,
        displayName: getLocationDisplayName(locKey),
        status: isOnline ? 'online' : 'offline',
        isBridgeOnline: isBridgeAlive,
        isKioskOnline: isKioskAlive,
        port: b?.port || defaults.port || 'N/A',
        gateway: b?.gateway || defaults.gateway || 'raiffeisen',
        printerName: b?.printerName || defaults.printerName || 'N/A',
        lastPing: b?.lastPing || null,
        lastPingSecondsAgo: isOnline ? 0 : lastPingAge,
        offlineDurationMinutes,
        connectedAt: b?.connectedAt || null,
        ip: b?.ip || '',
        uptimeSeconds: b?.uptimeSeconds || 0,
        posWakeStandby: (() => {
          try {
            const allLocs = typeof getAllLocations === 'function' ? getAllLocations() : [];
            const match = allLocs.find(l => 
              l.id === locKey || 
              l.kioskUrl === locKey || 
              (Array.isArray(l.aliases) && l.aliases.includes(locKey)) ||
              (locKey === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
              (locKey === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov')))
            );
            if (match && match.posWakeStandby !== undefined) {
              return Boolean(match.posWakeStandby);
            }
          } catch (_) {}
          return b?.posWakeStandby !== undefined ? b.posWakeStandby : true;
        })(),
        posWakeIntervalMinutes: (() => {
          try {
            const allLocs = typeof getAllLocations === 'function' ? getAllLocations() : [];
            const match = allLocs.find(l => 
              l.id === locKey || 
              l.kioskUrl === locKey || 
              (Array.isArray(l.aliases) && l.aliases.includes(locKey)) ||
              (locKey === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
              (locKey === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov')))
            );
            if (match && match.posWakeIntervalMinutes !== undefined) {
              return Number(match.posWakeIntervalMinutes) || 5;
            }
          } catch (_) {}
          return b?.posWakeIntervalMinutes || 5;
        })(),
        hostname: b?.hostname || '',
        expectedHardware: EXPECTED_PHYSICAL_HARDWARE[locKey] || null,
        posSignal: b?.posSignal || null,
        isPosEnabled: isPosEnabled(locKey),
        isCashOnly: !isPosEnabled(locKey),
      };
    });

    return summary;
}

/**
 * Helper to fetch freshest location configurations from database or locations.json
 */
async function getDbLocationsList() {
  try {
    const { rows } = await pool.query('SELECT id, data FROM locations');
    if (rows && rows.length > 0) {
      return rows.map(r => ({ id: r.id, ...(r.data || {}) }));
    }
  } catch (_) {}
  if (typeof getAllLocations === 'function') {
    return getAllLocations();
  }
  return [];
}

/**
 * Format clean summary for /status command reply in Telegram (including POS, PINs, and Lock Schedule)
 */
async function formatStatusSummaryForTelegram() {
  const summary = getStatusSummary();
  const timeStr = formatDateTime();
  const dbLocs = await getDbLocationsList();

  const lines = [
    `📊 <b>[STATUS SISTEM SMART KIOSK]</b>`,
    `Timp: ${timeStr}`,
    ``
  ];

  for (const [k, loc] of Object.entries(summary.locations)) {
    const cfg = dbLocs.find(l => 
      l.id === k || 
      l.kioskUrl === k || 
      (Array.isArray(l.aliases) && l.aliases.includes(k)) ||
      (k === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
      (k === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov'))) ||
      (k === 'cluj1' && (l.id === 'smashme-main' || l.name?.toLowerCase().includes('centru'))) ||
      (k === 'cluj2' && (l.id === 'cluj2' || l.name?.toLowerCase().includes('cj-2')))
    );

    const isPosEnabled = Boolean(
      cfg &&
      cfg.paymentMode !== 'cash_only' &&
      !cfg.cashOnly &&
      cfg.paymentGateway !== 'none'
    );

    let dot = '🟢';
    if (!isPosEnabled) {
      dot = loc.isKioskOnline ? '🟢' : '🔴';
    } else if (!loc.isBridgeOnline && !loc.isKioskOnline) {
      dot = '🔴';
    } else if (!loc.isBridgeOnline || !loc.isKioskOnline) {
      dot = '🟡';
    }

    // POS details: Port, Gateway, Semnal / Latență
    let posDetail = '';
    if (!isPosEnabled) {
      posDetail = 'Dezactivat din setări (Mod: Doar Numerar 💵)';
    } else if (loc.isBridgeOnline) {
      const portName = loc.port && loc.port !== 'N/A' ? loc.port : 'COM';
      const gatewayName = loc.gateway ? loc.gateway.toUpperCase() : 'RAIFFEISEN';
      let signalStr = 'Conectat';
      if (loc.posSignal) {
        if (loc.posSignal.success) {
          signalStr = loc.posSignal.latencyMs !== null ? `${loc.posSignal.latencyMs}ms (activ)` : 'activ';
        } else {
          signalStr = `⚠️ Eșuat (${loc.posSignal.message || 'Timeout'})`;
        }
      }
      posDetail = `${portName} (${gatewayName}) • Semnal: ${signalStr}`;
    } else {
      posDetail = 'Deconectat / Oprit';
    }

    // Standby wake status
    const wakeActive = (cfg?.posWakeStandby !== undefined) ? Boolean(cfg.posWakeStandby) : Boolean(loc.posWakeStandby);
    const wakeInterval = cfg?.posWakeIntervalMinutes || loc.posWakeIntervalMinutes || 5;
    const wakeStr = wakeActive ? `Activă (la ${wakeInterval} min, 10:00 - 22:00)` : 'Inactivă';

    // PIN Manager & Casier
    let pinStr = cfg?.kioskPin ? `<code>${cfg.kioskPin}</code>` : 'Fără PIN';
    if (cfg?.vendorPin) {
      pinStr += ` (Casier: <code>${cfg.vendorPin}</code>)`;
    }

    // Blocare Program Kiosk
    let lockStr = 'Inactivă';
    if (cfg?.lockScheduleActive) {
      const s = cfg.lockStartTime || '22:00';
      const e = cfg.lockEndTime || '09:00';
      lockStr = `Activă (${s} - ${e})`;
    }

    // Imprimantă
    const printerStr = (loc.printerName && loc.printerName !== 'N/A' && loc.printerName !== 'Nedetectată')
      ? loc.printerName
      : (loc.isBridgeOnline ? 'Nedetectată' : 'Offline');

    // Kiosk & Uptime
    const kioskStr = loc.isKioskOnline ? 'Conectat' : 'Offline';
    let uptimeStr = '';
    if (loc.isBridgeOnline && loc.uptimeSeconds > 0) {
      const hrs = Math.floor(loc.uptimeSeconds / 3600);
      const mins = Math.floor((loc.uptimeSeconds % 3600) / 60);
      uptimeStr = hrs > 0 ? ` • Uptime: ${hrs}h ${mins}m` : ` • Uptime: ${mins}m`;
    }

    lines.push(`${dot} <b>${loc.displayName}</b>`);
    lines.push(`   ├ 💳 <b>POS:</b> ${posDetail}`);
    lines.push(`   ├ ⚡ <b>Trezire Standby:</b> ${wakeStr}`);
    lines.push(`   ├ 🔐 <b>PIN Manager:</b> ${pinStr}`);
    lines.push(`   ├ 🕒 <b>Blocare Program:</b> ${lockStr}`);
    lines.push(`   ├ 🖨️ <b>Imprimantă:</b> ${printerStr}`);
    lines.push(`   └ 🖥️ <b>Kiosk:</b> ${kioskStr}${uptimeStr}`);
    lines.push(``);
  }

  lines.push(`Total: <b>${summary.totalOnline}</b> active / <b>${summary.totalOffline}</b> offline`);
  return lines.join('\n');
}

/**
 * Format dedicated /pin command summary for quick PIN copy & schedule review
 */
async function formatPinSummaryForTelegram() {
  const dbLocs = await getDbLocationsList();
  const locationKeys = ['cluj1', 'cluj2', 'sm-brasov', 'constanta1'];
  const friendlyNames = {
    cluj1: 'SmashMe Centru (Cluj 1)',
    cluj2: 'SmashMe CJ-2 (Cluj 2)',
    'sm-brasov': 'RollMaster Brașov',
    constanta1: 'SmashMe Constanța 1',
  };

  const lines = [
    `🔐 <b>[CODURI PIN & PROGRAM BLOCARE KIOSK]</b>`,
    ``
  ];

  for (const locKey of locationKeys) {
    const cfg = dbLocs.find(l => 
      l.id === locKey || 
      l.kioskUrl === locKey || 
      (Array.isArray(l.aliases) && l.aliases.includes(locKey)) ||
      (locKey === 'constanta1' && (l.id === 'smashme-constanta' || l.name?.toLowerCase().includes('constanta'))) ||
      (locKey === 'sm-brasov' && (l.id === 'rollmaster' || l.name?.toLowerCase().includes('brasov'))) ||
      (locKey === 'cluj1' && (l.id === 'smashme-main' || l.name?.toLowerCase().includes('centru'))) ||
      (locKey === 'cluj2' && (l.id === 'cluj2' || l.name?.toLowerCase().includes('cj-2')))
    );

    const name = friendlyNames[locKey] || locKey;
    const pin = cfg?.kioskPin ? `<code>${cfg.kioskPin}</code>` : '<i>Fără PIN (Liber)</i>';
    const vendorPin = cfg?.vendorPin ? ` • Casier: <code>${cfg.vendorPin}</code>` : '';
    let lockStr = 'Inactivă';
    if (cfg?.lockScheduleActive) {
      const s = cfg.lockStartTime || '22:00';
      const e = cfg.lockEndTime || '09:00';
      lockStr = `Activă (${s} - ${e})`;
    }

    lines.push(`📍 <b>${name}</b>`);
    lines.push(`   • PIN: ${pin}${vendorPin}`);
    lines.push(`   • Blocare Program: ${lockStr}`);
    lines.push(``);
  }

  lines.push(`<i>💡 Apasă pe codul PIN pentru a-l copia direct.</i>`);
  return lines.join('\n');
}

/**
 * Seed initial state from recent port_scans table so restarted backend doesn't show blank
 */
async function seedFromRecentScans() {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (location_id) location_id, pos_port, pos_gateway, printer_name, hostname, created_at
       FROM port_scans
       ORDER BY location_id, created_at DESC`
    );

    const now = Date.now();
    rows.forEach(r => {
      const locKey = normalizeLocationKey(r.location_id);
      const defaults = DEFAULT_BRIDGE_CONFIGS[locKey] || {};
      const scanTime = new Date(r.created_at).getTime();
      const wasSeenToday = (now - scanTime) < (24 * 3600 * 1000);
      const isSocketAlive = isBridgeSocketConnected(locKey);

      bridges.set(locKey, {
        locationId: locKey,
        rawLocationId: r.location_id,
        displayName: getLocationDisplayName(locKey),
        port: r.pos_port || defaults.port || '?',
        gateway: r.pos_gateway || defaults.gateway || 'raiffeisen',
        printerName: r.printer_name || defaults.printerName || '',
        hostname: r.hostname || '',
        status: (isSocketAlive || wasSeenToday) ? 'online' : 'offline',
        lastPing: scanTime,
        connectedAt: scanTime,
        disconnectTime: (isSocketAlive || wasSeenToday) ? null : scanTime,
        socketId: null,
        ip: '',
        uptimeSeconds: 0,
      });
    });
    console.log(`[BridgeMonitor] Inițializat starea a ${bridges.size} bridge-uri din scanările anterioare.`);

    // Pre-încărcare din pos_signal_logs pentru a nu afișa niciodată „Netestat” după restartul backend-ului
    try {
      const { rows: sigRows } = await pool.query(
        `SELECT DISTINCT ON (location_id) location_id, latency_ms, success, message, tested_at
         FROM pos_signal_logs
         ORDER BY location_id, tested_at DESC`
      );
      sigRows.forEach(s => {
        const locKey = normalizeLocationKey(s.location_id);
        const sigObj = {
          success: !!s.success,
          latencyMs: s.latency_ms,
          message: s.message || (s.success ? 'Activ' : 'Eșuat'),
          testedAt: new Date(s.tested_at).getTime(),
        };
        let b = bridges.get(locKey);
        if (b) {
          b.posSignal = sigObj;
        } else {
          b = {
            locationId: locKey,
            displayName: getLocationDisplayName(locKey),
            status: isBridgeSocketConnected(locKey) ? 'online' : 'offline',
            posSignal: sigObj,
          };
          bridges.set(locKey, b);
        }
      });
      console.log(`[BridgeMonitor] Pre-încărcat istoricul semnalului POS pentru ${sigRows.length} locații.`);
    } catch (sigErr) {
      console.warn('[BridgeMonitor] Nu s-au putut pre-încărca pos_signal_logs:', sigErr.message);
    }
  } catch (err) {
    console.warn('[BridgeMonitor] Nu s-au putut pre-încărca port_scans:', err.message);
  }
}

/**
 * Retrieve recent POS signal latency logs for a location
 */
async function getPosSignalLogs(locationId, limit = 50) {
  try {
    const locKey = normalizeLocationKey(locationId);
    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases(locKey) || [];
    const targetKeys = Array.from(new Set([locKey, ...aliases]));

    const { rows } = await pool.query(
      `SELECT id, location_id, port, latency_ms, success, message, tested_at, created_at
       FROM pos_signal_logs
       WHERE location_id = ANY($1)
         AND (message IS NULL OR message NOT LIKE '%WAIT_ENQ_ACK%')
       ORDER BY tested_at DESC
       LIMIT $2`,
      [targetKeys, limit]
    );
    return rows;
  } catch (err) {
    console.error('[BridgeMonitor] Eroare la citirea pos_signal_logs:', err.message);
    return [];
  }
}

module.exports = {
  setIo,
  loadTelegramConfig,
  saveTelegramConfig,
  getPublicTelegramConfig,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendPosAlert,
  sendOrderAlert,
  sendIikoAlert,
  getPosReasonText,
  handleBridgeConnect,
  handleBridgeHeartbeat,
  handleBridgeDisconnect,
  getStatusSummary,
  recordPosSignalResult,
  getPosSignalLogs,
  seedFromRecentScans,
  formatDateTime,
  formatStatusSummaryForTelegram,
  formatPinSummaryForTelegram,
  runMorningPreflightCheck,
  registerTelegramWebhook,
  updateLocationConfig,
  updateBridgeHardware,
};


