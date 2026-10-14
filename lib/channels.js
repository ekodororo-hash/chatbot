'use strict';
// Telegram dan WhatsApp: verifikasi webhook, baca pesan masuk, kirim balasan.
// Otak bot tetap satu: lib/bot.js (handleMessage). File ini hanya "pipa" ke tiap saluran.
const crypto = require('crypto');
const { getAdmin } = require('./supabase');
const bot = require('./bot');

const TG_LIMIT = 4000;   // batas Telegram 4096 karakter per pesan
const WA_LIMIT = 4000;   // batas WhatsApp 4096 karakter per pesan
const FETCH_TIMEOUT = 15000;

function waVersion() { return process.env.WHATSAPP_API_VERSION || 'v26.0'; }

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  if (!x.length || x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

// Meta menandatangani isi mentah webhook dengan App Secret: header "sha256=<hex>".
function verifyWhatsAppSignature(rawBody, header, appSecret) {
  if (!appSecret || !header) return false;
  const want = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return safeEqual(header, want);
}

function splitText(text, limit) {
  const out = [];
  let rest = String(text || '').trim();
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut < limit / 2) cut = rest.lastIndexOf(' ', limit);
    if (cut < limit / 2) cut = limit;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/* ---------- Membaca pesan masuk ---------- */

// Mengembalikan null kalau bukan pesan pribadi yang perlu diproses (grup, edit, kanal, dll).
// kind: 'text' (diproses bot) atau 'unsupported' (foto, stiker, dll: dibalas permintaan maaf).
function parseTelegramUpdate(update) {
  const m = update && update.message;
  if (!m || !m.chat || m.chat.type !== 'private' || !m.from || m.from.is_bot) return null;
  const name = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ').trim();
  const base = { externalId: String(m.chat.id), name, messageId: 'tg:' + update.update_id };
  if (typeof m.text === 'string' && m.text.trim()) return Object.assign(base, { kind: 'text', text: m.text });
  return Object.assign(base, { kind: 'unsupported' });
}

// Satu webhook Meta bisa membawa beberapa pesan sekaligus. Status pengiriman (delivered/read) dilewati.
function parseWhatsAppPayload(payload) {
  const out = [];
  if (!payload || payload.object !== 'whatsapp_business_account') return out;
  for (const entry of payload.entry || []) {
    for (const ch of entry.changes || []) {
      const v = ch && ch.value;
      if (!v || !Array.isArray(v.messages)) continue;
      const phoneId = v.metadata && v.metadata.phone_number_id ? String(v.metadata.phone_number_id) : '';
      const names = {};
      (v.contacts || []).forEach((c) => { if (c && c.wa_id) names[c.wa_id] = (c.profile && c.profile.name) || ''; });
      for (const m of v.messages) {
        if (!m || !m.from || !m.id) continue;
        const base = { phoneId, externalId: String(m.from), name: names[m.from] || '', messageId: 'wa:' + m.id };
        if (m.type === 'text' && m.text && typeof m.text.body === 'string' && m.text.body.trim()) {
          out.push(Object.assign(base, { kind: 'text', text: m.text.body }));
        } else {
          out.push(Object.assign(base, { kind: 'unsupported' }));
        }
      }
    }
  }
  return out;
}

/* ---------- Mengirim balasan ---------- */

async function timedFetch(url, opt) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  try { return await fetch(url, Object.assign({}, opt, { signal: ctl.signal })); } finally { clearTimeout(t); }
}

async function telegramApi(token, method, body) {
  const res = await timedFetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error('Telegram: ' + (j.description || ('HTTP ' + res.status)));
  return j.result;
}

async function sendTelegram(token, chatId, text) {
  for (const part of splitText(text, TG_LIMIT)) await telegramApi(token, 'sendMessage', { chat_id: chatId, text: part });
}

async function sendWhatsApp(cfg, to, text) {
  for (const part of splitText(text, WA_LIMIT)) {
    const res = await timedFetch('https://graph.facebook.com/' + waVersion() + '/' + cfg.wa_phone_id + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.wa_token },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: part } })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('WhatsApp: ' + ((j.error && j.error.message) || ('HTTP ' + res.status)));
  }
}

// Dipakai saat admin membalas dari dashboard.
async function sendToCustomer(channel, ch, externalId, text) {
  if (channel === 'telegram') {
    if (!ch || !ch.telegram_token) throw new Error('Telegram belum terhubung.');
    return sendTelegram(ch.telegram_token, externalId, text);
  }
  if (channel === 'whatsapp') {
    if (!ch || !ch.wa_token || !ch.wa_phone_id) throw new Error('WhatsApp belum terhubung.');
    return sendWhatsApp(ch, externalId, text);
  }
  throw new Error('Saluran tidak dikenal.');
}

/* ---------- Memuat konfigurasi toko ---------- */

// Mengembalikan { shop, ch } atau null kalau toko tidak ada / belum menyambungkan saluran apa pun.
async function loadChannels(slug) {
  if (!/^[a-z0-9-]{3,30}$/.test(String(slug || ''))) return null;
  const sb = getAdmin();
  const s = await sb.from('shops').select('*').eq('slug', slug).maybeSingle();
  if (s.error) throw s.error;
  if (!s.data) return null;
  const c = await sb.from('shop_channels').select('*').eq('shop_id', s.data.id).maybeSingle();
  if (c.error) throw c.error;
  return c.data ? { shop: s.data, ch: c.data } : null;
}

/* ---------- Pemrosesan pesan masuk ---------- */

// msg = hasil parseTelegramUpdate / parseWhatsAppPayload. send(text) mengirim balasan ke pelanggan.
// Tidak pernah melempar error ke pemanggil (webhook harus tetap membalas 200 agar tidak dikirim ulang terus).
async function handleInbound(channel, ctx, msg, send) {
  try {
    const call = bot.callName(ctx.shop.tone);
    if (msg.kind === 'unsupported') {
      await send('Maaf ' + call + ', saat ini saya baru bisa membaca pesan teks.');
      return { handled: true };
    }
    // Telegram: tombol "Mulai" mengirim /start. Dibalas sapaan toko, tanpa memanggil AI.
    if (channel === 'telegram' && /^\/start(@\w+)?(\s|$)/i.test(msg.text.trim())) {
      await send(String(ctx.shop.greeting || '').replace(/\{k\}/g, call) || 'Halo, ada yang bisa dibantu?');
      return { handled: true };
    }
    const r = await bot.handleMessage({
      slug: ctx.shop.slug, channel, externalId: msg.externalId, customerName: msg.name,
      externalMessageId: msg.messageId, text: msg.text
    });
    if (r.duplicate) return { handled: false, duplicate: true };
    for (const m of r.messages) if (m.role === 'bot') await send(m.content);
    return { handled: true };
  } catch (e) {
    // 429 (terlalu cepat/terlalu panjang) tidak dibalas supaya tidak jadi spam; sisanya dicatat.
    if (!e || e.httpStatus !== 429) console.error('Saluran ' + channel + ' gagal:', e && e.message);
    return { handled: false, error: true };
  }
}

module.exports = {
  safeEqual, verifyWhatsAppSignature, splitText, waVersion,
  parseTelegramUpdate, parseWhatsAppPayload,
  telegramApi, sendTelegram, sendWhatsApp, sendToCustomer, timedFetch,
  loadChannels, handleInbound
};
