
const express = require('express');
const db = require('../config/db');
const { requireAuth, STAFF_ROLES } = require('../middleware/auth');
const workflow = require('../services/workflow.service');

const router = express.Router();

router.get('/stages', requireAuth, (req, res) => {
  res.json({ stages: workflow.getStages() });
});


router.get('/active', requireAuth, (req, res) => {
  if (!STAFF_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Staff only.' });
  workflow.checkAndNotifyEscalations();
  res.json({ documents: workflow.getAllActiveWithEscalation() });
});


router.get('/mine', requireAuth, (req, res) => {
  if (req.user.role !== 'supplier') return res.status(403).json({ error: 'Suppliers only.' });
  const docs = db.prepare('SELECT * FROM documents WHERE supplier_id = ? ORDER BY uploaded_at DESC').all(req.user.id);
  const withStatus = docs.map((d) => workflow.getDocumentStatus(d.id));
  res.json({ documents: withStatus });
});

router.post('/:documentId/advance', requireAuth, (req, res) => {
  if (!STAFF_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Staff only.' });
  const current = workflow.getCurrentStage(req.params.documentId);
  if (!current) return res.status(400).json({ error: 'This document has no active stage to advance.' });
  if (req.user.role !== 'admin' && req.user.role !== current.responsible_role) {
    return res.status(403).json({ error: `Only ${current.responsible_role.replace(/_/g, ' ')} (or admin) can advance this stage.` });
  }
  workflow.advanceStage(req.params.documentId, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
