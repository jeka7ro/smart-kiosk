const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const IIKO_LOGS_FILE = path.join(__dirname, '../../data/iiko_logs.json');

router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(IIKO_LOGS_FILE)) {
      return res.json([]);
    }
    const logs = JSON.parse(fs.readFileSync(IIKO_LOGS_FILE, 'utf8'));
    res.json(logs);
  } catch (err) {
    console.error('[IikoLogs] Error reading logs:', err.message);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

module.exports = router;
