

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./config/db');
const workflow = require('./services/workflow.service');
const { hashBuffer } = require('./utils/hash');
const { UPLOAD_DIR } = require('./middleware/upload');

console.log('Seeding database...');

db.exec(`
  DELETE FROM document_access_log; DELETE FROM notifications;
  DELETE FROM document_workflow; DELETE FROM documents;
  DELETE FROM bids; DELETE FROM tenders; DELETE FROM users;
`);

const PASSWORD_HASH = bcrypt.hashSync('password123', 10);

function createUser({ role, full_name, email, phone, business_name }) {
  return db.prepare(`
    INSERT INTO users (role, full_name, email, phone, business_name, password_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(role, full_name, email, phone || null, business_name || null, PASSWORD_HASH).lastInsertRowid;
}

const alice = createUser({ role: 'procurement_officer', full_name: 'Alice Wanjiru', email: 'alice.wanjiru@kilimo.go.ke' });
const brian = createUser({ role: 'supply_chain_officer', full_name: 'Brian Otieno', email: 'brian.otieno@kilimo.go.ke' });
const catherine = createUser({ role: 'finance_officer', full_name: 'Catherine Mwikali', email: 'catherine.mwikali@kilimo.go.ke' });
createUser({ role: 'internal_audit_officer', full_name: 'David Kiptoo', email: 'david.kiptoo@kilimo.go.ke' });
createUser({ role: 'accounting_officer', full_name: 'Esther Njoki', email: 'esther.njoki@kilimo.go.ke' });
createUser({ role: 'admin', full_name: 'Head of Department', email: 'hod@kilimo.go.ke' });

const james = createUser({ role: 'supplier', full_name: 'James Mutua', email: 'james@agrisupplies.co.ke', phone: '+254712345678', business_name: 'AgriSupplies Ltd' });
const grace = createUser({ role: 'supplier', full_name: 'Grace Achieng', email: 'grace@farmequip.co.ke', phone: '+254723456789', business_name: 'FarmEquip Kenya' });
createUser({ role: 'supplier', full_name: 'Peter Kamau', email: 'peter@harvesttools.co.ke', phone: '+254734567890', business_name: 'Harvest Tools Co.' });

// --- Demo tenders (synthetic, kept OPEN/AWARDED so bidding stays testable) ---
const tenderId = db.prepare(`
  INSERT INTO tenders (reference_no, title, description, category, closing_date, status, created_by, awarded_supplier_id)
  VALUES (?, ?, ?, ?, ?, 'awarded', ?, ?)
`).run('MOA/T/2026/001', 'Supply of Certified Maize Seed', 'Supply and delivery of certified maize seed to 12 county depots.', 'Seeds', '2026-08-01', alice, james).lastInsertRowid;

db.prepare(`INSERT INTO bids (tender_id, supplier_id, amount, proposal, status) VALUES (?, ?, ?, ?, 'awarded')`)
  .run(tenderId, james, 4200000, 'Certified seed, 12 depots, 21-day delivery window.');
db.prepare(`INSERT INTO bids (tender_id, supplier_id, amount, proposal, status) VALUES (?, ?, ?, ?, 'rejected')`)
  .run(tenderId, grace, 4550000, 'Certified seed with cold-chain packaging.');

db.prepare(`
  INSERT INTO tenders (reference_no, title, description, category, closing_date, status, created_by)
  VALUES (?, ?, ?, ?, ?, 'open', ?)
`).run('MOA/T/2026/002', 'Farm Equipment Maintenance Contract', 'Annual maintenance contract for tractors and irrigation pumps across 5 stations.', 'Equipment', '2026-10-15', alice);


const REAL_TENDERS = [
  ['KE-MOALF-560682-CS-QCBS', 'Consulting Services for Business Accelerator for Mango and Avocado Value Chain (NAVCDP)', 'Consulting', '2026-08-19', 'https://kilimo.go.ke/consulting-services-for-business-accelerator-for-mango-and-avocado-value-chain-for-navcdp/'],
  ['KE-MOALF-560393-CS-CQS', 'Consulting Services for Business Development and Acceleration of Apiculture Value Chain', 'Consulting', '2026-08-19', 'https://kilimo.go.ke/consulting-services-for-business-development-and-acceleration-of-apiculture-value-chain/'],
  ['KE-MOALF-562862-CSINDV', 'Technical Support & Partnership Specialist 1 for Coffee Value Chain Revitalization and Factory Modernization', 'Consulting', '2026-08-18', 'https://kilimo.go.ke/terms-of-reference-tor-for-technical-support-and-partnership-specialist-1-for-coffee-value-chain-revitalisation-factory-modernization/'],
  ['KE-MOALF-550197-CS-CQS', 'Consulting Services to Undertake Midterm Review for the Food Systems Resilience Project', 'Consulting', '2026-06-03', 'https://kilimo.go.ke/consulting-services-to-undertake-midterm-review-for-the-food-systems-resilience-project/'],
  ['KE-MOALF-533751-NC-RFB', 'Design, Development and Installation of an Integrated Sacco Core Banking System', 'ICT', '2026-07-02', 'https://kilimo.go.ke/design-development-and-installation-of-an-integrated-sacco-core-banking-system/'],
  ['KE-MOALF-550199-NC-RFB', 'Automated Web-Based Integrated Grievance Feedback System', 'ICT', '2026-07-02', 'https://kilimo.go.ke/automated-web-based-integrated-grievance-feedback-2/'],
  ['KE-MOALF-533754-NC-RFB', 'FPO Management Information System', 'ICT', '2026-07-02', 'https://kilimo.go.ke/fpo-management-information-system-rfb/'],
  ['MOA&LD/SDA/INReMP/NCB/01/2025-2026', 'Supply and Installation of Accounting Software', 'ICT', '2026-05-22', 'https://kilimo.go.ke/wp-content/uploads/2026/05/BIDDING-DOCUMENT-Accounting-software-210426-Fin_260421_080802.pdf'],
  ['KE-MOALF-529705-GO-RFB', 'NAVCDP -- Supply of Assorted ICT Items', 'ICT', '2026-03-06', 'https://kilimo.go.ke/navcdp-rfb-doc-assorted-ict-items/'],
  ['KE-MOALF-517510-GO-RFB', 'FSRP -- Supply & Delivery of Laptops, Desktop Computers and Tablets', 'ICT', '2026-03-05', 'https://kilimo.go.ke/fsrp-rfb-supply-delivery-of-446no-user-laptops-331no-desktop-computers-14no-production-laptops-and-66no-tablets/'],
  ['MOALD/SDA/REG/01/2024-2025', 'Prequalification/Registration of Suppliers for Goods, Works & Services FY 2025/26 & 2026/27', 'General', '2025-03-24', 'https://kilimo.go.ke/prequalification-registration-of-suppliers-for-goods-works-2026-2027/'],
  ['MOALD/SDA/ENG/DATIC/01/2024-2025', 'Drilling and Equipping of Khaunga Primary School Solar Powered Borehole, Kakamega County', 'Works', '2025-04-29', 'https://kilimo.go.ke/tenders-for-state-department-for-agriculture/datic-td-khaunga-pri-sch-bh-kakamega-county/'],
  ['MOALD/SDA/ENG/DAC/01/2024-2025', 'Construction of Tarakwa Aggregation Centre, Uasin Gishu County', 'Works', '2025-04-29', 'https://kilimo.go.ke/tenders-for-state-department-for-agriculture/dac-td-construction-of-tarakwa-ac-uasin-gishu-county/'],
];

const insertRealTender = db.prepare(`
  INSERT INTO tenders (reference_no, title, description, category, closing_date, status, document_url, created_by)
  VALUES (?, ?, ?, ?, ?, 'closed', ?, ?)
`);
for (const [reference_no, title, category, closing_date, document_url] of REAL_TENDERS) {
  insertRealTender.run(reference_no, title, `Official Ministry of Agriculture, Livestock, Fisheries and Cooperatives tender. See the downloadable document for full terms and requirements.`, category, closing_date, document_url, alice);
}

function createDocument(supplierId, docType, referenceNo, documentName, tenderId = null) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const content = Buffer.from(`Demo placeholder content for ${referenceNo} (${docType}), generated by seed.js at ${new Date().toISOString()}`);
  const storedName = `${referenceNo.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  const filePath = path.join(UPLOAD_DIR, storedName);
  fs.writeFileSync(filePath, content);
  const sha256_hash = hashBuffer(content);

  const id = db.prepare(`
    INSERT INTO documents (supplier_id, tender_id, doc_type, reference_no, document_name, file_name, file_path, sha256_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(supplierId, tenderId, docType, referenceNo, documentName, `${referenceNo}.txt`, filePath, sha256_hash).lastInsertRowid;
  workflow.startWorkflow(id);
  return id;
}

function backdate(documentId, hoursAgo) {
  db.prepare(`UPDATE document_workflow SET entered_at = datetime('now', ?) WHERE document_id = ? AND exited_at IS NULL`)
    .run(`-${hoursAgo} hours`, documentId);
}

createDocument(james, 'invoice', 'INV-2026-0001', 'Certified Maize Seed -- Batch 1 Delivery', tenderId); // fresh, on track

const docB = createDocument(grace, 'delivery_note', 'DN-2026-0014', 'Irrigation Pump Parts -- Kitale Depot'); // -> stage 2, 132% of time used
workflow.advanceStage(docB, alice);
backdate(docB, 95);

const docC = createDocument(james, 'invoice', 'INV-2026-0022', 'Certified Maize Seed -- Batch 2 Delivery', tenderId); // -> stage 3, 181% of time used
workflow.advanceStage(docC, alice);
workflow.advanceStage(docC, brian);
backdate(docC, 130);

const docD = createDocument(james, 'payment_voucher', 'PV-2026-0003', 'Certified Maize Seed -- Final Payment Voucher', tenderId); // fully paid
workflow.advanceStage(docD, alice);
workflow.advanceStage(docD, brian);
workflow.advanceStage(docD, catherine);
workflow.advanceStage(docD, 4);
workflow.advanceStage(docD, 5);
workflow.advanceStage(docD, 6);

console.log('Seed complete.');
console.log(`Imported ${REAL_TENDERS.length} real MoALD tenders + 2 demo tenders.`);
console.log('Staff logins (password: password123): alice.wanjiru@kilimo.go.ke, brian.otieno@kilimo.go.ke, catherine.mwikali@kilimo.go.ke, david.kiptoo@kilimo.go.ke, esther.njoki@kilimo.go.ke, hod@kilimo.go.ke');
console.log('Supplier logins (password: password123): james@agrisupplies.co.ke, grace@farmequip.co.ke, peter@harvesttools.co.ke');
