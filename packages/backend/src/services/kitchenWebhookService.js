const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const CONFIG_PATH = path.join(__dirname, '../../data/kitchen_webhook_config.json');

// In-memory buffer for the last 50 webhook delivery attempts
const recentDeliveries = [];
const MAX_LOGS = 50;

function logDelivery(entry) {
  recentDeliveries.unshift({
    id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (recentDeliveries.length > MAX_LOGS) {
    recentDeliveries.length = MAX_LOGS;
  }
}

/**
 * Get current kitchen webhook configuration
 */
function getKitchenWebhookConfig() {
  let fileConfig = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (err) {
    console.warn('[KitchenWebhook] Could not read config file:', err.message);
  }

  const envUrl = process.env.KITCHEN_MONITORING_WEBHOOK_URL || process.env.KITCHEN_WEBHOOK_URL || '';
  const url = fileConfig.url !== undefined ? fileConfig.url : envUrl;
  const enabled = fileConfig.enabled !== undefined ? !!fileConfig.enabled : Boolean(url);
  const secret = fileConfig.secret || process.env.KITCHEN_WEBHOOK_SECRET || '';
  const autoSendOnCreate = fileConfig.autoSendOnCreate !== undefined ? !!fileConfig.autoSendOnCreate : true;

  return {
    url: url || '',
    enabled,
    secret,
    autoSendOnCreate,
    recentCount: recentDeliveries.length,
  };
}

/**
 * Save new kitchen webhook configuration
 */
function updateKitchenWebhookConfig(newConfig = {}) {
  const current = getKitchenWebhookConfig();
  const updated = {
    url: newConfig.url !== undefined ? String(newConfig.url).trim() : current.url,
    enabled: newConfig.enabled !== undefined ? Boolean(newConfig.enabled) : current.enabled,
    secret: newConfig.secret !== undefined ? String(newConfig.secret).trim() : current.secret,
    autoSendOnCreate: newConfig.autoSendOnCreate !== undefined ? Boolean(newConfig.autoSendOnCreate) : current.autoSendOnCreate,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('[KitchenWebhook] Failed to save config file:', err.message);
  }

  return updated;
}

/**
 * Normalizes an order into the standardized Kitchen Monitoring Webhook payload
 */
function formatKitchenOrderPayload(order, event = 'order.created') {
  const rawItems = order.items || [];
  const items = rawItems.map((it, idx) => {
    let modifiers = [];
    if (Array.isArray(it.selectedModifiers)) {
      modifiers = it.selectedModifiers.map(m => typeof m === 'string' ? m : (m.optionName || m.name || m.modId));
    } else if (Array.isArray(it.modifiers)) {
      modifiers = it.modifiers.map(m => typeof m === 'string' ? m : (m.optionName || m.name || m.modId));
    }

    const qty = it.quantity || it.qty || 1;
    const price = it.totalPrice !== undefined 
      ? it.totalPrice 
      : ((it.unitPrice !== undefined ? it.unitPrice : it.price) || 0) * qty;

    return {
      index: idx + 1,
      id: it.productId || it.id || null,
      name: it.name || it.productName || 'Produs',
      quantity: qty,
      unitPrice: (it.unitPrice !== undefined ? it.unitPrice : it.price) || 0,
      totalPrice: price,
      modifiers,
      comment: it.comment || null,
    };
  });

  return {
    event,
    timestamp: new Date().toISOString(),
    order: {
      orderId: order._id || order.id || '',
      orderNumber: order.orderNumber || '',
      brand: order.brand || '',
      locationId: order.locationId || '',
      locationName: order.locationName || '',
      kioskId: order.kioskId || '1',
      orderType: order.orderType || 'takeaway', // 'dine-in' (La Masă) | 'takeaway' (La Pachet)
      tableNumber: order.tableNumber || null,
      channel: order.channel || 'kiosk',
      paymentMethod: order.paymentMethod || 'card',
      totalAmount: Number(order.totalAmount || 0),
      discountAmount: Number(order.discountAmount || 0),
      status: order.status || 'pending',
      itemsCount: items.reduce((s, it) => s + it.quantity, 0),
      items,
      fiscal: order.fiscal ? {
        cui: order.fiscal.rawCui || order.fiscal.cui,
        name: order.fiscal.name || '',
      } : null,
      createdAt: order.createdAt || new Date().toISOString(),
    },
  };
}

/**
 * Dispatches an outgoing webhook to the kitchen monitoring app
 */
async function sendKitchenOrderWebhook(order, event = 'order.created') {
  const config = getKitchenWebhookConfig();

  if (!config.enabled || !config.url) {
    return { skipped: true, reason: 'Webhook disabled or no URL configured' };
  }

  const payload = formatKitchenOrderPayload(order, event);
  const orderNumber = payload.order.orderNumber || payload.order.orderId;
  const startTime = Date.now();

  try {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'SmartKiosk-KitchenMonitoring/1.0',
      'X-Webhook-Event': event,
      'X-Order-Number': orderNumber,
    };

    if (config.secret) {
      headers['X-Kitchen-Secret'] = config.secret;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    const ok = response.ok;
    let responseBody = '';
    try {
      responseBody = await response.text();
    } catch (_) {}

    logDelivery({
      event,
      orderNumber,
      url: config.url,
      status: ok ? 'success' : 'failed',
      statusCode: response.status,
      latencyMs,
      responseSummary: responseBody.slice(0, 200),
    });

    console.log(`[KitchenWebhook] ✅ Dispatched #${orderNumber} (${event}) to ${config.url} [HTTP ${response.status} in ${latencyMs}ms]`);
    return { success: ok, statusCode: response.status, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    logDelivery({
      event,
      orderNumber,
      url: config.url,
      status: 'failed',
      statusCode: null,
      latencyMs,
      error: err.message,
    });

    console.warn(`[KitchenWebhook] ⚠️ Failed to dispatch #${orderNumber} to ${config.url}:`, err.message);
    return { success: false, error: err.message, latencyMs };
  }
}

/**
 * Handles incoming verification from Kitchen Monitoring App
 */
async function verifyKitchenOrder({ orderId, orderNumber, verified = true, cookName, cookId, notes, status, io }) {
  const identifier = orderId || orderNumber;
  if (!identifier) {
    throw new Error('Trebuie specificat orderId sau orderNumber');
  }

  // Find order in DB
  const { rows } = await pool.query(
    `SELECT id, data, status FROM orders 
     WHERE id = $1 OR data->>'orderNumber' = $1 OR data->>'orderNumber' = $2
     LIMIT 1`,
    [identifier, String(identifier).replace(/^#/, '')]
  );

  if (rows.length === 0) {
    return { found: false, error: `Comanda ${identifier} nu a fost găsită în baza de date.` };
  }

  const dbId = rows[0].id;
  const orderData = rows[0].data || {};
  let currentStatus = rows[0].status;

  const verificationRecord = {
    verified: Boolean(verified),
    verifiedAt: new Date().toISOString(),
    cookName: cookName || 'Bucătar',
    cookId: cookId || null,
    notes: notes || null,
  };

  orderData.kitchenVerification = verificationRecord;
  orderData.updatedAt = new Date().toISOString();

  let statusChanged = false;
  if (status && ['pending', 'preparing', 'ready', 'delivered', 'completed'].includes(status)) {
    orderData.status = status;
    currentStatus = status;
    statusChanged = true;
  }

  // Update in DB
  await pool.query(
    `UPDATE orders SET status = $1, data = $2, updated_at = NOW() WHERE id = $3`,
    [currentStatus, JSON.stringify(orderData), dbId]
  );

  // Emit realtime updates
  if (io) {
    io.emit('kitchen_order_verified', {
      orderId: dbId,
      orderNumber: orderData.orderNumber,
      verification: verificationRecord,
      status: currentStatus,
    });

    if (statusChanged) {
      io.emit('order_status_updated', {
        orderId: dbId,
        status: currentStatus,
      });
    }
  }

  console.log(`[KitchenWebhook] 👨‍🍳 Verificare înregistrată pentru #${orderData.orderNumber} de către ${verificationRecord.cookName} (Status: ${currentStatus})`);

  return {
    found: true,
    success: true,
    orderId: dbId,
    orderNumber: orderData.orderNumber,
    status: currentStatus,
    verification: verificationRecord,
  };
}

/**
 * Returns recent deliveries
 */
function getRecentDeliveries() {
  return [...recentDeliveries];
}

module.exports = {
  getKitchenWebhookConfig,
  updateKitchenWebhookConfig,
  formatKitchenOrderPayload,
  sendKitchenOrderWebhook,
  verifyKitchenOrder,
  getRecentDeliveries,
};
