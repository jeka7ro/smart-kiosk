const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// ─── Kiosk Config Persistence (JSON file) ─────────────────────────
const CONFIG_PATH = path.join(__dirname, '../../data/kiosk-config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) { console.warn('[Admin] Failed to load kiosk config:', e.message); }
  return { posters: {} };
}

function saveConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

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

// ─── POSTER / SCREENSAVER CONFIG ──────────────────────────────────

// GET /api/admin/kiosk-config — get all poster configs
router.get('/kiosk-config', (req, res) => {
  const config = loadConfig();
  res.json(config);
});

// GET /api/admin/kiosk-config/:brandId — get poster for a specific brand
router.get('/kiosk-config/:brandId', (req, res) => {
  const config = loadConfig();
  const poster = config.posters[req.params.brandId] || null;
  res.json({ poster });
});

// POST /api/admin/kiosk-config/:brandId — set poster for a brand
router.post('/kiosk-config/:brandId', protect, (req, res) => {
  const { brandId } = req.params;
  const { url, type, enabled } = req.body; // type: 'image' | 'video' | 'iframe'
  const config = loadConfig();

  config.posters[brandId] = {
    url: url || '',
    type: type || 'image',
    enabled: enabled !== false,
    updatedAt: new Date().toISOString(),
  };

  saveConfig(config);

  // Notify kiosks via Socket.IO if available
  const io = req.app.get('io');
  if (io) {
    io.emit('poster_updated', { brandId, poster: config.posters[brandId] });
  }

  res.json({ ok: true, poster: config.posters[brandId] });
});

// DELETE /api/admin/kiosk-config/:brandId — remove poster for a brand
router.delete('/kiosk-config/:brandId', protect, (req, res) => {
  const config = loadConfig();
  delete config.posters[req.params.brandId];
  saveConfig(config);

  const io = req.app.get('io');
  if (io) {
    io.emit('poster_updated', { brandId: req.params.brandId, poster: null });
  }

  res.json({ ok: true });
});

module.exports = router;
