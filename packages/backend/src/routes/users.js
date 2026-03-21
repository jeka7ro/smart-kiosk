const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const USERS_FILE = path.join(__dirname, '../../data/users.json');

const getUsers = () => {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
};

const saveUsers = (data) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
};

// Obține toți utilizatorii — doar admin
router.get('/', protect, restrictTo('admin'), (req, res) => {
  res.json(getUsers());
});

// Creare utilizator — doar admin
router.post('/', protect, restrictTo('admin'), (req, res) => {
  const { email, password, role, name, locations } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Completarea câmpurilor email, password și rol este obligatorie.' });
  }

  const users = getUsers();
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Acest email există deja.' });
  }

  const newUser = {
    id: 'u_' + Date.now() + Math.random().toString(36).substr(2, 9),
    email,
    password,
    role,
    name: name || '',
    locations: locations || []
  };

  users.push(newUser);
  saveUsers(users);
  res.json(newUser);
});

// Editare utilizator — doar admin
router.put('/:id', protect, restrictTo('admin'), (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const users = getUsers();
  
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  // Păstrăm id original
  users[index] = { ...users[index], ...updates, id };
  saveUsers(users);
  
  res.json(users[index]);
});

// Ștergere utilizator — doar admin
router.delete('/:id', protect, restrictTo('admin'), (req, res) => {
  const { id } = req.params;
  const users = getUsers();
  
  if (id === 'u-admin') {
    return res.status(400).json({ error: 'Nu poți șterge administratorul principal!' });
  }

  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) {
    return res.status(404).json({ error: 'User not found' });
  }

  saveUsers(filtered);
  res.json({ success: true });
});

module.exports = router;
