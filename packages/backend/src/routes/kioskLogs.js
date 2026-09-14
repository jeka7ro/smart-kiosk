/**
 * Kiosk Activity & Unlock Logs — API Route
 * POST /api/kiosk-logs — Record a new kiosk lock/unlock event
 * GET  /api/kiosk-logs — List kiosk activity logs
 */
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { pool } = require('../db');

const LOGS_FILE = path.join(__dirname, '../../data/kiosk_logs.json');
const hasDb = !!process.env.DATABASE_URL;

function readLogsFile() {
  try {
    if (!fs.existsSync(LOGS_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLogsFile(logs) {
  try {
    const dir = path.dirname(LOGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs.slice(0, 1000), null, 2));
  } catch (e) {
    console.error('[Kiosk Logs] JSON write error:', e.message);
  }
}

/**
 * POST /api/kiosk-logs
 * Record an event (unlock_manager, unlock_vendor, unlock_failed, auto_unlock, auto_lock)
 */
router.post('/', async (req, res) => {
  try {
    const { locationId, locationName, kioskId, eventType, role, details } = req.body;
    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    const log = {
      id: `KL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      location_id: locationId || '',
      location_name: locationName || '',
      kiosk_id: kioskId || '',
      event_type: eventType,
      role: role || (eventType === 'unlock_manager' ? 'manager' : eventType === 'unlock_vendor' ? 'vendor' : 'system'),
      details: typeof details === 'object' && details !== null ? details : { raw: details || '' }
    };

    if (hasDb) {
      try {
        await pool.query(
          `INSERT INTO kiosk_logs (id, timestamp, location_id, location_name, kiosk_id, event_type, role, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [log.id, log.timestamp, log.location_id, log.location_name, log.kiosk_id, log.event_type, log.role, JSON.stringify(log.details)]
        );
      } catch (dbErr) {
        console.warn('[Kiosk Logs] DB insert fallback to JSON:', dbErr.message);
        const fileLogs = readLogsFile();
        fileLogs.unshift(log);
        writeLogsFile(fileLogs);
      }
    } else {
      const fileLogs = readLogsFile();
      fileLogs.unshift(log);
      writeLogsFile(fileLogs);
    }

    // Broadcast via socket for real-time live admin view
    const io = req.app.get('io');
    if (io) {
      io.emit('kiosk_log_new', log);
    }

    return res.status(201).json(log);
  } catch (err) {
    console.error('[Kiosk Logs] Error recording log:', err.message);
    return res.status(500).json({ error: 'Failed to record kiosk log' });
  }
});

/**
 * GET /api/kiosk-logs
 * List logs with optional filtering by locationId and limit
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const locationId = (req.query.locationId || '').trim();
    const eventType = (req.query.eventType || '').trim();

    if (hasDb) {
      try {
        let query = 'SELECT * FROM kiosk_logs WHERE 1=1';
        const params = [];

        if (locationId && locationId !== 'all') {
          params.push(locationId);
          query += ` AND (location_id = $${params.length} OR location_name ILIKE '%' || $${params.length} || '%')`;
        }

        if (eventType && eventType !== 'all') {
          params.push(eventType);
          query += ` AND event_type = $${params.length}`;
        }

        params.push(limit);
        query += ` ORDER BY timestamp DESC LIMIT $${params.length}`;

        const { rows } = await pool.query(query, params);
        return res.json({ logs: rows });
      } catch (dbErr) {
        console.warn('[Kiosk Logs] DB query error, fallback to JSON:', dbErr.message);
      }
    }

    // JSON Fallback
    let logs = readLogsFile();
    if (locationId && locationId !== 'all') {
      logs = logs.filter(l => l.location_id === locationId || (l.location_name && l.location_name.toLowerCase().includes(locationId.toLowerCase())));
    }
    if (eventType && eventType !== 'all') {
      logs = logs.filter(l => l.event_type === eventType);
    }
    logs = logs.slice(0, limit);

    return res.json({ logs });
  } catch (err) {
    console.error('[Kiosk Logs] Error fetching logs:', err.message);
    return res.status(500).json({ error: 'Failed to fetch kiosk logs' });
  }
});

module.exports = router;
