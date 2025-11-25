// backend/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

/* ================== CORS CONFIG ================== */
const CLIENT_URL = (process.env.CLIENT_URL || '').replace(/\/$/, '');
const EXTRA_ALLOWED = (process.env.EXTRA_ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:5173','http://127.0.0.1:5173',
  'http://localhost:3000','http://127.0.0.1:3000',
];
const allowedOrigins = [CLIENT_URL, ...EXTRA_ALLOWED, ...DEFAULT_LOCAL_ORIGINS].filter(Boolean);
const ALLOW_CREDENTIALS = (process.env.CORS_ALLOW_CREDENTIALS || 'false').toLowerCase() === 'true';

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin || '(no origin)'}`);
  next();
});

app.use((req, res, next) => {
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (ALLOW_CREDENTIALS) res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (req.headers.origin) {
    console.log(`🚫 CORS Blocked: ${req.headers.origin}`);
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ================== MIDDLEWARE & DB ================== */
app.use(express.json({ limit: '10mb' }));
connectDB();

/* ================== WhatsApp init ================== */
const RAW_WA_MODE = process.env.WA_MODE;
let WA_MODE = (RAW_WA_MODE || '').trim().toLowerCase();
if (!WA_MODE) {
  const hasCloudCreds = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  WA_MODE = hasCloudCreds ? 'cloud' : 'baileys';
}
console.log(`ℹ️ WA_MODE raw: ${JSON.stringify(RAW_WA_MODE)} -> using: ${WA_MODE}`);

if (WA_MODE === 'baileys') {
  try {
    const { initBaileys } = require('./utils/baileysClient');
    initBaileys()
      .then(() => console.log('✅ Baileys initialized (scan QR if prompted)'))
      .catch(err => console.error('❌ Baileys init failed:', err.message));
  } catch (e) {
    console.warn('⚠️ Baileys init unavailable:', e.message);
  }
} else {
  const hasCloudCreds = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  console.log(`ℹ️ WhatsApp mode: Cloud API (${hasCloudCreds ? 'creds OK' : 'missing creds'})`);
}

/* ================== CRON ================== */
try {
  require('./cron/reminders');
  console.log('✅ Reminder cron started');
} catch (e) {
  console.warn('⚠️ Could not start reminder cron:', e.message);
}

/* ================== ROUTES ================== */
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const reportRoutes = require('./routes/reportRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const projectRoutes = require('./routes/projectRoutes');
const waRoutes = require('./routes/waRoutes');

const departmentRoutes = require("./routes/departmentRoutes");
app.use("/api/departments", departmentRoutes);


app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', uploadRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', waRoutes);

// serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), allowedOrigins, waMode: WA_MODE });
});

// quick home
app.get('/', (_req, res) => res.send('✅ API running successfully'));

// ----- SIMPLE QR PAGE (no HTML file needed) -----
app.get('/qr', (req, res) => {
  res.send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>WhatsApp QR</title></head>
  <body>
    <h3>Scan this QR to connect WhatsApp</h3>
    <img id="waQR" width="280" height="280" style="border:1px solid #ccc"/>
    <p id="status">Waiting for QR...</p>
    <script>
      async function pollQR(){
        try {
          const r = await fetch('/api/wa/qr');
          if(r.status === 204){
            document.getElementById('waQR').src = '';
            document.getElementById('status').textContent = 'Already connected ✅';
            return;
          }
          const { qrText } = await r.json();
          const url = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(qrText);
          document.getElementById('waQR').src = url;
          document.getElementById('status').textContent = 'Open WhatsApp → Linked devices → Link a device';
        } catch(e){
          document.getElementById('status').textContent = 'Waiting for QR...';
        }
      }
      setInterval(pollQR, 2000); pollQR();
    </script>
  </body>
</html>`);
});

/* ================== START ================== */
const PORT = parseInt(process.env.PORT, 10) || 8000;
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
