const express = require('express');
const { pool } = require('../db');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * ---------------------------------------------------------
 * ADMIN ROUTES
 * ---------------------------------------------------------
 */

// Obține toate promoțiile (Admin)
router.get('/', protect, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT brand_id, active, config FROM promotions');
    // Transformăm într-un obiect { brandId: { active, config } }
    const result = {};
    for (const r of rows) {
      result[r.brand_id] = { active: r.active, config: r.config };
    }
    res.json(result);
  } catch (err) {
    console.error('Error fetching promotions:', err);
    res.status(500).json({ error: 'Failed to fetch promotions', details: err.message });
  }
});

// Creează sau actualizează o promoție per brand (Admin)
router.put('/:brandId', protect, async (req, res) => {
  const { brandId } = req.params;
  const { active, config } = req.body;

  try {
    await pool.query(
      `
      INSERT INTO promotions (brand_id, active, config, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (brand_id)
      DO UPDATE SET
        active = EXCLUDED.active,
        config = EXCLUDED.config,
        updated_at = NOW()
      `,
      [brandId, active || false, config || {}]
    );

    res.json({ success: true, message: 'Promotions updated' });
  } catch (err) {
    console.error('Error saving promotion:', err);
    res.status(500).json({ error: 'Failed to save promotion', details: err.message });
  }
});

/**
 * ---------------------------------------------------------
 * KIOSK ROUTES
 * ---------------------------------------------------------
 */

// Obține roata norocului pentru o locație specifică (Kiosk app)
// Mixează proporțional feliile tuturor brandurilor active de pe acea tabletă.
router.get('/kiosk/:locationId', async (req, res) => {
  const { locationId } = req.params;

  try {
    // 1. Aflăm brandurile alocate acestei locații care sunt active
    const { rows: locRows } = await pool.query('SELECT brands, active FROM locations WHERE id = $1', [locationId]);
    if (!locRows.length || !locRows[0].active) {
      return res.json({ available: false, slices: [] });
    }

    const locBrands = locRows[0].brands || []; // ex: ['smashme', 'welovesushi']
    if (locBrands.length === 0) {
      return res.json({ available: false, slices: [] });
    }

    // 2. Fetch promoțiile active doar pentru brandurile locației curente
    const params = locBrands.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT brand_id, config FROM promotions WHERE active = true AND brand_id IN (${params})`;
    const { rows: promoRows } = await pool.query(query, locBrands);

    if (!promoRows.length) {
      return res.json({ available: false, slices: [] });
    }

    // 3. Mix-ul de felii (Roata)
    // Colectăm feliile din toate brandurile.
    // Un config conține: { title: "Roata SmashMe", slices: [ {id, name, ...}, ... ] }
    let allSlices = [];

    promoRows.forEach(row => {
      const brandId = row.brand_id;
      let brandSlices = row.config?.slices || [];
      // Taguim fiecare slice cu brandul, ca sa stim din care provine
      brandSlices = brandSlices.map(s => ({ ...s, brand_id: brandId }));
      allSlices = allSlices.concat(brandSlices);
    });

    // Daca sunt mai multe branduri, ideal este ca feliile sa fie intercalate "ca o piesa de sah", dar pentru simplitate deocamdata doar le amestecam sau le punem ordonat.
    // Pentru a asigura ca roata vizuala arata un mixaj ok, putem s-o shuffle-uim sau sa o sortam round-robin.
    
    // Sortare Round-robin pentru distribuție uniformă:
    const byBrand = {};
    allSlices.forEach(s => {
      if (!byBrand[s.brand_id]) byBrand[s.brand_id] = [];
      byBrand[s.brand_id].push(s);
    });

    const finalSlices = [];
    const maxLen = Math.max(...Object.values(byBrand).map(arr => arr.length));
    for (let i = 0; i < maxLen; i++) {
      for (const brand of Object.keys(byBrand)) {
        if (byBrand[brand][i]) {
          finalSlices.push(byBrand[brand][i]);
        }
      }
    }

    res.json({
      available: true,
      slices: finalSlices,
      // Folosim titlul primei promovari gasite ca fallback global
      title: promoRows.length > 1 ? "Învârte Roata Norocului!" : (promoRows[0].config?.title || "Învârte Roata Norocului!")
    });

  } catch (err) {
    console.error('Error fetching kiosk promotions:', err);
    res.status(500).json({ error: 'Failed to fetch kiosk promotions' });
  }
});

module.exports = router;
