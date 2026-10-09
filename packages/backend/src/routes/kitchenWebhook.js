const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const {
  getKitchenWebhookConfig,
  updateKitchenWebhookConfig,
  sendKitchenOrderWebhook,
  verifyKitchenOrder,
  getRecentDeliveries,
  formatKitchenOrderPayload,
} = require('../services/kitchenWebhookService');

// ─── GET /api/webhooks/kitchen/config ───────────────────────────────────────
router.get('/config', (req, res) => {
  try {
    const config = getKitchenWebhookConfig();
    const deliveries = getRecentDeliveries().slice(0, 10);
    res.json({
      success: true,
      config,
      recentDeliveries: deliveries,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/webhooks/kitchen/config ──────────────────────────────────────
router.post('/config', (req, res) => {
  try {
    const { url, enabled, secret, autoSendOnCreate } = req.body;
    const updated = updateKitchenWebhookConfig({ url, enabled, secret, autoSendOnCreate });
    res.json({
      success: true,
      message: 'Configurația webhook bucătărie a fost salvată.',
      config: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/webhooks/kitchen/deliveries ───────────────────────────────────
router.get('/deliveries', (req, res) => {
  try {
    res.json({
      success: true,
      deliveries: getRecentDeliveries(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/webhooks/kitchen/verify ──────────────────────────────────────
// Incoming webhook: Kitchen Monitoring App notifies Smart Kiosk that a cook verified the order
router.post('/verify', async (req, res) => {
  try {
    const { orderId, orderNumber, verified, cookName, cookId, notes, status } = req.body;
    const io = req.app.get('io');

    const result = await verifyKitchenOrder({
      orderId,
      orderNumber,
      verified,
      cookName,
      cookId,
      notes,
      status,
      io,
    });

    if (!result.found) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('[KitchenWebhook] /verify error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/webhooks/kitchen/test ────────────────────────────────────────
// Test connectivity by sending a mock order payload to configured webhook URL
router.post('/test', async (req, res) => {
  try {
    const mockOrder = {
      _id: `TEST-${Date.now()}`,
      orderNumber: 'TEST-001',
      brand: 'smashme',
      locationId: 'cluj-1',
      locationName: 'Iulius Mall Cluj',
      kioskId: 'Kiosk 1',
      orderType: 'dine-in',
      tableNumber: '14',
      paymentMethod: 'card',
      totalAmount: 49.50,
      status: 'pending',
      items: [
        {
          id: 'prod-burger-classic',
          name: 'Classic Smash Burger',
          quantity: 2,
          unitPrice: 20.00,
          totalPrice: 40.00,
          selectedModifiers: ['Bacon Extra', 'Fără Ceapă'],
          comment: 'Carne bine rumenită',
        },
        {
          id: 'prod-fries',
          name: 'Cartofi Prăjiți Mari',
          quantity: 1,
          unitPrice: 9.50,
          totalPrice: 9.50,
          selectedModifiers: ['Sos Usturoi'],
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const targetUrl = req.body.url || getKitchenWebhookConfig().url;
    if (!targetUrl) {
      return res.status(400).json({
        error: 'Niciun URL de webhook nu este configurat. Specificați un URL în setări sau în corpul cererii.',
      });
    }

    // Temporary override target if passed in body
    let originalConfig = null;
    if (req.body.url) {
      originalConfig = getKitchenWebhookConfig();
      updateKitchenWebhookConfig({ url: req.body.url, enabled: true });
    }

    const deliveryResult = await sendKitchenOrderWebhook(mockOrder, 'order.test');

    if (originalConfig) {
      updateKitchenWebhookConfig(originalConfig);
    }

    res.json({
      success: deliveryResult.success,
      targetUrl,
      deliveryResult,
      samplePayload: formatKitchenOrderPayload(mockOrder, 'order.test'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/webhooks/kitchen/resend/:id ───────────────────────────────────
// Manually resend an existing order to the kitchen webhook
router.post('/resend/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const { rows } = await pool.query(
      `SELECT data FROM orders WHERE id = $1 OR data->>'orderNumber' = $1 LIMIT 1`,
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Comanda nu a fost găsită' });
    }

    const order = rows[0].data;
    const deliveryResult = await sendKitchenOrderWebhook(order, 'order.created');

    res.json({
      success: deliveryResult.success,
      orderNumber: order.orderNumber,
      deliveryResult,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
