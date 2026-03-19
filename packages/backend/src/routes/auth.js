const express = require('express');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  // TODO: verify against DB with bcrypt
  if (email === (process.env.ADMIN_EMAIL || 'admin@kiosk.ro') &&
      password === (process.env.ADMIN_PASSWORD || 'admin123')) {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ email, role: 'super_admin' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' });
    return res.json({ token, role: 'super_admin' });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

module.exports = router;
