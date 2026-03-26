const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TRANSLATIONS_FILE = path.join(__dirname, '../../data/product_translations.json');
const TARGET_LANGS = ['en', 'fr', 'hu', 'ru', 'bg', 'de', 'es', 'uk']; // everything except 'ro'

// Make sure directory exists
if (!fs.existsSync(path.dirname(TRANSLATIONS_FILE))) {
  fs.mkdirSync(path.dirname(TRANSLATIONS_FILE), { recursive: true });
}

function loadTranslations() {
  if (fs.existsSync(TRANSLATIONS_FILE)) {
    try { return JSON.parse(fs.readFileSync(TRANSLATIONS_FILE, 'utf8')); } catch { return {}; }
  }
  return {};
}

function saveTranslations(data) {
  try {
    fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Translator] Failed to save translations:', err.message);
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
  processNewTranslations
};
