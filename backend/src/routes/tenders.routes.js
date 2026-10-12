
const express = require('express');
const db = require('../config/db');
const { requireAuth, requireRole, TENDER_MANAGER_ROLES } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const tenders = db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM bids WHERE bids.tender_id = t.id) AS bid_count
    FROM tenders t ORDER BY t.created_at DESC
  `).all();
  res.json({ tenders });
});

router.post('/', requireAuth, requireRole(...TENDER_MANAGER_ROLES), (req, res) => {
  const { reference_no, title, category, description, closing_date, document_url } = req.body;
  if (!reference_no || !title || !description || !closing_date) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO tenders (reference_no, title, description, category, closing_date, document_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(reference_no, title, description, category || null, closing_date, document_url || null, req.user.id);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: 'A tender with that reference number already exists.' });
  }
});

router.get('/:id', requireAuth, (req, res) => {
  const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
  if (!tender) return res.status(404).json({ error: 'Tender not found.' });

  const bids = db.prepare(`
    SELECT bids.*, u.business_name FROM bids JOIN users u ON u.id = bids.supplier_id
    WHERE tender_id = ? ORDER BY amount ASC
  `).all(req.params.id);

  // Suppliers only see their own bid amount, not competitors' -- staff see everything.
  const visibleBids = require('../middleware/auth').STAFF_ROLES.includes(req.user.role)
    ? bids
    : bids.filter((b) => b.supplier_id === req.user.id);

  res.json({ tender, bids: visibleBids });
});

module.exports = router;
