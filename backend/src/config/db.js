const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'procurement.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
db.exec(schema);

// 1. Seed workflow stages
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

// 2. Guarantee all system and demo accounts exist with matching schema columns
try {
  const defaultHash = bcrypt.hashSync('password123', 10);
  const upsertUser = db.prepare(`
    INSERT INTO users (role, full_name, email, phone, business_name, password_hash)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      password_hash = excluded.password_hash,
      role = excluded.role,
      full_name = excluded.full_name
  `);

  const seedUsers = [
    ['procurement_officer',   'Alice Wanjiru',        'alice.wanjiru@kilimo.go.ke', '+254712345678', 'MOALFC Procurement',   defaultHash],
    ['supplier',              'James Mwangi',         'james@agrisupplies.co.ke',   '+254722334455', 'AgriSupplies Kenya Ltd', defaultHash],
    ['supply_chain_officer',  'Supply Chain Officer', 'supplychain@kilimo.go.ke',   '+254733445566', 'MOALFC Supply Chain',   defaultHash],
    ['finance_officer',       'Finance Officer',      'finance@kilimo.go.ke',       '+254744556677', 'MOALFC Finance',        defaultHash],
    ['internal_audit_officer','Internal Auditor',     'audit@kilimo.go.ke',         '+254755667788', 'MOALFC Audit',          defaultHash],
    ['accounting_officer',    'Accounting Officer',   'accounting@kilimo.go.ke',    '+254766778899', 'MOALFC Accounts',       defaultHash],
    ['admin',                 'System Administrator', 'admin@kilimo.go.ke',         '+254700112233', 'MOALFC ICT',            defaultHash]
  ];

  const seedTransaction = db.transaction((users) => {
    for (const u of users) upsertUser.run(...u);
  });
  seedTransaction(seedUsers);
  console.log('Verified system accounts are seeded and ready.');
} catch (err) {
  console.error('Error seeding default users:', err.message);
}

module.exports = db;