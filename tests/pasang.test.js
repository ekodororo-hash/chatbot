'use strict';
// Jalankan: node tests/pasang.test.js
const assert = require('assert');
const http = require('http');
const sc = require('../lib/siteCheck');
const qr = require('../lib/qr');

// --- parseSiteUrl
assert.strictEqual(sc.parseSiteUrl('tokoayu.com').hostname, 'tokoayu.com');
assert.strictEqual(sc.parseSiteUrl('  https://www.TokoAyu.com/katalog?x=1#a ').hostname, 'www.tokoayu.com');
assert.strictEqual(sc.parseSiteUrl('http://tokoayu.com:80/').port, '');
['', 'localhost', 'http://localhost:3000', '127.0.0.1', 'http://10.0.0.5/', 'http://[::1]/', 'http://2130706433/',
  'ftp://tokoayu.com', 'javascript:alert(1)', 'https://user:pw@tokoayu.com', 'https://tokoayu.com:8080', 'bukan domain', null, 42]
  .forEach((x) => assert.strictEqual(sc.parseSiteUrl(x), null, 'harus ditolak: ' + x));

// --- isPrivateIp
['0.0.0.0', '10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '224.0.0.1',
  '::', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe', '2002:7f00:1::', '64:ff9b::1', 'bukan-ip']
  .forEach((ip) => assert.strictEqual(sc.isPrivateIp(ip), true, 'harus privat: ' + ip));
['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '100.63.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8']
  .forEach((ip) => assert.strictEqual(sc.isPrivateIp(ip), false, 'harus publik: ' + ip));

// --- analyzeHtml
const tag = (extra) => '<html><head></head><body><script ' + extra + '></script></body></html>';
let a = sc.analyzeHtml(tag('src="https://app.id/widget.js" data-bot="toko-ayu" defer'), 'toko-ayu');
assert.deepStrictEqual(a, { found: true, match: true, others: [] });
a = sc.analyzeHtml(tag("defer data-bot='toko-ayu' src='https://app.id/widget.js?v=2'"), 'toko-ayu');
assert.strictEqual(a.match, true);
a = sc.analyzeHtml(tag('src="https://app.id/widget.js" data-bot="toko-lain"'), 'toko-ayu');
assert.deepStrictEqual(a, { found: true, match: false, others: ['toko-lain'] });
a = sc.analyzeHtml('<html><body>halo</body></html>', 'toko-ayu');
assert.deepStrictEqual(a, { found: false, match: false, others: [] });
// dikomentari tidak dihitung
a = sc.analyzeHtml('<!-- <script src="https://app.id/widget.js" data-bot="toko-ayu"></script> -->', 'toko-ayu');
assert.strictEqual(a.found, false);
// script lain yang kebetulan bernama mirip tidak dihitung
a = sc.analyzeHtml(tag('src="/static/mywidget.json" data-bot="toko-ayu"'), 'toko-ayu');
assert.strictEqual(a.found, false);
// WP Rocket menunda script
a = sc.analyzeHtml('<script type="rocketlazyloadscript" data-rocket-src="https://app.id/widget.js" data-bot="toko-ayu"></script>', 'toko-ayu');
assert.strictEqual(a.match, true);
// Next.js <Script> (App Router) disuntik lewat JavaScript
a = sc.analyzeHtml('<script>(self.__next_s=self.__next_s||[]).push(["https://app.id/widget.js",{"data-bot":"toko-ayu"}])</script>', 'toko-ayu');
assert.strictEqual(a.match, true);
a = sc.analyzeHtml('<script>self.__next_f.push([1,"{\\"src\\":\\"https://app.id/widget.js\\",\\"data-bot\\":\\"toko-ayu\\"}"])</script>', 'toko-ayu');
assert.strictEqual(a.match, true);

// --- halaman penghadang bot
const iff = '<html><body><script type="text/javascript" src="/aes.js"></script><script>function toNumbers(d){}var a=toNumbers("f6"),slowAES.decrypt;document.cookie="__test="+toHex(slowAES.decrypt(c,2,a,b))+"; expires=Thu, 31-Dec-37 23:55:55 GMT; path=/"; location.href="http://x.rf.gd/?i=1";</script></body></html>';
assert.strictEqual(sc.looksLikeBotWall(iff, {}), true);
assert.strictEqual(sc.looksLikeBotWall('<title>Just a moment...</title>', {}), true);
assert.strictEqual(sc.looksLikeBotWall('<html></html>', { 'cf-mitigated': 'challenge' }), true);
assert.strictEqual(sc.looksLikeBotWall('<html><body>Toko Ayu</body></html>', {}), false);
assert.strictEqual(sc.looksLikeBotWall('x'.repeat(30000) + 'slowAES', {}), false);

// --- isRegistered (domain + subdomain, abaikan www)
assert.strictEqual(sc.isRegistered('www.tokoayu.com', ['tokoayu.com']), true);
assert.strictEqual(sc.isRegistered('tokoayu.com', ['https://www.tokoayu.com']), true);
assert.strictEqual(sc.isRegistered('shop.tokoayu.com', ['tokoayu.com']), true);
assert.strictEqual(sc.isRegistered('eviltokoayu.com', ['tokoayu.com']), false);
assert.strictEqual(sc.isRegistered('tokoayu.com.evil.io', ['tokoayu.com']), false);
assert.strictEqual(sc.isRegistered('tokoayu.com', []), false);
assert.strictEqual(sc.isRegistered('tokoayu.com', null), false);

// --- fetch: server lokal harus ditolak oleh penjaga SSRF, bukan diambil
(async () => {
  const srv = http.createServer((req, res) => { res.end('<script src="/widget.js" data-bot="x"></script>'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  // parseSiteUrl menolak port non-standar dan IP; uji penjaga lookup langsung
  const lookup = (host) => new Promise((resolve) => sc.guardedLookup(host, {}, (err) => resolve(err)));
  const err = await lookup('localhost');
  assert.ok(err && err.code === 'EBLOCKED', 'localhost harus diblokir saat lookup');
  const r = await sc.fetchPage(new URL('http://localhost:' + port + '/'));
  assert.strictEqual(r.fetched, false);
  srv.close();

  // --- QR
  const q = qr.encode('https://contoh.com/chat/toko-ayu');
  assert.ok(q.size >= 21 && (q.size - 17) % 4 === 0);
  // pola finder di tiga sudut
  [[0, 0], [q.size - 7, 0], [0, q.size - 7]].forEach(([x, y]) => {
    assert.strictEqual(q.modules[y][x], true);
    assert.strictEqual(q.modules[y + 3][x + 3], true);
    assert.strictEqual(q.modules[y + 1][x + 1], false);
  });
  assert.ok(qr.toSvg(q).startsWith('<svg'));
  assert.throws(() => qr.encode('x'.repeat(214)));
  assert.doesNotThrow(() => qr.encode('x'.repeat(213)));
  console.log('pasang.test.js: semua lolos');
})().catch((e) => { console.error(e); process.exit(1); });
