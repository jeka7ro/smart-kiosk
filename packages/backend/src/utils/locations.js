/**
 * Centralized location & city detection — SINGLE SOURCE OF TRUTH
 *
 * Resolves any location identifier (UUID, kioskUrl, name, slug, partial alias)
 * to its proper location record, city key, order prefix, and aliases.
 */
const fs = require('fs');
const path = require('path');

const LOCATIONS_FILE = path.join(__dirname, '../../data/locations.json');

// City configuration: prefix, minimum starting number, static aliases
const CITY_CONFIG = {
  cluj: {
    city: 'cluj',
    cityName: 'Cluj-Napoca',
    prefix: 'CJ',
    minStart: 0,
    aliases: [
      'cluj', 'cluj1', 'cluj2', 'cluj-centru', 'cluj-main',
      'smashme-main', 'sm-cluj', 'smashme-cluj', 'cj',
      'smashme centru', 'sm cluj',
      // UUIDs from locations.json
      '9c63cff6-1d66-442d-a98d-2302656e3943', // SmashMe Centru (cluj1)
      '90296b11-9ba9-4279-a69b-1f84e193315e', // SM CLUJ
    ],
  },
  brasov: {
    city: 'brasov',
    cityName: 'Brașov',
    prefix: 'BV',
    minStart: 0, // continues from legacy sequence (~540+)
    aliases: [
      'brasov', 'brasov1', 'brasov2', 'brasov-centru',
      'sm-brasov', 'smashme-brasov', 'smashme-bv', 'bv',
      'sm brasov',
      // UUIDs from locations.json
      'adddb5a0-26e5-4d50-b472-1c74726c3f72', // SM BRASOV (sm-brasov)
    ],
  },
};

/**
 * Read all locations from data/locations.json
 */
function getAllLocations() {
  try {
    if (fs.existsSync(LOCATIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
      return Array.isArray(raw) ? raw : (raw.locations || []);
    }
  } catch (err) {
    console.warn('[Locations] Error reading locations.json:', err.message);
  }
  return [];
}

/**
 * Normalize string for comparison (lowercase, strip diacritics, trim)
 */
function normalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Find a location object by UUID, kioskUrl, name, or alias
 */
function findLocation(identifier) {
  if (!identifier) return null;
  const target = normalize(String(identifier));
  if (!target) return null;

  const locs = getAllLocations();

  // 1. Exact ID match (UUID)
  const byId = locs.find(l => l.id && normalize(l.id) === target);
  if (byId) return byId;

  // 2. Exact kioskUrl match
  const byKioskUrl = locs.find(l => l.kioskUrl && normalize(l.kioskUrl) === target);
  if (byKioskUrl) return byKioskUrl;

  // 3. Exact name match
  const byName = locs.find(l => l.name && normalize(l.name) === target);
  if (byName) return byName;

  // 4. Check city aliases to find corresponding location
  for (const [cityKey, cfg] of Object.entries(CITY_CONFIG)) {
    const matchesAlias = cfg.aliases.some(a => normalize(a) === target || target.startsWith(normalize(a)));
    if (matchesAlias) {
      const cityLoc = locs.find(l => {
        const normName = normalize(l.name);
        const normUrl = normalize(l.kioskUrl);
        return normName.includes(cityKey) || normUrl.includes(cityKey) || (l.id && cfg.aliases.includes(l.id));
      });
      if (cityLoc) return cityLoc;
    }
  }

  // 5. Partial name / kioskUrl match
  const partial = locs.find(l => {
    const n = normalize(l.name);
    const u = normalize(l.kioskUrl);
    return n.includes(target) || (u && u.includes(target)) || target.includes(n);
  });
  if (partial) return partial;

  return null;
}

/**
 * Detect which city a locationId or locationName belongs to.
 * Returns city key ('cluj', 'brasov', etc.) or null if unknown.
 */
function detectCity(locationId, locationName) {
  const normId = normalize(locationId);
  const normName = normalize(locationName);

  // 1. First test against known city configs
  for (const [cityKey, cfg] of Object.entries(CITY_CONFIG)) {
    // Check direct alias match
    if (normId && cfg.aliases.some(a => normalize(a) === normId || normId === normalize(a) || normId.startsWith(normalize(a)))) {
      return cityKey;
    }
    if (normName && cfg.aliases.some(a => normalize(a) === normName || normName.includes(normalize(a)))) {
      return cityKey;
    }
    // Check city keyword inside id or name
    if (normId && (normId.includes(cityKey) || normId.startsWith(cfg.prefix.toLowerCase()))) {
      return cityKey;
    }
    if (normName && normName.includes(cityKey)) {
      return cityKey;
    }
  }

  // 2. If id looks like UUID or unknown slug, look up location in locations.json
  const loc = findLocation(locationId) || (locationName ? findLocation(locationName) : null);
  if (loc) {
    const locNameNorm = normalize(loc.name);
    const locUrlNorm = normalize(loc.kioskUrl);
    for (const [cityKey, cfg] of Object.entries(CITY_CONFIG)) {
      if (locNameNorm.includes(cityKey) || locUrlNorm.includes(cityKey)) {
        return cityKey;
      }
      if (cfg.aliases.includes(loc.id) || (loc.kioskUrl && cfg.aliases.includes(loc.kioskUrl))) {
        return cityKey;
      }
    }
  }

  return null;
}

/**
 * Get order number prefix ('CJ', 'BV', etc.)
 */
function getOrderPrefix(locationId, locationName) {
  const city = detectCity(locationId, locationName);
  return city && CITY_CONFIG[city] ? CITY_CONFIG[city].prefix : null;
}

/**
 * Get all possible aliases for a given location or city.
 * Used for socket room joining and multi-alias matching.
 */
function getLocationAliases(identifier) {
  if (!identifier) return [];
  const target = normalize(String(identifier));
  const aliases = new Set([String(identifier)]);

  const city = detectCity(identifier);
  if (city && CITY_CONFIG[city]) {
    CITY_CONFIG[city].aliases.forEach(a => aliases.add(a));
  }

  const loc = findLocation(identifier);
  if (loc) {
    if (loc.id) aliases.add(loc.id);
    if (loc.kioskUrl) aliases.add(loc.kioskUrl);
    if (loc.name) aliases.add(loc.name);
  }

  return Array.from(aliases);
}

module.exports = {
  CITY_CONFIG,
  getAllLocations,
  findLocation,
  detectCity,
  getOrderPrefix,
  getLocationAliases,
};
