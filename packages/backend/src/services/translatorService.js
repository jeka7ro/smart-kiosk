const fs = require('fs');
const path = require('path');
const axios = require('axios');

const { pool } = require('../db');

const TRANSLATIONS_FILE = path.join(__dirname, '../../data/product_translations.json');
const TARGET_LANGS = ['en', 'fr', 'hu', 'ru', 'bg', 'de', 'es', 'uk']; // everything except 'ro'

// Make sure directory exists
if (!fs.existsSync(path.dirname(TRANSLATIONS_FILE))) {
  fs.mkdirSync(path.dirname(TRANSLATIONS_FILE), { recursive: true });
}

let _memoryDict = null;

function loadTranslations() {
  if (_memoryDict && Object.keys(_memoryDict).length > 0) {
    return _memoryDict;
  }
  if (fs.existsSync(TRANSLATIONS_FILE)) {
    try {
      _memoryDict = JSON.parse(fs.readFileSync(TRANSLATIONS_FILE, 'utf8'));
      return _memoryDict;
    } catch {
      _memoryDict = {};
      return {};
    }
  }
  _memoryDict = {};
  return {};
}

function saveTranslations(data) {
  _memoryDict = data;
  try {
    fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Translator] Failed to save translations:', err.message);
  }
}

async function updateProductTranslation(productId, translations) {
  const dict = loadTranslations();
  if (!dict[productId]) {
    dict[productId] = { name: '', originalDescription: '', translations: {} };
  }
  dict[productId].translations = {
    ...dict[productId].translations,
    ...translations
  };
  saveTranslations(dict);

  if (process.env.DATABASE_URL) {
    try {
      await pool.query(`
        INSERT INTO product_translations (id, name, brand_id, category_id, original_description, translations, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET
          translations = EXCLUDED.translations,
          updated_at = NOW()
      `, [
        productId,
        dict[productId].name || '',
        dict[productId].brandId || '',
        dict[productId].categoryId || '',
        dict[productId].originalDescription || '',
        JSON.stringify(dict[productId].translations)
      ]);
    } catch (e) {
      console.error('[Translator] Failed to persist update to DB:', e.message);
    }
  }
  return dict[productId];
}

async function syncWithDb() {
  if (!process.env.DATABASE_URL) return;
  try {
    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int as count FROM product_translations');
    const dbCount = countRows[0]?.count || 0;
    const fileDict = loadTranslations();
    const entries = Object.entries(fileDict);
    const fileCount = entries.length;

    if (dbCount < fileCount && fileCount > 0) {
      console.log(`[Translator] Seeding ${fileCount} translations into PostgreSQL (db has ${dbCount})...`);
      const chunkSize = 50;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const valueStrings = [];
        const values = [];
        let paramIdx = 1;

        for (const [id, item] of chunk) {
          valueStrings.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}::jsonb, NOW())`);
          values.push(
            id,
            item.name || '',
            item.brandId || '',
            item.categoryId || '',
            item.originalDescription || '',
            JSON.stringify(item.translations || {})
          );
          paramIdx += 6;
        }

        const query = `
          INSERT INTO product_translations (id, name, brand_id, category_id, original_description, translations, updated_at)
          VALUES ${valueStrings.join(', ')}
          ON CONFLICT (id) DO UPDATE SET
            translations = CASE WHEN product_translations.translations = '{}'::jsonb THEN EXCLUDED.translations ELSE product_translations.translations END,
            name = COALESCE(NULLIF(product_translations.name, ''), EXCLUDED.name),
            brand_id = COALESCE(NULLIF(product_translations.brand_id, ''), EXCLUDED.brand_id),
            category_id = COALESCE(NULLIF(product_translations.category_id, ''), EXCLUDED.category_id),
            original_description = COALESCE(NULLIF(product_translations.original_description, ''), EXCLUDED.original_description)
        `;
        await pool.query(query, values);
      }
      console.log(`[Translator] Database seeded successfully (${fileCount} products).`);
    }

    // Load any existing DB rows into memory dictionary
    const { rows } = await pool.query('SELECT * FROM product_translations');
    if (rows && rows.length > 0) {
      for (const r of rows) {
        if (!_memoryDict[r.id]) {
          _memoryDict[r.id] = {
            name: r.name,
            brandId: r.brand_id,
            categoryId: r.category_id,
            originalDescription: r.original_description,
            translations: r.translations || {}
          };
        } else {
          _memoryDict[r.id].translations = {
            ..._memoryDict[r.id].translations,
            ...(r.translations || {})
          };
        }
      }
    }
  } catch (err) {
    console.error('[Translator] DB sync error:', err.message);
  }
}

async function translateText(text, targetLang) {
  if (!text || !text.trim()) return '';
  try {
    // Free Google Translate API endpoint (gtx)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ro&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url);
    const data = res.data;
    if (data && Array.isArray(data[0])) {
      return data[0].map(s => s[0]).join('');
    }
    return text;
  } catch (err) {
    console.error(`[Translator] Error translating to ${targetLang}:`, err.message);
    return text; // fallback to original
  }
}

/**
 * Iterates through the provided transformed products list and batch-translates
 * missing descriptions sequentially to avoid rate limiting.
 */
async function processNewTranslations(products) {
  const dict = loadTranslations();
  let hasUpdates = false;
  let translateCount = 0;

  for (const p of products) {
    if (!p.description || !p.description.trim()) {
      if (!dict[p.id]) {
        dict[p.id] = { name: p.name, brandId: p.brandId, categoryId: p.categoryId, originalDescription: p.description || '', translations: {} };
        hasUpdates = true;
      }
      continue;
    }
    
    if (!dict[p.id]) {
      dict[p.id] = { name: p.name, brandId: p.brandId, categoryId: p.categoryId, originalDescription: p.description, translations: {} };
      hasUpdates = true;
    }

    // Refresh metadata in case POS updated it
    dict[p.id].name = p.name;
    dict[p.id].brandId = p.brandId;
    dict[p.id].categoryId = p.categoryId;
    
    if (dict[p.id].originalDescription !== p.description) {
      console.log(`[Translator] Product ${p.id} description updated in POS, updating source...`);
      dict[p.id].originalDescription = p.description;
      hasUpdates = true;
    }
    
    let localUpdates = false;
    for (const lang of TARGET_LANGS) {
      if (!dict[p.id].translations[lang]) {
        console.log(`[Translator] Auto-translating [${lang}] for '${p.name}'...`);
        const translated = await translateText(p.description, lang);
        
        dict[p.id].translations[lang] = translated;
        hasUpdates = true;
        localUpdates = true;
        translateCount++;
        
        // Rate-limit throttle (delay 750ms)
        await new Promise(r => setTimeout(r, 750));
      }
    }
    
    // Save iteratively to avoid losing progress on large menus
    if (localUpdates && translateCount % 5 === 0) {
      saveTranslations(dict);
    }
  }

  if (hasUpdates) {
    console.log(`[Translator] Finished queue. Saved final translations to dictionary.`);
    saveTranslations(dict);
  }

  return dict;
}

module.exports = {
  TARGET_LANGS,
  loadTranslations,
  saveTranslations,
  processNewTranslations,
  syncWithDb,
  updateProductTranslation
};

