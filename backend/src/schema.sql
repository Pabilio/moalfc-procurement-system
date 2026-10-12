
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT NOT NULL CHECK(role IN (
                  'supplier','procurement_officer','supply_chain_officer',
                  'finance_officer','internal_audit_officer',
                  'accounting_officer','admin'
                )),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  business_name TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- TENDERS + BIDS -- Module 1: Supplier Registration & Bidder Portal
CREATE TABLE IF NOT EXISTS tenders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_no  TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT,
  closing_date  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK(status IN ('open','closed','awarded','cancelled')),
  document_url  TEXT,
  created_by          INTEGER NOT NULL REFERENCES users(id),
  awarded_supplier_id INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bids (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tender_id     INTEGER NOT NULL REFERENCES tenders(id),
  supplier_id   INTEGER NOT NULL REFERENCES users(id),
  amount        REAL NOT NULL,
  proposal      TEXT,
  status        TEXT NOT NULL DEFAULT 'submitted'
                  CHECK(status IN ('submitted','shortlisted','awarded','rejected')),
  submitted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tender_id, supplier_id)
);

-- WORKFLOW STAGES -- the six fixed stages every document passes through
CREATE TABLE IF NOT EXISTS workflow_stages (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_order     INTEGER NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  responsible_role   TEXT NOT NULL,
  max_duration_hours REAL NOT NULL
);

-- DOCUMENTS -- Module 2: Immutable Electronic Document Vault.
-- supersedes_document_id implements "no-delete, corrected versions only".
CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id   INTEGER NOT NULL REFERENCES users(id),
  tender_id     INTEGER REFERENCES tenders(id),
  doc_type      TEXT NOT NULL CHECK(doc_type IN (
                  'delivery_note','invoice','inspection_certificate',
                  'goods_received_note','payment_voucher',
                  'company_registration','tax_compliance_certificate',
                  'bid_proposal','other'
                )),
  reference_no  TEXT NOT NULL,
  document_name TEXT NOT NULL DEFAULT '',
  file_name     TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  sha256_hash   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK(status IN ('active','superseded','disputed','paid')),
  supersedes_document_id INTEGER REFERENCES documents(id),
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DOCUMENT_WORKFLOW -- Module 3: the workflow engine's core table.
-- A document's CURRENT stage is the row where exited_at IS NULL.
CREATE TABLE IF NOT EXISTS document_workflow (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id      INTEGER NOT NULL REFERENCES documents(id),
  stage_id         INTEGER NOT NULL REFERENCES workflow_stages(id),
  entered_at       TEXT NOT NULL DEFAULT (datetime('now')),
  exited_at        TEXT,
  actor_user_id    INTEGER REFERENCES users(id),
  escalation_level INTEGER NOT NULL DEFAULT 0
);

-- NOTIFICATIONS -- Module 5: every SMS/email the system generates
CREATE TABLE IF NOT EXISTS notifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  document_id   INTEGER REFERENCES documents(id),
  channel       TEXT NOT NULL CHECK(channel IN ('sms','email')),
  message       TEXT NOT NULL,
  sent_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DOCUMENT ACCESS LOG -- Module 2's "full access audit logs" requirement
CREATE TABLE IF NOT EXISTS document_access_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id  INTEGER NOT NULL REFERENCES documents(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  action       TEXT NOT NULL CHECK(action IN ('view','download')),
  timestamp    TEXT NOT NULL DEFAULT (datetime('now'))
);
-- DOCUMENT MESSAGES -- staff-to-supplier correspondence on a specific
-- document (e.g. "please resubmit with the corrected VAT amount").
CREATE TABLE IF NOT EXISTS document_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id  INTEGER NOT NULL REFERENCES documents(id),
  sender_id    INTEGER NOT NULL REFERENCES users(id),
  message      TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);