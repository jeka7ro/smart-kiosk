const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const DATA_FILE = path.join(__dirname, '../../data/vouchers.json');

function rowToVoucher(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: String(row.code || '').trim().toUpperCase(),
    description: row.description || '',
    type: row.type === 'fixed' ? 'fixed' : 'percentage',
    value: Number(row.value) || 0,
    minOrderAmount: Number(row.min_order_amount) || 0,
    maxDiscountAmount: row.max_discount_amount !== null && row.max_discount_amount !== undefined
      ? Number(row.max_discount_amount)
      : null,
    maxUses: row.max_uses !== null && row.max_uses !== undefined ? parseInt(row.max_uses, 10) : null,
    usedCount: parseInt(row.used_count, 10) || 0,
    startDate: row.start_date ? new Date(row.start_date).toISOString() : null,
    endDate: row.end_date ? new Date(row.end_date).toISOString() : null,
    active: row.active !== undefined ? Boolean(row.active) : true,
    locationIds: Array.isArray(row.location_ids) ? row.location_ids : [],
    brandIds: Array.isArray(row.brand_ids) ? row.brand_ids : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

const KIOSK_LOCATION_GROUPS = [
  ['smashme-main', 'cluj1', 'cluj', 'cluj-centru', 'cluj-main', 'sm-cluj', 'smashme-cluj'],
  ['cluj2', 'cluj-2', 'cj2', 'cj-2', 'smashme-cj2', 'smashme cj-2', 'cj-kiosk2', 'cluj-kiosk2'],
  ['sm-brasov', 'brasov', 'brasov-centru', 'rollmaster', 'rollmaster-brasov', 'rm-brasov'],
  ['smashme-constanta', 'constanta1', 'constanta', 'sm-constanta'],
];

function expandLocationTokens(val) {
  const norm = String(val || '').trim().toLowerCase();
  if (!norm) return new Set();
  const tokens = new Set([norm]);
  for (const group of KIOSK_LOCATION_GROUPS) {
    if (group.includes(norm)) {
      group.forEach(alias => tokens.add(alias));
    }
  }
  return tokens;
}

/**
 * Strict opt-in match:
 * A voucher MUST have at least one kiosk/location explicitly assigned in `locationIds`
 * to be visible or usable on any kiosk. Empty `locationIds` = disabled on all kiosks.
 */
function matchesKioskLocation(voucherLocationIds, locationId = '', kioskId = '') {
  if (!Array.isArray(voucherLocationIds) || voucherLocationIds.length === 0) {
    return false;
  }
  const incomingTokens = new Set([
    ...expandLocationTokens(locationId),
    ...expandLocationTokens(kioskId),
  ]);
  if (incomingTokens.size === 0) return false;

  return voucherLocationIds.some(lid => {
    const allowedTokens = expandLocationTokens(lid);
    for (const tok of allowedTokens) {
      if (incomingTokens.has(tok)) return true;
    }
    return false;
  });
}

const BRAND_GROUPS = [
  ['smashme', 'smash-me', 'smash me'],
  ['crunch'],
  ['rollmaster', 'roll-master', 'roll master', 'sushimaster', 'sushi-master', 'sushi master', 'ikura'],
  ['lovesushi', 'love-sushi', 'love sushi', 'welovesushi', 'we-love-sushi'],
  ['pokiwoki', 'poki-woki', 'poki woki'],
];

function expandBrandTokens(val) {
  const norm = String(val || '').trim().toLowerCase();
  if (!norm) return new Set();
  const compact = norm.replace(/[\s\-_]+/g, '');
  const tokens = new Set([norm, compact]);
  for (const group of BRAND_GROUPS) {
    if (group.includes(norm) || group.includes(compact)) {
      group.forEach(alias => tokens.add(alias));
    }
  }
  return tokens;
}

/**
 * Strict opt-in brand match:
 * A voucher MUST have at least one brand explicitly assigned in `brandIds`
 * to be visible or usable on any kiosk. Empty `brandIds` = disabled on all brands.
 */
function matchesBrand(voucherBrandIds, brandId = '', cartBrands = []) {
  if (!Array.isArray(voucherBrandIds) || voucherBrandIds.length === 0) {
    return false;
  }
  const incomingList = Array.isArray(cartBrands)
    ? cartBrands
    : String(cartBrands || '').split(',').map(s => s.trim()).filter(Boolean);
  const incomingTokens = new Set();
  expandBrandTokens(brandId).forEach(t => incomingTokens.add(t));
  incomingList.forEach(b => expandBrandTokens(b).forEach(t => incomingTokens.add(t)));
  if (incomingTokens.size === 0) return false;

  return voucherBrandIds.some(bid => {
    const allowedTokens = expandBrandTokens(bid);
    for (const tok of allowedTokens) {
      if (incomingTokens.has(tok)) return true;
    }
    return false;
  });
}

function loadVouchersFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.error('[VoucherService] Error reading vouchers.json:', e.message);
  }
  return [];
}

function saveVouchersToDisk(vouchers) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(vouchers, null, 2), 'utf8');
  } catch (e) {
    console.error('[VoucherService] Error writing vouchers.json:', e.message);
  }
}

let vouchersCache = loadVouchersFromDisk();
let dbReady = false;
let syncPromise = null;

async function syncWithDb() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    try {
      const { rows } = await pool.query(`SELECT * FROM vouchers ORDER BY created_at DESC`);
      if (rows.length > 0) {
        vouchersCache = rows.map(rowToVoucher);
        saveVouchersToDisk(vouchersCache);
        dbReady = true;
        console.log(`[VoucherService] Loaded ${vouchersCache.length} vouchers from PostgreSQL`);
        return vouchersCache;
      }

      // DB table is empty — migrate existing local vouchers (non-destructive)
      const localList = loadVouchersFromDisk();
      for (const v of localList) {
        await pool.query(
          `INSERT INTO vouchers (
             id, code, description, type, value, min_order_amount,
             max_discount_amount, max_uses, used_count, start_date, end_date,
             active, location_ids, brand_ids, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (id) DO NOTHING`,
          [
            v.id,
            String(v.code || '').trim().toUpperCase(),
            v.description || '',
            v.type === 'fixed' ? 'fixed' : 'percentage',
            Number(v.value) || 0,
            Number(v.minOrderAmount) || 0,
            v.maxDiscountAmount !== null && v.maxDiscountAmount !== undefined ? Number(v.maxDiscountAmount) : null,
            v.maxUses ? parseInt(v.maxUses, 10) : null,
            parseInt(v.usedCount, 10) || 0,
            v.startDate || null,
            v.endDate || null,
            v.active !== undefined ? Boolean(v.active) : true,
            JSON.stringify(Array.isArray(v.locationIds) ? v.locationIds : []),
            JSON.stringify(Array.isArray(v.brandIds) ? v.brandIds : []),
            v.createdAt || new Date().toISOString()
          ]
        ).catch(() => {});
      }
      const seeded = await pool.query(`SELECT * FROM vouchers ORDER BY created_at DESC`);
      vouchersCache = seeded.rows.map(rowToVoucher);
      saveVouchersToDisk(vouchersCache);
      dbReady = true;
      console.log(`[VoucherService] Synced ${vouchersCache.length} initial vouchers to PostgreSQL`);
      return vouchersCache;
    } catch (err) {
      dbReady = false;
      console.warn('[VoucherService] PostgreSQL unavailable — using local JSON cache:', err.message);
      return vouchersCache;
    } finally {
      syncPromise = null;
    }
  })();
  return syncPromise;
}

async function ensureSynced() {
  if (!dbReady && process.env.DATABASE_URL) {
    await syncWithDb();
  }
}

async function getAllVouchers() {
  await ensureSynced();
  if (dbReady) {
    try {
      const { rows } = await pool.query(`SELECT * FROM vouchers ORDER BY created_at DESC`);
      vouchersCache = rows.map(rowToVoucher);
      saveVouchersToDisk(vouchersCache);
      return vouchersCache;
    } catch (err) {
      console.warn('[VoucherService] DB read fallback to cache:', err.message);
    }
  }
  return vouchersCache;
}

async function getVoucherById(id) {
  await ensureSynced();
  if (dbReady) {
    try {
      const { rows } = await pool.query(`SELECT * FROM vouchers WHERE id = $1 LIMIT 1`, [id]);
      if (rows.length > 0) return rowToVoucher(rows[0]);
      return null;
    } catch (_) {}
  }
  return vouchersCache.find(v => v.id === id) || null;
}

async function getVoucherByCode(code) {
  if (!code) return null;
  await ensureSynced();
  const cleanCode = String(code).trim().toUpperCase();
  if (dbReady) {
    try {
      const { rows } = await pool.query(`SELECT * FROM vouchers WHERE UPPER(code) = $1 LIMIT 1`, [cleanCode]);
      if (rows.length > 0) return rowToVoucher(rows[0]);
      return null;
    } catch (_) {}
  }
  return vouchersCache.find(v => String(v.code).trim().toUpperCase() === cleanCode) || null;
}

async function createVoucher(data) {
  await ensureSynced();
  const cleanCode = String(data.code || '').trim().toUpperCase();
  if (!cleanCode) throw new Error('Codul promoțional este obligatoriu.');

  const existing = await getVoucherByCode(cleanCode);
  if (existing) throw new Error(`Codul promoțional "${cleanCode}" există deja.`);

  const newVoucher = {
    id: `vch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    code: cleanCode,
    description: String(data.description || '').trim(),
    type: data.type === 'fixed' ? 'fixed' : 'percentage',
    value: Math.max(0, Number(data.value) || 0),
    minOrderAmount: Math.max(0, Number(data.minOrderAmount) || 0),
    maxDiscountAmount: data.maxDiscountAmount ? Math.max(0, Number(data.maxDiscountAmount)) : null,
    maxUses: data.maxUses ? Math.max(1, parseInt(data.maxUses, 10)) : null,
    usedCount: 0,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    active: data.active !== undefined ? Boolean(data.active) : true,
    locationIds: Array.isArray(data.locationIds) ? data.locationIds : [],
    brandIds: Array.isArray(data.brandIds) ? data.brandIds.map(b => String(b).trim().toLowerCase()).filter(Boolean) : [],
    createdAt: new Date().toISOString()
  };

  if (dbReady) {
    const { rows } = await pool.query(
      `INSERT INTO vouchers (
         id, code, description, type, value, min_order_amount,
         max_discount_amount, max_uses, used_count, start_date, end_date,
         active, location_ids, brand_ids, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12,$13,$14,NOW())
       RETURNING *`,
      [
        newVoucher.id,
        newVoucher.code,
        newVoucher.description,
        newVoucher.type,
        newVoucher.value,
        newVoucher.minOrderAmount,
        newVoucher.maxDiscountAmount,
        newVoucher.maxUses,
        newVoucher.startDate,
        newVoucher.endDate,
        newVoucher.active,
        JSON.stringify(newVoucher.locationIds),
        JSON.stringify(newVoucher.brandIds),
        newVoucher.createdAt
      ]
    );
    const saved = rowToVoucher(rows[0]);
    vouchersCache = [saved, ...vouchersCache.filter(v => v.id !== saved.id)];
    saveVouchersToDisk(vouchersCache);
    return saved;
  }

  vouchersCache.unshift(newVoucher);
  saveVouchersToDisk(vouchersCache);
  return newVoucher;
}

async function updateVoucher(id, data) {
  await ensureSynced();
  const current = await getVoucherById(id);
  if (!current) throw new Error('Codul promoțional nu a fost găsit.');

  let cleanCode = current.code;
  if (data.code) {
    cleanCode = String(data.code).trim().toUpperCase();
    const existing = await getVoucherByCode(cleanCode);
    if (existing && existing.id !== id) {
      throw new Error(`Un alt cod cu denumirea "${cleanCode}" există deja.`);
    }
  }

  const updated = {
    ...current,
    code: cleanCode,
    description: data.description !== undefined ? String(data.description).trim() : current.description,
    type: data.type ? (data.type === 'fixed' ? 'fixed' : 'percentage') : current.type,
    value: data.value !== undefined ? Math.max(0, Number(data.value) || 0) : current.value,
    minOrderAmount: data.minOrderAmount !== undefined ? Math.max(0, Number(data.minOrderAmount) || 0) : current.minOrderAmount,
    maxDiscountAmount: data.maxDiscountAmount !== undefined
      ? (data.maxDiscountAmount ? Math.max(0, Number(data.maxDiscountAmount)) : null)
      : current.maxDiscountAmount,
    maxUses: data.maxUses !== undefined
      ? (data.maxUses ? Math.max(1, parseInt(data.maxUses, 10)) : null)
      : current.maxUses,
    startDate: data.startDate !== undefined ? (data.startDate || null) : current.startDate,
    endDate: data.endDate !== undefined ? (data.endDate || null) : current.endDate,
    active: data.active !== undefined ? Boolean(data.active) : current.active,
    locationIds: data.locationIds !== undefined ? (Array.isArray(data.locationIds) ? data.locationIds : []) : current.locationIds,
    brandIds: data.brandIds !== undefined
      ? (Array.isArray(data.brandIds) ? data.brandIds.map(b => String(b).trim().toLowerCase()).filter(Boolean) : [])
      : (Array.isArray(current.brandIds) ? current.brandIds : []),
    updatedAt: new Date().toISOString()
  };

  if (dbReady) {
    const { rows } = await pool.query(
      `UPDATE vouchers SET
         code = $2,
         description = $3,
         type = $4,
         value = $5,
         min_order_amount = $6,
         max_discount_amount = $7,
         max_uses = $8,
         start_date = $9,
         end_date = $10,
         active = $11,
         location_ids = $12,
         brand_ids = $13,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        updated.code,
        updated.description,
        updated.type,
        updated.value,
        updated.minOrderAmount,
        updated.maxDiscountAmount,
        updated.maxUses,
        updated.startDate,
        updated.endDate,
        updated.active,
        JSON.stringify(updated.locationIds),
        JSON.stringify(updated.brandIds)
      ]
    );
    if (rows.length > 0) {
      const saved = rowToVoucher(rows[0]);
      vouchersCache = vouchersCache.map(v => (v.id === id ? saved : v));
      saveVouchersToDisk(vouchersCache);
      return saved;
    }
  }

  vouchersCache = vouchersCache.map(v => (v.id === id ? updated : v));
  saveVouchersToDisk(vouchersCache);
  return updated;
}

async function deleteVoucher(id) {
  await ensureSynced();
  let deleted = false;

  if (dbReady) {
    const res = await pool.query(`DELETE FROM vouchers WHERE id = $1`, [id]);
    deleted = res.rowCount > 0;
  }

  const initialLen = vouchersCache.length;
  vouchersCache = vouchersCache.filter(v => v.id !== id);
  if (vouchersCache.length !== initialLen) {
    deleted = true;
    saveVouchersToDisk(vouchersCache);
  }
  return deleted;
}

/**
 * Check whether at least one active, valid voucher is explicitly enabled for this kiosk AND brand.
 * Used by Kiosk CartScreen to hide the promo code button completely until enabled by Admin.
 */
async function hasActiveVouchersForKiosk({ locationId = '', kioskId = '', brandId = '', cartBrands = [] } = {}) {
  const all = await getAllVouchers();
  if (!all.length) return { hasActiveVouchers: false, count: 0 };

  const now = new Date();
  const eligible = all.filter(v => {
    if (!v || !v.active) return false;
    if (v.startDate && new Date(v.startDate) > now) return false;
    if (v.endDate && new Date(v.endDate) < now) return false;
    if (v.maxUses && (v.usedCount || 0) >= v.maxUses) return false;
    return matchesKioskLocation(v.locationIds, locationId, kioskId) &&
      matchesBrand(v.brandIds, brandId, cartBrands);
  });

  return {
    hasActiveVouchers: eligible.length > 0,
    count: eligible.length
  };
}

/**
 * Validate voucher for kiosk
 * @param {Object} params - { code, subtotal, locationId, kioskId, brandId, cartBrands }
 */
async function validateVoucher({ code, subtotal = 0, locationId = '', kioskId = '', brandId = '', cartBrands = [] }) {
  if (!code) {
    return { valid: false, error: 'Introduceți un cod promoțional.' };
  }

  const voucher = await getVoucherByCode(code);
  if (!voucher) {
    return { valid: false, error: 'Codul introdus nu este valid.' };
  }

  if (!voucher.active) {
    return { valid: false, error: 'Acest cod promoțional este inactiv.' };
  }

  const now = new Date();
  if (voucher.startDate && new Date(voucher.startDate) > now) {
    return { valid: false, error: 'Acest cod promoțional nu este încă activ.' };
  }

  if (voucher.endDate && new Date(voucher.endDate) < now) {
    return { valid: false, error: 'Acest cod promoțional a expirat.' };
  }

  if (voucher.maxUses && voucher.usedCount >= voucher.maxUses) {
    return { valid: false, error: 'Limita de utilizări pentru acest cod a fost atinsă.' };
  }

  // Strict opt-in kiosk check: voucher MUST be explicitly assigned to this kiosk/location
  if (!matchesKioskLocation(voucher.locationIds, locationId, kioskId)) {
    return { valid: false, error: 'Acest cod nu este valabil pe acest kiosk.' };
  }

  // Strict opt-in brand check: voucher MUST be explicitly assigned to the active/cart brand
  if (!matchesBrand(voucher.brandIds, brandId, cartBrands)) {
    return { valid: false, error: 'Acest cod nu este valabil pentru brandul selectat.' };
  }

  const orderSubtotal = Math.max(0, Number(subtotal) || 0);
  if (voucher.minOrderAmount && orderSubtotal < voucher.minOrderAmount) {
    return {
      valid: false,
      error: `Comandă minimă necesară: ${voucher.minOrderAmount.toFixed(2)} lei (lipsesc ${(voucher.minOrderAmount - orderSubtotal).toFixed(2)} lei).`
    };
  }

  let discountAmount = 0;
  if (voucher.type === 'percentage') {
    discountAmount = (orderSubtotal * voucher.value) / 100;
    if (voucher.maxDiscountAmount && discountAmount > voucher.maxDiscountAmount) {
      discountAmount = voucher.maxDiscountAmount;
    }
  } else {
    discountAmount = voucher.value;
  }

  discountAmount = Math.min(orderSubtotal, Math.round(discountAmount * 100) / 100);
  const finalTotal = Math.max(0, Math.round((orderSubtotal - discountAmount) * 100) / 100);

  return {
    valid: true,
    voucher: {
      id: voucher.id,
      code: voucher.code,
      description: voucher.description,
      type: voucher.type,
      value: voucher.value,
      discountAmount,
      finalTotal,
      minOrderAmount: voucher.minOrderAmount,
      maxDiscountAmount: voucher.maxDiscountAmount
    }
  };
}

/**
 * Record voucher usage atomically when an order is created
 */
async function recordVoucherUsage(code) {
  if (!code) return false;
  await ensureSynced();
  const cleanCode = String(code).trim().toUpperCase();

  if (dbReady) {
    try {
      const { rows } = await pool.query(
        `UPDATE vouchers SET used_count = used_count + 1, updated_at = NOW() WHERE UPPER(code) = $1 RETURNING *`,
        [cleanCode]
      );
      if (rows.length > 0) {
        const saved = rowToVoucher(rows[0]);
        vouchersCache = vouchersCache.map(v => (v.id === saved.id ? saved : v));
        saveVouchersToDisk(vouchersCache);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[VoucherService] DB usage increment fallback:', err.message);
    }
  }

  const voucher = vouchersCache.find(v => String(v.code).trim().toUpperCase() === cleanCode);
  if (voucher) {
    voucher.usedCount = (voucher.usedCount || 0) + 1;
    saveVouchersToDisk(vouchersCache);
    return true;
  }
  return false;
}

module.exports = {
  syncWithDb,
  getAllVouchers,
  getVoucherById,
  getVoucherByCode,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  hasActiveVouchersForKiosk,
  validateVoucher,
  recordVoucherUsage
};
