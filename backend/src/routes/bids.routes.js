

const express = require('express');
const db = require('../config/db');
const { requireAuth, requireRole, TENDER_MANAGER_ROLES } = require('../middleware/auth');
const notifications = require('../services/notification.service');

const router = express.Router();

router.post('/', requireAuth, requireRole('supplier'), (req, res) => {
  const { tender_id, amount, proposal } = req.body;
  const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(tender_id);
  if (!tender || tender.status !== 'open') {
    return res.status(400).json({ error: 'This tender is not open for bidding.' });
  }
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Enter a valid bid amount.' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO bids (tender_id, supplier_id, amount, proposal) VALUES (?, ?, ?, ?)
    `).run(tender_id, req.user.id, Number(amount), proposal || null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: 'You have already bid on this tender.' });
  }
});

router.post('/:id/award', requireAuth, requireRole(...TENDER_MANAGER_ROLES), (req, res) => {
  const winningBid = db.prepare('SELECT * FROM bids WHERE id = ?').get(req.params.id);
  if (!winningBid) return res.status(404).json({ error: 'Bid not found.' });

  const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(winningBid.tender_id);
  if (!tender || tender.status !== 'open') {
    return res.status(400).json({ error: 'This tender is no longer open.' });
  }

  db.prepare(`UPDATE tenders SET status = 'awarded', awarded_supplier_id = ? WHERE id = ?`)
    .run(winningBid.supplier_id, tender.id);
  db.prepare(`UPDATE bids SET status = 'awarded' WHERE id = ?`).run(winningBid.id);
  db.prepare(`UPDATE bids SET status = 'rejected' WHERE tender_id = ? AND id != ?`).run(tender.id, winningBid.id);

  notifications.notifyUserById(
    winningBid.supplier_id,
    `Congratulations -- your bid on "${tender.title}" (${tender.reference_no}) has been awarded. You may now submit delivery documents for this tender.`,
    null, 'Tender Awarded'
  );
  const losers = db.prepare('SELECT supplier_id FROM bids WHERE tender_id = ? AND id != ?').all(tender.id, winningBid.id);
  for (const l of losers) {
    notifications.notifyUserById(
      l.supplier_id,
      `Thank you for bidding on "${tender.title}" (${tender.reference_no}). Another supplier was selected on this occasion.`,
      null, 'Tender Outcome'
    );
  }

  res.json({ ok: true });
});

module.exports = router;
