const nodemailer = require('nodemailer');
const config = require('../config');

// Locally this points at Mailpit (fake SMTP with a web inbox). In production use SES/SendGrid SMTP.
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
});

const layout = (title, body) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px">
    <h2 style="color:#111">${title}</h2>
    <p style="color:#333;font-size:15px;line-height:1.5">${body}</p>
    <p style="color:#999;font-size:12px">This is an automated message from Shop Microservices.</p>
  </div>`;

async function sendMail({ to, subject, title, message }) {
  await transporter.sendMail({ from: config.mailFrom, to, subject, text: message, html: layout(title, message) });
}

module.exports = { sendMail };
