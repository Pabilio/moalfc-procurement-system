

const express = require('express');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin', 'internal_audit_officer'), (req, res) => {
  const entries = db.prepare(`
    SELECT al.*, u.full_name, u.role AS user_role, d.reference_no, d.document_name
    FROM document_access_log al
    JOIN users u ON u.id = al.user_id
    JOIN documents d ON d.id = al.document_id
    ORDER BY al.timestamp DESC LIMIT 300
  `).all();
  res.json({ entries });
});

module.exports = router;
