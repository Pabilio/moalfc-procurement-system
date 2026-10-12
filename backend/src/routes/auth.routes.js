

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { business_name, full_name, email, phone, password } = req.body;
  if (!business_name || !full_name || !email || !phone || !password || password.length < 6) {
    return res.status(400).json({ error: 'Please fill in every field (password must be at least 6 characters).' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'An account with that email already exists.' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (role, full_name, email, phone, business_name, password_hash)
    VALUES ('supplier', ?, ?, ?, ?, ?)
  `).run(full_name, email, phone, business_name, password_hash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  delete user.password_hash;
  res.status(201).json({ token: generateToken(user), user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  delete user.password_hash;
  res.json({ token: generateToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
