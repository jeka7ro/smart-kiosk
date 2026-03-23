const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { protect, requireApiKey } = require('../middleware/authMiddleware');

// Force bypass browser caching for all location updates!
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ── Helpers ─────────────────────────────────────────────────
// Flatten a DB row (id + data JSONB) back to the flat object the frontend expects
function rowToLoc(row) {
  return { id: row.id, active: row.active, ...row.data };
}

// GET /api/locations — all locations (optionally filter by brand)
router.get('/', requireApiKey, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM locations ORDER BY created_at ASC');
    let locs = rows.map(rowToLoc);
    const { brandId } = req.query;
    if (brandId) locs = locs.filter(l => l.brands && l.brands.includes(brandId));
    res.json({ locations: locs, total: locs.length });
  } catch (e) {
    console.error('[Locations GET /]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/locations/:id
router.get('/:id', requireApiKey, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Location not found' });
    res.json(rowToLoc(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/locations — create new location
router.post('/', protect, async (req, res) => {
  try {
    const { name, brands, orgIds, tables, kiosks } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

    const data = {
      name,
      brands: brands || [],
      isMultiBrand: Array.isArray(brands) && brands.length > 1,
      orgIds: orgIds || {},
      kiosks: kiosks || [],
      tables: tables || 0,
      kioskUrl: req.body.kioskUrl || '',
      screensaverUrl: req.body.screensaverUrl || '',
      showLogoOnScreensaver: req.body.showLogoOnScreensaver !== undefined ? req.body.showLogoOnScreensaver : true,
      topBanner: req.body.topBanner || null,
      bottomBanner: req.body.bottomBanner || null,
    };

    const { rows } = await pool.query(
      `INSERT INTO locations (id, name, data, active) VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [id, name, JSON.stringify(data)]
    );

    res.status(201).json(rowToLoc(rows[0]));
  } catch (e) {
    console.error('[Locations POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/locations/:id — update location
router.put('/:id', protect, async (req, res) => {
  try {
    // Merge existing data with new data
    const existing = await pool.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Location not found' });

    const current = existing.rows[0];
    const { active, ...bodyRest } = req.body; // separate active from data fields

    const merged = { ...current.data, ...bodyRest };
    const newActive = active !== undefined ? active : current.active;

    const { rows } = await pool.query(
      `UPDATE locations SET data = $1, active = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(merged), newActive, req.params.id]
    );

    res.json(rowToLoc(rows[0]));
  } catch (e) {
    console.error('[Locations PUT]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/locations/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM locations WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Location not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/locations/:id/kiosks — add kiosk to location
router.post('/:id/kiosks', protect, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Location not found' });

    const { kioskId, name } = req.body;
    if (!kioskId) return res.status(400).json({ error: 'kioskId is required' });

    const data = rows[0].data;
    if (!data.kiosks) data.kiosks = [];
    if (!data.kiosks.find(k => k.kioskId === kioskId)) {
      data.kiosks.push({ kioskId, name: name || kioskId, addedAt: new Date().toISOString() });
    }

    const updated = await pool.query(
      `UPDATE locations SET data = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(data), req.params.id]
    );

    res.status(201).json(rowToLoc(updated.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/locations/:id/kiosks/:kioskId — remove kiosk from location
router.delete('/:id/kiosks/:kioskId', protect, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Location not found' });

    const data = rows[0].data;
    data.kiosks = (data.kiosks || []).filter(k => k.kioskId !== req.params.kioskId);

    const updated = await pool.query(
      `UPDATE locations SET data = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(data), req.params.id]
    );

    res.json(rowToLoc(updated.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
