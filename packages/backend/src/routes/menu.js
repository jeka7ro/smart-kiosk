const express = require('express');
const router  = express.Router();
const { getCachedMenu, getAllCachedMenus, fetchMenu, getOrgIdForBrand, clearMenuCache } = require('../services/iikoService');
const { pool } = require('../db');

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

  let menu = getCachedMenu(brandId) || getCachedMenu(orgId);

  if (!menu) {
    // Not cached yet — fetch on-demand
    try {
      menu = await fetchMenu(orgId, brandId);
    } catch (err) {
      return res.status(503).json({
        error: 'Menu not available',
        detail: err.message,
        orgId,
      });
    }
  }

  // Enrich modifier options with custom images from admin DB
  let modifierImages = {};
  try {
    const { rows } = await pool.query('SELECT modifier_id, image_url FROM modifier_images');
    rows.forEach(r => { modifierImages[r.modifier_id] = r.image_url; });
  } catch (_) { /* graceful — don't block menu if DB is slow */ }

  // Fetch product overrides (custom images, tags)
  let productOverrides = {};
  try {
    const { rows } = await pool.query('SELECT * FROM product_overrides WHERE brand_id = $1', [brandId]);
    rows.forEach(r => { productOverrides[r.id] = r; });
  } catch (_) { /* graceful */ }

  const enrichedProducts = menu.products.map(p => {
    const over = productOverrides[p.id] || {};
    return {
      ...p,
      image: over.custom_image_url || over.local_image_url || over.syrve_image_url || p.image,
      isVegetarian: over.is_vegetarian || false,
      isSpicy: over.is_spicy || false,
      modifierGroups: (p.modifierGroups || []).map(gm => ({
        ...gm,
        options: (gm.options || []).map(opt => ({
          ...opt,
          image: modifierImages[opt.id] || opt.image || null,
        })),
      })),
    };
  });

  let finalCategories = menu.categories || [];
  let finalProducts = enrichedProducts || [];

  const locId = req.query.locId;
  if (locId && brandId) {
    try {
      const { rows: locRows } = await pool.query('SELECT data FROM locations WHERE id = $1', [locId]);
      if (locRows.length > 0) {
        const locData = locRows[0].data || {};
        const overrides = locData.menuOverrides?.[brandId];
        
        if (overrides) {
          let profile = null;
          if (overrides.profileId) {
            const { rows: brandRows } = await pool.query('SELECT data FROM brands WHERE id = $1', [brandId]);
            if (brandRows.length > 0) {
              const profiles = brandRows[0].data?.menuProfiles || [];
              profile = profiles.find(p => p.id === overrides.profileId);
            }
          }

          const rootFolderId = overrides.rootFolderId || profile?.rootFolderId || null;
          const templateHidden = profile?.hiddenItems || {};
          const localHidden = overrides.hiddenItems || {};
          
          // Merge hidden maps: local overrides take precedence (can even explicitly unhide with false)
          const mergedHidden = { ...templateHidden };
          for (const [k, v] of Object.entries(localHidden)) {
            mergedHidden[k] = v;
          }

          // 1. Root Folder Traversal (if specified)
          if (rootFolderId) {
            const getDescendantsAndSelf = (parentId, allCats) => {
              const self = allCats.find(c => c.id === parentId);
              if (!self) return [];
              const children = allCats.filter(c => c.parentGroup === parentId);
              return [self, ...children.flatMap(c => getDescendantsAndSelf(c.id, allCats))];
            };
            finalCategories = getDescendantsAndSelf(rootFolderId, finalCategories);
          }

          // 2. Hide specific categories (and prune their branches)
          // We iteratively remove any category whose id OR parentGroup is hidden
          let categoriesToKeep = [];
          for (const cat of finalCategories) {
            // Traverse up to see if any ancestor is hidden
            let isHidden = false;
            let currentCursor = cat;
            while (currentCursor) {
              if (mergedHidden[currentCursor.id] === true) {
                isHidden = true;
                break;
              }
              currentCursor = finalCategories.find(c => c.id === currentCursor.parentGroup);
            }
            if (!isHidden) categoriesToKeep.push(cat);
          }
          finalCategories = categoriesToKeep;

          // 3. Keep products only if their category survived AND the product itself is not hidden
          const validCatIds = new Set(finalCategories.map(c => c.id));
          finalProducts = finalProducts.filter(p => {
             return validCatIds.has(p.categoryId) && mergedHidden[p.id] !== true;
          });
        }
      }
    } catch (e) {
      console.error('[Menu API] Failed to apply kiosk overrides:', e);
    }
  }

  res.json({
    orgId,
    brandId: brandId || 'smashme',
    categories: finalCategories,
    products: finalProducts,
    total: finalProducts.length,
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
