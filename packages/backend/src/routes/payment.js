const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { requireApiKey } = require('../middleware/authMiddleware');

// In-memory cache for fast lookup during the payment cycle
const pendingOrdersMap = new Map();

// Periodic cleanup of stale pending orders (> 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingOrdersMap.entries()) {
    if (now - (val.timestamp || 0) > 7200000) {
      pendingOrdersMap.delete(key);
    }
  }
}, 300000);

// ── Viva Wallet helpers ───────────────────────────────────────────────────────
async function vivaGetAccessToken() {
  const clientId     = process.env.VIVA_CLIENT_ID     || process.env.VIVA_MERCHANT_ID;
  const clientSecret = process.env.VIVA_CLIENT_SECRET || process.env.VIVA_API_KEY;
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const resp = await fetch('https://accounts.vivapayments.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body,
  });
  if (!resp.ok) throw new Error(`Viva auth failed: ${resp.status}`);
  const data = await resp.json();
  return data.access_token;
}

async function vivaCreateOrder(amount, accessToken) {
  const amountCents = Math.round(amount * 100);
  const resp = await fetch('https://api.vivapayments.com/checkout/v2/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      amount: amountCents,
      customerTrns: 'Comanda Kiosk',
      paymentTimeout: 300,
    }),
  });
  if (!resp.ok) throw new Error(`Viva order failed: ${resp.status}`);
  return await resp.json(); // { orderCode: "...", ... }
}

// POST /api/payment/initiate
router.post('/initiate', async (req, res) => {
  const { orderId, amount, channel, paymentGateway, orderPayload } = req.body;
  const io = req.app.get('io');

  console.log(`\n[Payment] ════ INIȚIERE PLATĂ ════`);
  console.log(`[Payment]   orderId:    ${orderId}`);
  console.log(`[Payment]   amount:     ${amount} RON`);
  console.log(`[Payment]   gateway:    ${paymentGateway}`);
  console.log(`[Payment]   locationId: ${req.body.locationId || 'nedefinit'}`);
  console.log(`[Payment]   channel:    ${channel || 'kiosk'}`);
  console.log(`[Payment]   hasPayload: ${!!orderPayload} (items: ${orderPayload?.items?.length || 0})`);

  // Pre-salvează coșul de produse astfel încât dacă plata este aprobată pe POS,
  // backend-ul poate finaliza comanda automat chiar dacă tableta se deconectează!
  if (orderId && orderPayload) {
    pendingOrdersMap.set(orderId, {
      locationId: req.body.locationId || '',
      payload: orderPayload,
      timestamp: Date.now(),
    });
    pool.query(
      `INSERT INTO pending_pos_orders (order_id, location_id, payload) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (order_id) DO UPDATE SET payload = EXCLUDED.payload, location_id = EXCLUDED.location_id, created_at = NOW()`,
      [orderId, req.body.locationId || '', JSON.stringify(orderPayload)]
    ).catch(err => console.warn('[Payment] Could not persist pending order to DB:', err.message));
  }

  const gatewayToUse = paymentGateway || process.env.DEFAULT_PAYMENT_GATEWAY || 'none';

  // ── VeriFone V200t Serial (Printec ECR v3.9.3) ──────────────────────────
  if (gatewayToUse === 'verifone_serial') {
    try {
      const serialPort = process.env.VERIFONE_SERIAL_PORT || '/dev/cu.usbserial-FTF2NAV8';
      const baudRate   = parseInt(process.env.VERIFONE_BAUD_RATE || '9600');
      const VerifoneSerialService = require('../services/verifoneSerialService');
      const vfSerial = new VerifoneSerialService(serialPort, baudRate);

      vfSerial.processPayment(amount, {
        onStatus: (msg) => { if (io) io.emit(`payment_status_${orderId}`, { message: msg }); },
      })
        .then(result => {
          console.log(`[Payment] VeriFone result: success=${result.success}`);
          if (io) io.emit(`payment_confirmed_${orderId}`, {
            paid:         result.success,
            responseCode: result.code,
            authCode:     result.authCode,
            refNum:       result.refNum,
            receiptNo:    result.receiptNo,
            cardNo:       result.cardNo,
            txDate:       result.txDate,
            error:        result.success ? undefined : (result.errorMsg || 'Plată refuzată'),
          });
        })
        .catch(err => {
          console.error('[Payment] VeriFone Error:', err.message);
          if (io) io.emit(`payment_confirmed_${orderId}`, { paid: false, error: err.message });
        });

      return res.json({
        success: true, orderId, amount, channel: channel || 'kiosk',
        status: 'initiated', paymentGateway: 'verifone_serial',
        message: 'Terminal POS activat — aşteptaţi cardul',
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ── Raiffeisen ECR & Viva POS — prin POS Bridge (socket) ───────────────────────────
  else if (['raiffeisen', 'viva_pos'].includes(gatewayToUse)) {
    try {
      const io = req.app.get('io');
      if (!io) {
        console.log(`[Payment] ❌ Socket.IO indisponibil!`);
        return res.status(500).json({ success: false, error: 'Socket.IO indisponibil' });
      }

      console.log(`[Payment] 📡 Trimit pos_payment_request (${gatewayToUse}) la POS Bridge...`);
      // Trimite cererea de plată spre POS Bridge-ul din locație
      io.emit('pos_payment_request', {
        orderId,
        amount,
        locationId: req.body.locationId || '',
        paymentGateway: gatewayToUse,
      });
      console.log(`[Payment] ✅ Cerere emise via socket — aştept răspuns de la Bridge`);

      // Timeout 3 minute — dacă Bridge-ul nu răspunde
      setTimeout(() => {
        io.emit(`payment_confirmed_${orderId}`, { paid: false, error: 'Timeout POS Bridge (3min)' });
      }, 180000);

      return res.json({
        success: true, orderId, amount, channel: channel || 'kiosk',
        status: 'initiated', paymentGateway: gatewayToUse,
        message: 'Cerere trimisă la POS Bridge — aşteptaţi cardul',
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ── Fallback / unknown gateway ───────────────────────────────────────────
  else {
    // Emit confirmation via socket so kiosk doesn't hang waiting
    const io = req.app.get('io');
    const { orderId } = req.body;
    if (io && orderId) {
      // Small delay to allow kiosk to register the socket listener first
      setTimeout(() => {
        io.emit(`payment_confirmed_${orderId}`, {
          paid: true,
          responseCode: '0000',
          authCode: 'SIMULATED',
          paymentMethod: 'simulated',
        });
      }, 800);
    }
    return res.json({
      success: true, orderId, amount, channel: channel || 'kiosk',
      status: 'initiated', message: 'Payment terminal activated',
    });
  }
});

// POST /api/payment/webhook — Viva sends this when payment completes
router.post('/webhook', async (req, res) => {
  const { EventTypeId, EventData } = req.body;
  console.log('[Webhook] Viva event:', EventTypeId, EventData?.TransactionId);
  if (EventTypeId === 1796) {
    const { OrderRef, StatusId } = EventData || {};
    if (StatusId === 'F') {
      const io = req.app.get('io');
      if (io) io.emit(`payment_confirmed_${OrderRef}`, { paid: true });
    }
  }
  res.status(200).send('OK');
});

// GET /api/payment/status/:orderId
router.get('/status/:orderId', async (req, res) => {
  res.json({ orderId: req.params.orderId, status: 'pending' });
});

// POST /api/payment/qr-link  — genereaza link Viva Wallet + QR
router.post('/qr-link', async (req, res) => {
  const { orderId, amount } = req.body;
  const io = req.app.get('io');

  try {
    const token = await vivaGetAccessToken();

    if (!token) {
      // Demo mode — no Viva credentials configured
      const demoUrl = `https://demo.vivapayments.com/web/checkout?ref=DEMO_${orderId}`;
      return res.json({
        success:    true,
        demo:       true,
        paymentUrl: demoUrl,
        orderId,
        message:    'Demo mode — configurati VIVA_CLIENT_ID si VIVA_CLIENT_SECRET in .env',
      });
    }

    const order     = await vivaCreateOrder(amount, token);
    const orderCode = order.orderCode;
    const paymentUrl = `https://www.vivapayments.com/web/checkout?ref=${orderCode}`;

    // Poll Viva for confirmation every 4s (max 5 min)
    let polls = 0;
    const interval = setInterval(async () => {
      polls++;
      if (polls > 75) { clearInterval(interval); return; }
      try {
        const t2   = await vivaGetAccessToken();
        const chk  = await fetch(`https://api.vivapayments.com/checkout/v2/orders/${orderCode}`, {
          headers: { Authorization: `Bearer ${t2}` },
        });
        const data = await chk.json();
        if (data.stateId === 'F') { // F = captured/paid
          clearInterval(interval);
          if (io) io.emit(`payment_confirmed_${orderId}`, { paid: true, paymentMethod: 'qr' });
        }
      } catch (_) {}
    }, 4000);

    return res.json({ success: true, paymentUrl, orderCode, orderId });

  } catch (err) {
    console.error('[QR Payment]', err.message);
    return res.status(500).json({ success: false, error: 'Eroare la generarea link-ului de plata' });
  }
});

// POST /api/payment/cancel — solicitare anulare plată pe POS
router.post('/cancel', (req, res) => {
  const { orderId, locationId } = req.body || {};
  const io = req.app.get('io');
  console.log(`[Payment] 🛑 Cerere HTTP anulare plată POS: order=${orderId || '?'}, loc=${locationId || '?'}`);
  if (io) {
    io.emit('cancel_pos_payment', { orderId, locationId });
  }
  return res.json({ success: true, message: 'Cerere de anulare trimisă la POS' });
});

// POST /api/payment/pos-settlement — declanșează Închiderea de Zi pe POS Bridge
router.post('/pos-settlement', async (req, res) => {
  const { locationId } = req.body || {};
  const { triggerPosSettlement } = require('../services/socketService');
  const ok = triggerPosSettlement(locationId);
  if (!ok) {
    return res.status(500).json({ success: false, error: 'Socket.IO neinițializat' });
  }
  return res.json({ 
    success: true, 
    message: `Cerere de Închidere de Zi (Settlement) trimisă către POS Bridge (${locationId || 'toate locațiile'})` 
  });
});

async function getPendingPosOrder(orderId) {
  if (!orderId) return null;
  const inMem = pendingOrdersMap.get(orderId);
  if (inMem?.payload) return inMem.payload;
  try {
    const res = await pool.query(`SELECT payload FROM pending_pos_orders WHERE order_id = $1`, [orderId]);
    if (res.rows.length > 0) return res.rows[0].payload;
  } catch (err) {
    console.warn('[Payment] Error fetching pending order from DB:', err.message);
  }
  return null;
}

async function removePendingPosOrder(orderId) {
  if (!orderId) return;
  pendingOrdersMap.delete(orderId);
  try {
    await pool.query(`DELETE FROM pending_pos_orders WHERE order_id = $1`, [orderId]);
  } catch (_) {}
}

// ── GET /api/payment/pending-orders ──────────────────────────────
router.get('/pending-orders', requireApiKey, async (req, res) => {
  try {
    const list = [];
    const seenIds = new Set();

    // 1. Pending POS orders (pre-saved cart before/during POS card transaction)
    try {
      const { rows: posRows } = await pool.query(`
        SELECT 
          p.order_id, 
          p.location_id, 
          p.payload, 
          p.created_at,
          l.paid,
          l.status as pos_status,
          l.amount as pos_amount,
          l.auth_code,
          l.ref_num,
          l.receipt_no,
          l.card_no,
          l.tx_date,
          l.error as pos_error,
          l.iiko_sent,
          l.iiko_order_id,
          l.iiko_error
        FROM pending_pos_orders p
        LEFT JOIN pos_logs l ON l.order_id = p.order_id
        ORDER BY p.created_at DESC
        LIMIT 100
      `);

      for (const r of posRows) {
        seenIds.add(r.order_id);
        list.push({
          order_id: r.order_id,
          orderNumber: r.payload?.orderNumber || null,
          location_id: r.location_id,
          payload: r.payload,
          created_at: r.created_at,
          paid: !!r.paid,
          pos_status: r.pos_status || (r.paid ? 'approved' : 'waiting'),
          pos_amount: r.pos_amount || r.payload?.totalAmount,
          auth_code: r.auth_code,
          ref_num: r.ref_num,
          receipt_no: r.receipt_no,
          card_no: r.card_no,
          tx_date: r.tx_date,
          error: r.pos_error,
          iiko_sent: !!r.iiko_sent,
          iiko_order_id: r.iiko_order_id,
          kind: r.paid ? 'pos_paid_pending_iiko' : 'pos_in_progress',
        });
      }
    } catch (e) {
      console.warn('[Payment] Error fetching pending_pos_orders table:', e.message);
    }

    // In-memory fallback if any
    for (const [orderId, val] of pendingOrdersMap.entries()) {
      if (!seenIds.has(orderId)) {
        seenIds.add(orderId);
        list.push({
          order_id: orderId,
          orderNumber: val.payload?.orderNumber || null,
          location_id: val.locationId,
          payload: val.payload,
          created_at: new Date(val.timestamp).toISOString(),
          paid: false,
          pos_status: 'waiting',
          pos_amount: val.payload?.totalAmount,
          kind: 'pos_in_progress',
        });
      }
    }

    // 2. Orders awaiting cash payment or pending iiko in `orders` table (last 48 hours)
    try {
      const { rows: orderRows } = await pool.query(`
        SELECT 
          id, 
          location_id, 
          data, 
          created_at
        FROM orders
        WHERE (
          data->>'status' = 'awaiting_payment'
          OR (
            (data->>'paymentMethod' = 'cash' OR data->>'paymentMethod' = 'card')
            AND (data->>'syrveOrderId') IS NULL
            AND status != 'cancelled'
            AND (data->>'status') != 'cancelled'
          )
        )
        AND created_at > NOW() - INTERVAL '48 hours'
        ORDER BY created_at DESC
        LIMIT 100
      `);

      for (const row of orderRows) {
        const orderData = row.data || {};
        const oId = orderData._id || row.id;
        if (seenIds.has(oId)) continue;
        seenIds.add(oId);

        const isCashAwaiting = orderData.status === 'awaiting_payment' || orderData.paymentMethod === 'cash';
        list.push({
          order_id: oId,
          orderNumber: orderData.orderNumber || null,
          location_id: row.location_id,
          payload: orderData,
          created_at: row.created_at,
          paid: orderData.paymentMethod === 'card',
          pos_status: orderData.paymentMethod === 'card' ? 'approved' : 'cash_pending',
          pos_amount: orderData.totalAmount,
          auth_code: orderData.paymentRef?.authCode || null,
          ref_num: orderData.paymentRef?.refNum || null,
          card_no: orderData.paymentRef?.cardNo || null,
          iiko_sent: !!orderData.syrveOrderId,
          iiko_order_id: orderData.syrveOrderId || null,
          kind: isCashAwaiting ? 'cash_awaiting' : 'iiko_pending',
        });
      }
    } catch (e) {
      console.warn('[Payment] Error fetching awaiting orders from orders table:', e.message);
    }

    // 3. Orphan POS logs with paid=true and not sent to iiko
    try {
      const { rows: orphanRows } = await pool.query(`
        SELECT 
          order_id, 
          location_id, 
          location_name,
          amount,
          auth_code,
          ref_num,
          receipt_no,
          card_no,
          tx_date,
          status,
          paid,
          timestamp as created_at
        FROM pos_logs
        WHERE paid = true
          AND (iiko_sent = false OR iiko_sent IS NULL OR iiko_order_id IS NULL)
          AND timestamp > NOW() - INTERVAL '48 hours'
        ORDER BY timestamp DESC
        LIMIT 50
      `);

      for (const r of orphanRows) {
        if (!r.order_id || seenIds.has(r.order_id)) continue;
        seenIds.add(r.order_id);

        list.push({
          order_id: r.order_id,
          orderNumber: null,
          location_id: r.location_id,
          payload: {
            brand: 'smashme',
            items: [],
            totalAmount: Number(r.amount) || 0,
            locationName: r.location_name,
          },
          created_at: r.created_at,
          paid: true,
          pos_status: r.status || 'approved',
          pos_amount: r.amount,
          auth_code: r.auth_code,
          ref_num: r.ref_num,
          receipt_no: r.receipt_no,
          card_no: r.card_no,
          tx_date: r.tx_date,
          iiko_sent: false,
          kind: 'pos_paid_pending_iiko',
        });
      }
    } catch (e) {
      console.warn('[Payment] Error fetching orphan pos_logs:', e.message);
    }

    // Sort by created_at DESC
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return res.json({ pendingOrders: list, total: list.length });
  } catch (err) {
    console.error('[Payment] Error in pending-orders endpoint:', err.message);
    return res.status(500).json({ error: err.message, pendingOrders: [], total: 0 });
  }
});

// ── POST /api/payment/pending-orders/:orderId/push-iiko ──────────
router.post('/pending-orders/:orderId/push-iiko', requireApiKey, async (req, res) => {
  const { orderId } = req.params;
  const io = req.app.get('io');
  const { createOrder: syrveCreateOrder } = require('../services/iikoService');
  const { findLocation } = require('../utils/locations');

  try {
    // A) Check if exists in pending_pos_orders
    const pendingPayload = await getPendingPosOrder(orderId);
    if (pendingPayload) {
      const { processOrderCreation } = require('./orders');
      let payRef = {};
      try {
        const pLog = await pool.query('SELECT * FROM pos_logs WHERE order_id = $1 LIMIT 1', [orderId]);
        if (pLog.rows.length > 0) {
          const r = pLog.rows[0];
          payRef = {
            orderId,
            authCode: r.auth_code,
            receiptNo: r.receipt_no,
            refNum: r.ref_num,
            cardNo: r.card_no,
            txDate: r.tx_date,
            extraFields: r.raw?.extraFields,
          };
        }
      } catch (_) {}

      const createResult = await processOrderCreation({
        ...pendingPayload,
        posOrderId: orderId,
        paymentMethod: 'card',
        paymentRef: Object.keys(payRef).length > 0 ? payRef : (pendingPayload.paymentRef || {}),
      }, io);

      if (createResult?.data?.order) {
        await removePendingPosOrder(orderId);
        return res.json({ success: true, order: createResult.data.order });
      }
    }

    // B) Check if exists in `orders` table (e.g. awaiting_payment cash or unsynced order)
    const orderRes = await pool.query(
      `SELECT id, location_id, data FROM orders WHERE data->>'_id' = $1 OR id = $1 OR data->>'orderNumber' = $1 LIMIT 1`,
      [orderId]
    );

    if (orderRes.rows.length > 0) {
      const orderRow = orderRes.rows[0];
      const order = orderRow.data;

      // Send to Syrve
      const locData = findLocation(order.locationId || orderRow.location_id);
      const orgIdsDict = locData?.orgIds || {};
      const brandsMap = {};
      for (const item of (order.items || [])) {
        const bId = item.brandId || order.brand || 'smashme';
        if (!brandsMap[bId]) brandsMap[bId] = { items: [], totalAmount: 0 };
        brandsMap[bId].items.push(item);
        brandsMap[bId].totalAmount += (item.totalPrice || 0);
      }

      const syrveIds = [];
      for (const [bId, brandData] of Object.entries(brandsMap)) {
        const specificOrgId = orgIdsDict[bId]
          || (bId === 'rollmaster' ? (orgIdsDict['sushimaster'] || orgIdsDict['welovesushi']) : null)
          || (bId === 'sushimaster' ? orgIdsDict['rollmaster'] : null)
          || (bId === 'smashme' ? orgIdsDict['crunch'] : null)
          || (bId === 'crunch' ? orgIdsDict['smashme'] : null)
          || order.orgId
          || (Object.values(orgIdsDict).length === 1 ? Object.values(orgIdsDict)[0] : null);

        const splitOrder = {
          ...order,
          brand: bId,
          orgId: specificOrgId,
          items: brandData.items,
          totalAmount: Math.round(brandData.totalAmount * 100) / 100,
        };

        try {
          const syrveResult = await syrveCreateOrder({ brandId: bId, orgId: specificOrgId, order: splitOrder });
          const sid = syrveResult?.orderInfo?.id || syrveResult?.id;
          if (sid) syrveIds.push(sid);
        } catch (e) {
          console.error(`[Payment] Syrve push error for brand ${bId}:`, e.message);
        }
      }

      const syrveIdStr = syrveIds.join(',') || 'MANUAL-CONFIRMED';
      order.syrveOrderId = syrveIdStr;
      order.status = 'confirmed';

      await pool.query(
        `UPDATE orders SET status = 'confirmed', data = jsonb_set(jsonb_set(data, '{syrveOrderId}', $1), '{status}', '"confirmed"') WHERE id = $2`,
        [JSON.stringify(syrveIdStr), orderRow.id]
      );

      if (io) {
        io.emit('order_status_updated', { orderId: orderRow.id, status: 'confirmed', syrveOrderId: syrveIdStr });
      }

      return res.json({ success: true, order });
    }

    return res.status(404).json({ error: 'Comanda nu a fost găsită în sistem' });
  } catch (err) {
    console.error('[Payment] Error pushing order to iiko:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/payment/pending-orders/:orderId ───────────────────
router.delete('/pending-orders/:orderId', requireApiKey, async (req, res) => {
  const { orderId } = req.params;
  try {
    await removePendingPosOrder(orderId);

    // Also cancel in orders if it exists as awaiting_payment
    await pool.query(
      `UPDATE orders SET status = 'cancelled', data = jsonb_set(data, '{status}', '"cancelled"') WHERE (data->>'_id' = $1 OR id = $1) AND data->>'status' = 'awaiting_payment'`,
      [orderId]
    ).catch(() => {});

    return res.json({ success: true, message: 'Comandă eliminată' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.getPendingPosOrder = getPendingPosOrder;
module.exports.removePendingPosOrder = removePendingPosOrder;
