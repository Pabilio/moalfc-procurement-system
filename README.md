# e-PTS — Electronic Procurement Tracking System

Final year project for: *Design and Implementation of an Automated Web-Based
Procurement Tracking System to Reduce Document Mismanagement Risks and
Enhance Transparency: A Case Study of the Ministry of Agriculture, Kenya.*

Full-stack system: **Express REST API backend** + **React (Vite) frontend**,
covering all five modules from Chapter 4:

1. **Supplier Registration & Bidder Portal** — self-service registration, JWT auth, tender browsing and bidding
2. **Immutable Electronic Document Vault** — SHA-256 hashing on upload, no-delete architecture (corrections supersede, never overwrite), full access audit log
3. **Automated Workflow & Approval Engine** — 6-stage sequential approval pipeline with auto-escalation at 125%/150% of allotted time
4. **Real-Time Supplier Payment Status Dashboard** — self-service tracker with stage-by-stage dates and a projected completion estimate
5. **Automated Notification System** — email via **Resend**, SMS via **Africa's Talking**, at every stage transition

Both backend and frontend were installed, run, and tested end-to-end while
building this (not just written and hoped-for) — see "What was actually
tested" below.

**Want to tweak colors, the favicon, login-page photos, or add more
tenders yourself?** See [`CUSTOMIZATION.md`](./CUSTOMIZATION.md) — every
change is one file, with the exact file path and what to edit.

### Recent changes
- Header and footer are now light green; page background is white
  (`frontend/src/styles/variables.css`)
- Login/signup pages now have a photo slideshow slot — add your own
  photos per `CUSTOMIZATION.md` section 3
- Documents now carry a plain-language **name** alongside their reference
  number (e.g. `INV-2026-0022 — Certified Maize Seed, Batch 2`), shown
  everywhere the document appears
- The Tenders page includes real Ministry of Agriculture tenders imported
  from kilimo.go.ke, each with a working "Download Tender Document" link
  to the actual document

## Tech stack

- **Backend**: Node.js, Express 5, better-sqlite3 (real SQLite driver, not
  an ORM — `schema.sql` is plain SQL you can read top to bottom), JWT auth
  (`jsonwebtoken`), `bcryptjs` password hashing, `multer` for file uploads,
  `resend` for email.
- **Frontend**: React 19 + Vite, React Router, plain hand-written CSS per
  the brief — **no Tailwind or other utility-CSS framework**. Every style
  lives in a named `.css` file under `src/styles/`.
- No JSX-in-strings, no server-rendered HTML — a real decoupled SPA talking
  to a real JSON API over `fetch`.

## Project structure

```
moalfc-procurement-system/
├── backend/
│   └── src/
│       ├── config/db.js            # opens SQLite, applies schema.sql
│       ├── middleware/auth.js      # JWT verify + role-based access control
│       ├── middleware/upload.js    # multer config for document uploads
│       ├── routes/*.routes.js      # one file per resource (auth, tenders, bids, workflow, documents, notifications, audit)
│       ├── services/workflow.service.js       # the 6-stage engine + escalation logic
│       ├── services/notification.service.js   # Resend (email) + Africa's Talking (SMS)
│       ├── utils/hash.js           # SHA-256 hashing + integrity verification
│       ├── schema.sql              # the full database schema, plain SQL
│       ├── seed.js                 # demo data
│       └── server.js               # Express app entry point
└── frontend/
    └── src/
        ├── api/client.js           # fetch wrapper (attaches JWT, handles errors)
        ├── context/AuthContext.jsx # logged-in user state, available everywhere via useAuth()
        ├── components/             # Navbar, HeroSlideshow, TendersList, StatusStepper, EscalationBadge, ProtectedRoute
        ├── pages/                  # one file per route
        └── styles/                 # variables.css (design tokens) + one .css file per area
```

## Running it locally

You need **Node.js 18+** and two terminal windows (backend + frontend run as
separate processes in development).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # already done for you in this zip; edit if needed
npm run seed               # creates the database and demo accounts
npm start                  # runs on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # runs on http://localhost:5173
```

Open **http://localhost:5173**. The Vite dev server proxies `/api/*`
requests to the backend automatically (see `vite.config.js`) — no CORS
setup needed.

### Demo logins (password for everyone: `password123`)

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

The seed data includes documents at different stages, including two
deliberately overdue ones, so the escalation badges (amber/red) are visible
immediately without waiting for real time to pass.

### Running it as one process (production-style)

```bash
cd frontend && npm install && npm run build   # produces frontend/dist
cd ../backend && npm start                     # now also serves the built frontend
```

Visit **http://localhost:5000** — Express serves the built React app and
the API from the same port. This is what `server.js`'s static-file block
does automatically whenever `frontend/dist` exists.

## Email & SMS notifications

By default (no configuration) notifications run in **simulation mode**:
every SMS/email is logged to the database (visible on the admin
`/notifications` page) and printed to the backend console, but nothing is
actually sent. This is enough to demo and defend the system with zero setup.

To send for real, edit `backend/.env`:

```
RESEND_API_KEY=re_your_real_key
RESEND_FROM=e-PTS <onboarding@resend.dev>

AT_USERNAME=sandbox
AT_API_KEY=your_africastalking_sandbox_key
```

Neither integration could be tested against a live account while building
this (the build sandbox had no general internet access) — the request
shapes are correct, but treat first real use as a "verify it actually
worked" moment rather than assuming it's flawless.

## What was actually tested

Rather than just writing code, this was installed and run:

- **Backend**: real `npm install`, seeded, started, and driven through curl —
  registration, login (including wrong-password rejection), staff-only and
  supplier-only route enforcement (401/403 checked), tender creation, bid
  submission (including duplicate-bid rejection), award + rejection
  notifications, a real multipart file upload, SHA-256 hash verification, a
  downloaded file diffed byte-for-byte against the original, the "supersede"
  immutability flow, role-gated stage advancement, and the notification and
  audit log endpoints.
- **Frontend**: real `npm install` and `npm run build` — 70 modules compiled
  with zero errors.
- **Integration**: the built frontend served correctly by the Express
  backend from one process, with client-side routes (e.g. `/dashboard`)
  correctly falling through to `index.html` and API routes still resolving
  on the same port.

What could **not** be tested here: real Resend/Africa's Talking delivery
(no outbound internet in the build sandbox), and visual/CSS rendering (no
browser available) — the CSS is hand-written and should be sanity-checked
in an actual browser before your defense.

## Publishing to GitHub (to share a link with your supervisor)

**Easiest path — no git commands needed:**

1. Go to [github.com/new](https://github.com/new), name the repository
   (e.g. `moalfc-procurement-system`), leave it **Public** so your
   supervisor can open the link without logging in, and click **Create
   repository**.
2. On the next page click **uploading an existing file**.
3. Unzip the download you got from this chat, then drag the whole
   `backend/` folder, `frontend/` folder, and `README.md` into the browser
   upload area (GitHub accepts whole folders dragged in at once).
4. Scroll down, add a commit message like "Initial commit", and click
   **Commit changes**.
5. Share the repository URL shown at the top of the page (e.g.
   `https://github.com/your-username/moalfc-procurement-system`) — that's
   the link for your supervisor.

**If you're comfortable with git** (faster for future updates):

```bash
cd moalfc-procurement-system
git init
git add .
git commit -m "Initial commit -- e-PTS full stack"
git branch -M main
git remote add origin https://github.com/your-username/moalfc-procurement-system.git
git push -u origin main
```

Either way, `.gitignore` files are already in place so `node_modules/`,
`.env`, the database file, and uploaded documents are never committed —
only your source code goes up.

## Not yet built

- Password reset / email verification flow
- Pagination on the notifications/audit-log tables (fine at demo scale,
  would matter at real production scale)
- Automated tests (everything above was verified manually via curl and a
  Vite build, not with a test suite — worth adding if you have time before
  your defense)
