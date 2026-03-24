const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { protect } = require('../middleware/authMiddleware');
const { PROVIDERS } = require('../services/adapters/providers');
const axios = require('axios');

// ─── Helper: test connection per provider ────────────────────────────────────
async function testProviderConnection(provider, creds) {
  switch (provider) {
    case 'syrve': {
      // Try to authenticate with Syrve API
      const apiUrl = (creds.apiUrl || 'https://api-eu.syrve.com').replace(/\/$/, '');
      const res = await axios.post(`${apiUrl}/api/0/auth/login`, {
        login: creds.apiLogin,
        password: creds.apiPassword,
      }, { timeout: 8000 });
      if (res.data?.token) return { ok: true, detail: `Token obținut. Org: ${creds.orgId}` };
      throw new Error('Nu s-a obținut token de la Syrve');
    }
    case 'freya': {
      const apiUrl = (creds.baseUrl || '').replace(/\/$/, '');
      if (!apiUrl) throw new Error('Base URL lipsă');
      const res = await axios.post(`${apiUrl}/api/v1/auth/login`, {
        username: creds.username, password: creds.password,
      }, { timeout: 8000 });
      if (res.status === 200) return { ok: true, detail: 'Autentificare Freya reușită' };
      throw new Error('Răspuns neașteptat Freya');
    }
    case 'boogit': {
      if (!creds.apiKey) throw new Error('API Key lipsă');
      const res = await axios.get(`https://app.boogit.ro/api/v1/locations`, {
        headers: { Authorization: `Bearer ${creds.apiKey}` }, timeout: 8000,
      });
      if (res.status === 200) return { ok: true, detail: 'Conexiune boogiT validă' };
      throw new Error('Cheie API invalidă boogiT');
    }
    case 'ebriza': {
      if (!creds.username) throw new Error('Username lipsă');
      const res = await axios.post('https://app.ebriza.com/api/auth/login', {
        email: creds.username, password: creds.password,
      }, { timeout: 8000 });
      if (res.data?.token) return { ok: true, detail: 'Autentificare Ebriza reușită' };
      throw new Error('Credentiale Ebriza invalide');
    }
    case 'posnet': {
      const apiUrl = (creds.apiUrl || '').replace(/\/$/, '');
      if (!apiUrl || !creds.apiKey) throw new Error('API URL sau API Key lipsă');
      const res = await axios.get(`${apiUrl}/api/health`, {
        headers: { 'X-API-Key': creds.apiKey }, timeout: 8000,
      });
      if (res.status < 400) return { ok: true, detail: 'POSnet reachable' };
      throw new Error('POSnet API error');
    }
    case 'custom': {
      const baseUrl = (creds.baseUrl || '').replace(/\/$/, '');
      if (!baseUrl) throw new Error('Base URL lipsă');
      const headers = {};
      if (creds.apiKey) headers['Authorization'] = `Bearer ${creds.apiKey}`;
      if (creds.headersJson) {
        try { Object.assign(headers, JSON.parse(creds.headersJson)); } catch (_) {}
      }
      const res = await axios.get(baseUrl + (creds.menuPath || '/'), { headers, timeout: 8000 });
      if (res.status < 400) return { ok: true, detail: `HTTP ${res.status} — API accesibil` };
      throw new Error(`HTTP ${res.status}`);
    }
    default:
      throw new Error(`Provider necunoscut: ${provider}`);
  }
}

// ─── GET /api/integrations — list all ───────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, provider, brand_id, location_id, status, last_error, last_sync_at, created_at, updated_at FROM pos_integrations ORDER BY created_at DESC'
    );
    // Don't return credentials in list — security
    res.json({ integrations: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/integrations/:id — single (with credentials for edit) ──────────
router.get('/:id', protect, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pos_integrations WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Nu există' });
    res.json({ integration: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/integrations — create ────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  const { name, provider, credentials, brand_id, location_id } = req.body;
  if (!name || !provider) return res.status(400).json({ error: 'name și provider obligatorii' });
  if (!PROVIDERS[provider]) return res.status(400).json({ error: `Provider necunoscut: ${provider}` });
  try {
    const { rows } = await pool.query(
      `INSERT INTO pos_integrations (name, provider, credentials, brand_id, location_id, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW()) RETURNING *`,
      [name, provider, JSON.stringify(credentials || {}), brand_id || null, location_id || null]
    );
    res.json({ integration: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/integrations/:id — update ─────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  const { name, provider, credentials, brand_id, location_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE pos_integrations
       SET name=$1, provider=$2, credentials=$3, brand_id=$4, location_id=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [name, provider, JSON.stringify(credentials || {}), brand_id || null, location_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Nu există' });
    res.json({ integration: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/integrations/:id ───────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    await pool.query('DELETE FROM pos_integrations WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/integrations/:id/test — test connection ──────────────────────
router.post('/:id/test', protect, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pos_integrations WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Nu există' });
    const { provider, credentials } = rows[0];

    const result = await testProviderConnection(provider, credentials);

    // Update status to active
    await pool.query(
      `UPDATE pos_integrations SET status='active', last_error=NULL, updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ ok: true, detail: result.detail });
  } catch (e) {
    // Update status to error
    await pool.query(
      `UPDATE pos_integrations SET status='error', last_error=$1, updated_at=NOW() WHERE id=$2`,
      [e.message, req.params.id]
    );
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ─── POST /api/integrations/:id/sync — sync menu ────────────────────────────
router.post('/:id/sync', protect, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pos_integrations WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Nu există' });

    // For now: only Syrve has full sync implemented
    // Other providers: mark last_sync_at and return instructions
    const { provider } = rows[0];
    let detail = '';

    if (provider === 'syrve') {
      const { syncAllMenus } = require('../services/iikoService');
      await syncAllMenus();
      detail = 'Meniu Syrve sincronizat cu succes';
    } else {
      detail = `Sincronizare ${PROVIDERS[provider]?.label || provider} — în curând. Meniu actualizat manual din Admin.`;
    }

    await pool.query(
      `UPDATE pos_integrations SET last_sync_at=NOW(), status='active', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ ok: true, detail });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── GET /api/integrations/providers/list — provider metadata for UI ─────────
router.get('/providers/list', async (req, res) => {
  const list = Object.entries(PROVIDERS).map(([key, p]) => ({
    key,
    label: p.label,
    description: p.description,
    color: p.color,
    fields: p.fields,
  }));
  res.json({ providers: list });
});

// ─── POST /api/integrations/import-from-env — auto-import Syrve from env vars ─
router.post('/import-from-env', protect, async (req, res) => {
  try {
    const API_URL = process.env.SYRVE_API_URL || 'https://api-eu.syrve.live';
    const SYRVE_BRANDS = [
      { brandId: 'smashme',     apiKey: process.env.SYRVE_API_KEY,           orgId: (process.env.SYRVE_ORG_IDS || '').split(',')[0]?.trim() },
      { brandId: 'sushimaster', apiKey: process.env.SYRVE_API_KEY_SUSHI,     orgId: process.env.SYRVE_ORG_ID_SUSHI },
      { brandId: 'welovesushi', apiKey: process.env.SYRVE_API_KEY_SUSHI,     orgId: process.env.SYRVE_ORG_ID_WELOVESUSHI },
      { brandId: 'ikura',       apiKey: process.env.SYRVE_API_KEY_SUSHI,     orgId: process.env.SYRVE_ORG_ID_IKURA },
    ].filter(b => b.apiKey && b.orgId); // only configured brands

    let created = 0;
    let skipped = 0;
    for (const b of SYRVE_BRANDS) {
      const name = `${b.brandId.charAt(0).toUpperCase() + b.brandId.slice(1)} — Syrve`;
      const creds = JSON.stringify({ apiLogin: b.apiKey, orgId: b.orgId, apiUrl: API_URL });

      const { rowCount } = await pool.query(
        `INSERT INTO pos_integrations (name, provider, credentials, brand_id, status, updated_at)
         VALUES ($1, 'syrve', $2, $3, 'pending', NOW())
         ON CONFLICT DO NOTHING`,
        [name, creds, b.brandId]
      );
      rowCount > 0 ? created++ : skipped++;
    }
    res.json({ ok: true, created, skipped, total: SYRVE_BRANDS.length,
      detail: `${created} integrări Syrve importate, ${skipped} deja existente` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
