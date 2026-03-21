const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const USERS_FILE = path.join(__dirname, '../../data/users.json');

function getUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    // Fallback block for env admin if DB lacks admin
    if (email === (process.env.ADMIN_EMAIL || 'admin@kiosk.ro') &&
        password === (process.env.ADMIN_PASSWORD || 'admin123')) {
      const token = jwt.sign({ id: 'env-admin', email, role: 'admin', locations: [] }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '12h' });
      return res.json({ token, role: 'admin', user: { email, role: 'admin', name: 'Env Admin' } });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create JWT with user payload
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
});

module.exports = router;
