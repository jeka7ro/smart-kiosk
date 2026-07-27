/**
 * POS Transaction Logs — API Route
 * GET  /api/pos-logs         — List all POS transaction logs
 * GET  /api/pos-logs/stats   — Get stats summary
 */
const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const STORE_FILE = path.join(__dirname, '../../data/pos-logs.json');

function loadLogs() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    }
  } catch (e) { console.warn('[POS Logs] Could not load:', e.message); }
  return [];
}

function saveLogs(logs) {
  try {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(logs, null, 2));
  } catch (e) { console.warn('[POS Logs] Could not save:', e.message); }
}

// In-memory store
const _logs = loadLogs();
console.log(`[POS Logs] Loaded ${_logs.length} transaction logs from disk`);

/**
 * Add a new POS transaction log entry.
 * Called internally by the socket handler when a POS payment result arrives.
 */
function addPosLog(entry) {
  const log = {
    _id:          `POS-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    timestamp:    new Date().toISOString(),
    locationId:   entry.locationId || '',
    locationName: entry.locationName || '',
    orderId:      entry.orderId || '',
    amount:       entry.amount || 0,
    gateway:      entry.gateway || 'raiffeisen',
    // POS Result
    status:       entry.paid ? 'approved' : (entry.error === 'timeout' ? 'timeout' : 'declined'),
    paid:         !!entry.paid,
    responseCode: entry.responseCode || '',
    authCode:     entry.authCode || '',
    refNum:       entry.refNum || '',
    cardNo:       entry.cardNo || '',
    txDate:       entry.txDate || '',
    error:        entry.error || null,
    // iiko Status
    iikoSent:     entry.iikoSent || false,
    iikoOrderId:  entry.iikoOrderId || null,
    iikoError:    entry.iikoError || null,
    // Raw data
    raw:          entry.raw || null,
  };

  _logs.unshift(log);
  if (_logs.length > 1000) _logs.splice(1000); // Keep last 1000
  saveLogs(_logs);
  console.log(`[POS Logs] ✅ Saved: ${log.status} | ${log.locationId} | ${log.amount} RON | auth=${log.authCode}`);
  return log;
}

/**
 * Update iiko status for an existing POS log entry.
 */
function updateIikoStatus(orderId, iikoSent, iikoOrderId, iikoError) {
  const log = _logs.find(l => l.orderId === orderId);
  if (log) {
    log.iikoSent = iikoSent;
    log.iikoOrderId = iikoOrderId || null;
    log.iikoError = iikoError || null;
    saveLogs(_logs);
  }
}

// GET /api/pos-logs
router.get('/', (req, res) => {
  const { locationId, status, limit = 100, offset = 0 } = req.query;
  let filtered = _logs;
  
  if (locationId) filtered = filtered.filter(l => l.locationId === locationId);
  if (status) filtered = filtered.filter(l => l.status === status);
  
  const total = filtered.length;
  const logs = filtered.slice(Number(offset), Number(offset) + Number(limit));
  
  res.json({ logs, total });
});

// GET /api/pos-logs/stats
router.get('/stats', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = _logs.filter(l => l.timestamp.startsWith(today));
  
  res.json({
    total: _logs.length,
    today: todayLogs.length,
    todayApproved: todayLogs.filter(l => l.paid).length,
    todayDeclined: todayLogs.filter(l => !l.paid).length,
    todayRevenue: todayLogs.filter(l => l.paid).reduce((s, l) => s + (l.amount || 0), 0),
    todayIikoSent: todayLogs.filter(l => l.iikoSent).length,
    todayIikoFailed: todayLogs.filter(l => l.paid && !l.iikoSent).length,
  });
});

module.exports = router;
module.exports.addPosLog = addPosLog;
module.exports.updateIikoStatus = updateIikoStatus;
