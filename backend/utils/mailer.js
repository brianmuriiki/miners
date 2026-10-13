const nodemailer = require('nodemailer');

let cachedTransport;

function emailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const from = process.env.SMTP_FROM;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from) return null;
  const auth = process.env.SMTP_USER && process.env.SMTP_PASSWORD
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined;
  if ((process.env.SMTP_USER && !process.env.SMTP_PASSWORD) || (!process.env.SMTP_USER && process.env.SMTP_PASSWORD)) return null;
  if (!cachedTransport) cachedTransport = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === 'true', auth });
  return { transport: cachedTransport, from };
}

function isEmailConfigured() { return Boolean(emailTransport()); }

async function sendAccountEmail({ to, subject, text }) {
  const configured = emailTransport();
  if (!configured) return false;
  await configured.transport.sendMail({ from: configured.from, to, subject, text });
  return true;
}

module.exports = { sendAccountEmail, isEmailConfigured };
