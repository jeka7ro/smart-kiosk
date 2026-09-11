/**
 * Port Scans — API Route
 * GET  /api/port-scans — List all port scan results from bridge PCs
 */
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

/**
 * Save a port scan result from a bridge.
 */
async function addPortScan(entry) {
  const log = {
    id:            `SCAN-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    timestamp:     new Date().toISOString(),
    location_id:   entry.locationId || '',
    location_name: entry.locationName || '',
    hostname:      entry.hostname || '',
    os:            entry.os || '',
    pos_port:      entry.posPort || '',
    pos_gateway:   entry.posGateway || '',
    printer_name:  entry.printerName || '',
    baud_rate:     entry.baudRate || 9600,
    com_ports:     entry.comPorts || [],
    printers:      entry.printers || [],
  };

  try {
    await pool.query(
      `INSERT INTO port_scans (
        id, timestamp, location_id, location_name, hostname, os,
        pos_port, pos_gateway, printer_name, baud_rate, com_ports, printers
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        log.id, log.timestamp, log.location_id, log.location_name, log.hostname, log.os,
        log.pos_port, log.pos_gateway, log.printer_name, log.baud_rate,
        JSON.stringify(log.com_ports), JSON.stringify(log.printers)
      ]
    );
    console.log(`[Port Scan] ✅ Saved: ${log.location_id} | ${log.hostname} | ${log.com_ports.length} COM | ${log.printers.length} printers`);
  } catch (err) {
    console.error(`[Port Scan] ❌ Failed to save:`, err.message);
  }

  return {
    ...log,
    _id: log.id,
    locationId: log.location_id,
    locationName: log.location_name,
    posPort: log.pos_port,
    posGateway: log.pos_gateway,
    printerName: log.printer_name,
    baudRate: log.baud_rate,
    comPorts: log.com_ports,
  };
}

// GET /api/port-scans
router.get('/', async (req, res) => {
  const { locationId, limit = 100, offset = 0 } = req.query;

  try {
    let query = `SELECT * FROM port_scans WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) FROM port_scans WHERE 1=1`;
    const params = [];

    if (locationId) {
      query += ` AND location_id = $${params.length + 1}`;
      countQuery += ` AND location_id = $${params.length + 1}`;
      params.push(locationId);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(Number(limit));
    params.push(Number(offset));

    const { rows } = await pool.query(query, params);

    const scans = rows.map(r => ({
      _id: r.id,
      timestamp: r.timestamp,
      locationId: r.location_id,
      locationName: r.location_name,
      hostname: r.hostname,
      os: r.os,
      posPort: r.pos_port,
      posGateway: r.pos_gateway,
      printerName: r.printer_name,
      baudRate: r.baud_rate,
      comPorts: r.com_ports || [],
      printers: r.printers || [],
    }));

    res.json({ scans, total });
  } catch (err) {
    console.error('[Port Scans] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch port scans' });
  }
});

module.exports = router;
module.exports.addPortScan = addPortScan;
