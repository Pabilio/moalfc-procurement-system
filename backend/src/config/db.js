const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'procurement.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000'); 

const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
db.exec(schema);


const stageCount = db.prepare('SELECT COUNT(*) AS n FROM workflow_stages').get().n;
if (stageCount === 0) {
  const insertStage = db.prepare(`
    INSERT INTO workflow_stages (sequence_order, name, responsible_role, max_duration_hours)
    VALUES (?, ?, ?, ?)
  `);
  const stages = [
    [1, 'Document Receipt and Registration', 'procurement_officer', 24],
    [2, 'Supply Chain Verification',          'supply_chain_officer', 72],
    [3, 'Finance Department Review',          'finance_officer',      72],
    [4, 'Internal Audit Clearance',           'internal_audit_officer', 48],
    [5, 'Accounting Officer Approval',        'accounting_officer',   48],
    [6, 'Payment Processing Confirmation',    'accounting_officer',   24],
  ];
  const insertMany = db.transaction((rows) => rows.forEach((s) => insertStage.run(...s)));
  insertMany(stages);
}

module.exports = db;