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

// Brand config — each brand has its own API key + org ID
const BRANDS = {
  smashme: {
    apiKey: process.env.SYRVE_API_KEY || '',
    orgId:  (process.env.SYRVE_ORG_IDS || '9c63cff6-1d66-442d-a98d-2302656e3943').split(',')[0].trim(),
    token: null,
    tokenExpiry: 0,
  },
  sushimaster: {
    apiKey: process.env.SYRVE_API_KEY_SUSHI || '56597d13165c49c49c10e351b5eac617',
    orgId:  process.env.SYRVE_ORG_ID_SUSHI || 'adddb5a0-26e5-4d50-b472-1c74726c3f72',
    token: null,
    tokenExpiry: 0,
  },
  welovesushi: {
    apiKey: process.env.SYRVE_API_KEY_SUSHI || '56597d13165c49c49c10e351b5eac617',
    orgId:  process.env.SYRVE_ORG_ID_WELOVESUSHI || process.env.SYRVE_ORG_ID_SUSHI || 'adddb5a0-26e5-4d50-b472-1c74726c3f72',
    token: null,
    tokenExpiry: 0,
  },
  ikura: {
    apiKey: process.env.SYRVE_API_KEY_SUSHI || '56597d13165c49c49c10e351b5eac617',
    orgId:  process.env.SYRVE_ORG_ID_IKURA || process.env.SYRVE_ORG_ID_SUSHI || 'adddb5a0-26e5-4d50-b472-1c74726c3f72',
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
  const needsDiscovery = ['sushimaster', 'welovesushi', 'ikura'].some(
    b => !BRANDS[b].orgId
  );
  if (!needsDiscovery) return;

  const apiKey = process.env.SYRVE_API_KEY_SUSHI;
  if (!apiKey) return;

  const orgs = await discoverOrgs('sushimaster');
  if (!orgs.length) return;

  // Map by name (case-insensitive contains match)
  const match = (name, keywords) =>
    keywords.some(k => name.toLowerCase().includes(k.toLowerCase()));

  for (const org of orgs) {
    if (!BRANDS.sushimaster.orgId && match(org.name, ['sushi master', 'sushimaster'])) {
      BRANDS.sushimaster.orgId = org.id;
      console.log(`[Syrve] Auto-assigned sushimaster orgId: ${org.id} (${org.name})`);
    } else if (!BRANDS.welovesushi.orgId && match(org.name, ['we love sushi', 'welovesushi', 'love sushi'])) {
      BRANDS.welovesushi.orgId = org.id;
      console.log(`[Syrve] Auto-assigned welovesushi orgId: ${org.id} (${org.name})`);
    } else if (!BRANDS.ikura.orgId && match(org.name, ['ikura'])) {
      BRANDS.ikura.orgId = org.id;
      console.log(`[Syrve] Auto-assigned ikura orgId: ${org.id} (${org.name})`);
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

  const kioskRoot = groups.find(g => g.name?.toUpperCase().includes('KIOSK'));
  const kioskRootId = kioskRoot?.id;

  // Since many orgs lack a KIOSK root, dynamically find and blacklist known bad roots
  const blockedRootIds = new Set();
  for (const g of groups) {
    if (!g.parentGroup) {
      const n = (g.name || '').toLowerCase();
      // Block Delivery/Online root branches entirely
      if (n.includes('livrare') || n.includes('bolt') || n.includes('tazz') || n.includes('glovo') || n.includes('sait') || n.includes('site')) {
        blockedRootIds.add(g.id);
      }
      // Block cross-brand branches
      if (brandId === 'sushimaster') {
        if (n.includes('ikura') || n.includes('wls') || n.includes('love')) blockedRootIds.add(g.id);
      } else if (brandId === 'welovesushi') {
        if (n.includes('ikura') || n.includes('master') || n.includes('sm ')) blockedRootIds.add(g.id);
      } else if (brandId === 'ikura') {
        if (n.includes('master') || n.includes('sm ') || n.includes('wls') || n.includes('love')) blockedRootIds.add(g.id);
      }
    }
  }

  function isCategoryBlocked(catId) {
    let current = groupMap[catId];
    
    // Hard-ban by explicit category name (catches operator errors where they put Delivery *inside* the main root)
    const catName = (current?.name || '').toLowerCase();
    if (catName.includes('livrare') || catName.includes('delivery')) return true;
    
    if (brandId === 'sushimaster') {
      if (catName.includes('ikura') || catName.includes('wls') || catName.includes('love')) return true;
    } else if (brandId === 'welovesushi') {
      if (catName.includes('ikura') || catName.includes('master') || catName.includes('sm ')) return true;
    } else if (brandId === 'ikura') {
      if (catName.includes('master') || catName.includes('sm ') || catName.includes('wls') || catName.includes('love')) return true;
    }

    while (current) {
      if (blockedRootIds.has(current.id)) return true;
      current = groupMap[current.parentGroup];
    }
    return false;
  }

  let categories;
  if (kioskRootId) {
    categories = groups.filter(g => !g.isGroupModifier && g.parentGroup === kioskRootId);
  } else {
    categories = groups.filter(g => !g.isGroupModifier && g.parentGroup);
  }
  if (categories.length === 0) {
    categories = groups.filter(g => !g.isGroupModifier);
  }

  const mappedCategories = categories
    .filter(cat => !isCategoryBlocked(cat.id))
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

  const mappedProducts = products
    .filter(p => {
      if (!categoryIds.has(p.parentGroup)) return false;
      if (p.isDeleted) return false;
      if (p.type === 'Modifier') return false;
      // Brand-specific visibility rules
      const sp = (p.sizePrices || [])[0];
      const isIncluded = sp?.price?.isIncludedInMenu;
      
      if (brandId === 'sushimaster') {
        // Sushi Master explicitly requires this flag to be TRUE to hide non-kiosk items (like Delivery)
        if (!isIncluded) return false;
      } else {
        // SmashMe lacks proper flags on some items; only hide if explicitly FALSE
        if (isIncluded === false) return false;
      }
      
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
            // Price for modifier: sizePrice - product base price (priceDiff)
            const childSp = (childProduct.sizePrices || [])[0];
            const childPrice = childSp?.price?.currentPrice || 0;
            return {
              id: child.id,
              name: childProduct.name,
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
  });

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
 * Sync menus for ALL configured brands (auto-discovers sushi orgs first)
 */
async function syncAllMenus() {
  // First: auto-assign org IDs for sushi brands that aren't set via env
  await autoAssignSushiOrgs();

  for (const [brandId, brand] of Object.entries(BRANDS)) {
    if (!brand.apiKey) {
      console.log(`[Syrve] No API key for ${brandId} — skipping`);
      continue;
    }
    if (!brand.orgId) {
      console.log(`[Syrve] No org ID for ${brandId} — skipping (set SYRVE_ORG_ID_${brandId.toUpperCase()} in .env)`);
      continue;
    }
    try {
      const menu = await fetchMenu(brand.orgId, brandId);
      _menuCache[brandId]     = { menu, brandId, syncedAt: new Date().toISOString() };
      console.log(`[Syrve] ✅ Synced ${brandId} (${brand.orgId}): ${menu.categories.length} cats, ${menu.products.length} products`);

      // Trigger background translation job for missing descriptions
      translator.processNewTranslations(menu.products)
        .then(newDict => {
          // Live patch the in-memory cache to ensure tablets get translations immediately upon refresh 
          menu.products.forEach(p => {
             if (newDict[p.id] && newDict[p.id].translations) {
               p.translations = newDict[p.id].translations;
             }
          });
          console.log(`[Syrve] Applied verified translations to live cache for ${brandId}`);
        })
        .catch(e => console.error(`[Syrve] Translation job failed for ${brandId}:`, e.message));

      // Trigger background image downlaod job
      syncProductImages(menu.products, brandId).catch(e => 
        console.error(`[Syrve] Image sync failed for ${brandId}:`, e.message)
      );

    } catch (err) {
      console.error(`[Syrve] ❌ Sync failed for ${brandId}:`, err.message);
    }
  }
}

/**
 * Get cached menu for an organization
 */
function getCachedMenu(orgId) {
  return _menuCache[orgId]?.menu || null;
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
    // Use smashme token for smashme orgs, sushi token for sushi orgs
    const smashmeOrgId = BRANDS.smashme.orgId;
    const smashmeOrgs  = orgIds.filter(id => id === smashmeOrgId);
    const sushiOrgs    = orgIds.filter(id => id !== smashmeOrgId);

    if (smashmeOrgs.length) {
      const res = await syrvePost('/api/1/stop_lists', { organizationIds: smashmeOrgs }, 'smashme');
      if (res.productStopListItems) {
        console.log(`[Syrve] Stop list synced (SmashMe): ${res.productStopListItems.length} items`);
      }
    }
    if (sushiOrgs.length) {
      const res = await syrvePost('/api/1/stop_lists', { organizationIds: sushiOrgs }, 'sushimaster');
      if (res.productStopListItems) {
        console.log(`[Syrve] Stop list synced (Sushi): ${res.productStopListItems.length} items`);
      }
    }
  } catch (err) {
    console.error('[Syrve] Stop list sync error:', err.message);
  }
}

/**
 * Create an order in Syrve — brand-aware
 * Called after payment confirmation from orders.js
 */
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

  try {
    const payload = {
      organizationId: resolvedOrgId,
      terminalGroupId: null, // will be set per-location in future
      createRequest: {
        orderTypeId: null, // will resolve from Syrve order types
        items: order.items.map(item => ({
          productId: item.productId,
          amount:    item.quantity,
          price:     item.unitPrice,
          comment:   item.selectedModifiers?.map(m => m.optionName).join(', ') || '',
        })),
        deliveryPoint: null,
        comment: `${order.orderType === 'dine-in' ? `Masa #${order.tableNumber}` : 'La pachet'} | ${order.channel}`,
        customer: null,
        phone: null,
      },
    };

    const res = await syrvePost('/api/1/order/create', payload, brandId);
    if (res.errorDescription) {
      console.error(`[Syrve] createOrder error [${brandId}]:`, res.errorDescription);
      return null;
    }
    console.log(`[Syrve] ✅ Order created [${brandId}]:`, res?.orderInfo?.id || res?.id);
    return res;
  } catch (err) {
    console.error(`[Syrve] createOrder exception [${brandId}]:`, err.message);
    return null;
  }
}

module.exports = {
  syncAllMenus,
  syncStopLists,
  createOrder,
  getOrganizations,
  getOrgIdForBrand,
  fetchMenu,
  fetchMenuForBrand,
  getCachedMenu,
  getAllCachedMenus,
  clearMenuCache,
};
