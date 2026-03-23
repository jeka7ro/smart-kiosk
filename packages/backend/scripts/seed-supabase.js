/**
 * seed-supabase.js
 * Run once to import existing JSON data into Supabase.
 * Usage: DATABASE_URL="postgresql://..." node scripts/seed-supabase.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DATA = path.join(__dirname, '../data');

async function seed() {
  console.log('🌱 Starting seed into Supabase...');

  // ── Locations ──────────────────────────────────────────────────
  try {
    const raw = fs.readFileSync(path.join(DATA, 'locations.json'), 'utf8');
    const locations = JSON.parse(raw);
    for (const loc of locations) {
      const { id, active, ...data } = loc;
      await pool.query(
        `INSERT INTO locations (id, name, data, active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET data = $3, active = $4, updated_at = NOW()`,
        [id, loc.name || id, JSON.stringify(data), active !== false]
      );
      console.log(`  ✅ Location: ${loc.name} (${id})`);
    }
  } catch (e) {
    console.warn('  ⚠️  Could not seed locations:', e.message);
  }

  // ── Users ──────────────────────────────────────────────────────
  try {
    const raw = fs.readFileSync(path.join(DATA, 'users.json'), 'utf8');
    const users = JSON.parse(raw);
    for (const u of users) {
      await pool.query(
        `INSERT INTO users (id, email, password, name, role, locations, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (email) DO NOTHING`,
        [u.id, u.email, u.password, u.name || '', u.role || 'staff', JSON.stringify(u.locations || [])]
      );
      console.log(`  ✅ User: ${u.email} (${u.role})`);
    }
  } catch (e) {
    console.warn('  ⚠️  Could not seed users:', e.message);
  }

  // ── Kiosk Config ───────────────────────────────────────────────
  try {
    const raw = fs.readFileSync(path.join(DATA, 'kiosk-config.json'), 'utf8');
    const config = JSON.parse(raw);
    for (const [brandId, poster] of Object.entries(config.posters || {})) {
      await pool.query(
        `INSERT INTO kiosk_configs (brand_id, data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (brand_id) DO UPDATE SET data = $2, updated_at = NOW()`,
        [brandId, JSON.stringify(poster)]
      );
      console.log(`  ✅ Kiosk config: ${brandId}`);
    }
  } catch (e) {
    console.warn('  ⚠️  Could not seed kiosk-config:', e.message);
  }

  console.log('\n🎉 Seed complete! All data is now in Supabase.');
  await pool.end();
}

seed().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
});
