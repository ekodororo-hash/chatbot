'use strict';

// Aturan tampil widget per halaman. Dipakai bersama oleh dashboard (saat menyimpan) dan /api/widget/:slug.
// Pencocokan alamat sebenarnya dilakukan di public/widget.js (blok @paths-begin ... @paths-end),
// dan dites di tests/widget.test.js.
const MAX_PATHS = 20;
const MAX_LEN = 100;
const OK_RE = /^[\p{L}\p{N}/_\-.*~:@+()]+$/u;

// Satu baris -> alamat bersih ("/akun/*"), atau '' kalau tidak valid.
function cleanLine(raw) {
  let t = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!t) return '';
  t = t.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/, '');   // buang https://domain
  t = t.replace(/[?#].*$/, '');                            // buang ?query dan #hash
  try { t = decodeURIComponent(t); } catch (e) { /* biarkan apa adanya */ }
  if (t[0] !== '/') t = '/' + t;
  t = t.replace(/\/{2,}/g, '/');
  if (t.length > 1) t = t.replace(/\/+$/, '');
  if (!t) t = '/';
  return t.length <= MAX_LEN && OK_RE.test(t) ? t : '';
}

// Teks (satu alamat per baris) atau array -> daftar alamat bersih, tanpa kembar, maksimal 20.
function cleanPaths(v) {
  const lines = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[\r\n,]+/);
  const out = [];
  lines.forEach((l) => {
    const t = cleanLine(l);
    if (t && out.indexOf(t) < 0 && out.length < MAX_PATHS) out.push(t);
  });
  return out;
}

// Baris yang tidak valid (untuk pesan kesalahan di dashboard).
function invalidLines(text) {
  return String(text == null ? '' : text).split(/[\r\n,]+/).map((l) => l.trim()).filter((l) => l && !cleanLine(l));
}

function countLines(text) {
  return String(text == null ? '' : text).split(/[\r\n,]+/).filter((l) => l.trim()).length;
}

module.exports = { cleanLine, cleanPaths, invalidLines, countLines, MAX_PATHS, MAX_LEN };
