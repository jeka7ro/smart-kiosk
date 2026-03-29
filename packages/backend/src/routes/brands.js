const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { protect, requireApiKey } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/brands');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${req.params.brandId}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|svg\+xml|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// GET /api/brands — list all brands
router.get('/', requireApiKey, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM brands ORDER BY id ASC');
    res.json({ brands: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/brands/:id — single brand
router.get('/:id', requireApiKey, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM brands WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Brand not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/brands/:id — update brand metadata (name, description, website, logo_url, colors)
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, description, website, logo_url, colors, data } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO brands (id, name, description, website, logo_url, colors, data, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name        = COALESCE(EXCLUDED.name, brands.name),
         description = COALESCE(EXCLUDED.description, brands.description),
         website     = COALESCE(EXCLUDED.website, brands.website),
         logo_url    = COALESCE(EXCLUDED.logo_url, brands.logo_url),
         colors      = COALESCE(EXCLUDED.colors, brands.colors),
         data        = COALESCE(EXCLUDED.data, brands.data),
         updated_at  = NOW()
       RETURNING *`,
      [req.params.id, name || req.params.id, description, website, logo_url, JSON.stringify(colors || {}), JSON.stringify(data || {})]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/brands/:brandId/logo — upload logo file
router.post('/:brandId/logo', protect, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    // Build the public URL for the uploaded logo
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
    const ext = path.extname(req.file.filename);
    const logoUrl = `${backendUrl}/uploads/brands/${req.params.brandId}${ext}`;

    // Update logo_url in brands table
    await pool.query(
      `UPDATE brands SET logo_url = $1, updated_at = NOW() WHERE id = $2`,
      [logoUrl, req.params.brandId]
    );

    res.json({ ok: true, logo_url: logoUrl, filename: req.file.filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
