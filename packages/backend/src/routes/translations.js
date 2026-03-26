const express = require('express');
const router = express.Router();
const translator = require('../services/translatorService');
const { verifyAdmin } = require('../middleware/authMiddleware');

// GET all product translations
router.get('/', async (req, res) => {
  try {
    const dict = translator.loadTranslations();
    res.json(dict);
  } catch (error) {
    console.error('Failed to get translations:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST to update specific product translations (Admin only)
router.post('/update', verifyAdmin, async (req, res) => {
  try {
    const { productId, translations } = req.body;
    
    if (!productId || typeof translations !== 'object') {
      return res.status(400).json({ error: 'Invalid payload. Requires productId and translations object' });
    }

    const dict = translator.loadTranslations();
    
    if (!dict[productId]) {
      dict[productId] = { name: '', originalDescription: '', translations: {} };
    }
    
    // Merge updates
    dict[productId].translations = {
      ...dict[productId].translations,
      ...translations
    };

    translator.saveTranslations(dict);
    
    console.log(`[Admin] Manually updated translations for product ${productId}`);
    res.json({ success: true, productTranslations: dict[productId] });
  } catch (error) {
    console.error('Failed to update translations:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST to force auto-translation check manually (Admin only)
router.post('/auto-translate', verifyAdmin, async (req, res) => {
  try {
    // A bit hacky: To trigger auto-translate we normally pass products from Syrve.
    // If Admin triggers this, we might fetch the latest cache from iikoService.
    const iikoService = require('../services/iikoService');
    const orgs = iikoService.getAllCachedMenus();
    
    let allProducts = [];
    for (const key of Object.keys(orgs)) {
      if (orgs[key] && orgs[key].menu && orgs[key].menu.products) {
        allProducts = allProducts.concat(orgs[key].menu.products);
      }
    }

    // Deduplicate products by id
    const uniqueProducts = [];
    const seen = new Set();
    for (const p of allProducts) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        uniqueProducts.push(p);
      }
    }

    if (uniqueProducts.length === 0) {
      return res.status(400).json({ error: 'No products in cache. Please wait for Syrve sync.' });
    }

    // Run translator asynchronously so we don't block the request for 5 mins
    translator.processNewTranslations(uniqueProducts)
      .then(() => console.log('[Admin] Forced auto-translation check complete'))
      .catch(e => console.error('[Admin] Forced auto-translation error:', e.message));

    res.json({ success: true, message: 'Auto-translation job started on the background. Check logs.' });
  } catch (error) {
    console.error('Failed to force auto-translation:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
