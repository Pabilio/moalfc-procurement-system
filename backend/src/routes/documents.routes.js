

const express = require('express');
const fs = require('fs');
const db = require('../config/db');
const { requireAuth, STAFF_ROLES } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { hashFile, verifyIntegrity } = require('../utils/hash');
const workflow = require('../services/workflow.service');

const router = express.Router();

const DOC_TYPES = [
  'delivery_note', 'invoice', 'inspection_certificate', 'goods_received_note',
  'payment_voucher', 'company_registration', 'tax_compliance_certificate',
  'bid_proposal', 'other',
];

function canAccess(user, document) {
  if (STAFF_ROLES.includes(user.role)) return true;
  return user.role === 'supplier' && user.id === document.supplier_id;
}

router.get('/types', requireAuth, (req, res) => res.json({ types: DOC_TYPES }));

router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (req.user.role !== 'supplier') return res.status(403).json({ error: 'Suppliers only.' });
  const { doc_type, reference_no, document_name, tender_id } = req.body;
  if (!req.file || !doc_type || !reference_no || !document_name) {
    return res.status(400).json({ error: 'Please choose a file and fill in every field.' });
  }
  if (!DOC_TYPES.includes(doc_type)) return res.status(400).json({ error: 'Invalid document type.' });

  const sha256_hash = hashFile(req.file.path);
  const result = db.prepare(`
    INSERT INTO documents (supplier_id, tender_id, doc_type, reference_no, document_name, file_name, file_path, sha256_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, tender_id || null, doc_type, reference_no, document_name, req.file.originalname, req.file.path, sha256_hash);

  workflow.startWorkflow(result.lastInsertRowid);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.get('/:id', requireAuth, (req, res) => {
  const status = workflow.getDocumentStatus(req.params.id);
  if (!status) return res.status(404).json({ error: 'Document not found.' });
  if (!canAccess(req.user, status.document)) return res.status(403).json({ error: 'You do not have access to this document.' });

  workflow.checkAndNotifyEscalations();
  db.prepare(`INSERT INTO document_access_log (document_id, user_id, action) VALUES (?, ?, 'view')`).run(req.params.id, req.user.id);

  let accessLog = [];
  if (STAFF_ROLES.includes(req.user.role)) {
    accessLog = db.prepare(`
      SELECT al.*, u.full_name FROM document_access_log al JOIN users u ON u.id = al.user_id
      WHERE al.document_id = ? ORDER BY al.timestamp DESC LIMIT 20
    `).all(req.params.id);
  }

  res.json({ ...status, accessLog, stages: workflow.getStages() });
});

router.get('/:id/verify', requireAuth, (req, res) => {
  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  if (!canAccess(req.user, document)) return res.status(403).json({ error: 'You do not have access to this document.' });
  res.json(verifyIntegrity(document));
});

router.get('/:id/download', requireAuth, (req, res) => {
  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  if (!canAccess(req.user, document)) return res.status(403).json({ error: 'You do not have access to this document.' });
  if (!fs.existsSync(document.file_path)) return res.status(404).json({ error: 'File missing from disk.' });

  db.prepare(`INSERT INTO document_access_log (document_id, user_id, action) VALUES (?, ?, 'download')`).run(req.params.id, req.user.id);
  res.download(document.file_path, document.file_name);
});

router.post('/:id/supersede', requireAuth, upload.single('file'), (req, res) => {
  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  if (document.status !== 'active' || req.user.id !== document.supplier_id) {
    return res.status(403).json({ error: 'Only the owning supplier can correct an active document.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Please choose a corrected file.' });

  const sha256_hash = hashFile(req.file.path);
  const result = db.prepare(`
    INSERT INTO documents (supplier_id, tender_id, doc_type, reference_no, document_name, file_name, file_path, sha256_hash, supersedes_document_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(document.supplier_id, document.tender_id, document.doc_type, document.reference_no, document.document_name, req.file.originalname, req.file.path, sha256_hash, document.id);

  db.prepare(`UPDATE documents SET status = 'superseded' WHERE id = ?`).run(document.id);
  workflow.startWorkflow(result.lastInsertRowid);
  res.status(201).json({ id: result.lastInsertRowid });
});
// --- Staff <-> supplier messages on a document (queries, amendment requests) ---

router.get('/:id/messages', requireAuth, (req, res) => {
  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  if (!canAccess(req.user, document)) return res.status(403).json({ error: 'You do not have access to this document.' });

  const messages = db.prepare(`
    SELECT dm.*, u.full_name, u.role AS sender_role
    FROM document_messages dm JOIN users u ON u.id = dm.sender_id
    WHERE dm.document_id = ? ORDER BY dm.created_at ASC
  `).all(req.params.id);
  res.json({ messages });
});

router.post('/:id/messages', requireAuth, (req, res) => {
  if (!STAFF_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Only staff can send a message to a supplier.' });

  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found.' });

  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message cannot be empty.' });

  db.prepare(`INSERT INTO document_messages (document_id, sender_id, message) VALUES (?, ?, ?)`)
    .run(req.params.id, req.user.id, message.trim());

  
  const notifications = require('../services/notification.service');
  notifications.notifyDocumentEvent(req.params.id, `you have a new message from ${req.user.full_name}: "${message.trim()}"`);

  res.status(201).json({ ok: true });
});
module.exports = router;
