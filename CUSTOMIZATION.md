# Customization Guide

This is a plain-language walkthrough for making the kinds of changes you'll
likely want before your defense -- colors, photos, the favicon, and adding
more tenders -- directly in the source code, without needing to ask for
help each time.

Every change below is a small, isolated edit to one file. None of them
require touching the database schema, the API, or any logic.

---

## 1. Changing colors

**File:** `frontend/src/styles/variables.css`

Every color used anywhere in the app is defined once, at the top of this
file, as a CSS custom property (a "variable"). Change the value here and
it updates everywhere that color is used -- you never need to hunt through
individual page files.

```css
--paper: #FFFFFF;             /* the page background (currently white) */
--header-footer-bg: #E7F0E1;  /* the header and footer band (currently light green) */
--primary: #3F5C34;           /* brand color -- buttons, links, "on track" status */
--ink: #2B2A25;                /* body text color */
```

To change the header/footer green, edit the `--header-footer-bg` line.
To change the page background, edit `--paper`. Colors are standard hex
codes (`#RRGGBB`) -- any color picker tool online will give you one to
paste in.

After editing, if you're running `npm run dev`, the browser updates
automatically. If you're running the built version, run `npm run build`
again in `frontend/` to regenerate it.

---

## 2. Replacing the favicon (the little icon in the browser tab)

**Folder:** `frontend/public/`

1. Save your favicon file as `favicon.ico` directly inside `frontend/public/`
   (there's a placeholder text file there now, named
   `FAVICON_PUT_YOUR_FILE_HERE.txt` -- delete it once your real file is in
   place).
2. That's it if you're using a `.ico` file -- `frontend/index.html`
   already points at `/favicon.ico`.

If your file is a `.png` instead of `.ico`:
1. Name it `favicon.png` and put it in the same `frontend/public/` folder.
2. Open `frontend/index.html`, find this line near the top:
   ```html
   <link rel="icon" href="/favicon.ico" />
   ```
   and change it to:
   ```html
   <link rel="icon" href="/favicon.png" type="image/png" />
   ```

---

## 3. Adding photos to the login/signup slideshow

**Folder:** `frontend/public/assets/login/`

The slideshow on the Login and Register pages looks for exactly three
image files, named:

```
login-1.jpg
login-2.jpg
login-3.jpg
```

Drop your three photos into `frontend/public/assets/login/` with those
exact names (there's a placeholder text file there now -- delete it once
your photos are in). The slideshow auto-advances every 5 seconds and has
clickable dots. Until a photo is added, that slide just shows the light
green panel instead of a broken-image icon, so nothing looks broken in
the meantime.

**To use different filenames, more than 3 photos, or a different format**
(`.png`, `.webp`), edit this file:

**File:** `frontend/src/components/LoginSlideshow.jsx`

Near the top, you'll see:

```js
const IMAGES = [
  '/assets/login/login-1.jpg',
  '/assets/login/login-2.jpg',
  '/assets/login/login-3.jpg',
];
```

Add, remove, or rename entries in this list to match whatever files you
actually have in the folder.

---

## 4. Adding more real tenders (with a download link)

There are two ways to add a tender: through the app itself, or by editing
the seed data. Use the app for anything you add day-to-day; use the seed
file only if you want it to always be there whenever the database is
freshly created.

### Option A -- through the app (recommended for day-to-day use)

Log in as a Procurement Officer or Admin (e.g. `alice.wanjiru@kilimo.go.ke`
/ `password123`), click **New Tender** in the navigation bar, and fill in
the form. The **"Tender document link"** field is where you paste the URL
to the actual PDF -- for example, a fresh tender from
https://kilimo.go.ke/tenders-for-state-department-for-agriculture/, or
any other link you want bidders to be able to click through to download.
This is exactly how the "Download Tender Document" button gets its link
for the tenders already in the system.

### Option B -- editing the seed data (for tenders you want present every time you reset the database)

**File:** `backend/src/seed.js`

Find the `REAL_TENDERS` array (search for that name in the file). Each
entry is one tender, in this order:

```js
['REFERENCE-NUMBER', 'Title of the tender', 'Category', 'YYYY-MM-DD', 'https://link-to-document.pdf'],
```

Add a new line following that same pattern. The date must be in
`YYYY-MM-DD` format. After editing, re-run `npm run seed` in `backend/`
to apply it (this wipes and recreates the demo database, so only do this
in development, not against real data).

---

## 5. How the "document name" field works

Every uploaded document (invoice, delivery note, etc.) now has two labels
shown together everywhere it appears: the **reference number** (e.g.
`INV-2026-0022`, which suppliers make up themselves, usually matching
their own internal numbering) and the **document name** (e.g. "Certified
Maize Seed -- Batch 2 Delivery", a plain-language description). Both are
entered on the upload form (`frontend/src/pages/DocumentUpload.jsx`) and
stored as separate columns (`reference_no` and `document_name`) in the
`documents` table (`backend/src/schema.sql`). If you want to make the
document name optional instead of required, remove this line from
`backend/src/routes/documents.routes.js`:

```js
if (!req.file || !doc_type || !reference_no || !document_name) {
```

and remove `!documentName.trim()` from the matching check in
`frontend/src/pages/DocumentUpload.jsx`.

---

## 6. Where things live -- quick reference

| I want to change... | Edit this file |
|---|---|
| Any color | `frontend/src/styles/variables.css` |
| The favicon | `frontend/public/favicon.ico` |
| Login/signup photos | `frontend/public/assets/login/` |
| The brand name in the header | `frontend/src/components/Navbar.jsx` |
| The landing page hero text | `frontend/src/components/HeroSlideshow.jsx` |
| The footer text | `frontend/src/App.jsx` (bottom of the file) |
| The 6 workflow stages / their time limits | `backend/src/config/db.js` (the `stages` array) |
| Demo login accounts | `backend/src/seed.js` |
| Which document types can be uploaded | `backend/src/routes/documents.routes.js` (`DOC_TYPES`) and `backend/src/schema.sql` (the `CHECK` constraint on `doc_type`) |

**After any backend file change:** stop and restart `npm start` (or use
`npm run dev`, which restarts automatically on save).
**After any frontend file change:** if you're using `npm run dev`, it
updates live in the browser. If you're serving the built version, run
`npm run build` again.
**After any `schema.sql` change:** delete `backend/data/procurement.db`
and run `npm run seed` again -- SQLite won't add a new column to a table
that already exists, so a schema change needs a fresh database in
development.
