'use strict';
// Pemanggil Gemini. API key (sampai 3 per paket) dan model per paket diatur admin di /admin/ai (disimpan lewat lib/settings.js).
// Urutan: isian web lebih dulu, lalu environment variable (GEMINI_API_KEY, GEMINI_MODEL) sebagai cadangan.
const settings = require('./settings');
const plans = require('./plans');

// Model bawaan bila paket belum punya model sendiri. Bisa diganti lewat env GEMINI_MODEL.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const MODEL = DEFAULT_MODEL; // dipertahankan untuk kode lama
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$/;

const planIds = () => Object.keys(plans.PLANS);

// AI_CONFIG = JSON { models: { free: '...', starter: '...', bisnis: '...' } }. Isian rusak/kosong diabaikan.
function parseModels(raw) {
  let o = null;
  try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
  const out = {};
  planIds().forEach((id) => {
    const m = o && o.models && typeof o.models[id] === 'string' ? o.models[id].trim() : '';
    if (m && MODEL_RE.test(m)) out[id] = m;
  });
  return out;
}

// Periksa masukan admin. Nama kosong = pakai model bawaan. Melempar Error (400) bila format tidak sah.
function sanitizeModels(input) {
  input = input || {};
  const out = {};
  planIds().forEach((id) => {
    const m = String(input[id] == null ? '' : input[id]).trim();
    if (!m) return;
    if (!MODEL_RE.test(m)) {
      throw Object.assign(new Error('Nama model "' + m.slice(0, 40) + '" tidak valid. Pakai huruf, angka, titik, strip, atau garis bawah (contoh gemini-2.5-flash).'), { httpStatus: 400 });
    }
    out[id] = m;
  });
  return out;
}

// Tiap paket boleh punya sampai KEYS_PER_PLAN key. Nama pengaturan: free -> GEMINI_API_KEY_FREE (key 1),
// GEMINI_API_KEY_FREE_2 (key 2), GEMINI_API_KEY_FREE_3 (key 3).
const KEYS_PER_PLAN = 3;
const keyName = (planId, slot) => 'GEMINI_API_KEY_' + String(planId).toUpperCase() + (slot > 1 ? '_' + slot : '');

// Key dan model yang berlaku untuk satu paket. keys = key khusus paket yang terisi (urut slot);
// kalau tidak ada satu pun, paket memakai key bawaan (GEMINI_API_KEY).
async function resolve(planId) {
  const v = await settings.getAll();
  const models = parseModels(v.AI_CONFIG);
  const known = planIds().includes(planId);
  const own = [];
  if (known) for (let n = 1; n <= KEYS_PER_PLAN; n++) { const k = v[keyName(planId, n)]; if (k) own.push({ slot: n, value: k }); }
  const keys = own.length ? own : (v.GEMINI_API_KEY ? [{ slot: 0, value: v.GEMINI_API_KEY }] : []);
  return {
    keys,
    key: keys.length ? keys[0].value : '',
    keySource: own.length ? 'plan' : (v.GEMINI_API_KEY ? 'default' : null),
    model: models[planId] || DEFAULT_MODEL
  };
}

// Satu panggilan ke Gemini dengan satu key. Galat membawa .status (kode HTTP) bila Gemini yang menolak.
async function callOnce({ key, model, system, contents }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1024 }
      }),
      signal: ctrl.signal
    });
    if (!r.ok) {
      const text = (await r.text()).slice(0, 300);
      throw Object.assign(new Error('Gemini ' + r.status + ' (' + model + '): ' + text), { status: r.status, body: text });
    }
    const d = await r.json();
    const parts = (d.candidates && d.candidates[0] && d.candidates[0].content &&
      d.candidates[0].content.parts) || [];
    return parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
  } finally {
    clearTimeout(timer);
  }
}

// Boleh dicoba dengan key lain? Ya untuk: kuota habis (429), key ditolak (401/403, atau 400 "API key"), galat server (5xx),
// dan gangguan jaringan/timeout. Tidak untuk galat yang sama di semua key (mis. nama model salah, permintaan salah).
function worthNextKey(e) {
  const st = e && e.status;
  if (!st) return true;
  if (st === 429 || st === 401 || st === 403 || st >= 500) return true;
  return st === 400 && /api[_ ]key/i.test((e && e.body) || '');
}

let rotate = 0;   // putaran bergantian antar key (per proses server)

// Catatan: model Gemini 3.x tidak menerima temperature/top_p/top_k, dan giliran
// terakhir di "contents" harus dari user dengan teks tidak kosong.
// plan = id paket toko (free/starter/bisnis); menentukan model dan key yang dipakai.
// slot (opsional, 1 sampai 3) = paksa satu key paket itu saja, untuk tes koneksi.
async function generate({ system, contents, plan, slot }) {
  const r = await resolve(plan);
  const keys = slot ? r.keys.filter((k) => k.slot === slot) : r.keys;
  if (!keys.length) throw new Error('GEMINI_API_KEY belum diatur');
  const start = keys.length > 1 && !slot ? (rotate++ % keys.length) : 0;
  let lastErr;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[(start + i) % keys.length];
    try { return await callOnce({ key: k.value, model: r.model, system, contents }); }
    catch (e) {
      lastErr = e;
      if (!worthNextKey(e)) throw e;
      if (i < keys.length - 1) console.error('Key Gemini paket ' + plan + ' gagal (' + (e.status || e.message) + '), mencoba key berikutnya');
    }
  }
  throw lastErr;
}

module.exports = { generate, resolve, keyName, KEYS_PER_PLAN, parseModels, sanitizeModels, MODEL, DEFAULT_MODEL };
