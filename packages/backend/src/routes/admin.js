const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { protect } = require('../middleware/authMiddleware');

// Admin routes — require JWT auth in production
// GET /api/admin/dashboard
router.get('/dashboard', protect, async (req, res) => {
  res.json({
    ordersToday: 0,
    revenueToday: 0,
    activeLocations: 2,
    pendingOrders: 0,
  });
});

// GET /api/admin/orders?date=&locationId=&status=
router.get('/orders', protect, async (req, res) => {
  res.json({ orders: [], total: 0 });
});

// ─── POSTER / SCREENSAVER CONFIG (Supabase) ────────────────────────────────

// GET /api/admin/kiosk-config — get all poster configs
router.get('/kiosk-config', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT brand_id, data FROM kiosk_configs');
    const posters = {};
    rows.forEach(row => { posters[row.brand_id] = row.data; });
    res.json({ posters });
  } catch (e) {
    console.error('[Admin] kiosk-config GET:', e.message);
    res.json({ posters: {} }); // graceful fallback
  }
});

// GET /api/admin/kiosk-config/:brandId — get poster for a specific brand
router.get('/kiosk-config/:brandId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT data FROM kiosk_configs WHERE brand_id = $1',
      [req.params.brandId]
    );
    res.json({ poster: rows[0]?.data || null });
  } catch (e) {
    res.json({ poster: null });
  }
});

// POST /api/admin/kiosk-config/:brandId — set poster for a brand
router.post('/kiosk-config/:brandId', protect, async (req, res) => {
  try {
    const { brandId } = req.params;
    const { url, type, enabled } = req.body;

    const data = {
      url: url || '',
      type: type || 'image',
      enabled: enabled !== false,
      updatedAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO kiosk_configs (brand_id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (brand_id) DO UPDATE SET data = $2, updated_at = NOW()`,
      [brandId, JSON.stringify(data)]
    );

    // Notify kiosks via Socket.IO if available
    const io = req.app.get('io');
    if (io) io.emit('poster_updated', { brandId, poster: data });

    res.json({ ok: true, poster: data });
  } catch (e) {
    console.error('[Admin] kiosk-config POST:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/kiosk-config/:brandId/location — save full location-level config
// (screensaver, topBanner, bottomBanner, cornerRadius, etc.)
router.post('/kiosk-config/:brandId/location', protect, async (req, res) => {
  try {
    const { brandId } = req.params;
    const { locationId, ...configData } = req.body;

    const key = locationId ? `${brandId}__${locationId}` : brandId;

    const data = {
      ...configData,
      brandId,
      locationId: locationId || null,
      updatedAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO kiosk_configs (brand_id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (brand_id) DO UPDATE SET data = $2, updated_at = NOW()`,
      [key, JSON.stringify(data)]
    );

    const io = req.app.get('io');
    if (io) io.emit('kiosk_config_updated', { brandId, locationId, config: data });

    res.json({ ok: true, config: data });
  } catch (e) {
    console.error('[Admin] kiosk-config location POST:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/kiosk-config/:brandId — remove poster for a brand
router.delete('/kiosk-config/:brandId', protect, async (req, res) => {
  try {
    await pool.query('DELETE FROM kiosk_configs WHERE brand_id = $1', [req.params.brandId]);

    const io = req.app.get('io');
    if (io) io.emit('poster_updated', { brandId: req.params.brandId, poster: null });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
