'use strict';
// Pengaturan layanan yang diisi admin lewat halaman /admin/pengaturan (key pembayaran). Disimpan di tabel app_settings
// (hanya bisa diakses server). Nilai rahasia dienkripsi AES-256-GCM; kuncinya diturunkan dari SETTINGS_SECRET kalau ada,
// kalau tidak dari SUPABASE_SERVICE_ROLE_KEY (sudah ada di server, jadi tidak perlu variabel baru).
// Urutan baca: isian dari web lebih dulu, lalu environment variable (cadangan).
const crypto = require('crypto');
const { getAdmin } = require('./supabase');

const SECRET = new Set(['MIDTRANS_SERVER_KEY', 'DOKU_CLIENT_ID', 'DOKU_SECRET_KEY']);
const FLAGS = new Set(['MIDTRANS_IS_PRODUCTION', 'DOKU_IS_PRODUCTION']);
const KEYS = [...SECRET, ...FLAGS];
const TTL_MS = 15000;

let cache = null;   // { at, values, meta }

function encKey() {
  const base = process.env.SETTINGS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return crypto.createHash('sha256').update('app_settings:' + base).digest();
}
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}
function decrypt(blob) {
  const [v, iv, tag, ct] = String(blob || '').split(':');
  if (v !== 'v1' || !iv || !tag || !ct) return '';
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch (e) { return ''; }   // kunci enkripsi berubah: anggap kosong, jatuh ke environment variable
}
const hint = (v) => (v ? '••••' + String(v).slice(-4) : '');

async function load() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const values = {}, meta = {};
  KEYS.forEach((k) => {
    const v = process.env[k] || '';
    values[k] = v; meta[k] = { source: v ? 'env' : null, hint: SECRET.has(k) ? hint(v) : v };
  });
  try {
    const { data, error } = await getAdmin().from('app_settings').select('key,value').in('key', KEYS);
    if (error) throw error;
    (data || []).forEach((r) => {
      const v = SECRET.has(r.key) ? decrypt(r.value) : String(r.value || '');
      if (!v) return;
      values[r.key] = v; meta[r.key] = { source: 'web', hint: SECRET.has(r.key) ? hint(v) : v };
    });
  } catch (e) { /* tabel belum dibuat atau gagal dibaca: pakai environment variable saja */ }
  cache = { at: Date.now(), values, meta };
  return cache;
}

async function getAll() { return (await load()).values; }
async function describe() { return (await load()).meta; }

// patch: { KEY: 'nilai' }. Nilai kosong menghapus isian web (kembali ke environment variable).
async function save(patch) {
  const sb = getAdmin();
  const up = [], del = [];
  Object.keys(patch).forEach((k) => {
    if (!KEYS.includes(k)) return;
    const v = String(patch[k] == null ? '' : patch[k]).trim();
    if (!v) del.push(k);
    else up.push({ key: k, value: SECRET.has(k) ? encrypt(v) : v, updated_at: new Date().toISOString() });
  });
  if (up.length) { const { error } = await sb.from('app_settings').upsert(up, { onConflict: 'key' }); if (error) throw error; }
  if (del.length) { const { error } = await sb.from('app_settings').delete().in('key', del); if (error) throw error; }
  cache = null;
}

module.exports = { getAll, describe, save, KEYS };
