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
    const { botToken, chatId, enabled, alertCooldownMinutes } = req.body || {};
    const updates = {};

    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof botToken === 'string' && botToken.trim()) updates.botToken = botToken.trim();
    if (typeof chatId === 'string') updates.chatId = chatId.trim();
    if (typeof alertCooldownMinutes === 'number' && alertCooldownMinutes > 0) {
      updates.alertCooldownMinutes = alertCooldownMinutes;
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
 * POST /api/bridge-monitoring/:locationId/reload-kiosk
 * Remotely triggers reload of the Chrome kiosk browser on that location
 */
router.post('/:locationId/reload-kiosk', (req, res) => {
  try {
    const io = req.app.get('io');
    const { locationId } = req.params;
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

