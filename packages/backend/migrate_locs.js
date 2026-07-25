const { Pool } = require('pg');
const fs = require('fs');

async function run() {
  const pool = new Pool({ connectionString: 'postgres://smartkiosk:UvUe8C8aWqUq8zWz@smart-kiosk-db.c0y6q2y2q2y2.eu-central-1.rds.amazonaws.com:5432/smartkiosk' });
  const raw = JSON.parse(fs.readFileSync('data/locations.json', 'utf8'));
  const locs = Array.isArray(raw) ? raw : (raw.locations || []);
  
  for (const loc of locs) {
    const id = loc.id;
    const existing = await pool.query('SELECT * FROM locations WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      console.log(`Inserting ${id} (${loc.name})...`);
      const active = loc.active !== false;
      await pool.query(
        `INSERT INTO locations (id, name, data, active) VALUES ($1, $2, $3, $4)`,
        [id, loc.name, JSON.stringify(loc), active]
      );
    } else {
      console.log(`Already exists: ${id}`);
    }
  }
  console.log('Done.');
  pool.end();
}
run();
