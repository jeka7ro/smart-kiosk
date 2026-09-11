const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
});
async function run() {
  const res = await pool.query("SELECT * FROM pos_logs WHERE order_id IN ('kiosk-1787326988516', 'kiosk-1787326939211') ORDER BY timestamp DESC LIMIT 5");
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run().catch(console.error);
