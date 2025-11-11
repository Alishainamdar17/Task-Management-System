// backend/utils/email.js
// Minimal email helper: dev में console पर log; SMTP चाहो तो नीचे nodemailer enable कर देना.

const fs = require('fs');
const path = require('path');

// --- OPTIONAL real email (enable when you have SMTP) ---
// const nodemailer = require('nodemailer');
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: Number(process.env.SMTP_PORT || 587),
//   secure: false,
//   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
// });

function renderTemplate(templateName, vars = {}) {
  // templates dir: backend/templates/<templateName>
  const templatesDir = path.join(process.cwd(), 'backend', 'templates');
  const filePath = path.join(templatesDir, templateName);
  let html = '';
  try {
    html = fs.readFileSync(filePath, 'utf8');
  } catch {
    // fallback inline template
    html = `
      <h2>Task Reminder</h2>
      <p>Hi {{name}},</p>
      <p><strong>{{title}}</strong> in <strong>{{project}}</strong> is due on <strong>{{dueDate}}</strong>.</p>
    `;
  }
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ''));
}

async function sendEmail(to, subject, html) {
  // Dev fallback
  console.log('📧 [DEV EMAIL] To:', to);
  console.log('📧 Subject:', subject);
  console.log('📧 HTML:\n', html);

  // --- enable for real SMTP ---
  // await transporter.sendMail({
  //   from: process.env.MAIL_FROM || 'no-reply@example.com',
  //   to, subject, html
  // });
}

module.exports = { sendEmail, renderTemplate };
