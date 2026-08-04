/**
 * Smart Kiosk — Orders API Route
 * POST /api/orders            — Create new order (kiosk or QR web)
 * GET  /api/orders            — List orders (KDS + admin)
 * GET  /api/orders/:id        — Get single order
 * PATCH /api/orders/:id/status — Update status (kitchen)
 */
const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const { createOrder: syrveCreateOrder } = require('../services/iikoService');
const { pool } = require('../db');
const { addPosLog } = require('./posLogs');

// ── POST /api/orders ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      locationId, brand, brandId, orgId, locationName,
      orderType, tableNumber, items,
      totalAmount, lang, channel, paymentMethod, paymentRef,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }

    const subtotal = totalAmount || items.reduce((s, i) => s + (i.totalPrice || 0), 0);
    
    // Get max orderNumber from Supabase
    let maxOrderNumber = 358;
    try {
      const { rows } = await pool.query(`SELECT data->>'orderNumber' as num FROM orders WHERE (data->>'orderNumber') IS NOT NULL`);
      for (const row of rows) {
        const num = parseInt(row.num, 10);
        // Exclude specific test numbers and ignore huge numbers from old DB data to keep the Kiosk sequence around 360
        if (!isNaN(num) && num !== 946 && num !== 862 && num < 1000) {
          maxOrderNumber = Math.max(maxOrderNumber, num);
        }
      }
    } catch (dbErr) {
      console.warn('[Orders] DB error getting max orderNumber:', dbErr.message);
    }
    
    const orderNumber = maxOrderNumber + 1;
    const locId       = locationId || 'loc1';
    const brandName   = brand || brandId || 'smashme';

    const orderId = `ORD-${Date.now()}`;
    const status = (paymentMethod || 'card') === 'cash' ? 'awaiting_payment' : 'pending';

    const order = {
      _id:         orderId,
      orderNumber,
      locationId:  locId,
      locationName: locationName || null,
      brand:       brandName,
      orgId:       orgId || null,
      orderType:   orderType || 'takeaway',
      tableNumber: tableNumber || null,
      items:       items || [],
      totalAmount: Math.round(subtotal * 100) / 100,
      lang:        lang || 'ro',
      channel:      channel || 'kiosk',
      paymentMethod: paymentMethod || 'card',
      paymentRef: paymentRef || null,
      status:      status,
      syrveOrderId: null,
      arrivedAt:   Date.now(),
      createdAt:   new Date().toISOString(),
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
      io.to(`pos-bridge-${locId}`).emit('print_ticket', { order });
    }

    console.log(`[Order] ════ COMANDĂ NOUĂ ════`);
    console.log(`[Order]   #${orderNumber} | ${brandName} | ${locationName || orgId || 'no-loc'}`);
    console.log(`[Order]   channel: ${channel} | orderType: ${orderType} | total: ${subtotal} RON`);
    console.log(`[Order]   paymentMethod: ${order.paymentMethod} | items: ${order.items.length}`);

    // Respond immediately to kiosk
    res.json({ success: true, order });

    // ── Send to Syrve async ──
    setImmediate(async () => {
      try {
        const locsPath = path.join(__dirname, '../../data/locations.json');
        let orgIdsDict = {};
        if (fs.existsSync(locsPath)) {
           try {
             const locs = JSON.parse(fs.readFileSync(locsPath, 'utf8'));
             const locData = locs.find(l => l.id === locId);
             if (locData?.orgIds) orgIdsDict = locData.orgIds;
           } catch(e) {}
        }

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
                orgId:   specificOrgId,
                order:   splitOrder,
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
  const { status, brand, startDate, endDate, limit = 50 } = req.query;
  try {
    let query = `SELECT data, status FROM orders WHERE 1=1`;
    const params = [];
    
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
  const valid = ['awaiting_payment','pending','confirmed','preparing','ready','delivered','completed','cancelled'];
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
          const locsPath = path.join(__dirname, '../../data/locations.json');
          let orgIdsDict = {};
          if (fs.existsSync(locsPath)) {
            try {
              const locs = JSON.parse(fs.readFileSync(locsPath, 'utf8'));
              const locData = locs.find(l => l.id === order.locationId);
              if (locData?.orgIds) orgIdsDict = locData.orgIds;
            } catch(e) {}
          }
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

module.exports = router;
