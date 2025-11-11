// backend/routes/waRoutes.js
const express = require('express');
const router = express.Router();
const { getLatestQRText, initBaileys, sendText } = require('../utils/baileysClient');

initBaileys().catch(() => {});

router.get('/wa/qr', (req, res) => {
  const qrText = getLatestQRText && getLatestQRText();
  if (!qrText) return res.status(204).end();
  res.json({ qrText });
});

router.get('/wa/status', (req, res) => {
  const qrText = getLatestQRText && getLatestQRText();
  res.json({ connected: !qrText, hasQR: !!qrText });
});

router.post('/wa/send', async (req, res) => {
  try {
    const { to, text } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: 'to required' });
    const r = await sendText(to, text || 'Hello from Baileys ✅');
    res.json({ ok: true, id: r?.key?.id });
  } catch (e) {
    console.error('[wa/send] error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
