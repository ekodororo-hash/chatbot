'use strict';
// Pemanggil AI. Penyedia (Gemini atau yang berformat OpenAI: Groq, OpenRouter, Mistral, Cerebras), API key (sampai 3 per paket)
// dan model per paket diatur admin di /admin/ai (disimpan lewat lib/settings.js). Bawaan semua paket: Gemini.
// Urutan: isian web lebih dulu, lalu environment variable (GEMINI_API_KEY, GEMINI_MODEL) sebagai cadangan (khusus Gemini).
const settings = require('./settings');
const plans = require('./plans');

// Model bawaan bila paket belum punya model sendiri. Bisa diganti lewat env GEMINI_MODEL.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const MODEL = DEFAULT_MODEL; // dipertahankan untuk kode lama
// Boleh memuat "/" dan ":" karena nama model OpenRouter seperti "meta-llama/llama-3.3-70b-instruct:free".
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,59}$/;
const modelOk = (m) => MODEL_RE.test(m) && !m.includes('..');

// Penyedia AI. Gemini punya format sendiri; sisanya berformat OpenAI (POST {base}/chat/completions, Authorization: Bearer).
// model = model bawaan penyedia bila paket belum mengisi (kosong = admin wajib mengisi). json = mendukung response_format json_object.
// Nama model sering berubah; admin bisa menggantinya di /admin/ai tanpa deploy.
const PROVIDERS = {
  gemini:     { id: 'gemini',     label: 'Gemini (Google)', keyHint: 'AIza...', model: DEFAULT_MODEL },
  groq:       { id: 'groq',       label: 'Groq',            keyHint: 'gsk_...', model: 'llama-3.3-70b-versatile', base: 'https://api.groq.com/openai/v1', json: true },
  openrouter: { id: 'openrouter', label: 'OpenRouter',      keyHint: 'sk-or-...', model: '', base: 'https://openrouter.ai/api/v1', json: false },
  mistral:    { id: 'mistral',    label: 'Mistral',         keyHint: '', model: 'mistral-small-latest', base: 'https://api.mistral.ai/v1', json: true },
  cerebras:   { id: 'cerebras',   label: 'Cerebras',        keyHint: 'csk-...', model: 'gpt-oss-120b', base: 'https://api.cerebras.ai/v1', json: true }
};
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const planIds = () => Object.keys(plans.PLANS);

// AI_CONFIG = JSON { models: { free: '...', starter: '...', bisnis: '...' } }. Isian rusak/kosong diabaikan.
function parseModels(raw) {
  let o = null;
  try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
  const out = {};
  planIds().forEach((id) => {
    const m = o && o.models && typeof o.models[id] === 'string' ? o.models[id].trim() : '';
    if (m && modelOk(m)) out[id] = m;
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
    if (!modelOk(m)) {
      throw Object.assign(new Error('Nama model "' + m.slice(0, 40) + '" tidak valid. Pakai huruf, angka, titik, strip, atau garis bawah (contoh gemini-2.5-flash atau meta-llama/llama-3.3-70b-instruct:free).'), { httpStatus: 400 });
    }
    out[id] = m;
  });
  return out;
}

// AI_CONFIG.providers = { free: 'groq', ... }. Paket tanpa isian (atau isian tidak dikenal) memakai Gemini.
function parseProviders(raw) {
  let o = null;
  try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
  const out = {};
  planIds().forEach((id) => {
    const v = o && o.providers && typeof o.providers[id] === 'string' ? o.providers[id].trim() : '';
    if (v && v !== 'gemini' && has(PROVIDERS, v)) out[id] = v;
  });
  return out;
}

// Periksa masukan admin. Kosong atau "gemini" = bawaan. Melempar Error (400) bila penyedia tidak dikenal.
function sanitizeProviders(input) {
  input = input || {};
  const out = {};
  planIds().forEach((id) => {
    const v = String(input[id] == null ? '' : input[id]).trim();
    if (!v || v === 'gemini') return;
    if (!has(PROVIDERS, v)) throw Object.assign(new Error('Penyedia AI "' + v.slice(0, 30) + '" tidak dikenal.'), { httpStatus: 400 });
    out[id] = v;
  });
  return out;
}

// Tiap paket boleh punya sampai KEYS_PER_PLAN key. Nama pengaturan: free -> GEMINI_API_KEY_FREE (key 1),
// GEMINI_API_KEY_FREE_2 (key 2), GEMINI_API_KEY_FREE_3 (key 3).
const KEYS_PER_PLAN = 3;
const keyName = (planId, slot) => 'GEMINI_API_KEY_' + String(planId).toUpperCase() + (slot > 1 ? '_' + slot : '');

// Penyedia, key, dan model yang berlaku untuk satu paket. keys = key khusus paket yang terisi (urut slot);
// kalau tidak ada satu pun dan penyedianya Gemini, paket memakai key bawaan (GEMINI_API_KEY).
// Key bawaan itu key Gemini, jadi tidak pernah dipakai untuk penyedia lain.
async function resolve(planId) {
  const v = await settings.getAll();
  const models = parseModels(v.AI_CONFIG);
  const provider = parseProviders(v.AI_CONFIG)[planId] || 'gemini';
  const known = planIds().includes(planId);
  const own = [];
  if (known) for (let n = 1; n <= KEYS_PER_PLAN; n++) { const k = v[keyName(planId, n)]; if (k) own.push({ slot: n, value: k }); }
  const useDefault = provider === 'gemini' && !!v.GEMINI_API_KEY;
  const keys = own.length ? own : (useDefault ? [{ slot: 0, value: v.GEMINI_API_KEY }] : []);
  return {
    provider,
    keys,
    key: keys.length ? keys[0].value : '',
    keySource: own.length ? 'plan' : (useDefault ? 'default' : null),
    model: models[planId] || PROVIDERS[provider].model
  };
}

// Satu panggilan ke penyedia berformat OpenAI (Groq, OpenRouter, Mistral, Cerebras) dengan satu key.
// contents memakai bentuk Gemini ({ role: 'user'|'model', parts: [{ text }] }) dan diubah di sini.
async function callOpenAI({ provider, key, model, system, contents }) {
  const P = PROVIDERS[provider];
  const messages = [{ role: 'system', content: system }];
  (contents || []).forEach((c) => {
    const role = c.role === 'model' ? 'assistant' : 'user';
    const text = (c.parts || []).map((x) => (x && x.text) || '').join('');
    const last = messages[messages.length - 1];
    if (last.role === role) last.content += '\n' + text; else messages.push({ role, content: text });
  });
  const body = { model, messages, max_tokens: 1024 };
  if (P.json) body.response_format = { type: 'json_object' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(P.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (!r.ok) {
      const text = (await r.text()).slice(0, 300);
      throw Object.assign(new Error(P.label + ' ' + r.status + ' (' + model + '): ' + text), { status: r.status, body: text });
    }
    const d = await r.json();
    const ch = d.choices && d.choices[0];
    // Sebagian model menulis proses berpikir di <think>...</think>: dibuang, hanya jawabannya yang dipakai.
    const out = String((ch && ch.message && ch.message.content) || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!out) throw Object.assign(new Error(P.label + ' kosong (' + model + '): ' + ((ch && ch.finish_reason) || 'tanpa teks')), { status: 0 });
    return out;
  } finally {
    clearTimeout(timer);
  }
}

// Satu panggilan ke Gemini dengan satu key. Galat membawa .status (kode HTTP) bila Gemini yang menolak.
async function callGemini({ key, model, system, contents }) {
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
    const out = parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
    if (!out) {
      const c = d.candidates && d.candidates[0];
      const why = (c && c.finishReason) || (d.promptFeedback && d.promptFeedback.blockReason) || 'tanpa teks';
      throw Object.assign(new Error('Gemini kosong (' + model + '): ' + why), { status: 0 });
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

const callOnce = (a) => (a.provider && a.provider !== 'gemini' ? callOpenAI(a) : callGemini(a));

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
  if (!keys.length) {
    throw new Error(r.provider === 'gemini' ? 'GEMINI_API_KEY belum diatur'
      : 'API key ' + PROVIDERS[r.provider].label + ' untuk paket ' + plan + ' belum diatur' + (!PROVIDERS[r.provider].model && !r.model ? ' (dan modelnya belum diisi)' : ''));
  }
  if (!r.model) throw new Error('Model ' + PROVIDERS[r.provider].label + ' untuk paket ' + plan + ' belum diisi');
  const start = keys.length > 1 && !slot ? (rotate++ % keys.length) : 0;
  let lastErr;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[(start + i) % keys.length];
    try { return await callOnce({ provider: r.provider, key: k.value, model: r.model, system, contents }); }
    catch (e) {
      lastErr = e;
      if (!worthNextKey(e)) throw e;
      if (i < keys.length - 1) console.error('Key ' + PROVIDERS[r.provider].label + ' paket ' + plan + ' gagal (' + (e.status || e.message) + '), mencoba key berikutnya');
    }
  }
  throw lastErr;
}

module.exports = { generate, resolve, keyName, KEYS_PER_PLAN, parseModels, sanitizeModels, parseProviders, sanitizeProviders, PROVIDERS, MODEL, DEFAULT_MODEL };
