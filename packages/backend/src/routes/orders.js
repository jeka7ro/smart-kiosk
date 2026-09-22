/**
 * Smart Kiosk — Orders API Route
 * POST /api/orders            — Create new order (kiosk or QR web)
 * GET  /api/orders            — List orders (KDS + admin)
 * GET  /api/orders/:id        — Get single order
 * PATCH /api/orders/:id/status — Update status (kitchen)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { createOrder: syrveCreateOrder } = require('../services/iikoService');
const { pool } = require('../db');
const { addPosLog } = require('./posLogs');

const { detectCity, getOrderPrefix, findLocation, getLocationAliases } = require('../utils/locations');

// Module-level fallback sequence memory (for offline / dev fallback)
let memoryClujMax = 93;

// ── Core order creation logic (callable via HTTP or directly on POS socket confirmation) ──
async function processOrderCreation(body, io) {
  const {
    locationId, brand, brandId, orgId, locationName,
    orderType, tableNumber, items,
    totalAmount, lang, channel, paymentMethod, paymentRef, kioskId,
    fiscal, posOrderId
  } = body;

  if (!items || items.length === 0) {
    return { status: 400, data: { error: 'No items in order' } };
  }

  // Idempotency check: if posOrderId was provided or paymentRef.orderId, check if order already created
  const checkPosId = posOrderId || paymentRef?.orderId;
  if (checkPosId) {
    try {
      const existing = await pool.query(
        `SELECT data FROM orders WHERE data->>'posOrderId' = $1 OR id = $1 LIMIT 1`,
        [checkPosId]
      );
      if (existing.rows.length > 0) {
        console.log(`[Order] ℹ️ Comanda cu posOrderId ${checkPosId} există deja: #${existing.rows[0].data?.orderNumber}`);
        return { status: 200, data: { success: true, order: existing.rows[0].data, duplicate: true } };
      }
    } catch (e) {
      console.warn('[Order] Idempotency check error:', e.message);
    }
  }

  const subtotal = totalAmount || items.reduce((s, i) => s + (i.totalPrice || 0), 0);

  // Helper: formatare secvențială: 001..999 cu padding de 3 cifre, iar de la 1000 continuă natural (1000, 1001, etc.)
  const formatOrderSeq = (num) => {
    const n = parseInt(num, 10);
    if (isNaN(n) || n <= 0) return '001';
    return n < 1000 ? String(n).padStart(3, '0') : String(n);
  };

  // Get max orderNumber from Postgres
  let maxOrderNumber = 358;
  let clujMax = 93;
  let brasovMax = 0;
  const maxByPrefix = {};
  const usedClujSeqs = new Set();

  try {
    // Auto-corectie comenzi
    await pool.query(`UPDATE orders SET data = jsonb_set(data, '{orderNumber}', '"CJ1-094"') WHERE data->>'orderNumber' = 'CJ1-544'`).catch(() => {});
    await pool.query(`UPDATE orders SET data = jsonb_set(data, '{orderNumber}', '"CT-001"') WHERE data->>'orderNumber' = 'CT-438'`).catch(() => {});
    await pool.query(`UPDATE orders SET data = jsonb_set(data, '{orderNumber}', '"CT-002"') WHERE data->>'orderNumber' = 'CT-439'`).catch(() => {});

    const { rows } = await pool.query(`SELECT data->>'orderNumber' as num, location_id FROM orders WHERE (data->>'orderNumber') IS NOT NULL`);
    for (const row of rows) {
      const str = String(row.num || '').trim();
      if (!str) continue;

      // Căutăm prefix cu format [LITERE][CIFRĂ]?-[NUMĂR] (ex: CJ1-093, CJ2-1002, BV-561, CT-045, OR-1002)
      const prefixMatch = str.match(/^([a-zA-Z]+)(\d*)-(\d+)$/);
      if (prefixMatch) {
        const letterPrefix = prefixMatch[1].toUpperCase(); // ex: 'CJ', 'BV', 'CT'
        const fullPrefix = `${letterPrefix}${prefixMatch[2]}`; // ex: 'CJ1', 'CJ2', 'BV'
        const seqNum = parseInt(prefixMatch[3], 10);

        if (!isNaN(seqNum) && seqNum < 1000000) {
          if (letterPrefix === 'CJ') {
            if (seqNum < 500) {
              usedClujSeqs.add(seqNum);
              clujMax = Math.max(clujMax, seqNum);
              maxByPrefix[fullPrefix] = Math.max(maxByPrefix[fullPrefix] || 0, seqNum);
              maxByPrefix[letterPrefix] = Math.max(maxByPrefix[letterPrefix] || 0, seqNum);
            }
          } else {
            maxByPrefix[fullPrefix] = Math.max(maxByPrefix[fullPrefix] || 0, seqNum);
            maxByPrefix[letterPrefix] = Math.max(maxByPrefix[letterPrefix] || 0, seqNum);
            if (letterPrefix === 'BV') {
              brasovMax = Math.max(brasovMax, seqNum);
            }
          }
        }
      } else {
        // Format numeric pur sau comenzi vechi - NU afectează Cluj!
        const numOnly = parseInt(str.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numOnly) && numOnly < 1000000 && numOnly !== 946 && numOnly !== 862) {
          const city = detectCity(row.location_id);
          if (city === 'brasov') {
            brasovMax = Math.max(brasovMax, numOnly);
          } else if (city !== 'cluj') {
            maxOrderNumber = Math.max(maxOrderNumber, numOnly);
          }
        }
      }
    }
  } catch (dbErr) {
    console.warn('[Orders] DB error getting max orderNumber:', dbErr.message);
  }

  const locId = locationId || 'loc1';
  const locRecord = findLocation(locId) || (locationName ? findLocation(locationName) : null);
  const resolvedLocationName = locationName || locRecord?.name || null;
  const brandName = brand || brandId || 'smashme';
  const city = detectCity(locId, resolvedLocationName);

  // Kiosk number detection (Kiosk 1, Kiosk 2, etc.)
  let kioskNum = '1';
  const kioskIdStr = String(kioskId || '').toLowerCase();
  const locIdStr = String(locId || '').toLowerCase();
  if (kioskIdStr.includes('2') || locIdStr.includes('kiosk2') || locIdStr.includes('kiosk-2') || locIdStr === 'cluj2') {
    kioskNum = '2';
  } else if (kioskIdStr.includes('3') || locIdStr.includes('kiosk3') || locIdStr.includes('kiosk-3')) {
    kioskNum = '3';
  } else if (kioskIdStr.includes('1') || locIdStr.includes('kiosk1') || locIdStr.includes('kiosk-1') || locIdStr === 'cluj1') {
    kioskNum = '1';
  }

  let orderNumber;
  if (city === 'cluj') {
    let nextSeq = clujMax + 1;
    while (usedClujSeqs.has(nextSeq)) {
      nextSeq++;
    }
    orderNumber = `CJ${kioskNum}-${formatOrderSeq(nextSeq)}`;
    memoryClujMax = Math.max(memoryClujMax, nextSeq);
  } else if (city === 'brasov') {
    const nextSeq = Math.max(brasovMax, maxOrderNumber) + 1;
    orderNumber = `BV-${formatOrderSeq(nextSeq)}`;
  } else {
    const prefix = getOrderPrefix(locId, resolvedLocationName);
    if (prefix) {
      const nextSeq = (maxByPrefix[prefix] !== undefined ? maxByPrefix[prefix] : 0) + 1;
      orderNumber = `${prefix}-${formatOrderSeq(nextSeq)}`;
    } else {
      const nextSeq = maxOrderNumber + 1;
      orderNumber = formatOrderSeq(nextSeq);
    }
  }

  const orderId = `ORD-${Date.now()}`;
  const status = (paymentMethod || 'card') === 'cash' ? 'awaiting_payment' : 'pending';

  let grossItemsTotal = 0;
  (items || []).forEach(it => {
    const q = Number(it.quantity) || 1;
    const bPrice = (it.basePrice !== null && it.basePrice !== undefined && !isNaN(Number(it.basePrice)) && Number(it.basePrice) > 0)
      ? Number(it.basePrice)
      : Number(it.unitPrice || 0);
    let line = bPrice * q;
    if (it.selectedModifiers && it.selectedModifiers.length > 0) {
      it.selectedModifiers.forEach(m => {
        if (m.modId !== 'custom_comment') {
          line += (Number(m.price) || 0) * (Number(m.amount) || 1) * q;
        }
      });
    }
    grossItemsTotal += line;
  });
  grossItemsTotal = Math.round(grossItemsTotal * 100) / 100;
  const discountAmount = Math.max(0, Math.round((grossItemsTotal - subtotal) * 100) / 100);

  const order = {
    _id: orderId,
    orderNumber,
    posOrderId: checkPosId || null,
    locationId: locId,
    locationName: resolvedLocationName,
    kioskId: kioskId || '1',
    brand: brandName,
    orgId: orgId || null,
    orderType: orderType || 'takeaway',
    tableNumber: tableNumber || null,
    items: items || [],
    totalAmount: Math.round(subtotal * 100) / 100,
    discountAmount: discountAmount,
    lang: lang || 'ro',
    channel: channel || 'kiosk',
    paymentMethod: paymentMethod || 'card',
    paymentRef: paymentRef || null,
    status: status,
    fiscal: fiscal || null,
    syrveOrderId: null,
    arrivedAt: Date.now(),
    createdAt: new Date().toISOString(),
  };

  // Store in Supabase
  try {
    await pool.query(
      `INSERT INTO orders (id, location_id, status, data) VALUES ($1, $2, $3, $4)`,
      [orderId, locId, status, JSON.stringify(order)]
    );
  } catch (dbErr) {
    console.error('[Orders] Could not save order to DB:', dbErr.message);
  }

  // Also update pos_logs if posOrderId is provided so order_id links directly
  if (checkPosId) {
    try {
      await pool.query(
        `UPDATE pos_logs SET order_id = $1 WHERE order_id = $2`,
        [orderId, checkPosId]
      ).catch(() => {});
    } catch (_) {}
  }

  // Emit to Kitchen Display & Admin (broadcast globally once)
  if (io) {
    io.emit('new_order', order);

    // Emit ticket to POS bridge: chained .to() ensures each connected socket receives the event only ONCE
    const bridgeAliases = getLocationAliases(locId);
    let bridgeTarget = io;
    for (const alias of bridgeAliases) {
      bridgeTarget = bridgeTarget.to(`pos-bridge-${alias}`);
    }
    if (locRecord?.kioskUrl && !bridgeAliases.includes(locRecord.kioskUrl)) {
      bridgeTarget = bridgeTarget.to(`pos-bridge-${locRecord.kioskUrl}`);
    }
    bridgeTarget.emit('print_ticket', { order });
  }

  console.log(`[Order] ════ COMANDĂ NOUĂ ════`);
  console.log(`[Order]   #${orderNumber} | ${brandName} | ${resolvedLocationName || orgId || 'no-loc'}`);
  console.log(`[Order]   channel: ${channel} | orderType: ${orderType} | total: ${subtotal} RON`);
  console.log(`[Order]   paymentMethod: ${order.paymentMethod} | items: ${order.items.length}`);

  // ── Send to Syrve async ──
  setImmediate(async () => {
    try {
      const locRecordSyrve = findLocation(locId);
      let orgIdsDict = locRecordSyrve?.orgIds || {};

      const brandsMap = {};
      for (const item of order.items) {
        const bId = item.brandId || brandName;
        if (!brandsMap[bId]) brandsMap[bId] = { items: [], totalAmount: 0 };
        brandsMap[bId].items.push(item);
        brandsMap[bId].totalAmount += (item.totalPrice || 0);
      }

      const syrveIds = [];
      for (const [bId, brandData] of Object.entries(brandsMap)) {
        const specificOrgId = orgIdsDict[bId] || orgId || null;
        const splitOrder = {
          ...order,
          brand: bId,
          orgId: specificOrgId,
          items: brandData.items,
          totalAmount: Math.round(brandData.totalAmount * 100) / 100
        };

        try {
          console.log(`[Syrve]   brand: ${bId} | orgId: ${specificOrgId}`);
          const syrveResult = await syrveCreateOrder({
            brandId: bId,
            orgId: specificOrgId,
            order: splitOrder,
          });

          if (syrveResult?.orderInfo?.id || syrveResult?.id) {
            const syrveId = syrveResult?.orderInfo?.id || syrveResult?.id;
            syrveIds.push(syrveId);
            console.log(`[Syrve] ✅ SUCCES — syrveId: ${syrveId}`);
          } else {
            console.log(`[Syrve] ⚠️  Răspuns fără ID: ${JSON.stringify(syrveResult)}`);
          }
        } catch (e) {
          console.error(`[Syrve] ❌ EROARE iiko brand ${bId}: ${e.message}`);
        }
      }

      if (syrveIds.length > 0) {
        order.syrveOrderId = syrveIds.join(',');

        // Update DB with syrveOrderId
        await pool.query(
          `UPDATE orders SET data = jsonb_set(data, '{syrveOrderId}', $1) WHERE id = $2`,
          [JSON.stringify(order.syrveOrderId), orderId]
        );

        if (io) {
          io.emit('order_syrve_confirmed', { orderId: order._id, syrveOrderId: order.syrveOrderId });
        }

        if (order.paymentMethod === 'card' && order.paymentRef?.authCode) {
          const { updateIikoStatusByAuthCode } = require('./posLogs');
          if (updateIikoStatusByAuthCode) {
            updateIikoStatusByAuthCode(order.paymentRef.authCode, true, order.syrveOrderId, null);
          }
        }
      } else {
        if (order.paymentMethod === 'card' && order.paymentRef?.authCode) {
          const { updateIikoStatusByAuthCode } = require('./posLogs');
          if (updateIikoStatusByAuthCode) {
            updateIikoStatusByAuthCode(order.paymentRef.authCode, false, null, "iiko Error");
          }
        }
      }
    } catch (err) {
      console.error(`[Syrve] Grouping logic failed for order #${orderNumber}:`, err.message);
    }
  });

  return { status: 200, data: { success: true, order } };
}

// ── POST /api/orders ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const result = await processOrderCreation(req.body, req.app.get('io'));
    return res.status(result.status || 200).json(result.data);
  } catch (err) {
    console.error('[Orders] POST error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/orders ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, brand, startDate, endDate, limit = 50, locationId } = req.query;
  try {
    await pool.query(`UPDATE orders SET data = jsonb_set(data, '{orderNumber}', '"CJ1-094"') WHERE data->>'orderNumber' = 'CJ1-544'`).catch(() => {});
    await pool.query(`UPDATE orders SET data = jsonb_set(data, '{orderNumber}', '"CT-001"') WHERE data->>'orderNumber' = 'CT-438'`).catch(() => {});
    await pool.query(`UPDATE orders SET data = jsonb_set(data, '{orderNumber}', '"CT-002"') WHERE data->>'orderNumber' = 'CT-439'`).catch(() => {});
    let query = `SELECT data, status FROM orders WHERE 1=1`;
    const params = [];

    if (locationId && locationId !== 'all') {
      query += ` AND (location_id = $${params.length + 1} OR data->>'locationId' = $${params.length + 1})`;
      params.push(locationId);
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      query += ` AND status = ANY($${params.length + 1})`;
      params.push(statuses);
    }

    if (brand && brand !== 'all') {
      query += ` AND data->>'brand' = $${params.length + 1}`;
      params.push(brand);
    }

    if (startDate) {
      query += ` AND data->>'createdAt' >= $${params.length + 1}`;
      params.push(new Date(startDate).toISOString());
    }

    if (endDate) {
      query += ` AND data->>'createdAt' <= $${params.length + 1}`;
      params.push(new Date(endDate).toISOString());
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

    const { rows } = await pool.query(query, params);
    const orders = rows.map(r => r.data);

    // Also get total count
    let countQuery = `SELECT COUNT(*) FROM orders WHERE 1=1`;
    const countParams = [];
    if (locationId && locationId !== 'all') {
      countQuery += ` AND (location_id = $${countParams.length + 1} OR data->>'locationId' = $${countParams.length + 1})`;
      countParams.push(locationId);
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      countQuery += ` AND status = ANY($${countParams.length + 1})`;
      countParams.push(statuses);
    }
    if (brand && brand !== 'all') {
      countQuery += ` AND data->>'brand' = $${countParams.length + 1}`;
      countParams.push(brand);
    }
    if (startDate) {
      countQuery += ` AND data->>'createdAt' >= $${countParams.length + 1}`;
      countParams.push(new Date(startDate).toISOString());
    }
    if (endDate) {
      countQuery += ` AND data->>'createdAt' <= $${countParams.length + 1}`;
      countParams.push(new Date(endDate).toISOString());
    }
    const countRes = await pool.query(countQuery, countParams);
    const total = parseInt(countRes.rows[0].count, 10);

    res.json({ orders, total });
  } catch (err) {
    console.error('[Orders] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── GET /api/orders/:id ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT data FROM orders WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0].data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});


// ── PATCH /api/orders/:id/status ───────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { status, canceledBy } = req.body;
  const valid = ['awaiting_payment', 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Valid: ${valid.join(', ')}` });
  }

  try {
    const { rows } = await pool.query(`SELECT data, status FROM orders WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = rows[0].data;
    const currentStatus = rows[0].status;

    if (currentStatus === 'cancelled' && status !== 'cancelled') {
      return res.status(400).json({ error: 'Comanda a fost anulată și nu poate fi modificată.' });
    }

    const wasCashWaiting = currentStatus === 'awaiting_payment' && order.paymentMethod === 'cash';

    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (status === 'cancelled' && canceledBy) {
      order.canceledBy = canceledBy;
    }
    await pool.query(
      `UPDATE orders SET status = $1, data = $2, updated_at = NOW() WHERE id = $3`,
      [status, JSON.stringify(order), req.params.id]
    );

    // Daca s-a anulat o comanda platita cu cardul (Refuz POS manual), adaugam un POS Log de retur
    if (status === 'cancelled' && order.paymentMethod === 'card') {
      const refundEntry = {
        locationId: order.locationId,
        locationName: order.locationName,
        orderId: order._id,
        amount: -(order.totalAmount || 0),
        paid: true, // we set paid: true so it counts as a successful refund
        status: 'refunded',
        authCode: order.paymentRef?.authCode || 'REFUND',
        refNum: order.paymentRef?.refNum || '',
        cardNo: order.paymentRef?.cardNo || '',
        raw: { note: 'Storno/Anulare manuală din Admin (Refuz POS)' }
      };
      await addPosLog(refundEntry).catch(e => console.error('[Orders] Failed to insert refund POS log:', e));
    }

    // Dacă casierul tocmai a confirmat plata cash → trimitem la iiko acum
    if (wasCashWaiting && (status === 'pending' || status === 'confirmed')) {
      console.log(`[Order] 💵 Casier a confirmat plata cash #${order.orderNumber} — trimit la iiko`);
      setImmediate(async () => {
        try {
          const locData = findLocation(order.locationId);
          const orgIdsDict = locData?.orgIds || {};
          const brandsMap = {};
          for (const item of order.items) {
            const bId = item.brandId || order.brand;
            if (!brandsMap[bId]) brandsMap[bId] = { items: [], totalAmount: 0 };
            brandsMap[bId].items.push(item);
            brandsMap[bId].totalAmount += (item.totalPrice || 0);
          }
          const syrveIds = [];
          for (const [bId, brandData] of Object.entries(brandsMap)) {
            const specificOrgId = orgIdsDict[bId] || order.orgId || null;
            const splitOrder = { ...order, brand: bId, orgId: specificOrgId, items: brandData.items, totalAmount: Math.round(brandData.totalAmount * 100) / 100 };
            try {
              const syrveResult = await syrveCreateOrder({ brandId: bId, orgId: specificOrgId, order: splitOrder });
              if (syrveResult?.orderInfo?.id || syrveResult?.id) syrveIds.push(syrveResult?.orderInfo?.id || syrveResult?.id);
            } catch (e) { console.error(`[Syrve] ❌ cash confirm error ${bId}:`, e.message); }
          }
          if (syrveIds.length > 0) {
            order.syrveOrderId = syrveIds.join(',');
            await pool.query(
              `UPDATE orders SET data = jsonb_set(data, '{syrveOrderId}', $1) WHERE id = $2`,
              [JSON.stringify(order.syrveOrderId), req.params.id]
            );
          }
        } catch (err) { console.error(`[Syrve] Cash confirm failed #${order.orderNumber}:`, err.message); }
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('order_status_updated', { orderId: req.params.id, status });
    }
    res.json({ success: true, id: req.params.id, status });

  } catch (err) {
    console.error('[Orders] PATCH status error:', err.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ── POST /api/orders/:id/retry — Retry failed Syrve submission ──────
router.post('/:id/retry', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT data, location_id FROM orders WHERE data->>'_id' = $1 OR data->>'orderNumber' = $1 OR id::text = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = rows[0].data;
    const locationId = rows[0].location_id || order.locationId;

    console.log(`[Syrve-Retry] Retrying order #${order.orderNumber || order._id}...`);

    // Determine orgId from order data or location
    const loc = findLocation(locationId);
    const orgId = order.orgId || loc?.orgId;
    const brandId = order.brand || order.brandId || 'smashme';

    if (!orgId) {
      return res.status(400).json({ error: 'Cannot determine orgId for this order' });
    }

    const syrveResult = await syrveCreateOrder({
      brandId,
      orgId,
      order,
    });

    if (syrveResult?.orderInfo?.id || syrveResult?.id) {
      const syrveId = syrveResult?.orderInfo?.id || syrveResult?.id;
      order.syrveOrderId = syrveId;

      await pool.query(
        `UPDATE orders SET data = jsonb_set(data, '{syrveOrderId}', $1), status = 'confirmed' WHERE data->>'_id' = $2 OR data->>'orderNumber' = $2`,
        [JSON.stringify(syrveId), req.params.id]
      );

      console.log(`[Syrve-Retry] ✅ SUCCES — syrveId: ${syrveId}`);
      return res.json({ success: true, syrveOrderId: syrveId });
    } else {
      console.log(`[Syrve-Retry] ⚠️ Răspuns fără ID:`, JSON.stringify(syrveResult));
      return res.status(502).json({ error: 'Syrve returned no order ID', response: syrveResult });
    }
  } catch (err) {
    console.error(`[Syrve-Retry] ❌ EROARE:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.processOrderCreation = processOrderCreation;
