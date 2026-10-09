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

module.exports = router;
