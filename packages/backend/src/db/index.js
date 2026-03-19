const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query('SELECT 1'); // test connection

  // ─── Locations (multi-tenant) ────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS locations (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name         VARCHAR(200) NOT NULL,
      slug         VARCHAR(100) UNIQUE NOT NULL,
      address      TEXT,
      iiko_org_id  VARCHAR(100),
      pos_provider VARCHAR(20) DEFAULT 'VIVA' CHECK (pos_provider IN ('VIVA','RAIFFEISEN','MANUAL')),
      languages    TEXT[] DEFAULT ARRAY['ro','en'],
      tables_count INTEGER DEFAULT 20,
      vat_rate     DECIMAL(5,2) DEFAULT 9.00,
      active       BOOLEAN DEFAULT true,
      settings     JSONB DEFAULT '{}',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ─── Tables (mese) ───────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tables (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
      number      INTEGER NOT NULL,
      label       VARCHAR(50),
      qr_code_url TEXT,
      active      BOOLEAN DEFAULT true,
      UNIQUE(location_id, number)
    );
  `);

  // ─── Menu cache (din iiko) ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_cache (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id  UUID REFERENCES locations(id) ON DELETE CASCADE,
      iiko_org_id  VARCHAR(100),
      menu_data    JSONB NOT NULL,
      stop_list    JSONB DEFAULT '[]',
      synced_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(location_id)
    );
  `);

  // ─── Menu overrides (customizare locala) ─────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_overrides (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
      iiko_item_id VARCHAR(100) NOT NULL,
      custom_name  VARCHAR(200),
      custom_desc  TEXT,
      custom_image TEXT,
      hidden       BOOLEAN DEFAULT false,
      sort_order   INTEGER DEFAULT 0,
      UNIQUE(location_id, iiko_item_id)
    );
  `);

  // ─── Orders ──────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id     UUID REFERENCES locations(id),
      table_id        UUID REFERENCES tables(id),
      order_number    SERIAL,
      channel         VARCHAR(20) DEFAULT 'KIOSK' CHECK (channel IN ('KIOSK','QR','ONLINE')),
      status          VARCHAR(30) DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','PAID','SENT_TO_KITCHEN','IN_PROGRESS','READY','COMPLETED','CANCELLED')),
      items           JSONB NOT NULL,
      subtotal        DECIMAL(10,2) NOT NULL,
      vat_amount      DECIMAL(10,2) NOT NULL,
      total           DECIMAL(10,2) NOT NULL,
      customer_name   VARCHAR(200),
      customer_phone  VARCHAR(30),
      iiko_order_id   VARCHAR(100),
      payment_method  VARCHAR(30),
      payment_status  VARCHAR(20) DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PAID','REFUNDED')),
      payment_ref     VARCHAR(200),
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS orders_location_id_idx ON orders(location_id);
    CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
    CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
  `);

  // ─── Payment transactions ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id        UUID REFERENCES orders(id),
      provider        VARCHAR(20) CHECK (provider IN ('VIVA','RAIFFEISEN','CASH')),
      provider_ref    VARCHAR(200),
      amount          DECIMAL(10,2),
      currency        VARCHAR(3) DEFAULT 'RON',
      status          VARCHAR(20) DEFAULT 'PENDING',
      raw_response    JSONB,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ─── Admin users ─────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       VARCHAR(200) UNIQUE NOT NULL,
      password    VARCHAR(200) NOT NULL,
      name        VARCHAR(200),
      role        VARCHAR(20) DEFAULT 'LOCATION_ADMIN' CHECK (role IN ('SUPER_ADMIN','LOCATION_ADMIN')),
      location_ids UUID[],
      active      BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

module.exports = { pool, initDb };
