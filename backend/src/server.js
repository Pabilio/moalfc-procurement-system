

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('./config/db'); // opens the DB and applies schema.sql on startup

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/tenders', require('./routes/tenders.routes'));
app.use('/api/bids', require('./routes/bids.routes'));
app.use('/api/workflow', require('./routes/workflow.routes'));
app.use('/api/documents', require('./routes/documents.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/audit-log', require('./routes/audit.routes'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'e-PTS backend' }));

// Optional: serve the built frontend (frontend/dist) if it exists, so
// `npm run build` in frontend/ + `npm start` in backend/ is enough to
// run the whole system from one process/port.
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}


const multer = require('multer');
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File exceeds the 20MB upload limit.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`e-PTS backend running on http://localhost:${PORT}`);
});
