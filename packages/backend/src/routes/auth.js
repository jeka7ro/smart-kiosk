const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check DB first
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND active = true',
      [email]
    );

    const user = rows.find(u => u.password === password);

    if (!user) {
      // Fallback to env admin (always works even if DB is empty)
      if (email === (process.env.ADMIN_EMAIL || 'admin@kiosk.ro') &&
          password === (process.env.ADMIN_PASSWORD || 'admin123')) {
        const token = jwt.sign(
          { id: 'env-admin', email, role: 'admin', locations: [] },
          process.env.JWT_SECRET || 'dev-secret',
          { expiresIn: '12h' }
        );
        return res.json({ token, role: 'admin', user: { email, role: 'admin', name: 'Admin' } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, locations: user.locations || [] },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      role: user.role,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, locations: user.locations || [] }
    });
  } catch (e) {
    console.error('[Auth] login error:', e.message);
    // If DB is down, fallback to env admin
    if (email === (process.env.ADMIN_EMAIL || 'admin@kiosk.ro') &&
        password === (process.env.ADMIN_PASSWORD || 'admin123')) {
      const token = jwt.sign(
        { id: 'env-admin', email, role: 'admin', locations: [] },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: '12h' }
      );
      return res.json({ token, role: 'admin', user: { email, role: 'admin', name: 'Admin' } });
    }
    return res.status(500).json({ error: 'Auth service unavailable' });
  }
});

module.exports = router;
