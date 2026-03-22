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

// ── Persistent JSON store ──────────────────────────────────────
const STORE_FILE = path.join(__dirname, '../../data/orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) { console.warn('[Orders] Could not load orders.json:', e.message); }
  return [];
}

function saveOrders() {
  try {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(_orders, null, 2));
  } catch (e) { console.warn('[Orders] Could not save orders.json:', e.message); }
}

// In-memory store, seeded from disk
const _orders = loadOrders();
console.log(`[Orders] Loaded ${_orders.length} orders from disk`);

// ── POST /api/orders ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      locationId, brand, brandId, orgId, locationName,
      orderType, tableNumber, items,
      totalAmount, lang, channel, paymentMethod,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }

    const subtotal    = totalAmount || items.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const orderNumber = Math.floor(100 + Math.random() * 900);
    const locId       = locationId || 'loc1';
    const brandName   = brand || brandId || 'smashme';

    const order = {
      _id:         `ORD-${Date.now()}`,
      orderNumber,
      locationId:  locId,
      locationName: locationName || null,
      brand:       brandName,
      orgId:       orgId || null,        // Syrve org ID for this specific restaurant
      orderType:   orderType || 'takeaway',
      tableNumber: tableNumber || null,
      items:       items || [],
      totalAmount: Math.round(subtotal * 100) / 100,
      lang:        lang || 'ro',
      channel:     channel || 'kiosk',
      paymentMethod: paymentMethod || 'card',
      status:      'pending',
      syrveOrderId: null,
      arrivedAt:   Date.now(),
      createdAt:   new Date().toISOString(),
    };

    // Store in memory + persist to disk
    _orders.unshift(order);
    if (_orders.length > 500) _orders.splice(500);
    saveOrders();

    // Emit to Kitchen Display — both global and location-specific rooms
    const io = req.app.get('io');
    if (io) {
      io.emit('new_order', order);
      io.to(`kitchen-${locId}`).emit('new_order', order);
      io.to('admin').emit('new_order', order);
    }

    console.log(`[Order] #${orderNumber} ${brandName} (${locationName || orgId || 'no-loc'}) — ${channel} — ${orderType} — ${subtotal} RON`);

    // Respond immediately to kiosk (don't block on Syrve)
    res.json({ success: true, order });

    // ── Send to Syrve async (fire-and-forget, Split by Brand) ──
    setImmediate(async () => {
      try {
        // Read locations to find orgIds dictionary
        const locsPath = path.join(__dirname, '../../data/locations.json');
        let orgIdsDict = {};
        if (fs.existsSync(locsPath)) {
           try {
             const locs = JSON.parse(fs.readFileSync(locsPath, 'utf8'));
             const locData = locs.find(l => l.id === locId);
             if (locData?.orgIds) orgIdsDict = locData.orgIds;
           } catch(e) {}
        }

        // Group order items by their actual brandId
        const brandsMap = {};
        for (const item of order.items) {
           const bId = item.brandId || brandName;
           if (!brandsMap[bId]) brandsMap[bId] = { items: [], totalAmount: 0 };
           brandsMap[bId].items.push(item);
           brandsMap[bId].totalAmount += (item.totalPrice || 0);
        }
        
        const syrveIds = [];
        
        // Fire Syrve order creation for EACH brand separately
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
             console.log(`[Syrve] Pushing sub-order for brand: ${bId} / orgId: ${specificOrgId}`);
             const syrveResult = await syrveCreateOrder({
               brandId: bId,
               orgId:   specificOrgId,
               order:   splitOrder,
             });
             
             if (syrveResult?.orderInfo?.id || syrveResult?.id) {
               syrveIds.push(syrveResult?.orderInfo?.id || syrveResult?.id);
             }
           } catch (e) {
             console.error(`[Syrve] Failed to push sub-order for brand ${bId}:`, e.message);
           }
        }
        
        // Link Syracuse IDs back to main order for tracking
        if (syrveIds.length > 0) {
          order.syrveOrderId = syrveIds.join(',');
          saveOrders(); // Save the fact that it is now synced
          if (io) {
            io.emit('order_syrve_confirmed', { orderId: order._id, syrveOrderId: order.syrveOrderId });
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
  const { status, brand, limit = 50 } = req.query;
  let result = [..._orders];
  if (status) {
    const statuses = status.split(',').map(s => s.trim());
    result = result.filter(o => statuses.includes(o.status));
  }
  if (brand && brand !== 'all') {
    result = result.filter(o => o.brand === brand);
  }
  res.json({ orders: result.slice(0, Number(limit)), total: result.length });
});

// ── GET /api/orders/:id ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const order = _orders.find(o => o._id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});


// ── PATCH /api/orders/:id/status ───────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['pending','confirmed','preparing','ready','delivered','completed'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Valid: ${valid.join(', ')}` });
  }
  const order = _orders.find(o => o._id === req.params.id);
  if (order) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
    saveOrders();
  }

  const io = req.app.get('io');
  if (io) {
    io.emit('order_status_updated', { orderId: req.params.id, status });
  }
  res.json({ success: true, id: req.params.id, status });
});

module.exports = router;
