'use strict';
// Pemanggil Gemini. API key dan model per paket diatur admin di /admin/ai (disimpan lewat lib/settings.js).
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

// Nama pengaturan untuk key khusus satu paket, contoh: free -> GEMINI_API_KEY_FREE.
const keyName = (planId) => 'GEMINI_API_KEY_' + String(planId).toUpperCase();

// Key dan model yang berlaku untuk satu paket. Key khusus paket dipakai bila ada;
// kalau belum diisi, paket memakai key bawaan (GEMINI_API_KEY).
async function resolve(planId) {
  const v = await settings.getAll();
  const models = parseModels(v.AI_CONFIG);
  const own = planIds().includes(planId) ? (v[keyName(planId)] || '') : '';
  return {
    key: own || v.GEMINI_API_KEY || '',
    keySource: own ? 'plan' : (v.GEMINI_API_KEY ? 'default' : null),
    model: models[planId] || DEFAULT_MODEL
  };
}

// Catatan: model Gemini 3.x tidak menerima temperature/top_p/top_k, dan giliran
// terakhir di "contents" harus dari user dengan teks tidak kosong.
// plan = id paket toko (free/starter/bisnis); menentukan model yang dipakai.
async function generate({ system, contents, plan }) {
  const { key, model } = await resolve(plan);
  if (!key) throw new Error('GEMINI_API_KEY belum diatur');

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
    if (!r.ok) throw new Error('Gemini ' + r.status + ' (' + model + '): ' + (await r.text()).slice(0, 300));
    const d = await r.json();
    const parts = (d.candidates && d.candidates[0] && d.candidates[0].content &&
      d.candidates[0].content.parts) || [];
    return parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generate, resolve, keyName, parseModels, sanitizeModels, MODEL, DEFAULT_MODEL };
