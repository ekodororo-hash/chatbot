'use strict';

const RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// "https://www.TokoAyu.com/katalog" -> "tokoayu.com". Hasil null kalau tidak valid.
function normalizeDomain(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/^www\./, '');
  if (s === 'localhost') return s;
  return RE.test(s) ? s : null;
}

// Nilai header CSP yang menentukan situs mana yang boleh memasang widget (iframe).
// Setiap domain divalidasi ulang di sini supaya tidak ada injeksi ke header.
function frameAncestors(domains) {
  const parts = ["'self'"];
  (domains || []).forEach(d => {
    const n = normalizeDomain(d);
    if (!n) return;
    if (n === 'localhost') { parts.push('http://localhost:*', 'http://localhost'); return; }
    parts.push('https://' + n, 'https://*.' + n);
  });
  return 'frame-ancestors ' + parts.join(' ');
}

module.exports = { normalizeDomain, frameAncestors };
