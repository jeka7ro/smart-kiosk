/**
 * Printer Logs — API Route
 * GET  /api/printer-logs         — List all printer logs
 * GET  /api/printer-logs/stats   — Get stats summary
 */
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

/**
 * Add a new printer log entry.
 * Called internally by the socket handler when a print result arrives from bridge.
 */
async function addPrinterLog(entry) {
  const log = {
    id:             `PRT-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    timestamp:      new Date().toISOString(),
    location_id:    entry.locationId || '',
    location_name:  entry.locationName || '',
    brand:          entry.brand || '',
    kiosk_id:       entry.kioskId || '',
    order_id:       entry.orderId || '',
    order_number:   entry.orderNumber || '',
    status:         entry.status || 'unknown',
    error:          entry.error || null,
    printer_name:   entry.printerName || '',
    method:         entry.method || '',
    items_count:    entry.itemsCount || 0,
    total_amount:   entry.totalAmount || 0,
    payment_method: entry.paymentMethod || '',
    receipt_content: entry.receiptContent || null,
  };

  try {
    await pool.query(
      `INSERT INTO printer_logs (
        id, timestamp, location_id, location_name, brand, kiosk_id,
        order_id, order_number, status, error, printer_name, method,
        items_count, total_amount, payment_method, receipt_content
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        log.id, log.timestamp, log.location_id, log.location_name, log.brand, log.kiosk_id,
        log.order_id, log.order_number, log.status, log.error, log.printer_name, log.method,
        log.items_count, log.total_amount, log.payment_method, JSON.stringify(log.receipt_content)
      ]
    );
    console.log(`[Printer Logs] ✅ Saved: ${log.status} | ${log.location_id} | #${log.order_number} | ${log.printer_name}`);
  } catch (err) {
    console.error(`[Printer Logs] ❌ Failed to save log to DB:`, err.message);
  }

  return {
    ...log,
    _id: log.id,
    locationId: log.location_id,
    locationName: log.location_name,
    kioskId: log.kiosk_id,
    orderId: log.order_id,
    orderNumber: log.order_number,
    printerName: log.printer_name,
    paymentMethod: log.payment_method,
    itemsCount: log.items_count,
    totalAmount: log.total_amount,
    receiptContent: log.receipt_content,
  };
}

// GET /api/printer-logs
router.get('/', async (req, res) => {
  const { locationId, status, limit = 100, offset = 0 } = req.query;

  try {
    let query = `SELECT * FROM printer_logs WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) FROM printer_logs WHERE 1=1`;
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

    const logs = rows.map(r => ({
      _id: r.id,
      timestamp: r.timestamp,
      locationId: r.location_id,
      locationName: r.location_name,
      brand: r.brand,
      kioskId: r.kiosk_id,
      orderId: r.order_id,
      orderNumber: r.order_number,
      status: r.status,
      error: r.error,
      printerName: r.printer_name,
      method: r.method,
      itemsCount: r.items_count,
      totalAmount: parseFloat(r.total_amount) || 0,
      paymentMethod: r.payment_method,
      receiptContent: r.receipt_content,
    }));

    res.json({ logs, total });
  } catch (err) {
    console.error('[Printer Logs] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch printer logs' });
  }
});

// GET /api/printer-logs/stats
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as total_success,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as total_errors,
        COUNT(DISTINCT location_id) as total_locations
      FROM printer_logs
    `);

    const stats = rows[0];

    res.json({
      total: parseInt(stats.total_count, 10) || 0,
      totalSuccess: parseInt(stats.total_success, 10) || 0,
      totalErrors: parseInt(stats.total_errors, 10) || 0,
      totalLocations: parseInt(stats.total_locations, 10) || 0,
    });
  } catch (err) {
    console.error('[Printer Logs] GET stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
module.exports.addPrinterLog = addPrinterLog;
