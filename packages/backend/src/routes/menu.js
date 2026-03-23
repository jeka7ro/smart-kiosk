const express = require('express');
const router  = express.Router();
const { getCachedMenu, getAllCachedMenus, fetchMenu, getOrgIdForBrand, clearMenuCache } = require('../services/iikoService');

// Clear stale cache on startup so the new groupModifiers mapping takes effect immediately
clearMenuCache();

const { requireApiKey } = require('../middleware/authMiddleware');

const ORG_IDS = (process.env.SYRVE_ORG_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const DEFAULT_ORG = ORG_IDS[0] || '9c63cff6-1d66-442d-a98d-2302656e3943';

// GET /api/menu?orgId=xxx&brandId=smashme
// Returns cached menu (populated on startup by iikoService.syncAllMenus)
router.get('/', requireApiKey, async (req, res) => {
  const { brandId = 'smashme' } = req.query;
  let orgId = req.query.orgId;
  
  // FIX: Frontend sends 'undefined' as string if locationOrgIds is empty
  if (!orgId || orgId === 'undefined' || orgId === 'null') {
    orgId = getOrgIdForBrand(brandId) || DEFAULT_ORG;
  }

  let menu = getCachedMenu(orgId) || getCachedMenu(brandId);

  if (!menu) {
    // Not cached yet — fetch on-demand
    try {
      menu = await fetchMenu(orgId);
    } catch (err) {
      return res.status(503).json({
        error: 'Menu not available',
        detail: err.message,
        orgId,
      });
    }
  }

  res.json({
    orgId,
    brandId: brandId || 'smashme',
    categories: menu.categories,
    products: menu.products,
    total: menu.products.length,
    source: 'syrve-live',
  });
});

// GET /api/menu/categories?orgId=xxx
router.get('/categories', requireApiKey, async (req, res) => {
  const { orgId = DEFAULT_ORG } = req.query;
  const menu = getCachedMenu(orgId);
  if (!menu) return res.json({ categories: [], source: 'not-synced' });
  res.json({ categories: menu.categories });
});

// GET /api/menu/products?orgId=xxx&categoryId=yyy
router.get('/products', requireApiKey, async (req, res) => {
  let orgId = req.query.orgId;
  if (!orgId || orgId === 'undefined' || orgId === 'null') orgId = DEFAULT_ORG;
  
  const categoryId = req.query.categoryId;
  const menu = getCachedMenu(orgId);
  if (!menu) return res.json({ products: [], source: 'not-synced' });

  const products = categoryId
    ? menu.products.filter(p => p.categoryId === categoryId)
    : menu.products;
  res.json({ products, total: products.length });
});

// GET /api/menu/all — all cached orgs
router.get('/all', (req, res) => {
  res.json(getAllCachedMenus());
});

// GET /api/menu/status — per-brand sync status for Admin Panel
router.get('/status', (req, res) => {
  const all = getAllCachedMenus();
  const brands = Object.entries(all).map(([key, val]) => ({
    brandId:   val.brandId || key,
    name:      val.brandId === 'smashme' ? 'SmashMe' : val.brandId === 'sushimaster' ? 'SushiMaster' : key,
    categories: val.menu?.categories?.length || 0,
    products:   val.menu?.products?.length   || 0,
    syncedAt:   val.syncedAt || null,
    source:     'syrve-live',
  }));
  // Remove duplicates (cache keyed by both brandId and orgId)
  const seen = new Set();
  const unique = brands.filter(b => {
    if (seen.has(b.brandId)) return false;
    seen.add(b.brandId);
    return true;
  });
  res.json({ brands: unique, count: unique.length });
});

module.exports = router;
