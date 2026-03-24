/**
 * PROVIDER SCHEMAS — defines which fields are required per POS provider
 * and metadata for display in the Admin UI.
 */
const PROVIDERS = {
  syrve: {
    label: 'Syrve / iiko',
    description: 'Syrve POS (fostul iiko) — cel mai popular în HoReCa premium RO',
    color: '#7c3aed',
    fields: [
      { key: 'apiUrl',       label: 'API URL',         type: 'url',      placeholder: 'https://api-eu.syrve.com' },
      { key: 'apiLogin',     label: 'API Login',       type: 'text',     placeholder: 'username' },
      { key: 'apiPassword',  label: 'API Password',    type: 'password', placeholder: '••••••••' },
      { key: 'orgId',        label: 'Organization ID', type: 'text',     placeholder: 'uuid-org' },
      { key: 'brandId',      label: 'Brand ID (kiosk)',type: 'text',     placeholder: 'smashme' },
      { key: 'kioskApiKey',  label: 'Kiosk API Key',   type: 'password', placeholder: 'sk-...' },
    ],
  },
  freya: {
    label: 'Freya POS',
    description: '2.000+ restaurante în România — cel mai mare jucător local',
    color: '#f59e0b',
    fields: [
      { key: 'baseUrl',    label: 'Base URL',     type: 'url',      placeholder: 'https://api.freyapos.ro' },
      { key: 'username',   label: 'Username',     type: 'text',     placeholder: 'user@restaurant.ro' },
      { key: 'password',   label: 'Password',     type: 'password', placeholder: '••••••••' },
      { key: 'locationId', label: 'Location ID',  type: 'text',     placeholder: 'LOC-001' },
      { key: 'brandId',    label: 'Brand ID (kiosk)', type: 'text', placeholder: 'smashme' },
    ],
  },
  boogit: {
    label: 'boogiT POS',
    description: '900+ magazine, integrator nr. 1 Bolt/Wolt/Glovo în RO',
    color: '#10b981',
    fields: [
      { key: 'apiKey',     label: 'API Key',      type: 'password', placeholder: 'bgt-...' },
      { key: 'locationId', label: 'Location ID',  type: 'text',     placeholder: 'LOC-001' },
      { key: 'brandId',    label: 'Brand ID (kiosk)', type: 'text', placeholder: 'restaurant-slug' },
    ],
  },
  ebriza: {
    label: 'Ebriza',
    description: 'POS cloud HoReCa RO — flexibil, abonament lunar',
    color: '#3b82f6',
    fields: [
      { key: 'username',       label: 'Email / Username',   type: 'email',    placeholder: 'user@ebriza.com' },
      { key: 'password',       label: 'Password',           type: 'password', placeholder: '••••••••' },
      { key: 'organizationId', label: 'Organization ID',    type: 'text',     placeholder: 'org-uuid' },
      { key: 'brandId',        label: 'Brand ID (kiosk)',   type: 'text',     placeholder: 'smashme' },
    ],
  },
  posnet: {
    label: 'POSnet',
    description: 'Sute de clienți RO+EU, integrări Glovo/Wolt/Bolt/Saga',
    color: '#ef4444',
    fields: [
      { key: 'apiUrl',    label: 'API URL',          type: 'url',      placeholder: 'https://api.posnet.ro' },
      { key: 'apiKey',    label: 'API Key',          type: 'password', placeholder: 'pn-...' },
      { key: 'storeId',   label: 'Store ID',         type: 'text',     placeholder: 'STORE-001' },
      { key: 'brandId',   label: 'Brand ID (kiosk)', type: 'text',     placeholder: 'smashme' },
    ],
  },
  custom: {
    label: 'Custom REST API',
    description: 'Orice POS cu API REST — configurare manuală completă',
    color: '#6b7280',
    fields: [
      { key: 'baseUrl',     label: 'Base URL',          type: 'url',      placeholder: 'https://api.mypos.ro' },
      { key: 'apiKey',      label: 'API Key / Token',   type: 'password', placeholder: 'Bearer ...' },
      { key: 'menuPath',    label: 'Menu Endpoint',     type: 'text',     placeholder: '/api/menu' },
      { key: 'ordersPath',  label: 'Orders Endpoint',   type: 'text',     placeholder: '/api/orders' },
      { key: 'brandId',     label: 'Brand ID (kiosk)',  type: 'text',     placeholder: 'smashme' },
      { key: 'headersJson', label: 'Extra Headers (JSON)', type: 'textarea', placeholder: '{"X-Custom": "value"}' },
    ],
  },
};

module.exports = { PROVIDERS };
