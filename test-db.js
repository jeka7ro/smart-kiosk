require('dotenv').config({ path: './packages/backend/.env' });
const { pool } = require('./packages/backend/src/db');
async function run() {
  const res = await pool.query("SELECT raw FROM pos_logs ORDER BY timestamp DESC LIMIT 1");
  console.log(JSON.stringify(res.rows[0], null, 2));
  process.exit(0);
}
run();
