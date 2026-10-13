require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('./config/db'); // opens the DB and applies schema.sql on startup

const app = express();

// 1. CORS configured right at the top before any routes
const allowedOrigins = [
  'https://moalfc-procurement.web.app',
  'https://moalfc-procurement.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests (Postman, curl, server-to-server) or matched origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback: allow all origins during development/testing
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Explicitly answer browser OPTIONS preflight requests

app.use(express.json());

// 2. API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/tenders', require('./routes/tenders.routes'));
app.use('/api/bids', require('./routes/bids.routes'));
app.use('/api/workflow', require('./routes/workflow.routes'));
app.use('/api/documents', require('./routes/documents.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/audit-log', require('./routes/audit.routes'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'e-PTS backend' }));

// 3. Static frontend serve (if dist folder exists)
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

// 4. Global error handler
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`e-PTS backend running on port ${PORT}`);
});