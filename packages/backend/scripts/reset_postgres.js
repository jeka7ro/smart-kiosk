const { Pool } = require('pg');
const fs = require('fs');

async function run() {
  const pool = new Pool({ connectionString: 'postgresql://smart_kiosk:smart_password@localhost:5432/smart_kiosk' });
  try {
     const data = JSON.parse(fs.readFileSync('./packages/backend/data/promotions.json', 'utf8'));
     for (const brand of Object.keys(data)) {
        await pool.query(
          `INSERT INTO promotions (brand_id, active, config) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (brand_id) 
           DO UPDATE SET config = $3, active = $2`,
          [brand, true, data[brand].config]
        );
     }
     console.log('Postgres promotions updated with JSON hardcoded realistic data.');
  } catch(e) {
     console.error('Failed pg update', e);
  } finally {
     pool.end();
  }
}
run();
