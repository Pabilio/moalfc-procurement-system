

const express = require('express');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const notifications = db.prepare(`
    SELECT n.*, u.full_name, u.role AS user_role, d.reference_no
    FROM notifications n
    JOIN users u ON u.id = n.user_id
    LEFT JOIN documents d ON d.id = n.document_id
    ORDER BY n.sent_at DESC LIMIT 200
  `).all();
  res.json({ notifications });
});

module.exports = router;
