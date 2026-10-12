require('dotenv').config();
const nodemailer = require('nodemailer');

nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: { user: process.env.BREVO_USER, pass: process.env.BREVO_SMTP_KEY },
}).verify()
  .then(() => console.log('Brevo login OK'))
  .catch((e) => console.log('Brevo login FAILED:', e.message));