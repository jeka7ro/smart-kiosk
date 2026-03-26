const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function initDb() {
  // Quick connection test
  await pool.query('SELECT 1');

  // ─── Locations ────────────────────────────────────────────────────────────
  // Keeps all the flexible JSON fields (brands, orgIds, kiosks, screensaver, banners…)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS locations (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      data        JSONB NOT NULL DEFAULT '{}',
      active      BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ─── Kiosk Configs (screensaver / banners per brand) ─────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosk_configs (
      brand_id    TEXT PRIMARY KEY,
      data        JSONB NOT NULL DEFAULT '{}',
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ─── Promotions (Wheel of Fortune) ────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promotions (
      brand_id    TEXT PRIMARY KEY,
      active      BOOLEAN DEFAULT false,
      config      JSONB NOT NULL DEFAULT '{}',
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ─── Users ───────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      name        TEXT,
      role        TEXT DEFAULT 'staff',
      locations   JSONB DEFAULT '[]',
      active      BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ─── Orders ──────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id          TEXT PRIMARY KEY,
      location_id TEXT,
      data        JSONB NOT NULL DEFAULT '{}',
      status      TEXT DEFAULT 'pending',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS orders_location_idx ON orders(location_id);
    CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
    CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
  `);

  // ── Modifier Images (custom images for Syrve modifier options) ────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS modifier_images (
      modifier_id   TEXT PRIMARY KEY,   -- Syrve product UUID for the modifier option
      modifier_name TEXT,               -- Name at time of assignment (for display)
      brand_id      TEXT,               -- Which brand this modifier belongs to
      image_url     TEXT NOT NULL,      -- URL of the image (CDN or Supabase Storage)
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── POS Integrations (multi-provider: syrve / freya / boogit / ebriza / custom) ───
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pos_integrations (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      location_id   TEXT,
      name          TEXT NOT NULL,                -- display name e.g. "SmashMe Syrve"
      provider      TEXT NOT NULL,               -- syrve | freya | boogit | ebriza | custom
      credentials   JSONB NOT NULL DEFAULT '{}', -- provider-specific API credentials
      brand_id      TEXT,                         -- kiosk brand mapping
      status        TEXT    DEFAULT 'pending',    -- active | error | pending
      last_error    TEXT,
      last_sync_at  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Brands (editable brand metadata + logo) ───────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brands (
      id          TEXT PRIMARY KEY,       -- e.g. 'smashme', 'sushimaster'
      name        TEXT NOT NULL,
      description TEXT,
      website     TEXT,
      logo_url    TEXT,
      colors      JSONB NOT NULL DEFAULT '{}',  -- { primary, accent }
      data        JSONB NOT NULL DEFAULT '{}',
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    INSERT INTO brands (id, name) VALUES
      ('smashme', 'SmashMe'),
      ('sushimaster', 'Sushi Master'),
      ('ikura', 'Ikura'),
      ('welovesushi', 'WeLoveSushi')
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log('[DB] Tables initialized (Supabase/PostgreSQL)');
}

module.exports = { pool, initDb };
