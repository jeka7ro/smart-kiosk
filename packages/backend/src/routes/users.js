const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Obține toți utilizatorii — doar admin
router.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, locations, active FROM users ORDER BY created_at ASC'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Creare utilizator — doar admin
router.post('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { email, password, role, name, locations } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Completarea câmpurilor email, password și rol este obligatorie.' });
    }

    const id = 'u_' + Date.now() + Math.random().toString(36).substr(2, 9);

    const { rows } = await pool.query(
      `INSERT INTO users (id, email, password, name, role, locations)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role, locations, active`,
      [id, email, password, name || '', role, JSON.stringify(locations || [])]
    );

    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Acest email există deja.' });
    res.status(500).json({ error: e.message });
  }
});

// Editare utilizator — doar admin
router.put('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, name, role, locations, active } = req.body;

    const { rows } = await pool.query(
      `UPDATE users SET
        email = COALESCE($1, email),
        password = COALESCE($2, password),
        name = COALESCE($3, name),
        role = COALESCE($4, role),
        locations = COALESCE($5, locations),
        active = COALESCE($6, active)
       WHERE id = $7
       RETURNING id, email, name, role, locations, active`,
      [email, password, name, role, locations ? JSON.stringify(locations) : null, active, id]
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ștergere utilizator — doar admin
router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'u-admin') {
      return res.status(400).json({ error: 'Nu poți șterge administratorul principal!' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
