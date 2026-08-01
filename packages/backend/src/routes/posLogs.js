/**
 * POS Transaction Logs — API Route
 * GET  /api/pos-logs         — List all POS transaction logs
 * GET  /api/pos-logs/stats   — Get stats summary
 */
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

/**
 * Add a new POS transaction log entry.
 * Called internally by the socket handler when a POS payment result arrives.
 */
async function addPosLog(entry) {
  const log = {
    id:          `POS-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    timestamp:   new Date().toISOString(),
    location_id: entry.locationId || '',
    location_name: entry.locationName || '',
    order_id:    entry.orderId || '',
    amount:      entry.amount || 0,
    gateway:     entry.gateway || 'raiffeisen',
    status:      entry.paid ? 'approved' : (entry.error === 'timeout' ? 'timeout' : 'declined'),
    paid:        !!entry.paid,
    response_code: entry.responseCode || '',
    auth_code:   entry.authCode || '',
    ref_num:     entry.refNum || '',
    card_no:     entry.cardNo || '',
    tx_date:     entry.txDate || '',
    error:       entry.error || null,
    iiko_sent:   entry.iikoSent || false,
    iiko_order_id: entry.iikoOrderId || null,
    iiko_error:  entry.iikoError || null,
    raw:         entry.raw || null,
  };

  try {
    await pool.query(
      `INSERT INTO pos_logs (
        id, timestamp, location_id, location_name, order_id, amount, gateway, 
        status, paid, response_code, auth_code, ref_num, card_no, tx_date, 
        error, iiko_sent, iiko_order_id, iiko_error, raw
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        log.id, log.timestamp, log.location_id, log.location_name, log.order_id, log.amount, log.gateway,
        log.status, log.paid, log.response_code, log.auth_code, log.ref_num, log.card_no, log.tx_date,
        log.error, log.iiko_sent, log.iiko_order_id, log.iiko_error, JSON.stringify(log.raw)
      ]
    );
    console.log(`[POS Logs] ✅ Saved: ${log.status} | ${log.location_id} | ${log.amount} RON | auth=${log.auth_code}`);
  } catch (err) {
    console.error(`[POS Logs] ❌ Failed to save log to DB:`, err.message);
  }
  
  // Return in camelCase for backwards compatibility with any calling code
  return { ...log, _id: log.id, locationId: log.location_id, orderId: log.order_id };
}

/**
 * Update iiko status for an existing POS log entry.
 */
async function updateIikoStatus(orderId, iikoSent, iikoOrderId, iikoError) {
  try {
    await pool.query(
      `UPDATE pos_logs SET iiko_sent = $1, iiko_order_id = $2, iiko_error = $3 WHERE order_id = $4`,
      [iikoSent, iikoOrderId || null, iikoError || null, orderId]
    );
  } catch (err) {
    console.error(`[POS Logs] Failed to update iiko status in DB:`, err.message);
  }
}

/**
 * Update iiko status for an existing POS log entry using authCode.
 */
async function updateIikoStatusByAuthCode(authCode, iikoSent, iikoOrderId, iikoError) {
  if (!authCode) return;
  try {
    await pool.query(
      `UPDATE pos_logs SET iiko_sent = $1, iiko_order_id = $2, iiko_error = $3 WHERE auth_code = $4 AND paid = true`,
      [iikoSent, iikoOrderId || null, iikoError || null, authCode]
    );
  } catch (err) {
    console.error(`[POS Logs] Failed to update iiko status by auth code in DB:`, err.message);
  }
}

// GET /api/pos-logs
router.get('/', async (req, res) => {
  const { locationId, status, limit = 100, offset = 0 } = req.query;
  
  try {
    let query = `SELECT * FROM pos_logs WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) FROM pos_logs WHERE 1=1`;
    const params = [];
    
    if (locationId) {
      query += ` AND location_id = $${params.length + 1}`;
      countQuery += ` AND location_id = $${params.length + 1}`;
      params.push(locationId);
    }
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      countQuery += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);
    
    params.push(Number(limit));
    params.push(Number(offset));
    
    const { rows } = await pool.query(query, params);
    
    // Map rows back to camelCase for frontend compatibility
    const logs = rows.map(r => ({
      _id: r.id,
      timestamp: r.timestamp,
      locationId: r.location_id,
      locationName: r.location_name,
      orderId: r.order_id,
      amount: r.amount,
      gateway: r.gateway,
      status: r.status,
      paid: r.paid,
      responseCode: r.response_code,
      authCode: r.auth_code,
      refNum: r.ref_num,
      cardNo: r.card_no,
      txDate: r.tx_date,
      error: r.error,
      iikoSent: r.iiko_sent,
      iikoOrderId: r.iiko_order_id,
      iikoError: r.iiko_error,
      raw: r.raw
    }));
    
    res.json({ logs, total });
  } catch (err) {
    console.error('[POS Logs] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/pos-logs/stats
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    const { rows: totalRows } = await pool.query(`SELECT COUNT(*) FROM pos_logs`);
    const total = parseInt(totalRows[0].count, 10);
    
    const { rows: todayRows } = await pool.query(`
      SELECT 
        COUNT(*) as today_count,
        COUNT(CASE WHEN paid = true THEN 1 END) as today_approved,
        COUNT(CASE WHEN paid = false THEN 1 END) as today_declined,
        SUM(CASE WHEN paid = true THEN amount ELSE 0 END) as today_revenue,
        COUNT(CASE WHEN iiko_sent = true THEN 1 END) as today_iiko_sent,
        COUNT(CASE WHEN paid = true AND (iiko_sent = false OR iiko_sent IS NULL) THEN 1 END) as today_iiko_failed
      FROM pos_logs 
      WHERE timestamp::text LIKE $1
    `, [`${today}%`]);
    
    const stats = todayRows[0];
    
    res.json({
      total: total,
      today: parseInt(stats.today_count, 10) || 0,
      todayApproved: parseInt(stats.today_approved, 10) || 0,
      todayDeclined: parseInt(stats.today_declined, 10) || 0,
      todayRevenue: parseFloat(stats.today_revenue) || 0,
      todayIikoSent: parseInt(stats.today_iiko_sent, 10) || 0,
      todayIikoFailed: parseInt(stats.today_iiko_failed, 10) || 0,
    });
  } catch (err) {
    console.error('[POS Logs] GET stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
module.exports.addPosLog = addPosLog;
module.exports.updateIikoStatus = updateIikoStatus;
module.exports.updateIikoStatusByAuthCode = updateIikoStatusByAuthCode;
