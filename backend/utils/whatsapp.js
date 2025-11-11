// utils/whatsapp.js
// Dual provider: Baileys (free) when WA_MODE=baileys, else WhatsApp Cloud API
// ✅ Backward-compatible function signatures for sendText / sendTemplate.

const RAW_WA_MODE = process.env.WA_MODE;
const WA_MODE = (RAW_WA_MODE || '').trim().toLowerCase();

// ---- Helpers to accept both call styles ----
// sendText(to, message)  OR  sendText({ to, body | text | message })
function parseTextArgs(a, b) {
  if (typeof a === 'object' && a !== null) {
    const to = a.to;
    const body = a.body ?? a.text ?? a.message;
    return { to, body };
  }
  return { to: a, body: b };
}

// sendTemplate(to, templateName, params)
// OR sendTemplate({ to, templateName, bodyParams | params })
function parseTemplateArgs(a, b, c) {
  if (typeof a === 'object' && a !== null) {
    const to = a.to;
    const templateName = a.templateName || a.template || a.name;
    const params = a.bodyParams ?? a.params ?? [];
    return { to, templateName, params };
  }
  return { to: a, templateName: b, params: Array.isArray(c) ? c : [] };
}

/* ============ Baileys (free) ============ */
if (WA_MODE === 'baileys') {
  console.log(`[whatsapp] Using Baileys mode (WA_MODE=${JSON.stringify(RAW_WA_MODE)})`);
  const { sendText: bSendText } = require('./baileysClient');

  async function sendText(a, b) {
    const { to, body } = parseTextArgs(a, b);
    if (!to) throw new Error('sendText: "to" required');
    console.log(`[whatsapp.baileys] Sending message to ${to}`);
    try {
      const result = await bSendText(to, body ?? '');
      console.log(`[whatsapp.baileys] ✅ Message sent successfully to ${to}`);
      return result;
    } catch (e) {
      console.error(`[whatsapp.baileys] ❌ Error sending to ${to}:`, e.message);
      throw e;
    }
  }

  // Simple template fallback for Baileys (renders as plain text)
  async function sendTemplate(a, b, c) {
    const { to, templateName, params } = parseTemplateArgs(a, b, c);
    if (!to) throw new Error('sendTemplate: "to" required');
    const rendered =
      `🔔 ${templateName}\n` +
      (params || []).map((p, i) => `{{${i + 1}}} ${String(p)}`).join('\n');
    console.log(`[whatsapp.baileys] Sending template "${templateName}" to ${to}`);
    try {
      const result = await bSendText(to, rendered);
      console.log(`[whatsapp.baileys] ✅ Template sent successfully to ${to}`);
      return result;
    } catch (e) {
      console.error(`[whatsapp.baileys] ❌ Error sending template to ${to}:`, e.message);
      throw e;
    }
  }

  module.exports = { sendText, sendTemplate };
  return; // 🛑 important: don’t fall through to Cloud branch
}

/* ===== Official Cloud API branch ===== */
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const apiBase = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_NUMBER_ID}/messages`;

// 🧩 Helper to E.164-ish digits
function normalizePhone(raw) {
  const digits = (raw || '').toString().replace(/\D/g, '');
  if (!digits) throw new Error('Invalid phone number');
  return digits;
}

async function sendRaw(body) {
  if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
    console.warn('[whatsapp.cloud] ⚠️ Cloud API env missing; skipping send.');
    return;
  }
  console.log(`[whatsapp.cloud] Sending to API: ${apiBase}`);
  try {
    const res = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`WA Cloud API error ${res.status}: ${t}`);
    }
    const json = await res.json();
    console.log(`[whatsapp.cloud] ✅ Message sent successfully`);
    return json;
  } catch (e) {
    console.error(`[whatsapp.cloud] ❌ Error:`, e.message);
    throw e;
  }
}

// Public API (supports both signatures)
async function sendText(a, b) {
  const { to, body } = parseTextArgs(a, b);
  const msisdn = normalizePhone(to);
  return sendRaw({ to: msisdn, type: 'text', text: { preview_url: false, body: body ?? '' } });
}

async function sendTemplate(a, b, c) {
  const { to, templateName, params } = parseTemplateArgs(a, b, c);
  const msisdn = normalizePhone(to);
  const components = (params && params.length)
    ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p) })) }]
    : [];
  return sendRaw({
    to: msisdn,
    type: 'template',
    template: {
      name: templateName,
      language: { code: process.env.WHATSAPP_LANG || 'en' },
      components
    }
  });
}

module.exports = { sendText, sendTemplate };
