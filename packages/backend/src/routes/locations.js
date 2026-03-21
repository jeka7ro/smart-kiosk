const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/locations.json');

// ── Helpers ─────────────────────────────────────────────────
function readLocations() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeLocations(locs) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(locs, null, 2), 'utf-8');
}

// GET /api/locations — all locations (optionally filter by brand)
router.get('/', (req, res) => {
  const locs = readLocations();
  const { brandId } = req.query;
  const result = brandId
    ? locs.filter(l => l.brands && l.brands.includes(brandId))
    : locs;
  res.json({ locations: result, total: result.length });
});

// GET /api/locations/:id
router.get('/:id', (req, res) => {
  const locs = readLocations();
  const loc = locs.find(l => l.id === req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });
  res.json(loc);
});

// POST /api/locations — create new location
router.post('/', (req, res) => {
  const locs = readLocations();
  const { name, brands, orgIds, tables, kiosks } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const newLoc = {
    id,
    name,
    brands: brands || [],
    orgIds: orgIds || {},
    kiosks: kiosks || [],
    tables: tables || 0,
    active: true,
  };
  locs.push(newLoc);
  writeLocations(locs);
  res.status(201).json(newLoc);
});

// PUT /api/locations/:id — update location
router.put('/:id', (req, res) => {
  const locs = readLocations();
  const idx = locs.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Location not found' });

  locs[idx] = { ...locs[idx], ...req.body, id: locs[idx].id };
  writeLocations(locs);
  res.json(locs[idx]);
});

// DELETE /api/locations/:id
router.delete('/:id', (req, res) => {
  let locs = readLocations();
  const before = locs.length;
  locs = locs.filter(l => l.id !== req.params.id);
  if (locs.length === before) return res.status(404).json({ error: 'Location not found' });
  writeLocations(locs);
  res.json({ ok: true });
});

// POST /api/locations/:id/kiosks — add kiosk to location
router.post('/:id/kiosks', (req, res) => {
  const locs = readLocations();
  const loc = locs.find(l => l.id === req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  const { kioskId, name } = req.body;
  if (!kioskId) return res.status(400).json({ error: 'kioskId is required' });

  if (!loc.kiosks) loc.kiosks = [];
  loc.kiosks.push({ kioskId, name: name || kioskId, addedAt: new Date().toISOString() });
  writeLocations(locs);
  res.status(201).json(loc);
});

// DELETE /api/locations/:id/kiosks/:kioskId — remove kiosk from location
router.delete('/:id/kiosks/:kioskId', (req, res) => {
  const locs = readLocations();
  const loc = locs.find(l => l.id === req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  loc.kiosks = (loc.kiosks || []).filter(k => k.kioskId !== req.params.kioskId);
  writeLocations(locs);
  res.json(loc);
});

module.exports = router;
