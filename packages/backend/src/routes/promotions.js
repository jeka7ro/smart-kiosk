const express = require('express');
const { pool } = require('../db');
const { protect } = require('../middleware/authMiddleware');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// ─── JSON Fallback Store ────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, '../../data/promotions.json');

function loadPromos() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch(e) { 
    console.error('[Promotions] Error reading promotions.json', e.message); 
  }
  
  // Seed initial (12 slices per brand) if file doesn't exist
  return createSeed();
}

function savePromos(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch(e) { 
    console.error('[Promotions] Error writing promotions.json', e.message); 
  }
}

function createSeed() {
  const getColors = () => ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f43f5e', '#14b8a6', '#d946ef'];
  
  const smashSlices = [
    { id: 'sm1', name: 'Burger Simplu', type: 'product', probability: 5 },
    { id: 'sm2', name: 'Mai încearcă altă dată', type: 'nada', probability: 15 },
    { id: 'sm3', name: 'Cartofi Prăjiți', type: 'product', probability: 10 },
    { id: 'sm4', name: 'Mai încearcă altă dată', type: 'nada', probability: 10 },
    { id: 'sm5', name: 'Cola Zero', type: 'product', probability: 10 },
    { id: 'sm6', name: 'Mai încearcă altă dată', type: 'nada', probability: 10 },
    { id: 'sm7', name: 'Sos de Usturoi', type: 'product', probability: 10 },
    { id: 'sm8', name: 'Mai încearcă altă dată', type: 'nada', probability: 10 },
    { id: 'sm9', name: 'SmashBurger', type: 'product', probability: 2 },
    { id: 'sm10', name: 'Mai încearcă altă dată', type: 'nada', probability: 8 },
    { id: 'sm11', name: 'Gogoașă', type: 'product', probability: 5 },
    { id: 'sm12', name: 'Mai încearcă altă dată', type: 'nada', probability: 5 }
  ];

  const sushiSlices = [
    { id: 'su1', name: 'Sushi Roll', type: 'product', probability: 5 },
    { id: 'su2', name: 'Mai încearcă altă dată', type: 'nada', probability: 10 },
    { id: 'su3', name: 'Sos Soia', type: 'product', probability: 10 },
    { id: 'su4', name: 'Mai încearcă altă dată', type: 'nada', probability: 10 },
    { id: 'su5', name: 'Orez', type: 'product', probability: 10 },
    { id: 'su6', name: 'Mai încearcă altă dată', type: 'nada', probability: 10 },
    { id: 'su7', name: 'Mochi', type: 'product', probability: 10 },
    { id: 'su8', name: 'Mai încearcă altă dată', type: 'nada', probability: 10 },
    { id: 'su9', name: 'Platou 30 Piese', type: 'product', probability: 2 },
    { id: 'su10', name: 'Mai încearcă altă dată', type: 'nada', probability: 8 },
    { id: 'su11', name: 'Edamame', type: 'product', probability: 5 },
    { id: 'su12', name: 'Mai încearcă altă dată', type: 'nada', probability: 10 }
  ];

  const colors = getColors();
  smashSlices.forEach((s, idx) => s.bg = colors[idx]);
  sushiSlices.forEach((s, idx) => s.bg = colors[11 - idx]);

  const initData = {
    smashme: { active: true, config: { title: 'Roata SmashMe', slices: smashSlices } },
    welovesushi: { active: true, config: { title: 'Roata WeLoveSushi', slices: sushiSlices } }
  };
  
  savePromos(initData);
  return initData;
}

// In-memory cache loaded once on startup
let promotionsCache = loadPromos();

// ─── ROUTES ─────────────────────────────────────────────────────────────

// GET /api/promotions (Admin)
// Fetches from DB if available, else from JSON
router.get('/', protect, async (req, res) => {
  try {
    try {
      const { rows } = await pool.query('SELECT brand_id, active, config FROM promotions');
      const result = {};
      rows.forEach(r => { result[r.brand_id] = { active: r.active, config: r.config }; });
      if (Object.keys(result).length > 0) return res.json(result);
    } catch(err) {
      console.warn('[Promotions] DB fetch failed, using JSON fallback:', err.message);
    }
    
    // Fallback if DB query failed or returned empty
    res.json(promotionsCache);
  } catch (err) {
    console.error('Error fetching promotions:', err);
    res.status(500).json({ error: 'Failed to fetch promotions', details: err.message });
  }
});

// PUT /api/promotions/:brandId (Admin)
// Saves to DB if available, AND saves to JSON
router.put('/:brandId', protect, async (req, res) => {
  const { brandId } = req.params;
  const { active, config } = req.body;

  try {
    let usedDb = false;
    try {
      await pool.query(`
        INSERT INTO promotions (brand_id, active, config)
        VALUES ($1, $2, $3)
        ON CONFLICT (brand_id) 
        DO UPDATE SET active = EXCLUDED.active, config = EXCLUDED.config, updated_at = NOW()
      `, [brandId, active, JSON.stringify(config)]);
      usedDb = true;
    } catch(err) {
      console.warn('[Promotions] DB save failed, falling back to JSON:', err.message);
    }

    // Always update JSON cache as fallback
    promotionsCache[brandId] = { active, config };
    savePromos(promotionsCache);

    res.json({ success: true, message: 'Promotions updated', db: usedDb });
  } catch (err) {
    console.error('Error saving promotion:', err);
    res.status(500).json({ error: 'Failed to save promotion', details: err.message });
  }
});

// GET /api/promotions/kiosk/:locationId (Public Kiosk)
// Routes based on location brands
router.get('/kiosk/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    let locBrands = [];
    
    // Attempt to load location brands from Postgres
    try {
      const locData = await pool.query('SELECT data FROM locations WHERE id = $1', [locationId]);
      if (locData.rows.length > 0) {
        locBrands = locData.rows[0].data.brands || [];
      }
    } catch(err) {
      // Fallback: try loading from local locations.json if exists
      try {
        const locFile = path.join(__dirname, '../../data/locations.json');
        if (fs.existsSync(locFile)) {
           const fileLocs = JSON.parse(fs.readFileSync(locFile, 'utf8'));
           const loc = fileLocs.find(l => l.id === locationId);
           if (loc && loc.brands) locBrands = loc.brands;
        }
      } catch(e){}
    }
    
    if (locBrands.length === 0) {
      // Ultimate fallback: assume it wants smashme if undefined
      locBrands = ['smashme'];
    }

    let allSlices = [];
    let combinedTitle = 'Roata Norocului';
    let available = false;

    // Load from DB or use JSON cache
    let dataMap = {};
    try {
      const { rows } = await pool.query('SELECT brand_id, active, config FROM promotions');
      rows.forEach(r => { dataMap[r.brand_id] = { active: r.active, config: r.config }; });
    } catch(err) {
      dataMap = promotionsCache;
    }
    
    if (Object.keys(dataMap).length === 0) {
       dataMap = promotionsCache;
    }

    locBrands.forEach(bId => {
      const promo = dataMap[bId];
      if (promo && promo.active && promo.config && promo.config.slices) {
        available = true;
        
        // Add slices tagged with brand
        const mappedSlices = promo.config.slices.map(s => ({
          ...s,
          brand_id: bId 
        }));
        
        allSlices = allSlices.concat(mappedSlices);
      }
    });

    if (!available || allSlices.length === 0) {
      return res.json({ available: false });
    }

    res.json({
      available: true,
      title: combinedTitle,
      slices: allSlices
    });

  } catch (err) {
    console.error('[Promotions] Kiosk route error:', err);
    res.status(500).json({ error: 'Failed to load kiosk promotions' });
  }
});

module.exports = router;
