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

// ── POST /api/orders ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      locationId, brand, brandId, orgId, locationName,
      orderType, tableNumber, items,
      totalAmount, lang, channel, paymentMethod, paymentRef, kioskId,
      fiscal
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }

    const subtotal = totalAmount || items.reduce((s, i) => s + (i.totalPrice || 0), 0);

    // Get max orderNumber from Supabase
    let maxOrderNumber = 358;
    let clujMax = 0;
    let brasovMax = 0;
    try {
      const { rows } = await pool.query(`SELECT data->>'orderNumber' as num, location_id FROM orders WHERE (data->>'orderNumber') IS NOT NULL`);
      for (const row of rows) {
        const str = String(row.num || '');
        const city = detectCity(row.location_id);
        if (city === 'cluj' || str.startsWith('CJ')) {
          if (str.startsWith('CJ')) {
            const match = str.match(/^CJ[12]?-?(\d+)/i);
            if (match) {
              const rawNum = parseInt(match[1], 10);
              if (!isNaN(rawNum)) {
                // Support legacy 10000+ orders (e.g. 10021 -> 21) as well as 3-digit orders (022 -> 22)
                const seq = rawNum >= 10000 ? (rawNum - 10000) : rawNum;
                clujMax = Math.max(clujMax, seq);
              }
            }
          }
        } else if (city === 'brasov' || str.startsWith('BV')) {
          if (str.startsWith('BV')) {
            const bvNum = parseInt(str.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(bvNum)) brasovMax = Math.max(brasovMax, bvNum);
          } else {
            // Old numeric orders from brasov (or before prefix was added)
            const num = parseInt(str, 10);
            if (!isNaN(num) && num < 1000) {
              brasovMax = Math.max(brasovMax, num);
            }
          }
        } else {
          const num = parseInt(row.num, 10);
          // Exclude specific test numbers and ignore huge numbers from old DB data
          if (!isNaN(num) && num !== 946 && num !== 862 && num < 1000) {
            maxOrderNumber = Math.max(maxOrderNumber, num);
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

    let orderNumber;
    if (city === 'cluj') {
      let kioskNum = '1';
      const kioskIdStr = String(kioskId || '').toLowerCase();
      const locIdStr = String(locId || '').toLowerCase();
      if (kioskIdStr.includes('2') || locIdStr.includes('kiosk2') || locIdStr.includes('kiosk-2') || locIdStr === 'cluj2') {
        kioskNum = '2';
      } else if (kioskIdStr.includes('1') || locIdStr.includes('kiosk1') || locIdStr.includes('kiosk-1') || locIdStr === 'cluj1') {
        kioskNum = '1';
      }
      const nextSeq = clujMax + 1;
      const seqPadded = String(nextSeq).padStart(3, '0');
      orderNumber = `CJ${kioskNum}-${seqPadded}`;
    } else if (city === 'brasov') {
      // Continue from highest Brașov order (numeric 539-541 or previous BV-...)
      const bvContinue = Math.max(brasovMax, maxOrderNumber);
      orderNumber = `BV-${bvContinue + 1}`;
    } else {
      orderNumber = maxOrderNumber + 1;
    }

    const orderId = `ORD-${Date.now()}`;
    const status = (paymentMethod || 'card') === 'cash' ? 'awaiting_payment' : 'pending';

    const order = {
      _id: orderId,
      orderNumber,
      locationId: locId,
      locationName: resolvedLocationName,
      kioskId: kioskId || '1',
      brand: brandName,
      orgId: orgId || null,
      orderType: orderType || 'takeaway',
      tableNumber: tableNumber || null,
      items: items || [],
      totalAmount: Math.round(subtotal * 100) / 100,
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

    // Emit to Kitchen Display
    const io = req.app.get('io');
    if (io) {
      io.emit('new_order', order);
      io.to(`kitchen-${locId}`).emit('new_order', order);
      io.to('admin').emit('new_order', order);

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

    // Respond immediately to kiosk
    res.json({ success: true, order });

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

  } catch (err) {
    console.error('[Orders] POST error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/orders ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, brand, startDate, endDate, limit = 50, locationId } = req.query;
  try {
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
