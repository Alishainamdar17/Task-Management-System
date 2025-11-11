// backend/utils/baileysClient.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  getContentType,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
let mime; try { mime = require('mime'); } catch { mime = { getType: () => 'application/octet-stream' }; }

const { restoreDirFromMongo, snapshotDirToMongo } = require('./authMirror');

const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, '..', 'auth');

let sock = null;
let initializing = null;
let reconnectTimer = null;
let latestQRText = null;

function getLatestQRText() { return latestQRText; }

let isReady = false;
let readyResolvers = [];
function waitForReady() {
  if (isReady && sock) return Promise.resolve();
  return new Promise(res => readyResolvers.push(res));
}
function markReady() {
  isReady = true;
  readyResolvers.splice(0).forEach(fn => fn());
}

async function initBaileys() {
  if (sock) return sock;
  if (initializing) return initializing;

  initializing = (async () => {
    try { await restoreDirFromMongo(AUTH_DIR); } catch (e) { console.warn('[wa] restore failed:', e?.message); }

    const { state, saveCreds: _saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    async function saveCreds() {
      try { await _saveCreds(); await snapshotDirToMongo(AUTH_DIR); }
      catch (e) { console.warn('[wa] saveCreds snapshot failed:', e?.message); }
    }

    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) latestQRText = qr;
      if (connection === 'open') {
        console.log('[wa] connected');
        latestQRText = null;
        markReady();
        try { await snapshotDirToMongo(AUTH_DIR); } catch {}
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.reason ?? 'unknown';
        console.warn('[wa] connection closed:', code);
        const loggedOut = code === DisconnectReason.loggedOut || code === 'loggedOut' || code === 401;
        if (!loggedOut) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            sock = null; initializing = null; isReady = false;
            initBaileys().catch(console.error);
          }, 1500);
        } else {
          try { await fsp.rm(AUTH_DIR, { recursive: true, force: true }); } catch {}
          isReady = false;
        }
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages?.[0]; if (!msg) return;
      const from = jidNormalizedUser(msg.key.remoteJid || '');
      const type = getContentType(msg.message) || 'unknown';
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      console.log('[wa] msg:', { from, type, text });
    });

    process.on('SIGINT', async () => { await snapshotDirToMongo(AUTH_DIR); process.exit(0); });
    process.on('SIGTERM', async () => { await snapshotDirToMongo(AUTH_DIR); process.exit(0); });

    return sock;
  })();

  return initializing;
}

function getSockOrThrow() {
  if (!sock) throw new Error('Baileys not initialized');
  return sock;
}

async function ensureUserJid(input) {
  let raw = String(input || '').trim();
  raw = raw.replace(/\s|\+/g, '');
  if (!/@s\.whatsapp\.net$/.test(raw)) raw = raw.replace(/\D/g, '') + '@s.whatsapp.net';

  const s = getSockOrThrow();
  const exists = await s.onWhatsApp(raw).catch(() => null);
  const valid = Array.isArray(exists) ? exists.find(e => e.exists) : null;
  if (!valid) throw new Error(`Number not on WhatsApp or incorrect: ${raw}`);
  return raw;
}

async function sendText(jid, text) {
  await waitForReady();
  const s = getSockOrThrow();
  const to = await ensureUserJid(jid);
  const msg = await s.sendMessage(to, { text: String(text ?? '') });
  console.log('[wa] sent ->', to, 'id:', msg?.key?.id);
  return msg;
}

module.exports = { initBaileys, sendText, getLatestQRText };
