const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { protect, requireApiKey } = require('../middleware/authMiddleware');

const LOCATIONS_FILE = path.join(__dirname, '../../data/locations.json');
const hasDb = !!process.env.DATABASE_URL;

function readLocFile() {
  try {
    const raw = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : (raw.locations || []);
  } catch { return []; }
}

function writeLocFile(locs) {
  try { fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locs, null, 2)); } catch(e) { console.error('[Locations JSON write]', e.message); }
}

// Force bypass browser caching for all location updates!
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ── Helpers ─────────────────────────────────────────────────
function rowToLoc(row) {
  return { id: row.id, active: row.active, ...row.data };
}

// GET /api/locations
router.get('/', requireApiKey, async (req, res) => {
  try {
    if (!hasDb) throw new Error('no db');
    const { rows } = await pool.query('SELECT * FROM locations ORDER BY created_at ASC');
    let locs = rows.map(rowToLoc);
    const { brandId } = req.query;
    if (brandId) locs = locs.filter(l => l.brands && l.brands.includes(brandId));
    return res.json({ locations: locs, total: locs.length });
  } catch (e) {
    // JSON file fallback
    let locs = readLocFile();
    const { brandId } = req.query;
    if (brandId) locs = locs.filter(l => l.brands && l.brands.includes(brandId));
    return res.json({ locations: locs, total: locs.length });
  }
});

// GET /api/locations/:id
router.get('/:id', requireApiKey, async (req, res) => {
  try {
    if (!hasDb) throw new Error('no db');
    const { rows } = await pool.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Location not found' });
    res.json(rowToLoc(rows[0]));
  } catch (e) {
    const locs = readLocFile();
    const loc = locs.find(l => l.id === req.params.id);
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    res.json(loc);
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

    const updatedLoc = rowToLoc(rows[0]);
    
    // Notify connected Kiosks about the config change
    const io = req.app.get('io');
    if (io) {
      io.to(`kiosk-${req.params.id}`).emit('location_updated', updatedLoc);
    }

    res.json(updatedLoc);
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

// POST /api/locations/:id/restart — remote restart all kiosks at location
router.post('/:id/restart', protect, async (req, res) => {
  try {
    const io = req.app.get('io');
    if (io) {
      const locId = req.params.id;
      // Emit to the specific room
      io.to(`kiosk-${locId}`).emit('remote_restart', { locationId: locId });
      // Also broadcast globally so Kiosks that haven't joined the room yet
      // (e.g. still on Welcome screen when location loaded late) also get it.
      io.emit(`remote_restart_${locId}`, { locationId: locId });
      console.log(`[Locations RESTART] Sent restart signal to kiosk-${locId}`);
      res.json({ ok: true, message: 'Restart signal sent' });
    } else {
      res.status(500).json({ error: 'Socket.io not initialized on server' });
    }
  } catch (e) {
    console.error('[Locations RESTART]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
