const express = require('express');
const router  = express.Router();
const { getCachedMenu, getAllCachedMenus, fetchMenu, getOrgIdForBrand, clearMenuCache, getStopListIds } = require('../services/iikoService');
const { pool } = require('../db');

// Clear stale cache on startup so the new groupModifiers mapping takes effect immediately
clearMenuCache();

const { requireApiKey } = require('../middleware/authMiddleware');

const ORG_IDS = (process.env.SYRVE_ORG_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const DEFAULT_ORG = ORG_IDS[0] || '9c63cff6-1d66-442d-a98d-2302656e3943';

// GET /api/menu?orgId=xxx&brandId=smashme
// Returns cached menu (populated on startup by iikoService.syncAllMenus)
router.get('/', requireApiKey, async (req, res) => {
  const { brandId = 'smashme', locId } = req.query;
  const includeHidden = req.query.includeHidden === 'true' || req.query.includeHidden === '1';
  let orgId = req.query.orgId;
  
  // Resolve orgId from location if missing or string undefined
  if (!orgId || orgId === 'undefined' || orgId === 'null') {
    if (locId) {
      try {
        const { findLocation, getAllLocations } = require('../utils/locations');
        const loc = findLocation(locId);
        if (loc?.orgIds?.[brandId]) {
          orgId = loc.orgIds[brandId];
        } else {
          const all = getAllLocations();
          const cleanLoc = locId.toLowerCase().replace(/[^a-z0-9]/g, '');
          const alt = all.find(l => (l.orgIds?.[brandId]) && (
            (l.kioskUrl && l.kioskUrl.toLowerCase().includes(cleanLoc)) ||
            (l.id && l.id.toLowerCase().includes(cleanLoc)) ||
            (l.name && l.name.toLowerCase().includes(cleanLoc)) ||
            (cleanLoc.includes('constanta') && (l.id?.includes('8308e796') || l.name?.toLowerCase().includes('constanta')))
          ));
          if (alt?.orgIds?.[brandId]) {
            orgId = alt.orgIds[brandId];
          }
        }
      } catch (_) {}
    }
    if (!orgId || orgId === 'undefined' || orgId === 'null') {
      orgId = getOrgIdForBrand(brandId) || DEFAULT_ORG;
    }
  }

  // Look up cached menu specifically for this (orgId, brandId) pair
  let menu = getCachedMenu(orgId, brandId);

  if (!menu) {
    // Not cached yet — fetch on-demand specifically for this organization!
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

  // Fetch product overrides (custom images, tags, promo price)
  let productOverrides = {};
  let productOverridesByName = {};
  try {
    const isSushi = brandId === 'sushimaster' || brandId === 'rollmaster';
    const query = isSushi
      ? "SELECT * FROM product_overrides WHERE brand_id IN ('sushimaster', 'rollmaster')"
      : "SELECT * FROM product_overrides WHERE brand_id = $1";
    const params = isSushi ? [] : [brandId];
    const { rows } = await pool.query(query, params);
    rows.forEach(r => { 
      productOverrides[r.id] = r; 
      if (r.product_name) {
        productOverridesByName[r.product_name.trim().toLowerCase()] = r;
      }
    });
  } catch (_) { /* graceful */ }

  // Build maps of product id/name → image so modifier options can inherit product images
  const productImageMap = {};
  const productNameImageMap = {};
  (menu.products || []).forEach(p => {
    const pNameLower = (p.name || '').trim().toLowerCase();
    const over = productOverrides[p.id] || productOverridesByName[pNameLower] || {};
    const img = over.custom_image_url || over.syrve_image_url || p.image || over.local_image_url;
    if (img) {
      productImageMap[p.id] = img;
      if (p.name) productNameImageMap[pNameLower] = img;
    }
  });

  const enrichedProducts = menu.products.map(p => {
    const pNameLower = (p.name || '').trim().toLowerCase();
    const over = productOverrides[p.id] || productOverridesByName[pNameLower] || {};
    return {
      ...p,
      image: over.custom_image_url || over.syrve_image_url || p.image || over.local_image_url,
      isVegetarian: over.is_vegetarian || false,
      isSpicy: over.is_spicy || false,
      isHidden: over.is_hidden || false,
      isFeatured: over.is_featured || false,
      promoPrice: over.promo_price ? parseFloat(over.promo_price) : null,
      promoStart: over.promo_start || null,
      promoEnd: over.promo_end || null,
      popupStart: over.popup_start !== undefined ? !!over.popup_start : false,
      modifierGroups: (p.modifierGroups || []).map(gm => ({
        ...gm,
        options: (gm.options || []).map(opt => ({
          ...opt,
          image: modifierImages[opt.id] || opt.image || productImageMap[opt.id] || (opt.name ? productNameImageMap[opt.name.toLowerCase().trim()] : null) || null,
        })),
      })),
    };
  }).filter(p => includeHidden || !p.isHidden);

  let finalCategories = menu.categories || [];
  let finalProducts = enrichedProducts || [];

  let locData = null;
  if (locId) {
    try {
      const { findLocation } = require('../utils/locations');
      try {
        let { rows: locRows } = await pool.query('SELECT data FROM locations WHERE id = $1 OR data->>\'kioskUrl\' = $1', [locId]);
        if (!locRows || !locRows.length) {
          const aliasRes = await pool.query("SELECT data FROM locations WHERE data->'aliases' ? $1", [locId]).catch(() => ({ rows: [] }));
          locRows = aliasRes.rows;
        }
        if (locRows && locRows.length > 0) {
          locData = locRows[0].data;
          if (typeof locData === 'string') {
            try { locData = JSON.parse(locData); } catch {}
          }
        }
      } catch (_) {}
      
      if (!locData) {
        const found = findLocation(locId);
        if (found) locData = found.data || found;
      }

      if (locData) {
        const overrides = locData.menuOverrides?.[brandId]
          || (brandId === 'sushimaster' ? locData.menuOverrides?.['rollmaster'] : (brandId === 'rollmaster' ? locData.menuOverrides?.['sushimaster'] : null));
        
        if (overrides) {
          let profile = null;
          let bData = null;
          if (overrides.profileId) {
            const { rows: brandRows } = await pool.query('SELECT data FROM brands WHERE id = $1', [brandId]);
            if (brandRows.length > 0) {
              bData = brandRows[0].data;
              if (typeof bData === 'string') {
                try { bData = JSON.parse(bData); } catch {}
              }
              const profiles = bData?.menuProfiles || [];
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

          const includeHidden = req.query.includeHidden === 'true' || req.query.includeHidden === '1';

          // 1. Root Folder Traversal (if specified)
          if (rootFolderId) {
            const getDescendantsAndSelf = (parentId, allCats) => {
              const self = allCats.find(c => c.id === parentId);
              if (!self) return [];
              const children = allCats.filter(c => c.parentGroup === parentId);
              return [self, ...children.flatMap(c => getDescendantsAndSelf(c.id, allCats))];
            };
            const scopedCats = getDescendantsAndSelf(rootFolderId, finalCategories);
            
            // Failsafe: only restrict to scopedCats if it keeps active products available.
            // If the user mistakenly set rootFolderId to a leaf category that is hidden or has 0 products,
            // fallback to the full categories list so the kiosk does not turn blank.
            if (scopedCats.length > 0) {
              const scopedCatIds = new Set(scopedCats.map(c => c.id));
              const survivingProds = finalProducts.filter(p => 
                scopedCatIds.has(p.categoryId) && 
                mergedHidden[p.id] !== true && 
                mergedHidden[p.categoryId] !== true
              );
              if (survivingProds.length > 0 || includeHidden) {
                finalCategories = scopedCats;
              } else {
                console.warn(`[Menu API] rootFolderId '${rootFolderId}' would result in 0 active products. Fallback to full menu to prevent kiosk blackout.`);
              }
            }
          }

          // 2. Hide specific categories (and prune their branches)
          // When includeHidden is true (Admin mode), we do not prune categories so the user can see & unhide them.
          if (!includeHidden) {
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
          }

          // 3. Keep products only if their category survived AND the product itself is not hidden
          if (!includeHidden) {
            const validCatIds = new Set(finalCategories.map(c => c.id));
            const stopListIds = typeof getStopListIds === 'function' ? getStopListIds() : new Set();

            // Collect all hidden product IDs and names (including products whose category was pruned or hidden)
            const hiddenProductIds = new Set();
            const hiddenProductNames = new Set();

            (menu.products || []).forEach(p => {
              const pNameLower = (p.name || '').trim().toLowerCase();
              const isCatHidden = !validCatIds.has(p.categoryId) || mergedHidden[p.categoryId] === true;
              const isProdExplicitlyHidden = mergedHidden[p.id] === true || (p.name && mergedHidden[pNameLower] === true);
              const isOutOfStock = p.outOfStock || stopListIds.has(p.id);
              if (isCatHidden || isProdExplicitlyHidden || isOutOfStock) {
                hiddenProductIds.add(p.id);
                if (p.name) {
                  hiddenProductNames.add(pNameLower);
                  hiddenProductNames.add(p.name.replace(/^\*+\s*/, '').trim().toLowerCase());
                }
              }
            });

            // Also add any key explicitly set to true in mergedHidden or in stop list
            Object.entries(mergedHidden).forEach(([k, v]) => {
              if (v === true) {
                hiddenProductIds.add(k);
                hiddenProductNames.add(k.trim().toLowerCase());
              }
            });
            stopListIds.forEach(id => hiddenProductIds.add(id));

            // Filter top-level products
            finalProducts = finalProducts.filter(p => {
               const pNameLower = (p.name || '').trim().toLowerCase();
               return validCatIds.has(p.categoryId) && !hiddenProductIds.has(p.id) && !hiddenProductNames.has(pNameLower);
            });

            // 4. Prune hidden modifier options and empty modifier groups from surviving products
            const isModifierOptionHidden = (opt) => {
              if (!opt) return true;
              if (opt.outOfStock) return true;
              if (hiddenProductIds.has(opt.id)) return true;
              if (opt._matchedId && hiddenProductIds.has(opt._matchedId)) return true;
              if (opt.name) {
                const nameLower = opt.name.trim().toLowerCase();
                const cleanNameLower = opt.name.replace(/^\*+\s*/, '').trim().toLowerCase();
                if (hiddenProductNames.has(nameLower) || hiddenProductNames.has(cleanNameLower)) return true;
              }
              return false;
            };

            const cleanModifierGroup = (group) => {
              const rawOptions = group.options || group.items || [];
              const validOptions = rawOptions.filter(opt => !isModifierOptionHidden(opt));
              return {
                ...group,
                options: validOptions,
                items: validOptions
              };
            };

            finalProducts = finalProducts.map(p => {
              const cleanedModifierGroups = (p.modifierGroups || [])
                .map(cleanModifierGroup)
                .filter(group => (group.options || []).length > 0 || group.required);

              const cleanedModifiers = (p.modifiers || [])
                .map(cleanModifierGroup)
                .filter(group => (group.options || []).length > 0 || group.required);

              return {
                ...p,
                modifierGroups: cleanedModifierGroups,
                modifiers: cleanedModifiers.length > 0 ? cleanedModifiers : cleanedModifierGroups
              };
            });
          }
        }
      }
    } catch (e) {
      console.error('[Menu API] Failed to apply kiosk overrides:', e);
    }

    // Apply location & kiosk-specific promo overrides
    try {
      const kioskId = req.query.kioskId || '1';
      if (locData) {
        const kioskPromos = locData.kioskPromos || {};
        const promoOverrides = kioskPromos[kioskId] 
          || kioskPromos[locData.kioskUrl] 
          || (locData.id && kioskPromos[locData.id])
          || (kioskPromos['cluj1'] || {}) 
          || (Object.keys(kioskPromos).length > 0 ? kioskPromos[Object.keys(kioskPromos)[0]] : {}) 
          || {};
        const now = new Date();
        finalProducts = finalProducts.map(p => {
          const pNameLower = (p.name || '').trim().toLowerCase();
          const promo = promoOverrides[p.id] 
            || promoOverrides[pNameLower] 
            || (productOverrides[p.id]?.promo_price ? { price: productOverrides[p.id].promo_price, start: productOverrides[p.id].promo_start, end: productOverrides[p.id].promo_end, popupStart: productOverrides[p.id].popup_start } : null) 
            || (productOverridesByName[pNameLower]?.promo_price ? { price: productOverridesByName[pNameLower].promo_price, start: productOverridesByName[pNameLower].promo_start, end: productOverridesByName[pNameLower].promo_end, popupStart: productOverridesByName[pNameLower].popup_start } : null);

          if (!promo || !promo.price) return p;
          const inRange = (!promo.start || new Date(promo.start) <= now) && (!promo.end || new Date(promo.end) >= now);
          if (!inRange) return p;
          return { 
            ...p, 
            promoPrice: parseFloat(promo.price), 
            promoStart: promo.start || null, 
            promoEnd: promo.end || null,
            popupStart: promo.popupStart !== undefined ? !!promo.popupStart : true
          };
        });
      }
    } catch (_) { /* graceful */ }
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
