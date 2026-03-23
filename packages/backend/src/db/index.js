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

  console.log('[DB] Tables initialized (Supabase/PostgreSQL)');
}

module.exports = { pool, initDb };
