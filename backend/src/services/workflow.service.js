
const db = require('../config/db');
const notifications = require('./notification.service');

function getStages() {
  return db.prepare('SELECT * FROM workflow_stages ORDER BY sequence_order').all();
}

function startWorkflow(documentId) {
  const firstStage = db.prepare('SELECT * FROM workflow_stages WHERE sequence_order = 1').get();
  db.prepare(`INSERT INTO document_workflow (document_id, stage_id, entered_at) VALUES (?, ?, datetime('now'))`)
    .run(documentId, firstStage.id);
  notifications.notifyDocumentEvent(documentId, `has been received and registered. It is now at stage 1/6 -- ${firstStage.name}.`);
}

function getCurrentStage(documentId) {
  return db.prepare(`
    SELECT dw.*, ws.name AS stage_name, ws.sequence_order, ws.responsible_role, ws.max_duration_hours
    FROM document_workflow dw JOIN workflow_stages ws ON ws.id = dw.stage_id
    WHERE dw.document_id = ? AND dw.exited_at IS NULL
  `).get(documentId);
}

function computeEscalation(currentStageRow) {
  if (!currentStageRow) return null;
  const enteredAt = new Date(currentStageRow.entered_at + 'Z');
  const elapsedHours = (Date.now() - enteredAt.getTime()) / 3600000;
  const maxHours = currentStageRow.max_duration_hours;
  let level = 0;
  if (elapsedHours > maxHours * 1.5) level = 2;
  else if (elapsedHours > maxHours * 1.25) level = 1;
  return {
    elapsedHours: Math.round(elapsedHours * 10) / 10,
    maxHours,
    percentUsed: Math.round((elapsedHours / maxHours) * 100),
    level,
  };
}

function remainingHoursFrom(fromSeq) {
  const rows = db.prepare('SELECT max_duration_hours FROM workflow_stages WHERE sequence_order >= ?').all(fromSeq);
  return rows.reduce((sum, r) => sum + r.max_duration_hours, 0);
}

function advanceStage(documentId, actorUserId) {
  const current = getCurrentStage(documentId);
  if (!current) throw new Error('Document has no active workflow stage (already completed or superseded).');

  db.prepare(`UPDATE document_workflow SET exited_at = datetime('now'), actor_user_id = ? WHERE id = ?`)
    .run(actorUserId, current.id);

  const nextStage = db.prepare('SELECT * FROM workflow_stages WHERE sequence_order = ?').get(current.sequence_order + 1);

  if (nextStage) {
    db.prepare(`INSERT INTO document_workflow (document_id, stage_id, entered_at) VALUES (?, ?, datetime('now'))`)
      .run(documentId, nextStage.id);
    notifications.notifyDocumentEvent(documentId, `moved to stage ${nextStage.sequence_order}/6 -- ${nextStage.name}.`);
  } else {
    db.prepare(`UPDATE documents SET status = 'paid' WHERE id = ?`).run(documentId);
    notifications.notifyDocumentEvent(documentId, `payment has been processed and confirmed. This document's journey is complete.`);
  }
}

function getDocumentStatus(documentId) {
  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!document) return null;
  const currentStage = getCurrentStage(documentId);
  const escalation = computeEscalation(currentStage);
  const projectedCompletion = currentStage
    ? new Date(Date.now() + remainingHoursFrom(currentStage.sequence_order) * 3600000).toISOString()
    : null;
  const history = db.prepare(`
    SELECT dw.*, ws.name AS stage_name, ws.sequence_order FROM document_workflow dw
    JOIN workflow_stages ws ON ws.id = dw.stage_id WHERE dw.document_id = ? ORDER BY ws.sequence_order ASC
  `).all(documentId);
  return { document, currentStage, escalation, history, projectedCompletion };
}

function getAllActiveWithEscalation() {
  const rows = db.prepare(`
    SELECT dw.*, ws.name AS stage_name, ws.sequence_order, ws.responsible_role, ws.max_duration_hours,
           d.reference_no, d.document_name, d.doc_type, d.supplier_id, d.status AS doc_status,
           u.business_name, u.full_name AS supplier_name
    FROM document_workflow dw
    JOIN workflow_stages ws ON ws.id = dw.stage_id
    JOIN documents d ON d.id = dw.document_id
    JOIN users u ON u.id = d.supplier_id
    WHERE dw.exited_at IS NULL AND d.status = 'active'
  `).all();
  return rows
    .map((row) => ({ ...row, escalation: computeEscalation(row) }))
    .sort((a, b) => b.escalation.level - a.escalation.level || b.escalation.percentUsed - a.escalation.percentUsed);
}

function checkAndNotifyEscalations() {
  const rows = getAllActiveWithEscalation();
  for (const row of rows) {
    if (row.escalation.level > row.escalation_level) {
      db.prepare('UPDATE document_workflow SET escalation_level = ? WHERE id = ?').run(row.escalation.level, row.id);
      const message = row.escalation.level === 2
        ? `Document ${row.reference_no} (${row.document_name}) at "${row.stage_name}" is critically overdue (${row.escalation.percentUsed}% of allotted time). Escalated to Head of Department.`
        : `Document ${row.reference_no} (${row.document_name}) at "${row.stage_name}" is overdue (${row.escalation.percentUsed}% of allotted time). Please review.`;
      for (const officer of db.prepare('SELECT id FROM users WHERE role = ?').all(row.responsible_role)) {
        notifications.notifyUserById(officer.id, message, row.document_id, 'Escalation Alert');
      }
      if (row.escalation.level === 2) {
        for (const hod of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all()) {
          notifications.notifyUserById(hod.id, message, row.document_id, 'Escalation Alert: HOD');
        }
      }
    }
  }
}

module.exports = {
  getStages, startWorkflow, getCurrentStage, computeEscalation, remainingHoursFrom,
  advanceStage, getDocumentStatus, getAllActiveWithEscalation, checkAndNotifyEscalations,
};