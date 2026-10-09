/**
 * Syrve (iiko) Cloud API Service — Multi-brand
 * Base URL: https://api-eu.syrve.live
 *
 * SmashMe:      API key from SYRVE_API_KEY        | org from SYRVE_ORG_IDS
 * SushiMaster:  API key from SYRVE_API_KEY_SUSHI  | org from SYRVE_ORG_ID_SUSHI
 * WeLoveSushi:  same API key as SushiMaster         | org from SYRVE_ORG_ID_WELOVESUSHI
 * Ikura:        same API key as SushiMaster         | org from SYRVE_ORG_ID_IKURA
 */

const API_URL = process.env.SYRVE_API_URL || 'https://api-eu.syrve.live';
const translator = require('./translatorService.js');
const { syncProductImages } = require('./imageService.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

// Brand config — each brand has its own API key + org ID
const BRANDS = {
  smashme: {
    apiKey: process.env.SYRVE_API_KEY || '',
    orgId:  (process.env.SYRVE_ORG_IDS || '9c63cff6-1d66-442d-a98d-2302656e3943').split(',')[0].trim(),
    token: null,
    tokenExpiry: 0,
  },
  crunch: {
    apiKey: process.env.SYRVE_API_KEY || '',
    orgId:  (process.env.SYRVE_ORG_IDS || '9c63cff6-1d66-442d-a98d-2302656e3943').split(',')[0].trim(),
    token: null,
    tokenExpiry: 0,
  },
  rollmaster: {
    apiKey: process.env.SYRVE_API_KEY_SUSHI || '93a34e75123e47b897e390f31ecfa4cb',
    orgId:  process.env.SYRVE_ORG_ID_SUSHI || 'adddb5a0-26e5-4d50-b472-1c74726c3f72',
    token: null,
    tokenExpiry: 0,
  },
  lovesushi: {
    apiKey: process.env.SYRVE_API_KEY_SUSHI || '93a34e75123e47b897e390f31ecfa4cb',
    orgId:  process.env.SYRVE_ORG_ID_WELOVESUSHI || process.env.SYRVE_ORG_ID_SUSHI || 'adddb5a0-26e5-4d50-b472-1c74726c3f72',
    token: null,
    tokenExpiry: 0,
  },
  pokiwoki: {
    apiKey: process.env.SYRVE_API_KEY_SUSHI || '93a34e75123e47b897e390f31ecfa4cb',
    orgId:  process.env.SYRVE_ORG_ID_POKIWOKI || process.env.SYRVE_ORG_ID_SUSHI || 'adddb5a0-26e5-4d50-b472-1c74726c3f72',
    token: null,
    tokenExpiry: 0,
  },
};

// ── Auth ────────────────────────────────────────────────────────────────────

async function getToken(brandId = 'smashme') {
  const brand = BRANDS[brandId];
  if (!brand?.apiKey) throw new Error(`No API key configured for brand: ${brandId}`);
  const now = Date.now();
  if (brand.token && now < brand.tokenExpiry - 60_000) return brand.token;

  const res = await fetch(`${API_URL}/api/1/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiLogin: brand.apiKey }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Syrve auth failed [${brandId}]: ${data.errorDescription}`);

  brand.token = data.token;
  brand.tokenExpiry = now + 60 * 60 * 1000;
  return brand.token;
}

// ── Helpers (per-brand) ──────────────────────────────────────────────────────

async function syrvePost(path, body, brandId = 'smashme') {
  const token = await getToken(brandId);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function syrveGet(path, brandId = 'smashme') {
  const token = await getToken(brandId);
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

// ── Org Discovery — lists all organizations for a given API key ──────────────

async function discoverOrgs(brandId) {
  try {
    const data = await syrveGet('/api/1/organizations', brandId);
    const orgs = data.organizations || [];
    console.log(`\n[Syrve] Organizations for [${brandId}]:`);
    orgs.forEach(o => console.log(`   • ${o.name}  →  id: ${o.id}`));
    return orgs;
  } catch (err) {
    console.error(`[Syrve] Failed to list orgs for [${brandId}]:`, err.message);
    return [];
  }
}

// ── Auto-assign org IDs for sushi brands that have no env var set ────────────

async function autoAssignSushiOrgs() {
  // Not strictly needed anymore since they all share SYRVE_ORG_ID_SUSHI by default, 
  // but keeping basic resolution just in case they split them.
  const needsDiscovery = ['rollmaster', 'lovesushi', 'pokiwoki'].some(
    b => !BRANDS[b].orgId
  );
  if (!needsDiscovery) return;

  const apiKey = process.env.SYRVE_API_KEY_SUSHI;
  if (!apiKey) return;

  const orgs = await discoverOrgs('rollmaster');
  if (!orgs.length) return;

  // Map by name (case-insensitive contains match)
  const match = (name, keywords) =>
    keywords.some(k => name.toLowerCase().includes(k.toLowerCase()));

  for (const org of orgs) {
    if (!BRANDS.rollmaster.orgId && match(org.name, ['sushi master', 'sushimaster', 'roll master'])) {
      BRANDS.rollmaster.orgId = org.id;
    } else if (!BRANDS.lovesushi.orgId && match(org.name, ['we love sushi', 'welovesushi', 'love sushi'])) {
      BRANDS.lovesushi.orgId = org.id;
    } else if (!BRANDS.pokiwoki.orgId && match(org.name, ['poki woki', 'pokiwoki'])) {
      BRANDS.pokiwoki.orgId = org.id;
    }
  }
}

// ── Menu transformer: Syrve nomenclature → kiosk format ─────────────────────

function transformMenu(raw, brandId = 'smashme') {
  const { groups = [], products = [] } = raw;

  const groupMap = {};
  for (const g of groups) {
    if (!g.isGroupModifier) groupMap[g.id] = g;
  }

  // Map brand IDs to Syrve root folder IDs (hardcoded for resilience against renames)
  // Use exact UUIDs from iiko so renames don't break the menu.
  const brandToRootId = {
    rollmaster: '52428a16-5250-49d1-8886-252f729a53d7', // SUSHI MASTER
    lovesushi:  'a820d72d-f735-4e7a-b6f3-5f984a4cbb9c', // WLS (Love Sushi)
    pokiwoki:   '628f6a2c-32cd-4ccf-b79d-366041f2c9f6', // POKI WOKI (98 produse)
    smashme:    'f57d6a6c-ee60-479c-aa49-6dfab38c2449', // SMASH ME KIOSK (exact root folder)
    crunch:     null,
  };

  // Categories to skip (internal, delivery, promo etc.)
  const SKIP_CATEGORIES = ['delivery', 'promo', 'scos', 'glovo', 'platforme', 'servicii', 'ambalaj', 'sgr'];

  let allowedRootId = brandToRootId[brandId] || null;

  // Fallback: search by name for smashme/crunch or unknown brands
  if (!allowedRootId) {
    const brandToRootName = { smashme: 'SMASH ME KIOSK', crunch: 'CRUNCH' };
    const allowedRootName = brandToRootName[brandId] || brandId.toUpperCase();
    const rootGroup = groups.find(g => !g.parentGroup && g.name?.toUpperCase().includes(allowedRootName.toUpperCase()));
    allowedRootId = rootGroup?.id;
  }

  if (!allowedRootId) {
    console.warn(`[Syrve] Could not find root folder for brand '${brandId}'`);
    return { categories: [], products: [] };
  }

  // Categories are direct children of the allowed root folder
  const categories = groups.filter(g => !g.isGroupModifier && g.parentGroup === allowedRootId);

  // Filter out internal/delivery/promo categories not meant for kiosk
  const filteredCategories = categories.filter(g => {
    const nameLower = (g.name || '').toLowerCase();
    return !SKIP_CATEGORIES.some(skip => nameLower.includes(skip));
  });

  // If a brand uses a complex structure, we could flatten it. For now, Kiosk UI supports 1 level.
  const mappedCategories = filteredCategories
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      image: cat.imageLinks?.[0] || cat.imagePaths?.[0] || null,
      parentGroupId: cat.parentGroup,
      order: cat.order || 0,
    }))
    .sort((a, b) => a.order - b.order);

  const categoryIds = new Set(mappedCategories.map(c => c.id));

  // Build a flat lookup map of ALL products (including modifiers) by ID
  // This is needed to resolve group modifier children's names and prices
  const productMap = {};
  for (const p of products) {
    productMap[p.id] = p;
  }

  // Load excluded products dynamically
  let excludedProductNames = [];
  try {
    const exPath = path.join(__dirname, '../../excluded_products.json');
    if (fs.existsSync(exPath)) {
      excludedProductNames = JSON.parse(fs.readFileSync(exPath, 'utf8')).map(n => n.toLowerCase().trim());
    }
  } catch (e) {
    console.warn('[Syrve] Could not read excluded_products.json:', e.message);
  }

  const mappedProducts = products
    .filter(p => {
      if (!categoryIds.has(p.parentGroup)) return false;
      if (p.isDeleted) return false;
      if (p.type === 'Modifier') return false;

      // Filter by excluded_products.json
      const pNameLower = (p.name || '').toLowerCase().trim();
      if (excludedProductNames.length > 0 && excludedProductNames.some(exName => pNameLower === exName || pNameLower.includes(exName))) {
         return false;
      }

      // Brand-specific visibility rules
      const sp = (p.sizePrices || [])[0];
      const isIncluded = sp?.price?.isIncludedInMenu;
      
      // Products disabled in Syrve/iiko (isIncludedInMenu: false) must not appear in kiosk
      if (isIncluded === false) return false;

      if (brandId === 'rollmaster' || brandId === 'lovesushi' || brandId === 'smashme') {
        // Explicitly requires this flag to be TRUE to hide non-kiosk or retired items
        if (!isIncluded) return false;
      }
      // pokiwoki, crunch: all non-deleted and included products shown
      
      return true;
    })
    .map(p => {
      const sizePrices = p.sizePrices || [];
      const price = sizePrices.length > 0
        ? (sizePrices[0]?.price?.currentPrice || 0)
        : 0;

      // --- groupModifiers: resolve childModifiers using the productMap ---
      const modifierGroups = (p.groupModifiers || []).map(gm => {
        const children = (gm.childModifiers || []);
        const options = children
          .map(child => {
            const childProduct = productMap[child.id];
            if (!childProduct) return null;
            if (childProduct.isDeleted) return null;
            // Price for modifier: sizePrice - product base price (priceDiff)
            const childSp = (childProduct.sizePrices || [])[0];
            if (childSp?.price?.isIncludedInMenu === false) return null;
            const childPrice = childSp?.price?.currentPrice || 0;
            // Resolve description: direct or via matching non-asterisk main product
            let description = childProduct.description || '';
            let matchedId = childProduct.id;
            if (!description && childProduct.name && childProduct.name.startsWith('*')) {
              const cleanName = childProduct.name.replace(/^\*+\s*/, '').trim().toLowerCase();
              const matched = products.find(prod => prod.name.trim().toLowerCase() === cleanName);
              if (matched) {
                if (matched.description) description = matched.description;
                matchedId = matched.id;
              }
            }

            return {
              id: child.id,
              name: childProduct.name,
              description: description || '',
              translations: {},
              _matchedId: matchedId,
              price: Math.round(childPrice * 100) / 100,
              image: childProduct.imageLinks?.[0] || childProduct.imagePaths?.[0] || null,
              minAmount: child.minAmount ?? 0,
              maxAmount: child.maxAmount ?? 1,
              defaultAmount: child.defaultAmount ?? 0,
            };
          })
          .filter(Boolean);

        return {
          id: gm.id,
          name: gm.name || null, // May be null — will try to resolve group name below
          required: gm.required || false,
          minAmount: gm.minAmount ?? 0,
          maxAmount: gm.maxAmount ?? 1,
          options,
        };
      }).filter(gm => gm.options.length > 0);

      return {
        id: p.id,
        brandId,
        categoryId: p.parentGroup,
        name: p.name,
        description: p.description || '',
        price: Math.round(price * 100) / 100,
        image: p.imageLinks?.[0] || p.imagePaths?.[0] || null,
        weight: p.weight || null,
        energyAmount: p.energyAmount || null,
        allergenGroups: p.allergenGroups || [],
        tags: p.tags || [],
        isNew: false,
        order: p.order || 0,
        modifierGroups,
      };
    })
    .sort((a, b) => a.order - b.order);

  // Remove categories with 0 products
  const productCategoryIds = new Set(mappedProducts.map(p => p.categoryId));
  const visibleCategories = mappedCategories.filter(c => productCategoryIds.has(c.id));

  // Debug log for investigation
  const newCat = mappedCategories.find(c => c.name?.toLowerCase().includes('new'));
  if (newCat) {
    const newProds = mappedProducts.filter(p => p.categoryId === newCat.id);
    console.log(`[Menu Debug] 'New' category: id=${newCat.id}, products=${newProds.length}, visible=${productCategoryIds.has(newCat.id)}`);
    if (!productCategoryIds.has(newCat.id)) {
      // Also log raw products that have this parentGroup to see why they're filtered
      const rawInNew = products.filter(p => p.parentGroup === newCat.id);
      console.log(`[Menu Debug] Raw products in 'New' from Syrve: ${rawInNew.length}`);
      rawInNew.slice(0, 3).forEach(p => {
        const sp = (p.sizePrices || [])[0];
        console.log(`  - ${p.name}: isDeleted=${p.isDeleted}, type=${p.type}, isIncludedInMenu=${sp?.price?.isIncludedInMenu}`);
      });
    }
  }

  return { categories: visibleCategories, products: mappedProducts };
}

// In-memory menu cache (will use Redis when available)
const _menuCache = {};

// ── Public functions ─────────────────────────────────────────────────────────

/**
 * Get organizations for a brand's API key
 */
async function getOrganizations(brandId = 'smashme') {
  return syrveGet('/api/1/organizations', brandId);
}

/**
 * Fetch and transform menu for one organization (brand-aware)
 */
async function fetchMenu(orgId, brandId = 'smashme') {
  const raw = await syrvePost('/api/1/nomenclature', { organizationId: orgId }, brandId);
  if (raw.errorDescription) throw new Error(`Menu fetch failed: ${raw.errorDescription}`);
  const menu = transformMenu(raw, brandId);
  
  // Inject known translations into the payload immediately
  const dict = translator.loadTranslations();
  menu.products.forEach(p => {
    if (dict[p.id] && dict[p.id].translations) {
      p.translations = dict[p.id].translations;
    }
    if (p.modifierGroups) {
      p.modifierGroups.forEach(gm => {
        (gm.options || []).forEach(opt => {
          if (dict[opt.id]?.translations) {
            opt.translations = dict[opt.id].translations;
          } else if (opt._matchedId && dict[opt._matchedId]?.translations) {
            opt.translations = dict[opt._matchedId].translations;
          }
          delete opt._matchedId;
        });
      });
    }
  });

  // Cache per orgId and per brandId:orgId
  const cacheKey = `${brandId}:${orgId}`;
  _menuCache[cacheKey] = { menu, brandId, orgId, syncedAt: new Date().toISOString() };
  if (orgId) {
    _menuCache[orgId] = _menuCache[cacheKey];
  }

  return menu;
}

/**
 * Convenience: fetch menu by brand name
 */
async function fetchMenuForBrand(brandId) {
  const brand = BRANDS[brandId];
  if (!brand) throw new Error(`Unknown brand: ${brandId}`);
  return fetchMenu(brand.orgId, brandId);
}

/**
 * Sync menus for ALL configured brands and active locations
 */
async function syncAllMenus() {
  // First: auto-assign org IDs for sushi brands that aren't set via env
  await autoAssignSushiOrgs();

  const syncTargets = [];
  const seenPairs = new Set();

  function addTarget(brandId, orgId) {
    if (!brandId || !orgId) return;
    const key = `${brandId}:${orgId}`;
    if (!seenPairs.has(key)) {
      seenPairs.add(key);
      syncTargets.push({ brandId, orgId });
    }
  }

  // 1. Defaults from BRANDS
  for (const [brandId, brand] of Object.entries(BRANDS)) {
    if (brand.apiKey && brand.orgId) {
      addTarget(brandId, brand.orgId);
    }
  }

  // 2. Extra locations from locs.json (e.g. Constanta, Cluj-2, etc.)
  try {
    const fs = require('fs');
    const path = require('path');
    const candidates = [
      path.join(__dirname, '../../../../locs.json'),
      path.join(__dirname, '../../data/locations.json')
    ];
    for (const cPath of candidates) {
      if (fs.existsSync(cPath)) {
        const parsed = JSON.parse(fs.readFileSync(cPath, 'utf8'));
        const locs = Array.isArray(parsed) ? parsed : (parsed.locations || []);
        for (const loc of locs) {
          if (loc.active !== false && loc.orgIds) {
            for (const [bId, oId] of Object.entries(loc.orgIds)) {
              if (oId) addTarget(bId, oId);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Syrve] Could not load extra locations for menu sync:', e.message);
  }

  // 3. Database locations if active
  try {
    const { rows } = await pool.query('SELECT data FROM locations WHERE active = true');
    for (const r of rows) {
      const lData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      if (lData?.orgIds) {
        for (const [bId, oId] of Object.entries(lData.orgIds)) {
          if (oId) addTarget(bId, oId);
        }
      }
    }
  } catch (_) {}

  console.log(`[Syrve] Syncing menus for ${syncTargets.length} organization/brand targets...`);

  for (const { brandId, orgId } of syncTargets) {
    const brand = BRANDS[brandId];
    if (!brand?.apiKey) continue;
    try {
      const menu = await fetchMenu(orgId, brandId);
      const cacheKey = `${brandId}:${orgId}`;
      _menuCache[cacheKey] = { menu, brandId, orgId, syncedAt: new Date().toISOString() };
      _menuCache[orgId]    = _menuCache[cacheKey];
      if (brand.orgId === orgId) {
        _menuCache[brandId] = _menuCache[cacheKey];
      }
      console.log(`[Syrve] ✅ Synced ${brandId} (${orgId}): ${menu.categories.length} cats, ${menu.products.length} products`);

      // Trigger background translation job for missing descriptions
      translator.processNewTranslations(menu.products)
        .then(newDict => {
          menu.products.forEach(p => {
             if (newDict[p.id] && newDict[p.id].translations) {
               p.translations = newDict[p.id].translations;
             }
          });
        })
        .catch(e => console.error(`[Syrve] Translation job failed for ${brandId} (${orgId}):`, e.message));

      syncProductImages(menu.products, brandId).catch(e => 
        console.error(`[Syrve] Image sync failed for ${brandId} (${orgId}):`, e.message)
      );

    } catch (err) {
      console.error(`[Syrve] ❌ Sync failed for ${brandId} (${orgId}):`, err.message);
    }
  }
}

/**
 * Get cached menu for an organization & brand
 */
function getCachedMenu(orgId, brandId) {
  if (brandId && orgId && _menuCache[`${brandId}:${orgId}`]?.menu) {
    return _menuCache[`${brandId}:${orgId}`].menu;
  }
  if (orgId && _menuCache[orgId]?.menu) {
    return _menuCache[orgId].menu;
  }
  if (brandId && _menuCache[brandId]?.menu) {
    return _menuCache[brandId].menu;
  }
  return null;
}

/**
 * Get all cached menus
 */
function getAllCachedMenus() {
  return _menuCache;
}

/**
 * Clear the entire in-memory menu cache (force re-fetch on next request)
 */
function clearMenuCache() {
  for (const key of Object.keys(_menuCache)) {
    delete _menuCache[key];
  }
  console.log('[Syrve] 🗑️  Menu cache cleared — will re-fetch from Syrve API on next request');
}

/**
 * Get org ID for a brand
 */
function getOrgIdForBrand(brandId) {
  return BRANDS[brandId]?.orgId || null;
}

const activeStopListProductIds = new Set();

function getStopListIds() {
  return activeStopListProductIds;
}

/**
 * Fetch stop list (out of stock items) across all configured orgs
 */
async function syncStopLists() {
  const orgIds = Object.values(BRANDS)
    .filter(b => b.apiKey && b.orgId)
    .map(b => b.orgId)
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  if (!orgIds.length) return;

  try {
    const parseStopListItems = (res) => {
      const ids = [];
      if (res.terminalGroupStopLists && Array.isArray(res.terminalGroupStopLists)) {
        res.terminalGroupStopLists.forEach(tg => {
          (tg.items || []).forEach(it => {
            if (it.productId && (it.balance === undefined || it.balance <= 0)) {
              ids.push(it.productId);
            }
          });
        });
      }
      if (res.productStopListItems && Array.isArray(res.productStopListItems)) {
        res.productStopListItems.forEach(it => {
          if (it.productId && (it.balance === undefined || it.balance <= 0)) {
            ids.push(it.productId);
          }
        });
      }
      return ids;
    };

    activeStopListProductIds.clear();

    // Use smashme token for smashme orgs, sushi token for sushi orgs
    const smashmeOrgId = BRANDS.smashme.orgId;
    const smashmeOrgs  = orgIds.filter(id => id === smashmeOrgId);
    const sushiOrgs    = orgIds.filter(id => id !== smashmeOrgId);

    if (smashmeOrgs.length) {
      const res = await syrvePost('/api/1/stop_lists', { organizationIds: smashmeOrgs }, 'smashme');
      const smashmeIds = parseStopListItems(res);
      smashmeIds.forEach(id => activeStopListProductIds.add(id));
      if (smashmeIds.length) {
        console.log(`[Syrve] Stop list synced (SmashMe): ${smashmeIds.length} items`);
      }
    }
    if (sushiOrgs.length) {
      const res = await syrvePost('/api/1/stop_lists', { organizationIds: sushiOrgs }, 'rollmaster');
      const sushiIds = parseStopListItems(res);
      sushiIds.forEach(id => activeStopListProductIds.add(id));
      if (sushiIds.length) {
        console.log(`[Syrve] Stop list synced (Sushi): ${sushiIds.length} items`);
      }
    }

    // Apply outOfStock flag to cached menus
    Object.values(menuCache).forEach(menu => {
      if (!menu || !menu.products) return;
      menu.products.forEach(p => {
        p.outOfStock = activeStopListProductIds.has(p.id);
        (p.modifierGroups || []).forEach(gm => {
          (gm.options || gm.items || []).forEach(opt => {
            opt.outOfStock = activeStopListProductIds.has(opt.id) || (opt._matchedId && activeStopListProductIds.has(opt._matchedId));
          });
        });
      });
    });
  } catch (err) {
    console.error('[Syrve] Stop list sync error:', err.message);
  }
}

/**
 * Create an order in Syrve — brand-aware
 * Called after payment confirmation from orders.js
 *
 * Payment Type IDs (from Valentin):
/**
 * Payment Type IDs per brand/organization:
 *
 * SushiMaster / Brașov (rollmaster, lovesushi, pokiwoki):
 *   Cash: 09322f46-578a-d210-add7-eec222a08871
 *   Card: 29ee5e97-c1cf-42ad-90e6-b4c876025bc9
 *
 * SmashMe / Cluj (smashme, crunch):
 *   Cash: 09322f46-578a-d210-add7-eec222a08871
 *   Card: e46b4e6c-10d5-a739-8fb1-b6674d1e65e7
 *   Viva: 07b0e68b-d19a-4b43-ab9b-75c30fd7edc1
 */
const SYRVE_PAYMENT_TYPES_BY_BRAND = {
  rollmaster: {
    cash: { paymentTypeId: '09322f46-578a-d210-add7-eec222a08871', paymentTypeKind: 'Cash', isProcessedExternally: false },
    card: { paymentTypeId: '29ee5e97-c1cf-42ad-90e6-b4c876025bc9', paymentTypeKind: 'Card', isProcessedExternally: false },
    viva: { paymentTypeId: '07b0e68b-d19a-4b43-ab9b-75c30fd7edc1', paymentTypeKind: 'Card', isProcessedExternally: false },
  },
  lovesushi: {
    cash: { paymentTypeId: '09322f46-578a-d210-add7-eec222a08871', paymentTypeKind: 'Cash', isProcessedExternally: false },
    card: { paymentTypeId: '29ee5e97-c1cf-42ad-90e6-b4c876025bc9', paymentTypeKind: 'Card', isProcessedExternally: false },
    viva: { paymentTypeId: '07b0e68b-d19a-4b43-ab9b-75c30fd7edc1', paymentTypeKind: 'Card', isProcessedExternally: false },
  },
  pokiwoki: {
    cash: { paymentTypeId: '09322f46-578a-d210-add7-eec222a08871', paymentTypeKind: 'Cash', isProcessedExternally: false },
    card: { paymentTypeId: '29ee5e97-c1cf-42ad-90e6-b4c876025bc9', paymentTypeKind: 'Card', isProcessedExternally: false },
    viva: { paymentTypeId: '07b0e68b-d19a-4b43-ab9b-75c30fd7edc1', paymentTypeKind: 'Card', isProcessedExternally: false },
  },
  smashme: {
    cash: { paymentTypeId: '09322f46-578a-d210-add7-eec222a08871', paymentTypeKind: 'Cash', isProcessedExternally: false },
    card: { paymentTypeId: 'e46b4e6c-10d5-a739-8fb1-b6674d1e65e7', paymentTypeKind: 'Card', isProcessedExternally: false },
    viva: { paymentTypeId: '07b0e68b-d19a-4b43-ab9b-75c30fd7edc1', paymentTypeKind: 'Card', isProcessedExternally: false },
  },
  crunch: {
    cash: { paymentTypeId: '09322f46-578a-d210-add7-eec222a08871', paymentTypeKind: 'Cash', isProcessedExternally: false },
    card: { paymentTypeId: 'e46b4e6c-10d5-a739-8fb1-b6674d1e65e7', paymentTypeKind: 'Card', isProcessedExternally: false },
    viva: { paymentTypeId: '07b0e68b-d19a-4b43-ab9b-75c30fd7edc1', paymentTypeKind: 'Card', isProcessedExternally: false },
  },
};

/**
 * Auto-translation map for Constanța:
 * When orders are placed at Constanța (8308e796-8780-4d18-ae66-4e430178c778),
 * maps any legacy/Cluj nomenclature item to the active Constanța (Valentin) nomenclature ID.
 */
const CONSTANTA_PRODUCT_ID_FIXES = {
  // SPECIAL COMBO: Cluj ID -> Valentin Constanta Active ID (Code 10610)
  'd9c0bf50-c376-444a-b9b3-35888534730c': 'e0c90062-cb86-48db-b622-3a9c6942363e',
  // Smashed ME Meniu
  'cc0c19b3-2452-46bb-8f6e-9f66517f54c1': '0fc1a318-bc48-425a-b254-b1115448f393',
  // Classic Cheesburger Meniu
  '7df4f353-6602-4106-9181-3c5e70d16f04': 'cbb201e8-9c52-4355-8ba8-dc645e57b0a4',
  // Chicken Nuggets Menu 6 buc
  'c8de66d8-b56a-4e8e-b865-8673a44a6430': '1f4ed94e-9124-4584-b625-bbf313b39761',
  // Chicken Nuggets Menu 4 buc
  'bc820104-16e7-4101-adab-423d0a424919': 'f11285c5-6176-4738-9412-0c83b670b9e7',
  // Chicken Burger Menu
  'b34946ed-62dc-4980-a024-9d38384aa6e4': 'be16b288-cdfd-488a-a946-837bf09a0883',
  // Big Boss Menu
  'e488b98e-ca7c-4a9e-bc8e-45b04c25cf84': '1be2329a-3ef0-41eb-872a-e67c6426b045',
  // Oklahoma Crunch Meniu
  '59c22b8b-0539-47d3-9db2-13ef37c8b16f': 'b3149770-e803-4087-85d0-ad104c1d45de',
  // Farmer Legend Meniu
  '532fd605-f492-4ba0-ad8b-e51b1522c165': 'a86cd82f-1121-49b8-9083-81b196e49adb',
  // Smoky Pepper Meniu
  '7fd01849-0bcb-4446-b241-5f61ffa9228b': '490a8d8c-b04b-445e-9cb1-8139cb63b5f7',
  // Spicy Jalapeno Meniu
  '493422bb-0a0d-413d-b0be-8ed014d7bdab': 'd08df61c-9d0f-4e98-bbc3-43921120263e',
  // Hotti Burger Meniu
  'fa42bef7-654f-4820-a4dc-c5c36af4f430': '8f03834b-b269-40c0-8909-8bea662f3ba3',
  // Classic Smash Dublu Menu
  'fc4fba39-184d-4b3d-a867-692e044fbb56': 'b58610f5-3e30-4f8b-8d0b-2a8dd5feee36',
  // Sos de Iaurt cu Usturoi 50g
  '80c02b27-949c-4f19-bcd9-ddc631868b25': 'c9e21a4d-fa6c-4bf7-bd2a-f1c8cccb19e3',
  // Sos Garlic Mayo 50g
  '44cadfe2-4dae-4447-b6d3-9f05d9b0e1dc': 'b09ef7c2-4e7d-4dde-a936-3b8f6d6b1226',
  // Mustar 50g
  '5b4418e7-669b-4232-9837-3f684890e5ec': 'aa282658-66dd-4a20-b07d-04e7313fb7d6',
  // Maioneza 50g
  '1f6d3f5f-f20b-4855-a8a3-86e5d3f5ebb2': 'fbd2c0ba-df08-411f-ab56-8a27852b67d2',
  // Sos Classic 50g
  '923bc8ba-5771-4b19-b74c-ec9f2f3ab3ff': 'e19abf0e-cc5d-4727-8ebf-5d2fa1149ed5',
  // Sos Aioli cu Lamaie 50g
  'e68da8a9-8a62-49fa-9dd9-5907979158ab': '78dc147c-8ae0-471d-a60d-f51f825bac14',
  // Sos Delight 50g
  '6f2f7d2c-2f0a-4786-88cf-6d8131fc23e4': '02a2fe40-19e9-4d29-9eaf-1a1b676d4172',
  // Ketchup 50g
  '23a52cb5-ce1e-4cc7-8670-718aaa16df04': 'dbb2ef28-4ff7-4fea-8ced-5d42b9b8e9b2',
  // Sos Dip-in Cheesy 50g
  '041eb5e9-25b8-4b3f-92b1-222f26d803ef': '779fb5a0-f2e6-4656-8405-8be10196eeb3',
  // Sos Fresh Mayo 50g
  'd6617584-ced5-4375-8840-98c447eae786': '37ccdc6d-29c4-4111-a501-f02f70250023',
  // Sos Smoked Chili Mayo 50g
  '031c9436-139b-497d-a903-4aa0a4f02f84': '1e76f178-851a-4b04-9590-c545c4af8c5c',
  // Sos Big Tasty 50g
  'ea748464-9ab3-45c5-a666-6cb2381e193e': 'f2838c92-f3be-467c-a56b-0bfd10707b0f',
  // Sweet chilli 50g
  'd2e16b25-cab0-4005-8298-ba62e2766433': 'e6460ad5-4aed-4044-8c17-bee0f761f3af',
  // Fanta 0,33 Doza
  'e3dd701d-5f32-4923-af21-d125c8885038': '97955089-ed8e-45d4-90af-c3e041c0ef1f',
  // Coca Cola 0,33 Doza
  'c7b9d43b-67c3-4e12-bec2-24d98e5df6b5': '0e602006-18d8-4688-a9aa-e1ad2e8b7eb5',
  // Coca Cola Zero 0,33 Doza
  '3ac15f0b-e48f-46e6-9a0c-b202b5595881': '65154bc0-7127-4d01-8a7d-8b5beb7ef526',
  // Sprite 0,33 Doza
  '2aba3ca3-312f-4de6-b304-58b734cb11f1': 'f04b67b0-0393-4f6b-a806-b91a28311fc6',
  // Cartofi Prajiti Clasic 150 gr
  'be24922d-dd2c-4fb2-953f-9912ae250bc6': 'ee47e8c3-5d6f-4a3c-b5bb-f6ac87c648f2',
};

function getPaymentConfigForBrand(brandId, paymentMethod) {
  const pMethod = (paymentMethod || 'card').toLowerCase();
  const brandTable = SYRVE_PAYMENT_TYPES_BY_BRAND[brandId] || SYRVE_PAYMENT_TYPES_BY_BRAND.smashme;
  return brandTable[pMethod] || brandTable.card;
}

async function logIikoRequest(orderId, brandId, payload, response, error = null) {
  try {
    const status = error ? 'error' : 'success';
    const respData = error ? { errorDescription: error } : response;
    
    // We execute this asynchronously without awaiting to not block the flow
    pool.query(
      `INSERT INTO iiko_logs (order_id, brand_id, status, payload, response) VALUES ($1, $2, $3, $4, $5)`,
      [String(orderId), brandId, status, JSON.stringify(payload || {}), JSON.stringify(respData || {})]
    ).catch(dbErr => {
      console.error('[Syrve] Failed to write iiko log to DB:', dbErr.message);
    });
  } catch (e) {
    console.error('[Syrve] Failed to write iiko log:', e.message);
  }
}

// Cache for discount type IDs per organization (e.g. 'kiosk' / 'KIOSK')
const KIOSK_DISCOUNT_CACHE = {};

async function getKioskDiscountTypeId(orgId, brandId = 'smashme') {
  if (!orgId) return null;
  if (KIOSK_DISCOUNT_CACHE[orgId]) return KIOSK_DISCOUNT_CACHE[orgId];

  // Hardcoded known fallbacks for production
  const FALLBACKS = {
    '9c63cff6-1d66-442d-a98d-2302656e3943': '1df3160e-8fb4-4141-b6d4-3c19b4c4e2b4', // Cluj (SmashMe) "kiosk"
    'adddb5a0-26e5-4d50-b472-1c74726c3f72': 'f6f652b6-f0cb-4364-9992-f4cd479ba1fb', // Brasov (SushiMaster) "KIOSK"
  };

  try {
    const res = await syrvePost('/api/1/discounts', {
      organizationIds: [orgId]
    }, brandId);

    const items = res?.discounts?.[0]?.items || [];
    // Priority 1: Discount named exactly 'kiosk' (case-insensitive)
    const exactKiosk = items.find(d => !d.isDeleted && (d.name || '').trim().toLowerCase() === 'kiosk');
    if (exactKiosk) {
      KIOSK_DISCOUNT_CACHE[orgId] = exactKiosk.id;
      return exactKiosk.id;
    }

    // Priority 2: Discount with 'kiosk' in name and mode FlexibleSum
    const anyKiosk = items.find(d => !d.isDeleted && (d.name || '').toLowerCase().includes('kiosk') && d.mode === 'FlexibleSum');
    if (anyKiosk) {
      KIOSK_DISCOUNT_CACHE[orgId] = anyKiosk.id;
      return anyKiosk.id;
    }

    // Priority 3: Fallback map
    if (FALLBACKS[orgId]) {
      KIOSK_DISCOUNT_CACHE[orgId] = FALLBACKS[orgId];
      return FALLBACKS[orgId];
    }

    // Priority 4: Any FlexibleSum discount
    const flexDiscount = items.find(d => !d.isDeleted && d.mode === 'FlexibleSum');
    if (flexDiscount) {
      KIOSK_DISCOUNT_CACHE[orgId] = flexDiscount.id;
      return flexDiscount.id;
    }
  } catch (err) {
    console.warn(`[Syrve] Failed to fetch discounts for org ${orgId}:`, err.message);
  }

  const fallbackId = FALLBACKS[orgId] || null;
  if (fallbackId) KIOSK_DISCOUNT_CACHE[orgId] = fallbackId;
  return fallbackId;
}

async function createOrder({ brandId = 'smashme', orgId, order }) {
  const brand = BRANDS[brandId];

  // If no API key for this brand, log and return mock
  if (!brand?.apiKey) {
    console.log(`[Syrve] No API key for ${brandId} — mock order #${order.orderNumber}`);
    return { id: `mock-${Date.now()}` };
  }

  const resolvedOrgId = orgId || brand?.orgId;
  if (!resolvedOrgId) {
    console.warn(`[Syrve] No orgId for ${brandId} — skipping Syrve order creation`);
    return null;
  }

  let payload = {};
  try {
    // Map payment method to Syrve payment type (brand-aware: Brașov vs Cluj)
    const pMethod = (order.paymentMethod || 'card').toLowerCase();
    const paymentConfig = getPaymentConfigForBrand(brandId, pMethod);

    // Build items in correct Syrve format
    const isConstanta = resolvedOrgId === '8308e796-8780-4d18-ae66-4e430178c778' ||
                        String(order.locationId || '').includes('constanta') ||
                        String(order.orderNumber || '').includes('CT');

    const syrveItems = order.items.map(item => {
      const itemComment = item.comment || 
        item.selectedModifiers?.find(m => m.modId === 'custom_comment' || m.id === 'custom_comment')?.optionName || 
        null;

      // Map modifiers to Syrve format (filter out custom_comment and mods without valid ID)
      let syrveModifiers = [];
      let modifiersCostPerUnit = 0;

      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        console.log(`[SYRVE-DEBUG] Item "${item.name}" raw modifiers:`, JSON.stringify(item.selectedModifiers));
        const validMods = item.selectedModifiers
          .filter(mod => mod.modId !== 'custom_comment' && mod.id !== 'custom_comment' && mod.productId !== 'custom_comment')
          .filter(mod => (mod.id || mod.productId || mod.optionId));  // Must have a valid ID for Syrve
        if (validMods.length > 0) {
          syrveModifiers = validMods.map(mod => {
            const modPrice = Number(mod.price) || 0;
            const modAmount = Number(mod.amount) || 1;
            modifiersCostPerUnit += (modPrice * modAmount);
            let modProdId = mod.productId || mod.id || mod.optionId;
            if (isConstanta && CONSTANTA_PRODUCT_ID_FIXES[modProdId]) {
              modProdId = CONSTANTA_PRODUCT_ID_FIXES[modProdId];
            }
            return {
              productId: modProdId,
              amount: modAmount,
              productGroupId: mod.groupId || mod.productGroupId || mod.modifierGroupId || mod.modId || null,
              price: modPrice,
              positionId: null,
            };
          });
          console.log(`[SYRVE-DEBUG] Item "${item.name}" mapped modifiers:`, JSON.stringify(syrveModifiers), `modifiersCostPerUnit:`, modifiersCostPerUnit);
        }
      }

      // Calculate base product price for Syrve:
      // In iiko: line total = (product.price * amount) + sum(mod.price * mod.amount)
      // Because kiosk item.unitPrice includes modifiers (basePrice + modifiersCost),
      // we must send the base price to Syrve so options are not double-calculated.
      const rawUnitPrice = Number(item.unitPrice !== undefined ? item.unitPrice : (item.price || 0));
      let productPrice = rawUnitPrice;
      if (item.basePrice !== undefined && item.basePrice !== null && !isNaN(Number(item.basePrice)) && Number(item.basePrice) > 0) {
        productPrice = Number(item.basePrice);
      } else if (modifiersCostPerUnit > 0) {
        productPrice = Math.max(0, Math.round((rawUnitPrice - modifiersCostPerUnit) * 100) / 100);
      }

      let itemProdId = item.productId;
      if (isConstanta && CONSTANTA_PRODUCT_ID_FIXES[itemProdId]) {
        console.log(`[Syrve-Constanta] Auto-mapped product "${item.name || ''}" (${itemProdId} -> ${CONSTANTA_PRODUCT_ID_FIXES[itemProdId]})`);
        itemProdId = CONSTANTA_PRODUCT_ID_FIXES[itemProdId];
      }

      const syrveItem = {
        productId: itemProdId,
        amount: item.quantity || 1,
        price: productPrice,
        type: 'Product',
        comment: itemComment,
      };

      if (syrveModifiers.length > 0) {
        syrveItem.modifiers = syrveModifiers;
      }

      return syrveItem;
    });

    // Build comment
    const orderTypeLabel = order.orderType === 'dine-in' ? 'La masă' : 'La pachet';
    const isPaidLabel = (pMethod === 'card' || pMethod === 'viva') ? 'PLĂTIT' : 'NEPLĂTIT (Cash)';
    // Determine specific kiosk display name (e.g. SmartKiosk CJ-1)
    let kioskDisplayName = 'SmartKiosk CJ-1';
    const ordNumStr = String(order.orderNumber || '');
    if (ordNumStr.startsWith('CJ1') || String(order.locationId || '').includes('cluj1')) {
      kioskDisplayName = 'SmartKiosk CJ-1';
    } else if (ordNumStr.startsWith('CJ2') || String(order.locationId || '').includes('cluj2')) {
      kioskDisplayName = 'SmartKiosk CJ-2';
    } else if (ordNumStr.startsWith('BV') || String(order.locationId || '').includes('brasov')) {
      kioskDisplayName = `SmartKiosk BV-${order.kioskId || '1'}`;
    } else if (ordNumStr.includes('-')) {
      const prefix = ordNumStr.split('-')[0];
      kioskDisplayName = `SmartKiosk ${prefix}`;
    }

    // Aggregate special notes from items to include in order-level comment
    const specialNotes = (order.items || [])
      .map(i => {
        const c = i.comment || i.selectedModifiers?.find(m => m.modId === 'custom_comment')?.optionName;
        return c ? `${i.name || 'Produs'}: ${c}` : null;
      })
      .filter(Boolean);

    let orderComment = `[${kioskDisplayName}] ${orderTypeLabel} | ${isPaidLabel} | Comanda #${order.orderNumber}`;
    let cuiDigits = '';
    let cuiWithRo = '';
    if (order.fiscal?.cui) {
      cuiDigits = String(order.fiscal.cui || order.fiscal.rawCui || '').replace(/\D/g, '');
      cuiWithRo = cuiDigits ? `RO${cuiDigits}` : String(order.fiscal.rawCui || '');
      const firmDisplay = order.fiscal.name ? ` (${order.fiscal.name})` : '';

      // RSISTEMS / Datecs fiscal driver in Romania parses the comment for standard tags:
      // "CF: <cui_digits>", "CIF: <cui_digits>", or "[CF:<cui_digits>]" strictly numeric (no emojis/unicode).
      // Datecs hardware protocol ONLY accepts 2-10 digits for client TaxNumber.
      orderComment = `CF:${cuiDigits} | CIF:${cuiDigits} | [CF:${cuiDigits}] | CUI: ${cuiWithRo}${firmDisplay} | ` + orderComment;
    }
    if (specialNotes.length > 0) {
      orderComment += ` | MENȚIUNI: ${specialNotes.join('; ')}`;
    }

    // Dynamically fetch terminalGroupId for the target organization
    let terminalGroupId = 'cf589c4a-37dd-54ed-015a-4e33131300bf'; // Fallback
    try {
      const termRes = await syrvePost('/api/1/terminal_groups', {
        organizationIds: [resolvedOrgId],
        includeDisabled: false
      }, brandId);
      
      const items = termRes?.terminalGroups?.[0]?.items || [];
      if (items.length > 0) {
        terminalGroupId = items[0].id;
      } else {
        console.warn(`[Syrve] Warning: No active terminal groups found for org ${resolvedOrgId}. Using fallback.`);
      }
    } catch (tErr) {
      console.warn(`[Syrve] Failed to fetch terminal groups for org ${resolvedOrgId}:`, tErr.message);
    }

    const customerData = order.fiscal?.cui ? {
      name: (order.fiscal.name || 'Client').slice(0, 60),
      surname: cuiDigits || String(order.fiscal.rawCui || order.fiscal.cui || '').slice(0, 30),
      comment: `CF:${cuiDigits} CIF:${cuiDigits} CUI:${cuiWithRo} | RegCom: ${order.fiscal.regCom || ''} | Adresa: ${order.fiscal.address || ''}`,
      // Syrve/iiko fiscal fields — 'inn' is the standard taxpayer ID field
      // that Syrve passes to the fiscal printer driver for buyer identification
      inn: cuiDigits,
      cardNumber: cuiWithRo,
      cardTrack: cuiDigits,
    } : {
      name: kioskDisplayName,
      surname: '',
    };

    // Calculate total gross items price in Syrve
    let grossSyrveTotal = 0;
    syrveItems.forEach(si => {
      const qty = Number(si.amount) || 1;
      let line = (Number(si.price) || 0) * qty;
      if (si.modifiers && si.modifiers.length > 0) {
        si.modifiers.forEach(m => {
          line += (Number(m.price) || 0) * (Number(m.amount) || 1) * qty;
        });
      }
      grossSyrveTotal += line;
    });
    grossSyrveTotal = Math.round(grossSyrveTotal * 100) / 100;

    const discountSum = Math.max(0, Math.round((grossSyrveTotal - Number(order.totalAmount || 0)) * 100) / 100);

    let discountsInfo = null;
    if (discountSum > 0.01) {
      const discountTypeId = await getKioskDiscountTypeId(resolvedOrgId, brandId);
      if (discountTypeId) {
        discountsInfo = {
          card: null,
          discounts: [
            {
              discountTypeId: discountTypeId,
              sum: discountSum,
              selectivePositions: null,
              type: null
            }
          ]
        };
        console.log(`[Syrve] Applied discount of ${discountSum.toFixed(2)} lei (discountTypeId: ${discountTypeId}) for order #${order.orderNumber} [${brandId}]`);
        orderComment += ` | REDUCERE: -${discountSum.toFixed(2)} LEI`;
      } else {
        console.warn(`[Syrve] Warning: Discount of ${discountSum.toFixed(2)} lei detected but no kiosk discount type configured for org ${resolvedOrgId}`);
      }
    }

    const finalPaymentSum = Math.max(0, Math.round((grossSyrveTotal - discountSum) * 100) / 100);

    payload = {
      createOrderSettings: {
        mode: 'Async',
      },
      organizationId: resolvedOrgId,
      terminalGroupId: terminalGroupId,
      order: {
        deliveryPoint: null,
        customer: customerData,
        items: syrveItems,
        payments: finalPaymentSum > 0 ? [
          {
            paymentTypeId: paymentConfig.paymentTypeId,
            paymentTypeKind: paymentConfig.paymentTypeKind,
            sum: finalPaymentSum,
            isProcessedExternally: paymentConfig.isProcessedExternally,
            isFiscalizedExternally: false,
          },
        ] : [],
        phone: '+40000000000',
        orderServiceType: 'DeliveryByClient',
        externalNumber: `K${order.orderNumber}`,
        comment: orderComment,
        sourceKey: 'Smart Kiosk',
        ...(discountsInfo ? { discountsInfo } : {}),
        externalData: order.fiscal?.cui ? [
          { key: 'cui', value: cuiWithRo },
          { key: 'cif', value: cuiDigits },
          { key: 'FiscalCode', value: cuiDigits },
          { key: 'CIF', value: cuiDigits },
          { key: 'CUI', value: cuiDigits },
          { key: 'TaxNumber', value: cuiDigits },
          { key: 'BuyerTaxNumber', value: cuiDigits },
          { key: 'ClientFiscalCode', value: cuiDigits },
          { key: 'ClientCIF', value: cuiDigits },
          { key: 'FiscalReceiptCUI', value: cuiDigits },
          { key: 'companyName', value: String(order.fiscal.name || '') },
          { key: 'companyAddress', value: String(order.fiscal.address || '') },
          { key: 'regCom', value: String(order.fiscal.regCom || '') },
        ] : null,
      },
    };

    console.log(`[Syrve] Sending order to iiko — brand: ${brandId}, org: ${resolvedOrgId}, payment: ${pMethod}`);

    const res = await syrvePost('/api/1/deliveries/create', payload, brandId);
    if (res.errorDescription) {
      console.error(`[Syrve] createOrder error [${brandId}]:`, res.errorDescription);
      logIikoRequest(order.orderNumber || order.id, brandId, payload, res, res.errorDescription);
      return null;
    }
    console.log(`[Syrve] ✅ Order created [${brandId}]:`, res?.orderInfo?.id || res?.id);
    logIikoRequest(order.orderNumber || order.id, brandId, payload, res);

    // Asynchronously verify final delivery creation status in Syrve (within 2-3 seconds)
    const deliveryId = res?.orderInfo?.id || res?.id;
    if (deliveryId && resolvedOrgId) {
      verifyDeliveryStatus(deliveryId, resolvedOrgId, brandId, order.orderNumber || order.id || order._id);
    }

    return res;
  } catch (err) {
    console.error(`[Syrve] createOrder exception [${brandId}]:`, err.message);
    logIikoRequest(order?.orderNumber || order?.id || 'unknown', brandId, payload || {}, null, err.message);
    return null;
  }
}

/**
 * Asynchronously poll Syrve deliveries/by_id to confirm if the order succeeded
 * or was rejected by the POS / Cloud (e.g. ProductExludedFromMenu, stop-list, etc.)
 */
async function verifyDeliveryStatus(deliveryId, orgId, brandId, orderNumber) {
  if (!deliveryId || !orgId) return;
  try {
    // Allow Syrve Cloud and local POS 2.5 seconds to process the creation request
    await new Promise(r => setTimeout(r, 2500));
    const check = await syrvePost('/api/1/deliveries/by_id', {
      organizationId: orgId,
      orderIds: [deliveryId],
    }, brandId);

    const dOrder = check?.orders?.[0];
    if (dOrder) {
      if (dOrder.creationStatus === 'Error') {
        const errMsg = dOrder.errorInfo?.message || dOrder.errorInfo?.description || 'Eroare necunoscută Syrve';
        const errReason = dOrder.errorInfo?.errorReason || 'CreationError';
        console.error(`[Syrve] ❌ ASYNC ORDER REJECTION for #${orderNumber} (${deliveryId}): [${errReason}] ${errMsg}`);

        // Update iiko_logs so admin portal shows the exact error
        try {
          await pool.query(
            `UPDATE iiko_logs SET status = 'error', response = $1 WHERE order_id = $2`,
            [JSON.stringify(dOrder), String(orderNumber)]
          );
        } catch (_) {}

        // Update orders table
        try {
          await pool.query(
            `UPDATE orders SET status = 'syrve_error', data = jsonb_set(jsonb_set(data, '{syrveStatus}', '"Error"'), '{syrveError}', $1) WHERE data->>'orderNumber' = $2 OR id = $2`,
            [JSON.stringify({ message: errMsg, reason: errReason }), String(orderNumber)]
          );
        } catch (_) {}

        // Emit socket alert for kitchen/kds/admin
        if (global.io) {
          global.io.emit('order_syrve_error', {
            orderNumber,
            deliveryId,
            error: errMsg,
            reason: errReason
          });
        }
      } else if (dOrder.creationStatus === 'Success') {
        console.log(`[Syrve] ✅ Delivery #${orderNumber} (${deliveryId}) confirmed Success in Syrve.`);
      }
    }
  } catch (err) {
    console.warn(`[Syrve] Async verifyDeliveryStatus failed for #${orderNumber}:`, err.message);
  }
}

module.exports = {
  syncAllMenus,
  syncStopLists,
  getStopListIds,
  createOrder,
  verifyDeliveryStatus,
  getOrganizations,
  getOrgIdForBrand,
  fetchMenu,
  fetchMenuForBrand,
  getCachedMenu,
  getAllCachedMenus,
  clearMenuCache,
  syrveGet,
  syrvePost,
  CONSTANTA_PRODUCT_ID_FIXES,
};
