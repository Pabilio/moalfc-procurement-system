# e-PTS: Electronic Procurement Tracking System

**Design and Implementation of an Automated Web-Based Procurement Tracking System to Reduce Document Mismanagement Risks and Enhance Transparency: A Case Study of the Ministry of Agriculture, Kenya**

Final Year Project by **Pabilio Muobe** | Supervisor: **Mr.Austin Karoki** | [University / Department] | [Year 4]

Repository: [GitHub link]

---

## 1. The problem

Public procurement in the Ministry of Agriculture runs on a hybrid of paper and electronic documents. Invoices, delivery notes and payment vouchers pass through several offices (procurement, supply chain, finance, internal audit, the accounting officer) and documents go missing between desks. Suppliers cannot see where their claim is, so they phone or visit offices to ask and unclear paper trails create room for delay and corruption.

This project replaces that with a single web system where every document is registered once, moves through a fixed approval pipeline and is visible to everyone who needs to see it.

## 2. What the system does

The system implements the five modules specified in Chapter 4.

| # | Module | What it does |
|---|---|---|
| 1 | **Supplier Registration and Bidder Portal** | Suppliers self-register, browse tenders, download the official tender document, and submit bids. Procurement officers publish tenders and award them. |
| 2 | **Immutable Document Vault** | Every uploaded file is hashed (SHA-256) at upload time. Files are never deleted or overwritten: a correction creates a new version that points back to the original, which is kept permanently. Integrity can be re-verified at any time, and every view and download is logged. |
| 3 | **Automated Workflow Engine** | Each document moves through six stages: Document Receipt, Supply Chain Verification, Finance Review, Internal Audit, Accounting Officer Approval, and Payment Confirmation. Only the role that owns a stage (or the admin) can advance it. Documents that overrun a stage's time limit are escalated automatically (see below). |
| 4 | **Supplier Status Dashboard** | Suppliers see a live progress tracker for every document, with stage-by-stage dates and a projected completion date. |
| 5 | **Notification System** | Suppliers are notified by email  when a document is received, moves stage, is paid, or when staff send a query. Staff are alerted on overdue documents. Every notification is logged. |

### Additional features
- **Staff-to-supplier messaging.** Staff can send a query or amendment request on a specific document. The supplier sees it on the document page and is notified.
- **Real Ministry tenders.** The Tenders page includes tenders published by the Ministry on kilimo.go.ke, each with a link to download the actual tender document.
- **Document names.** Each document shows a plain-language name beside its reference number (for example, `INV-2026-0022: Certified Maize Seed, Batch 2`).
- **Audit and notification logs** for the internal audit officer and admin.

### Escalation rule
Each stage has a time limit (24 to 72 hours depending on the stage). When a document has sat in a stage for more than **125%** of the limit, the officer who owns that stage is alerted. At **150%**, the Head of Department is alerted as well. Each level alerts once per stage.

## 3. User roles

| Role | Can do |
|---|---|
| Supplier | Register, bid on tenders, upload documents, track status, submit corrections, read staff messages |
| Procurement Officer | Publish and award tenders; advance stage 1 |
| Supply Chain Officer | Advance stage 2 |
| Finance Officer | Advance stage 3 |
| Internal Audit Officer | Advance stage 4; view the audit log |
| Accounting Officer | Advance stages 5 and 6 |
| Admin (Head of Department) | Advance any stage; view notification and audit logs |

All staff can view active documents and message suppliers.


### Demo accounts (password for all: `password123`)

| Role | Email |
|---|---|
| Procurement Officer | alice.wanjiru@kilimo.go.ke |
| Supply Chain Officer | brian.otieno@kilimo.go.ke |
| Finance Officer | catherine.mwikali@kilimo.go.ke |
| Internal Audit Officer | david.kiptoo@kilimo.go.ke |
| Accounting Officer | esther.njoki@kilimo.go.ke |
| Admin / Head of Department | hod@kilimo.go.ke |
| Supplier | james@agrisupplies.co.ke |
| Supplier | grace@farmequip.co.ke |

## 4. Technology

| Layer | Choice |
|---|---|
| Backend | Node.js, Express 5, REST JSON API |
| Database | SQLite (`better-sqlite3`), schema in plain SQL (`backend/src/schema.sql`) |
| Authentication | JSON Web Tokens, `bcryptjs` password hashing, role-based access control |
| File handling | `multer` uploads, SHA-256 hashing with Node's built-in `crypto` |
| Frontend | React 19, Vite, React Router |
| Styling | Hand-written CSS in `frontend/src/styles/`. No CSS framework. |
| Email | SMTP via Brevo (Resend is also supported in the code) |




## 5. Project structure

```
backend/src/
  config/db.js                   database connection, applies schema.sql
  middleware/                    JWT auth + role checks, file upload
  routes/                        auth, tenders, bids, workflow, documents, notifications, audit
  services/workflow.service.js   the six-stage engine and escalation logic
  services/notification.service.js   email + SMS
  utils/hash.js                  SHA-256 hashing and integrity check
  schema.sql                     full database schema
  seed.js                        demo data
frontend/src/
  pages/                         one file per screen
  components/                    navbar, stepper, slideshow, tender list
  styles/                        variables.css (design tokens) + one stylesheet per area
```
