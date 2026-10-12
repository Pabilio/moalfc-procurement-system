

const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production';
const TOKEN_EXPIRY = '7d';

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated. Log in and try again.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    delete user.password_hash;
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Log in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

const STAFF_ROLES = [
  'procurement_officer', 'supply_chain_officer', 'finance_officer',
  'internal_audit_officer', 'accounting_officer', 'admin',
];
const TENDER_MANAGER_ROLES = ['procurement_officer', 'admin'];

module.exports = { generateToken, requireAuth, requireRole, STAFF_ROLES, TENDER_MANAGER_ROLES, JWT_SECRET };
