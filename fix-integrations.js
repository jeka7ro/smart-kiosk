const fs = require('fs');
const path = './packages/backend/src/routes/integrations.js';
let content = fs.readFileSync(path, 'utf8');

// Replace standard pool.query calls with JSON fallback logic in /api/integrations
const getIntegrationsStr = `router.get('/', protect, async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('no db');
    const { rows } = await pool.query(
      'SELECT id, name, provider, brand_id, location_id, status, last_error, last_sync_at, created_at, updated_at FROM pos_integrations ORDER BY created_at DESC'
    );
    res.json({ integrations: rows });
  } catch (e) {
    const fs = require('fs');
    const dbPath = require('path').join(__dirname, '../../data/integrations.json');
    let locs = [];
    if (fs.existsSync(dbPath)) {
      locs = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
    res.json({ integrations: locs });
  }
});`;

const getSingleStr = `router.get('/:id', protect, async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('no db');
    const { rows } = await pool.query('SELECT * FROM pos_integrations WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Nu există' });
    res.json({ integration: rows[0] });
  } catch (e) {
    const fs = require('fs');
    const dbPath = require('path').join(__dirname, '../../data/integrations.json');
    if (fs.existsSync(dbPath)) {
      const locs = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const found = locs.find(l => l.id == req.params.id);
      if (found) return res.json({ integration: found });
    }
    res.status(404).json({ error: 'Nu există' });
  }
});`;

const postStr = `router.post('/', protect, async (req, res) => {
  const { name, provider, credentials, brand_id, location_id } = req.body;
  if (!name || !provider) return res.status(400).json({ error: 'name și provider obligatorii' });
  if (!PROVIDERS[provider]) return res.status(400).json({ error: \`Provider necunoscut: \${provider}\` });
  try {
    if (!process.env.DATABASE_URL) throw new Error('no db');
    const { rows } = await pool.query(
      \`INSERT INTO pos_integrations (name, provider, credentials, brand_id, location_id, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW()) RETURNING *\`,
      [name, provider, JSON.stringify(credentials || {}), brand_id || null, location_id || null]
    );
    res.json({ integration: rows[0] });
  } catch (e) {
    const fs = require('fs');
    const dbPath = require('path').join(__dirname, '../../data/integrations.json');
    let locs = [];
    if (fs.existsSync(dbPath)) locs = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const newInt = {
      id: Date.now(), name, provider, credentials, brand_id: brand_id || null, location_id: location_id || null, status: 'pending', created_at: new Date().toISOString()
    };
    locs.push(newInt);
    fs.writeFileSync(dbPath, JSON.stringify(locs, null, 2));
    res.json({ integration: newInt });
  }
});`;

const putStr = `router.put('/:id', protect, async (req, res) => {
  const { name, provider, credentials, brand_id, location_id } = req.body;
  try {
    if (!process.env.DATABASE_URL) throw new Error('no db');
    const { rows } = await pool.query(
      \`UPDATE pos_integrations
       SET name=$1, provider=$2, credentials=$3, brand_id=$4, location_id=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *\`,
      [name, provider, JSON.stringify(credentials || {}), brand_id || null, location_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Nu există' });
    res.json({ integration: rows[0] });
  } catch (e) {
    const fs = require('fs');
    const dbPath = require('path').join(__dirname, '../../data/integrations.json');
    if (fs.existsSync(dbPath)) {
      let locs = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const idx = locs.findIndex(l => l.id == req.params.id);
      if (idx !== -1) {
        locs[idx] = { ...locs[idx], name, provider, credentials, brand_id, location_id, updated_at: new Date().toISOString() };
        fs.writeFileSync(dbPath, JSON.stringify(locs, null, 2));
        return res.json({ integration: locs[idx] });
      }
    }
    res.status(404).json({ error: 'Nu există' });
  }
});`;

const testStr = `router.post('/:id/test', protect, async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('no db');
    const { rows } = await pool.query('SELECT * FROM pos_integrations WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Nu există' });
    const { provider, credentials } = rows[0];

    const result = await testProviderConnection(provider, credentials);
    await pool.query(\`UPDATE pos_integrations SET status='active', last_error=NULL, updated_at=NOW() WHERE id=$1\`, [req.params.id]);
    res.json({ ok: true, detail: result.detail });
  } catch (e) {
    const fs = require('fs');
    const dbPath = require('path').join(__dirname, '../../data/integrations.json');
    if (fs.existsSync(dbPath)) {
      let locs = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const idx = locs.findIndex(l => l.id == req.params.id);
      if (idx !== -1) {
         try {
           const result = await testProviderConnection(locs[idx].provider, locs[idx].credentials);
           locs[idx].status = 'active'; locs[idx].last_error = null;
           fs.writeFileSync(dbPath, JSON.stringify(locs, null, 2));
           return res.json({ ok: true, detail: result.detail });
         } catch(err) {
           locs[idx].status = 'error'; locs[idx].last_error = err.message;
           fs.writeFileSync(dbPath, JSON.stringify(locs, null, 2));
           return res.status(400).json({ ok: false, error: err.message });
         }
      }
    }
    if (process.env.DATABASE_URL) {
      await pool.query(\`UPDATE pos_integrations SET status='error', last_error=$1, updated_at=NOW() WHERE id=$2\`, [e.message, req.params.id]).catch(()=>{});
    }
    res.status(400).json({ ok: false, error: e.message });
  }
});`;

const syncStr = `router.post('/:id/sync', protect, async (req, res) => {
  try {
    let integration;
    if (process.env.DATABASE_URL) {
      const { rows } = await pool.query('SELECT * FROM pos_integrations WHERE id = $1', [req.params.id]);
      if (rows[0]) integration = rows[0];
    } else {
      const fs = require('fs');
      const dbPath = require('path').join(__dirname, '../../data/integrations.json');
      if (fs.existsSync(dbPath)) {
        const locs = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        integration = locs.find(l => l.id == req.params.id);
      }
    }
    if (!integration) return res.status(404).json({ error: 'Nu există' });
    
    let detail = '';
    if (integration.provider === 'syrve') {
      const { syncAllMenus } = require('../services/iikoService');
      await syncAllMenus();
      detail = 'Meniu Syrve sincronizat cu succes';
    } else {
      detail = 'Sincronizare ' + (PROVIDERS[integration.provider]?.label || integration.provider) + ' — în curând.';
    }

    if (process.env.DATABASE_URL) {
      await pool.query(\`UPDATE pos_integrations SET last_sync_at=NOW(), status='active', updated_at=NOW() WHERE id=$1\`, [req.params.id]);
    } else {
      const fs = require('fs');
      const dbPath = require('path').join(__dirname, '../../data/integrations.json');
      let locs = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const idx = locs.findIndex(l => l.id == req.params.id);
      if (idx !== -1) {
        locs[idx].last_sync_at = new Date().toISOString(); locs[idx].status = 'active';
        fs.writeFileSync(dbPath, JSON.stringify(locs, null, 2));
      }
    }
    res.json({ ok: true, detail });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});`;

const importEnvStr = `router.post('/import-from-env', protect, async (req, res) => {
  try {
    const API_URL = process.env.SYRVE_API_URL || 'https://api-eu.syrve.live';
    const SYRVE_BRANDS = [
      { brandId: 'smashme',     apiKey: process.env.SYRVE_API_KEY,           orgId: (process.env.SYRVE_ORG_IDS || '').split(',')[0]?.trim() },
      { brandId: 'rollmaster',  apiKey: process.env.SYRVE_API_KEY_SUSHI,     orgId: process.env.SYRVE_ORG_ID_SUSHI },
      { brandId: 'lovesushi',   apiKey: process.env.SYRVE_API_KEY_SUSHI,     orgId: process.env.SYRVE_ORG_ID_WELOVESUSHI },
      { brandId: 'pokiwoki',    apiKey: process.env.SYRVE_API_KEY_SUSHI,     orgId: process.env.SYRVE_ORG_ID_IKURA },
      { brandId: 'crunch',      apiKey: process.env.SYRVE_API_KEY,           orgId: (process.env.SYRVE_ORG_IDS || '').split(',')[0]?.trim() },
    ].filter(b => b.apiKey && b.orgId); 

    let created = 0; let skipped = 0;
    
    if (process.env.DATABASE_URL) {
      for (const b of SYRVE_BRANDS) {
        const name = \`\${b.brandId.charAt(0).toUpperCase() + b.brandId.slice(1)} — Syrve\`;
        const creds = JSON.stringify({ apiLogin: b.apiKey, orgId: b.orgId, apiUrl: API_URL });
        const { rowCount } = await pool.query(
          \`INSERT INTO pos_integrations (name, provider, credentials, brand_id, status, updated_at)
           VALUES ($1, 'syrve', $2, $3, 'pending', NOW()) ON CONFLICT DO NOTHING\`,
          [name, creds, b.brandId]
        );
        rowCount > 0 ? created++ : skipped++;
      }
    } else {
      const fs = require('fs');
      const dbPath = require('path').join(__dirname, '../../data/integrations.json');
      let locs = [];
      if (fs.existsSync(dbPath)) locs = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      for (const b of SYRVE_BRANDS) {
        if (!locs.find(l => l.brand_id === b.brandId)) {
           locs.push({ id: Date.now() + created, name: \`\${b.brandId} Syrve\`, provider: 'syrve', credentials: { apiLogin: b.apiKey, orgId: b.orgId, apiUrl: API_URL }, brand_id: b.brandId, status: 'pending', created_at: new Date().toISOString() });
           created++;
        } else skipped++;
      }
      fs.writeFileSync(dbPath, JSON.stringify(locs, null, 2));
    }
    res.json({ ok: true, created, skipped, total: SYRVE_BRANDS.length, detail: \`\${created} integrări importate, \${skipped} deja existente\` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});`;

const deleteStr = `router.delete('/:id', protect, async (req, res) => {
  try {
    if (process.env.DATABASE_URL) {
      await pool.query('DELETE FROM pos_integrations WHERE id = $1', [req.params.id]);
    } else {
      const fs = require('fs');
      const dbPath = require('path').join(__dirname, '../../data/integrations.json');
      if (fs.existsSync(dbPath)) {
        let locs = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        locs = locs.filter(l => l.id != req.params.id);
        fs.writeFileSync(dbPath, JSON.stringify(locs, null, 2));
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});`;

content = content.replace(/router\.get\('\/', protect, async \(req, res\) => \{[\s\S]*?\}\);/m, getIntegrationsStr);
content = content.replace(/router\.get\('\/:id', protect, async \(req, res\) => \{[\s\S]*?\}\);/m, getSingleStr);
content = content.replace(/router\.post\('\/', protect, async \(req, res\) => \{[\s\S]*?\}\);/m, postStr);
content = content.replace(/router\.put\('\/:id', protect, async \(req, res\) => \{[\s\S]*?\}\);/m, putStr);
content = content.replace(/router\.post\('\/:id\/test', protect, async \(req, res\) => \{[\s\S]*?\}\);/m, testStr);
content = content.replace(/router\.post\('\/:id\/sync', protect, async \(req, res\) => \{[\s\S]*?\}\);/m, syncStr);
content = content.replace(/router\.post\('\/import-from-env', protect, async \(req, res\) => \{[\s\S]*?\}\);/m, importEnvStr);
content = content.replace(/router\.delete\('\/:id', protect, async \(req, res\) => \{[\s\S]*?\}\);/m, deleteStr);

fs.writeFileSync(path, content);
console.log('Fixed integrations.js with JSON fallback!');
