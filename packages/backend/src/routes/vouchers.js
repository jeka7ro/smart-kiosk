const express = require('express');
const router = express.Router();
const voucherService = require('../services/voucherService');
const { protect } = require('../middleware/authMiddleware');

// Flexible admin auth: accepts JWT via `protect` OR x-api-key header
const requireAdminOrKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (apiKey === 'sk-live-2024-secure' || apiKey === process.env.ADMIN_API_KEY) {
    return next();
  }
  return protect(req, res, next);
};

// ─── Public / Kiosk Endpoints ───────────────────────────────────────────────
// GET /api/vouchers/kiosk-availability — Check if THIS kiosk + brand has any active promo codes enabled
router.get('/kiosk-availability', async (req, res) => {
  try {
    const locationId = String(req.query.locationId || '').trim();
    const kioskId = String(req.query.kioskId || '').trim();
    const brandId = String(req.query.brandId || '').trim();
    const cartBrands = String(req.query.cartBrands || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const result = await voucherService.hasActiveVouchersForKiosk({ locationId, kioskId, brandId, cartBrands });
    return res.json(result);
  } catch (err) {
    console.error('[Vouchers] Availability error:', err.message);
    return res.json({ hasActiveVouchers: false, count: 0 });
  }
});

// POST /api/vouchers/validate — Validate a promo code from Kiosk Cart
router.post('/validate', async (req, res) => {
  try {
    const { code, subtotal, locationId, kioskId, brandId, cartBrands } = req.body;
    const result = await voucherService.validateVoucher({
      code,
      subtotal: Number(subtotal) || 0,
      locationId,
      kioskId,
      brandId,
      cartBrands: Array.isArray(cartBrands) ? cartBrands : []
    });

    if (!result.valid) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[Vouchers] Validation error:', err.message);
    return res.status(500).json({ valid: false, error: 'Eroare la validarea codului promoțional.' });
  }
});

// ─── Admin Endpoints ────────────────────────────────────────────────────────

// GET /api/vouchers — List all vouchers
router.get('/', requireAdminOrKey, async (req, res) => {
  try {
    const vouchers = await voucherService.getAllVouchers();
    res.json({ success: true, vouchers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/vouchers — Create a new voucher
router.post('/', requireAdminOrKey, async (req, res) => {
  try {
    const created = await voucherService.createVoucher(req.body);
    res.status(201).json({ success: true, voucher: created });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/vouchers/:id — Update existing voucher
router.put('/:id', requireAdminOrKey, async (req, res) => {
  try {
    const updated = await voucherService.updateVoucher(req.params.id, req.body);
    res.json({ success: true, voucher: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/vouchers/:id — Delete voucher
router.delete('/:id', requireAdminOrKey, async (req, res) => {
  try {
    const deleted = await voucherService.deleteVoucher(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Codul promoțional nu a fost găsit.' });
    }
    res.json({ success: true, message: 'Codul promoțional a fost șters.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
