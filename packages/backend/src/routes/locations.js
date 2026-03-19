const express = require('express');
const router = express.Router();

/**
 * Static location registry — each entry maps to one Syrve organization.
 * orgId = Syrve Organization ID (from startup logs or Syrve backoffice)
 * Set VITE_ORG_ID on each kiosk device to match one of these orgIds.
 */
const LOCATIONS = [
  // ── SmashMe ──────────────────────────────────────────────────────────────
  { id: 'smashme-main', name: 'SmashMe', brandId: 'smashme',
    orgId: '9c63cff6-1d66-442d-a98d-2302656e3943', active: true },

  // ── SushiMaster — all locations (org IDs from Syrve, discovered at startup)
  { id: 'sm-brasov',        name: 'SM Brașov',         brandId: 'sushimaster', orgId: 'adddb5a0-26e5-4d50-b472-1c74726c3f72', active: true },
  { id: 'sm-cluj',          name: 'SM Cluj',            brandId: 'sushimaster', orgId: '90296b11-9ba9-4279-a69b-1f84e193315e', active: true },
  { id: 'sm-buc-titan',     name: 'SM București Titan', brandId: 'sushimaster', orgId: '04062575-5a47-426b-9d35-9dc748f24139', active: true },
  { id: 'sm-buc-unirii',    name: 'SM București Unirii',brandId: 'sushimaster', orgId: '0a7c46eb-f8e1-43f8-bac2-f7c34239d185', active: true },
  { id: 'sm-buc-cora',      name: 'SM București Cora',  brandId: 'sushimaster', orgId: '6956213e-6f71-48ed-9431-44d020511190', active: true },
  { id: 'sm-buc-ceaikovski',name: 'SM București Ceaikovski', brandId: 'sushimaster', orgId: '742343d9-38c1-4712-add3-1035b6bd7637', active: true },
  { id: 'sm-pitesti',       name: 'SM Pitești',         brandId: 'sushimaster', orgId: 'f0454d67-586e-4a21-9fda-f0b0f6f601e9', active: true },
  { id: 'sm-sibiu',         name: 'SM Sibiu',           brandId: 'sushimaster', orgId: 'c45b986e-5297-47b7-b733-293bbc91da23', active: true },
  { id: 'sm-piatra-neamt',  name: 'SM Piatra Neamț',    brandId: 'sushimaster', orgId: 'c54de781-08e4-4226-bea8-28565ab2b3d0', active: true },
  { id: 'sm-targu-mures',   name: 'SM Târgu Mureș',     brandId: 'sushimaster', orgId: '958aefef-28b5-4f25-9f4d-97fb02d2bf9d', active: true },
  { id: 'sm-craiova',       name: 'SM Craiova',         brandId: 'sushimaster', orgId: 'a7f99f17-1ded-4f6f-8920-931ace99b3e0', active: true },
  { id: 'sm-iasi-1',        name: 'SM Iași #1',         brandId: 'sushimaster', orgId: '26bc7c2c-5113-4a18-a9e9-c1c84da4ba9f', active: true },
  { id: 'sm-iasi-2',        name: 'SM Iași #2',         brandId: 'sushimaster', orgId: '9f260bf3-b6d8-42db-b2f1-ee8bb01cc7aa', active: true },
  { id: 'sm-balotesti',     name: 'SM Balotești',       brandId: 'sushimaster', orgId: '264cb8e8-0dc9-46c3-b8f5-6a38f6c43fe9', active: true },
  { id: 'sm-suceava',       name: 'SM Suceava',         brandId: 'sushimaster', orgId: '502e619b-c6bf-47b9-8c93-75833c810deb', active: true },
  { id: 'sm-galati',        name: 'SM Galați',          brandId: 'sushimaster', orgId: '37512ec4-ce69-4ce7-91f8-76d7a4216091', active: true },
  { id: 'sm-constanta',     name: 'SM Constanța',       brandId: 'sushimaster', orgId: '8ed15b53-e788-411b-8a06-96d0f9ee005a', active: true },
  { id: 'sm-botosani',      name: 'SM Botoșani',        brandId: 'sushimaster', orgId: 'f6c77b52-5bf8-4808-b4e4-e7fbfa1a2805', active: true },
  { id: 'sm-braila',        name: 'SM Brăila',          brandId: 'sushimaster', orgId: 'effc9518-ceef-4eec-8ad5-9b48ae84c540', active: true },
  { id: 'sm-bacau',         name: 'SM Bacău',           brandId: 'sushimaster', orgId: 'd0ca9d11-a38e-48e1-ae02-54ce627f8419', active: true },
  { id: 'sm-timisoara',     name: 'SM Timișoara',       brandId: 'sushimaster', orgId: 'f5cb901f-bff1-4b6a-b3a0-8d5b7b3cd5e3', active: true },
  { id: 'sm-oradea',        name: 'SM Oradea',          brandId: 'sushimaster', orgId: 'f4742901-905f-4b4c-86ea-ce85dc09a041', active: true },
  { id: 'sm-tulcea',        name: 'SM Tulcea',          brandId: 'sushimaster', orgId: '5989edaa-038d-4407-8d98-be180b5b5b65', active: true },

  // ── Ikura ──────────────────────────────────────────────────────────────---
  { id: 'ikura-oradea', name: 'Ikura Oradea', brandId: 'ikura',
    orgId: 'd1cb5d9d-6aeb-4b0c-adf9-5ce8648ce4e1', active: true },

  // ── WeLoveSushi — org IDs TBD (same Syrve account as SushiMaster?) ────────
  // { id: 'wls-xxx', name: 'WeLoveSushi ...', brandId: 'welovesushi', orgId: 'TBD', active: false },
];

// GET /api/locations — all locations (optionally filter by brand)
router.get('/', async (req, res) => {
  const { brandId } = req.query;
  const result = brandId
    ? LOCATIONS.filter(l => l.brandId === brandId)
    : LOCATIONS;
  res.json({ locations: result, total: result.length });
});

// GET /api/locations/by-org/:orgId — find location by Syrve org ID
router.get('/by-org/:orgId', async (req, res) => {
  const loc = LOCATIONS.find(l => l.orgId === req.params.orgId);
  if (!loc) return res.status(404).json({ error: 'Location not found for orgId' });
  res.json(loc);
});

// GET /api/locations/:id
router.get('/:id', async (req, res) => {
  const loc = LOCATIONS.find(l => l.id === req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });
  res.json(loc);
});

// POST /api/locations — add new location (runtime, not persisted)
router.post('/', async (req, res) => {
  res.status(201).json({ ...req.body, id: `loc-${Date.now()}` });
});

module.exports = router;
