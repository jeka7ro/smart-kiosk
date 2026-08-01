const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM iiko_logs ORDER BY timestamp DESC LIMIT 500');
    
    // Map rows to camelCase for frontend
    const logs = rows.map(r => ({
      id: r.order_id, // For backward compatibility with frontend
      orderId: r.order_id,
      timestamp: r.timestamp,
      brandId: r.brand_id,
      status: r.status,
      payload: r.payload,
      response: r.response
    }));
    
    res.json(logs);
  } catch (err) {
    console.error('[IikoLogs] Error reading logs:', err.message);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

module.exports = router;
