const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.params.productId}_custom_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|svg\+xml|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// GET /api/products/overrides/:brandId — get all manual overrides for a brand
router.get('/overrides/:brandId', protect, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM product_overrides WHERE brand_id = $1', [req.params.brandId]);
    res.json({ overrides: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/products/overrides/:brandId/:productId/tags — update boolean tags
router.put('/overrides/:brandId/:productId/tags', protect, async (req, res) => {
  const { is_vegetarian, is_spicy } = req.body;
  const { brandId, productId } = req.params;

  try {
    const { rows } = await pool.query(
      `INSERT INTO product_overrides (id, brand_id, is_vegetarian, is_spicy, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         is_vegetarian = EXCLUDED.is_vegetarian,
         is_spicy = EXCLUDED.is_spicy,
         updated_at = NOW()
       RETURNING *`,
      [productId, brandId, !!is_vegetarian, !!is_spicy]
    );
    res.json({ override: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/products/overrides/:brandId/:productId/image — upload manual custom image
router.post('/overrides/:brandId/:productId/image', protect, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const customUrl = `/uploads/products/${req.file.filename}`;
  const { brandId, productId } = req.params;

  try {
    const { rows } = await pool.query(
      `INSERT INTO product_overrides (id, brand_id, custom_image_url, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET
         custom_image_url = EXCLUDED.custom_image_url,
         updated_at = NOW()
       RETURNING *`,
      [productId, brandId, customUrl]
    );
    res.json({ override: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/products/overrides/:brandId/:productId/image — remove manual custom image
router.delete('/overrides/:brandId/:productId/image', protect, async (req, res) => {
  const { brandId, productId } = req.params;
  try {
    // We don't delete the row, just wipe out the custom_image_url pointer
    const { rows } = await pool.query(
      `UPDATE product_overrides SET custom_image_url = NULL, updated_at = NOW() 
       WHERE id = $1 AND brand_id = $2 RETURNING *`,
      [productId, brandId]
    );
    res.json({ override: rows[0] || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
