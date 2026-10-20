const express = require('express');
const router = express.Router();
const bridgeMonitoringService = require('../services/bridgeMonitoringService');

/**
 * GET /api/bridge-monitoring/status
 * Returns full status of all location bridges, printers, recent events, and telegram config status
 */
router.get('/status', (req, res) => {
  try {
    const summary = bridgeMonitoringService.getStatusSummary();
    res.json(summary);
  } catch (err) {
    console.error('[BridgeMonitoringRoute] Error getting status:', err.message);
    res.status(500).json({ error: 'Eroare la citirea statusului bridge-urilor' });
  }
});

/**
 * GET /api/bridge-monitoring/telegram-config
 * Returns public configuration of Telegram alerts
 */
router.get('/telegram-config', (req, res) => {
  try {
    const config = bridgeMonitoringService.getPublicTelegramConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bridge-monitoring/telegram-config
 * Updates Telegram bot token, chat ID, and enabled toggle
 */
router.post('/telegram-config', async (req, res) => {
  try {
    const { botToken, chatId, posChatId, ordersChatId, enabled, alertCooldownMinutes, posAlertsFilter, ordersAlertsEnabled } = req.body || {};
    const updates = {};

    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof botToken === 'string' && botToken.trim()) updates.botToken = botToken.trim();
    if (typeof chatId === 'string') updates.chatId = chatId.trim();
    if (typeof posChatId === 'string') updates.posChatId = posChatId.trim();
    if (typeof ordersChatId === 'string') updates.ordersChatId = ordersChatId.trim();
    if (typeof alertCooldownMinutes === 'number' && alertCooldownMinutes > 0) {
      updates.alertCooldownMinutes = alertCooldownMinutes;
    }
    if (typeof posAlertsFilter === 'string') {
      updates.posAlertsFilter = posAlertsFilter;
    }
    if (typeof ordersAlertsEnabled === 'boolean') {
      updates.ordersAlertsEnabled = ordersAlertsEnabled;
    }

    const result = await bridgeMonitoringService.saveTelegramConfig(updates);
    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, config: result.config });
  } catch (err) {
    console.error('[BridgeMonitoringRoute] Error saving telegram config:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bridge-monitoring/telegram-test
 * Sends an immediate test message to Telegram
 */
router.post('/telegram-test', async (req, res) => {
  try {
    const { botToken, chatId } = req.body || {};
    const testConfig = (botToken && chatId) ? { botToken, chatId } : null;

    const testMessage = [
      `<b>[TEST NOTIFICARE SMART KIOSK]</b>`,
      `Conexiunea cu Telegram Bot este functionala.`,
      `Data/Ora server: ${bridgeMonitoringService.formatDateTime()}`,
      `Stare sistem: Monitorizare hardware activa.`,
    ].join('\n');

    const result = await bridgeMonitoringService.sendTelegramMessage(testMessage, testConfig);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, message: 'Mesajul de test a fost trimis cu succes pe Telegram!' });
  } catch (err) {
    console.error('[BridgeMonitoringRoute] Error sending test message:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bridge-monitoring/telegram-webhook
 * Receives incoming bot commands from Telegram groups (e.g. /status)
 */
router.post('/telegram-webhook', async (req, res) => {
  try {
    const update = req.body || {};
    const message = update.message;
    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const text = String(message.text || '').trim().toLowerCase();
    const chatId = message.chat?.id;

    if (text.startsWith('/status') || text === 'status' || text.startsWith('/stare')) {
      const statusText = await bridgeMonitoringService.formatStatusSummaryForTelegram();
      await bridgeMonitoringService.sendTelegramMessage(statusText, null, chatId);
    } else if (text.startsWith('/pin') || text === 'pin' || text.startsWith('/cod') || text === 'cod' || text.startsWith('/program') || text === 'program') {
      const pinText = await bridgeMonitoringService.formatPinSummaryForTelegram();
      await bridgeMonitoringService.sendTelegramMessage(pinText, null, chatId);
    } else if (text.startsWith('/verificare') || text === 'verificare' || text.startsWith('/check') || text.startsWith('/dimineata') || text.startsWith('/0955') || text.startsWith('/preflight')) {
      await bridgeMonitoringService.sendTelegramMessage('⏳ <i>Se efectuează verificarea matinală a echipamentelor (test semnal POS, ecran, .env, procese duplicate)...</i>', null, chatId);
      await bridgeMonitoringService.runMorningPreflightCheck(chatId, true);
    } else if (text.startsWith('/ajutor') || text.startsWith('/help') || text.startsWith('/start')) {
      const helpText = [
        `🤖 <b>[SMART KIOSK BOT]</b>`,
        `Comenzi disponibile:`,
        `• <b>/status</b> — Afișează starea curentă a kiosk-urilor, POS, imprimante, PIN-uri și program.`,
        `• <b>/pin</b> — Afișează codurile PIN de deblocare și orarul programat de blocare.`,
        `• <b>/verificare</b> — Rulează manual raportul complet de verificare matinală de deschidere (semnal POS, ecran, .env, procese duplicate).`,
      ].join('\n');
      await bridgeMonitoringService.sendTelegramMessage(helpText, null, chatId);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('[TelegramWebhook] Eroare procesare update Telegram:', err.message);
    return res.sendStatus(200);
  }
});

/**
 * POST /api/bridge-monitoring/trigger-morning-check
 * Manually triggers the morning 09:55 pre-flight healthcheck report
 */
router.post('/trigger-morning-check', async (req, res) => {
  try {
    const result = await bridgeMonitoringService.runMorningPreflightCheck(null, true);
    res.json(result);
  } catch (err) {
    console.error('[BridgeMonitoringRoute] Error triggering morning check:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bridge-monitoring/:locationId/restart-bridge
 * Remotely restarts the POS bridge process on the location PC
 */
router.post('/:locationId/restart-bridge', (req, res) => {
  try {
    const io = req.app.get('io');
    const { locationId } = req.params;
    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases ? getLocationAliases(locationId) : [locationId];
    const targets = new Set([locationId, ...aliases].filter(Boolean));

    if (io) {
      for (const tid of targets) {
        io.to(`pos-bridge-${tid}`).emit('remote_restart', { locationId: tid });
        io.emit(`remote_restart_${tid}`, { locationId: tid });
      }
      console.log(`[BridgeMonitor] Comandă restart trimisă către bridge: ${[...targets].join(', ')}`);
      res.json({ success: true, message: `Comanda de restart a fost trimisă către bridge (${locationId})` });
    } else {
      res.status(500).json({ error: 'Socket.io nu este inițializat pe server' });
    }
  } catch (err) {
    console.error('[BridgeMonitor] Eroare restart bridge:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bridge-monitoring/:locationId/set-port
 * Remotely updates the POS COM_PORT in the bridge .env and restarts it
 */
router.post('/:locationId/set-port', (req, res) => {
  try {
    const io = req.app.get('io');
    const { locationId } = req.params;
    const { port } = req.body;
    if (!port) return res.status(400).json({ error: 'Portul este obligatoriu (ex: COM5)' });
    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases ? getLocationAliases(locationId) : [locationId];
    const targets = new Set([locationId, ...aliases].filter(Boolean));

    if (io) {
      for (const tid of targets) {
        io.to(`pos-bridge-${tid}`).emit('set_pos_port', { locationId: tid, port });
        io.emit(`set_pos_port_${tid}`, { locationId: tid, port });
      }
      console.log(`[BridgeMonitor] Comandă set_pos_port (${port}) trimisă către: ${[...targets].join(', ')}`);
      res.json({ success: true, message: `Comanda de setare port ${port} a fost trimisă către ${locationId}` });
    } else {
      res.status(500).json({ error: 'Socket.io nu este inițializat pe server' });
    }
  } catch (err) {
    console.error('[BridgeMonitor] Eroare set-port:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bridge-monitoring/:locationId/test-pos-signal
 * Sends a real-time signal and latency test command to POS Bridge
 */
router.post('/:locationId/test-pos-signal', (req, res) => {
  try {
    const io = req.app.get('io');
    const { locationId } = req.params;
    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases ? getLocationAliases(locationId) : [locationId];
    const targets = new Set([locationId, ...aliases].filter(Boolean));

    if (io) {
      io.to(`pos-bridge-${locationId}`).emit('test_pos_signal', { locationId });
      io.emit(`test_pos_signal_${locationId}`, { locationId });
      console.log(`[BridgeMonitor] Comandă test_pos_signal unică transmisă către: ${locationId}`);
      res.json({ success: true, message: `Test semnal POS transmis către ${locationId}...` });
    } else {
      res.status(500).json({ error: 'Socket.io nu este inițializat pe server' });
    }
  } catch (err) {
    console.error('[BridgeMonitor] Eroare test-pos-signal:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bridge-monitoring/:locationId/set-wake-config
 * Updates POS Standby keep-alive config and broadcasts to bridge
 */
router.post('/:locationId/set-wake-config', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { posWakeStandby, posWakeIntervalMinutes } = req.body;
    const { findLocation, getLocationAliases } = require('../utils/locations');
    const { pool } = require('../db');
    const fl = findLocation(locationId);
    const targetId = fl?.id || locationId;

    let updatedLoc = null;
    try {
      const existing = await pool.query('SELECT * FROM locations WHERE id = $1 OR data->>\'kioskUrl\' = $1', [targetId]);
      if (existing.rows[0]) {
        const current = existing.rows[0];
        const merged = { ...current.data };
        if (posWakeStandby !== undefined) merged.posWakeStandby = !!posWakeStandby;
        if (posWakeIntervalMinutes !== undefined) merged.posWakeIntervalMinutes = Number(posWakeIntervalMinutes);
        const { rows } = await pool.query(
          `UPDATE locations SET data = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [JSON.stringify(merged), current.id]
        );
        updatedLoc = { id: rows[0].id, active: rows[0].active, ...rows[0].data };
      }
    } catch (dbErr) {
      console.warn('[BridgeMonitoring] DB update error:', dbErr.message);
    }

    if (!updatedLoc) {
      updatedLoc = {
        id: targetId,
        posWakeStandby: posWakeStandby !== undefined ? !!posWakeStandby : true,
        posWakeIntervalMinutes: Number(posWakeIntervalMinutes) || 5,
      };
    }

    const io = req.app.get('io');
    if (io) {
      const aliases = getLocationAliases ? getLocationAliases(locationId) : [locationId];
      const targets = new Set([locationId, targetId, ...aliases].filter(Boolean));
      for (const tid of targets) {
        io.to(`pos-bridge-${tid}`).emit('location_updated', updatedLoc);
        io.emit(`location_updated_${tid}`, updatedLoc);
      }
      console.log(`[BridgeMonitoring] ⚡ Trimis location_updated (Wake: ${updatedLoc.posWakeStandby}, ${updatedLoc.posWakeIntervalMinutes}m) către: ${[...targets].join(', ')}`);
    }

    try {
      if (typeof bridgeMonitoringService.updateLocationConfig === 'function') {
        bridgeMonitoringService.updateLocationConfig(targetId, updatedLoc);
      }
    } catch (_) {}

    res.json({ success: true, message: `Configurație Standby salvată pentru ${locationId}`, updatedLoc });
  } catch (err) {
    console.error('[BridgeMonitoring] Eroare set-wake-config:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/bridge-monitoring/:locationId/signal-logs
 * Retrieves historical POS signal and latency tests for a location
 */
router.get('/:locationId/signal-logs', async (req, res) => {
  try {
    const { locationId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await bridgeMonitoringService.getPosSignalLogs(locationId, limit);
    res.json({ success: true, locationId, logs });
  } catch (err) {
    console.error('[BridgeMonitoringRoute] Error getting signal logs:', err.message);
    res.status(500).json({ error: 'Eroare la citirea istoricului semnalului POS' });
  }
});

/**
 * POST /api/bridge-monitoring/:locationId/test-print
 * Sends a diagnostic 1-line test print ticket to the thermal printer
 */
router.post('/:locationId/test-print', (req, res) => {
  try {
    const io = req.app.get('io');
    const { locationId } = req.params;
    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases ? getLocationAliases(locationId) : [locationId];
    const targets = new Set([locationId, ...aliases].filter(Boolean));

    const testOrder = {
      _id: `DIAG-${Date.now()}`,
      id: `DIAG-${Date.now()}`,
      orderNumber: 'TEST',
      orderType: 'DINE_IN',
      locationId: locationId,
      createdAt: new Date().toISOString(),
      items: [
        { name: 'TEST COMUNICATIE IMPRIMANTA', quantity: 1, price: 0 }
      ],
      subtotal: 0,
      total: 0,
      paymentMethod: 'TEST',
      brand: 'smashme'
    };

    if (io) {
      for (const tid of targets) {
        io.to(`pos-bridge-${tid}`).emit('print_ticket', { order: testOrder });
      }
      io.emit('print_ticket', { order: testOrder });
      console.log(`[BridgeMonitor] Test print trimis către imprimantă: ${[...targets].join(', ')}`);
      res.json({ success: true, message: `Test de printare trimis către imprimanta din ${locationId}` });
    } else {
      res.status(500).json({ error: 'Socket.io nu este inițializat pe server' });
    }
  } catch (err) {
    console.error('[BridgeMonitor] Eroare test print:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bridge-monitoring/reload-all-kiosks
 * Remotely triggers reload and update of ALL connected kiosk screens
 */
router.post('/reload-all-kiosks', (req, res) => {
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('remote_restart', { locationId: 'all' });
      console.log('[BridgeMonitor] Comandă globală reload trimisă către TOATE ecranele Kiosk!');
      res.json({ success: true, message: 'Comanda de actualizare și reîncărcare a fost trimisă către TOATE Kiosk-urile!' });
    } else {
      res.status(500).json({ error: 'Socket.io nu este inițializat pe server' });
    }
  } catch (err) {
    console.error('[BridgeMonitor] Eroare reload all kiosks:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bridge-monitoring/:locationId/reload-kiosk
 * Remotely triggers reload of the Chrome kiosk browser on that location
 */
router.post('/:locationId/reload-kiosk', (req, res) => {
  try {
    const io = req.app.get('io');
    const { locationId } = req.params;

    if (locationId === 'all') {
      if (io) {
        io.emit('remote_restart', { locationId: 'all' });
        console.log('[BridgeMonitor] Comandă globală reload trimisă către TOATE ecranele Kiosk!');
        return res.json({ success: true, message: 'Comanda de actualizare și reîncărcare a fost trimisă către TOATE Kiosk-urile!' });
      } else {
        return res.status(500).json({ error: 'Socket.io nu este inițializat pe server' });
      }
    }

    const { getLocationAliases } = require('../utils/locations');
    const aliases = getLocationAliases ? getLocationAliases(locationId) : [locationId];
    const targets = new Set([locationId, ...aliases].filter(Boolean));

    if (io) {
      for (const tid of targets) {
        io.to(`kiosk-${tid}`).emit('remote_restart', { locationId: tid });
        io.emit(`remote_restart_${tid}`, { locationId: tid });
      }
      console.log(`[BridgeMonitor] Comandă reload trimisă către ecran kiosk: ${[...targets].join(', ')}`);
      res.json({ success: true, message: `Comanda de reîncărcare a fost trimisă către ecranul kiosk (${locationId})` });
    } else {
      res.status(500).json({ error: 'Socket.io nu este inițializat pe server' });
    }
  } catch (err) {
    console.error('[BridgeMonitor] Eroare reload kiosk:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

