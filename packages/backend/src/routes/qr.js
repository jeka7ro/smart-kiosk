const express = require('express');
const router  = express.Router();
const { generateQrDataUrl, generateQrBuffer, generateAllForLocation } = require('../services/qrService');

// GET /api/qr/generate?brand=smashme&table=5&loc=1  → returns JSON { dataUrl }
router.get('/generate', async (req, res) => {
  try {
    const { brand, table, loc } = req.query;
    if (!table || !loc) return res.status(400).json({ error: 'table and loc are required' });
    const dataUrl = await generateQrDataUrl({
      brandId: brand || 'smashme',
      tableNumber: parseInt(table),
      locationId: loc,
    });
    res.json({ dataUrl, table, loc, brand });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/qr/image?brand=smashme&table=5&loc=1  → returns PNG directly (usable as img src)
router.get('/image', async (req, res) => {
  try {
    const { brand = 'smashme', table = '1', loc = '1' } = req.query;
    const buf = await generateQrBuffer({
      brandId: brand,
      tableNumber: parseInt(table),
      locationId: loc,
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/qr/location/:locationId?brand=smashme&tables=20
// Returns all QR data URLs for a location
router.get('/location/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { brand = 'smashme', tables = '10' } = req.query;
    const tableCount = parseInt(tables);

    const qrs = [];
    for (let t = 1; t <= tableCount; t++) {
      const dataUrl = await generateQrDataUrl({ brandId: brand, tableNumber: t, locationId });
      qrs.push({ tableNumber: t, dataUrl });
    }
    res.json({ locationId, brand, qrs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
