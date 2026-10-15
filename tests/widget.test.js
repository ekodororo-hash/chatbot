'use strict';
// Jalankan: node tests/widget.test.js
const assert = require('assert');
const wc = require('../lib/widgetConfig');

const d = wc.clean({});
assert.deepStrictEqual(d, {
  color: '#0b7a75', pos: 'right', icon: '\uD83D\uDCAC', logo: '', label: '', teaser: '', size: 'sedang', shape: 'bulat', bubble: 'bulat', ox: 20, oy: 20,
  hours: { on: false, open: '09:00', close: '17:00', days: [1, 2, 3, 4, 5, 6], tz: 'Asia/Jakarta' }, eta: 0
});

const c = wc.clean({ accent: '#ff0000', widget_pos: 'left', widget_icon: ' \uD83D\uDED2 ', widget_label: 'Tanya kami', widget_teaser: 'Halo!', widget_size: 'besar', widget_shape: 'kotak' });
assert.strictEqual(c.color, '#ff0000');
assert.strictEqual(c.pos, 'left');
assert.strictEqual(c.icon, '\uD83D\uDED2');
assert.strictEqual(c.size, 'besar');
assert.strictEqual(c.shape, 'kotak');

// nilai rusak jatuh ke default, teks dipotong
const bad = wc.clean({ accent: 'red', widget_pos: 'top', widget_size: 'raksasa', widget_shape: 'x', widget_label: 'a'.repeat(100), widget_icon: '' });
assert.strictEqual(bad.color, '#0b7a75');
assert.strictEqual(bad.pos, 'right');
assert.strictEqual(bad.size, 'sedang');
assert.strictEqual(bad.shape, 'bulat');
assert.strictEqual(bad.label.length, 30);
assert.strictEqual(bad.icon, '\uD83D\uDCAC');

// logo hanya boleh data:image png/jpeg/webp dan tidak lebih dari batas; selain itu dibuang
const okLogo = 'data:image/webp;base64,AAAA';
assert.strictEqual(wc.clean({ widget_logo: okLogo }).logo, okLogo);
assert.strictEqual(wc.clean({ widget_logo: 'https://x.com/a.png' }).logo, '');
assert.strictEqual(wc.clean({ widget_logo: 'data:image/svg+xml;base64,AAAA' }).logo, '');
assert.strictEqual(wc.clean({ widget_logo: 'data:image/png;base64,' + 'A'.repeat(wc.LOGO_MAX) }).logo, '');

// jarak tepi, estimasi balasan, dan jam operasional divalidasi
const o = wc.clean({ widget_ox: 48, widget_oy: 90, reply_eta: 15, hours_on: true, hours_open: '08:30', hours_close: '21:00', hours_days: '1,3,5,5,9', hours_tz: 'Asia/Makassar' });
assert.strictEqual(o.ox, 48);
assert.strictEqual(o.oy, 90);
assert.strictEqual(o.eta, 15);
assert.deepStrictEqual(o.hours, { on: true, open: '08:30', close: '21:00', days: [1, 3, 5], tz: 'Asia/Makassar' });
const ob = wc.clean({ widget_ox: -5, widget_oy: 999, reply_eta: 'x', hours_on: 'ya', hours_open: '25:00', hours_close: 'abc', hours_tz: 'Mars/Base', hours_days: '' });
assert.strictEqual(ob.ox, 20);
assert.strictEqual(ob.oy, 20);
assert.strictEqual(ob.eta, 0);
assert.deepStrictEqual(ob.hours, { on: false, open: '09:00', close: '17:00', days: [], tz: 'Asia/Jakarta' });

// template chat: tidak ada lagi tombol mode gelap manual, dan jam operasional memberi status yang benar
const tpl = require('../lib/chatTemplate');
assert.ok(!/data-theme|isengin-theme|id="th"/.test(tpl));
const seg = tpl.slice(tpl.indexOf('var DAYN='), tpl.indexOf('function etaText'));
function hoursAt(h, iso) {
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(iso); } };
  try { return new Function('C', seg + '; return hoursInfo();')({ hours: h }); } finally { global.Date = RealDate; }
}
const wk = { on: true, open: '09:00', close: '17:00', days: [1, 2, 3, 4, 5], tz: 'Asia/Jakarta' };
assert.deepStrictEqual(hoursAt(wk, '2026-10-15T03:00:00Z'), { on: true });                    // Kamis 10:00 WIB
assert.deepStrictEqual(hoursAt(wk, '2026-10-15T12:00:00Z'), { on: false, nd: -2, open: '09:00' }); // Kamis 19:00 WIB
assert.deepStrictEqual(hoursAt(wk, '2026-10-17T03:00:00Z'), { on: false, nd: 1, open: '09:00' });   // Sabtu 10:00 WIB
assert.deepStrictEqual(hoursAt(wk, '2026-10-15T00:30:00Z'), { on: false, nd: -1, open: '09:00' }); // Kamis 07:30 WIB
assert.deepStrictEqual(hoursAt({ ...wk, open: '20:00', close: '02:00' }, '2026-10-15T18:00:00Z'), { on: true }); // Jumat 01:00 WIB, jam kamis yang lewat tengah malam
assert.strictEqual(hoursAt({ ...wk, on: false }, '2026-10-15T03:00:00Z'), null);
assert.strictEqual(wc.clean({ widget_bubble: 'lancip' }).bubble, 'lancip');
assert.strictEqual(wc.clean({ widget_bubble: 'segitiga' }).bubble, 'bulat');
console.log('widget config ok');
