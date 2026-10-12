
const https = require('https');
const db = require('../config/db');

let resendClient = null;
function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function logNotification(userId, documentId, channel, message) {
  db.prepare(`
    INSERT INTO notifications (user_id, document_id, channel, message) VALUES (?, ?, ?, ?)
  `).run(userId, documentId, channel, message);
}
const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: { user: process.env.BREVO_USER, pass: process.env.BREVO_SMTP_KEY },
  });

  async function sendEmail(to, subject, message) {
    if (!process.env.BREVO_USER || !to) {
      console.log(`[SIMULATED EMAIL] to ${to || '(none)'} | ${subject}: ${message}`);
      return { sent: false, simulated: true };
    }
    try {
      await transporter.sendMail({
        from: process.env.BREVO_FROM || process.env.BREVO_USER,
        to, subject, html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
      });
      return { sent: true, simulated: false };
    } catch (err) {
      console.log(`[Email] Brevo send failed (${err.message}); simulating instead.`);
      return { sent: false, simulated: true };
    }
  }

function sendSMS(phone, message) {
  return new Promise((resolve) => {
    const username = process.env.AT_USERNAME;
    const apiKey = process.env.AT_API_KEY;
    if (!username || !apiKey || !phone) {
      console.log(`[SIMULATED SMS] to ${phone || '(no phone on file)'}: ${message}`);
      return resolve({ sent: false, simulated: true });
    }

    const body = new URLSearchParams({ username, to: phone, message }).toString();
    const host = username === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; resolve(r); } };

    const request = https.request({
      hostname: host, path: '/version1/messaging', method: 'POST',
      headers: {
        apiKey, 'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json', 'Content-Length': Buffer.byteLength(body),
      },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        console.log(`[SMS] Africa's Talking responded ${res.statusCode}: ${data.slice(0, 200)}`);
        finish({ sent: res.statusCode < 300, simulated: false });
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', (err) => {
      console.log(`[SMS] Could not reach Africa's Talking (${err.message}); simulating instead.`);
      console.log(`[SIMULATED SMS] to ${phone}: ${message}`);
      finish({ sent: false, simulated: true });
    });
    request.write(body);
    request.end();
  });
}

function notifyUserById(userId, message, documentId = null, subject = 'e-PTS Notification') {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return;
  logNotification(user.id, documentId, 'sms', message);
  logNotification(user.id, documentId, 'email', message);
  sendSMS(user.phone, message).catch(() => {});
  sendEmail(user.email, subject, message).catch(() => {});
}

function notifyDocumentEvent(documentId, eventMessage) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) return;
  const label = doc.document_name ? `${doc.reference_no} (${doc.document_name})` : doc.reference_no;
  const message = `Document ${label}: ${eventMessage}`;
  notifyUserById(doc.supplier_id, message, documentId, `Update on ${doc.reference_no}`);
}

module.exports = { notifyUserById, notifyDocumentEvent, sendEmail, sendSMS };
