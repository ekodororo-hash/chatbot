'use strict';
// Cek pemasangan widget: server mengambil halaman situs klien lalu mencari kode widget di dalamnya.
// Karena server membuka alamat yang diketik pengguna, ada penjagaan SSRF: hanya http/https port 80/443,
// nama domain biasa (bukan IP), dan setiap alamat hasil DNS diperiksa saat koneksi dibuat, termasuk
// setiap kali ada pengalihan (redirect). Alamat privat, loopback, dan link-local ditolak.

const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');
const zlib = require('zlib');
const domains = require('./domains');

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 8000;

// "tokoayu.com", "https://www.tokoayu.com/produk" -> URL. Null kalau tidak valid.
function parseSiteUrl(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s || s.length > 300) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch (e) { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const n = domains.normalizeDomain(u.hostname);
  if (!n || n === 'localhost') return null;
  u.hash = '';
  return u;
}

function expandV6(ip) {
  let s = ip.split('%')[0].toLowerCase();
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const p = tail[1].split('.').map(Number);
    s = s.slice(0, -tail[1].length) + ((p[0] << 8) | p[1]).toString(16) + ':' + ((p[2] << 8) | p[3]).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const a = halves[0] ? halves[0].split(':') : [];
  const b = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - a.length - b.length : 0;
  if (fill < 0) return null;
  const all = a.concat(new Array(fill).fill('0'), b).map((h) => parseInt(h || '0', 16));
  return all.length === 8 && all.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? all : null;
}

function isPrivateV4(a, b, c) {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return a >= 224;
}

// True untuk alamat yang tidak boleh dihubungi server (internal, loopback, link-local, multicast, dokumentasi).
function isPrivateIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    return isPrivateV4(p[0], p[1], p[2]);
  }
  if (v === 6) {
    const g = expandV6(ip);
    if (!g) return true;
    if (g.every((n) => n === 0)) return true;                                   // ::
    if (g.slice(0, 7).every((n) => n === 0) && g[7] === 1) return true;       // ::1
    if (g.slice(0, 5).every((n) => n === 0) && (g[5] === 0xffff || g[5] === 0)) {
      return isPrivateV4(g[6] >> 8, g[6] & 255, g[7] >> 8);                    // ::ffff:a.b.c.d dan ::a.b.c.d
    }
    if ((g[0] & 0xfe00) === 0xfc00) return true;                                // fc00::/7
    if ((g[0] & 0xffc0) === 0xfe80) return true;                                // fe80::/10
    if ((g[0] & 0xff00) === 0xff00) return true;                                // ff00::/8
    if (g[0] === 0x64 && g[1] === 0xff9b) return true;                          // 64:ff9b::/96
    if (g[0] === 0x2001 && g[1] === 0x0db8) return true;                        // dokumentasi
    if (g[0] === 0x2002) return isPrivateV4(g[1] >> 8, g[1] & 255, g[2] >> 8);  // 6to4
    return false;
  }
  return true;
}

// Dipasang sebagai opsi `lookup` pada request, jadi alamat yang diperiksa persis alamat yang dipakai
// untuk konek (tidak bisa dibelokkan lewat DNS rebinding di antara pemeriksaan dan koneksi).
function guardedLookup(hostname, options, cb) {
  if (typeof options === 'function') { cb = options; options = {}; }
  dns.lookup(hostname, Object.assign({}, options, { all: true }), (err, addrs) => {
    if (err) return cb(err);
    if (!addrs || !addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      const e = new Error('Alamat situs tidak diizinkan.');
      e.code = 'EBLOCKED';
      return cb(e);
    }
    if (options && options.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

function getOnce(u) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    let done = false;
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(deadline); fn(v); };
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      method: 'GET',
      lookup: guardedLookup,
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CekPemasanganBot/1.0)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400) { res.resume(); return finish(resolve, { status, headers: res.headers, body: '', truncated: false }); }
      let stream = res;
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      const chunks = [];
      let size = 0, truncated = false;
      stream.on('data', (c) => {
        if (truncated) return;
        size += c.length;
        if (size > MAX_BYTES) {
          truncated = true;
          chunks.push(c.subarray(0, c.length - (size - MAX_BYTES)));
          res.destroy();
          return finish(resolve, { status, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), truncated: true });
        }
        chunks.push(c);
      });
      stream.on('end', () => finish(resolve, { status, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), truncated }));
      stream.on('error', (e) => finish(reject, e));
      res.on('error', (e) => finish(reject, e));
    });
    const deadline = setTimeout(() => { const e = new Error('timeout'); e.code = 'ETIMEDOUT'; req.destroy(e); finish(reject, e); }, TIMEOUT_MS + 2000);
    req.on('timeout', () => { const e = new Error('timeout'); e.code = 'ETIMEDOUT'; req.destroy(e); finish(reject, e); });
    req.on('error', (e) => finish(reject, e));
    req.end();
  });
}

function reasonFor(e) {
  const c = e && e.code;
  if (c === 'EBLOCKED') return 'Alamat itu tidak boleh dibuka dari server.';
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return 'Nama situs tidak ditemukan. Periksa penulisan alamatnya.';
  if (c === 'ETIMEDOUT') return 'Situs terlalu lama membalas.';
  if (c === 'ECONNREFUSED' || c === 'ECONNRESET') return 'Situs menolak koneksi.';
  if (c && /CERT|SSL|TLS|ERR_TLS/i.test(c)) return 'Sertifikat HTTPS situs bermasalah.';
  return 'Situs tidak bisa dibuka dari server.';
}

// Ambil halaman, ikuti redirect dengan pemeriksaan ulang tiap lompatan.
// Hasil: { fetched: true, url, status, body, truncated, redirected } atau { fetched: false, reason }.
async function fetchPage(startUrl) {
  let u = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let r;
    try { r = await getOnce(u); } catch (e) { return { fetched: false, reason: reasonFor(e) }; }
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      let next = null;
      try { next = parseSiteUrl(new URL(r.headers.location, u).toString()); } catch (e) { next = null; }
      if (!next) return { fetched: false, reason: 'Situs mengalihkan ke alamat yang tidak bisa dicek.' };
      u = next;
      continue;
    }
    if (r.status >= 400) return { fetched: false, reason: 'Situs membalas dengan kode ' + r.status + (r.status === 403 || r.status === 401 ? ' (mungkin ada proteksi bot atau halaman dikunci).' : '.') };
    if (r.status < 200 || r.status >= 300) return { fetched: false, reason: 'Balasan situs tidak bisa dibaca (kode ' + r.status + ').' };
    const ct = String(r.headers['content-type'] || '').toLowerCase();
    if (ct && !/html|xml/.test(ct)) return { fetched: false, reason: 'Alamat itu bukan halaman web (' + ct.split(';')[0] + ').' };
    return { fetched: true, url: u, status: r.status, body: r.body, truncated: r.truncated, redirected: u.toString() !== startUrl.toString() };
  }
  return { fetched: false, reason: 'Terlalu banyak pengalihan alamat.' };
}

function attr(tag, name) {
  const re = new RegExp('(?:^|[\\s"\'/])' + name.replace(/-/g, '\\-') + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))', 'i');
  const m = tag.match(re);
  return m ? (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]) : null;
}

const WIDGET_SRC = /\/widget\.js(?:[?#]|$)/i;

// Cari kode widget di HTML. match = ada kode untuk slug ini; others = slug lain yang ditemukan.
// Selain tag <script> biasa, dibaca juga jejak Next.js <Script> (disuntik lewat JavaScript, tidak berupa tag).
function analyzeHtml(html, slug) {
  const clean = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
  const bots = [];
  let found = false;
  const re = /<script\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(clean))) {
    const tag = m[1];
    const src = attr(tag, 'src') || attr(tag, 'data-src') || attr(tag, 'data-rocket-src');
    if (!src || !WIDGET_SRC.test(src)) continue;
    found = true;
    const bot = attr(tag, 'data-bot');
    if (bot) bots.push(bot.trim());
  }
  if (!found) {
    const re2 = /\/widget\.js(?=[?#"'\\\s]|$)/gi;
    while ((m = re2.exec(clean))) {
      const win = clean.slice(Math.max(0, m.index - 300), m.index + 500);
      const b = win.match(/data-bot\\?["']?\s*[:=]\s*\\?["']([a-z0-9-]{3,30})\\?["']/i);
      if (b) { found = true; bots.push(b[1]); }
    }
  }
  const match = bots.includes(slug);
  const others = Array.from(new Set(bots.filter((b) => b !== slug)));
  return { found, match, others };
}

// Apakah host termasuk domain terdaftar (domain itu sendiri atau subdomainnya), sama dengan aturan frame-ancestors.
function isRegistered(host, allowed) {
  const n = domains.normalizeDomain(host);
  if (!n) return false;
  return (allowed || []).some((d) => {
    const dn = domains.normalizeDomain(d);
    return !!dn && (n === dn || n.endsWith('.' + dn));
  });
}

module.exports = { parseSiteUrl, isPrivateIp, guardedLookup, fetchPage, analyzeHtml, isRegistered };
