

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/debug-users', (req, res) => {
  const users = db.prepare('SELECT id, email, role, full_name FROM users').all();
  res.json({ count: users.length, users });

});
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
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  console.log(`[LOGIN ATTEMPT] email: "${email}"`);

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
  if (!user) {
    console.log(`[LOGIN FAILED] User not found for email: "${email}"`);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    console.log(`[LOGIN FAILED] Password mismatch for user: "${email}"`);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  delete user.password_hash;
  res.json({ token: generateToken(user), user });
});


router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
