'use strict';
// Jalankan: node tests/gayaNeo.test.js
// Menguji gaya Neo untuk toko isengin.site (env ISENGIN_BOT): hanya toko itu yang kena, CSS/CSP hanya berubah untuk gaya ini,
// dan widget.js memuat gayanya hanya kalau server mengirim "gaya":"neo".
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const neo = require('../lib/gayaNeo');
const tpl = require('../lib/chatTemplate');

const keepI = process.env.ISENGIN_BOT, keepW = process.env.WIDGET_BOT;
process.env.ISENGIN_BOT = 'isengin';
delete process.env.WIDGET_BOT;

// gerbang: hanya toko ISENGIN_BOT
assert.strictEqual(neo.forShop({ slug: 'isengin' }), 'neo');
assert.strictEqual(neo.forShop({ slug: 'toko-lain' }), '');
assert.strictEqual(neo.forShop(null), '');
process.env.ISENGIN_BOT = '';
assert.strictEqual(neo.forShop({ slug: 'isengin' }), '', 'tanpa ISENGIN_BOT tidak ada toko yang kena');
process.env.ISENGIN_BOT = 'isengin'; process.env.WIDGET_BOT = 'isengin';
assert.strictEqual(neo.forShop({ slug: 'isengin' }), '', 'sama dengan WIDGET_BOT: WIDGET_BOT menang, sama seperti otak isengin');
delete process.env.WIDGET_BOT;

// halaman chat: atribut, font, CSS disisipkan sekali; template asli tidak berubah
const out = neo.terapkan(tpl);
assert.ok(out.includes('<html lang="id" data-gaya="neo">'));
assert.strictEqual(out.split('data-gaya="neo"]{--navy:#1f2255').length - 1, 1);
assert.ok(out.includes('fonts.googleapis.com/css2?family=Bungee'));
for (const col of ['#1f2255', '#ffd23f', '#ff5a43', '#fffbe8']) assert.ok(neo.CSS.includes(col), col);
assert.ok(!tpl.includes('data-gaya'), 'template dasar tidak memuat gaya Neo');
assert.ok(out.indexOf('</style>') > out.indexOf('gaya Neo (toko isengin.site)'), 'CSS Neo ada di dalam blok style');
// CSS tidak boleh mematikan data bubble lancip secara liar di toko lain: semua aturan diawali html[data-gaya="neo"]
const rules = neo.CSS.split('\n').filter((l) => l && !l.startsWith('/*') && !l.startsWith('@media'));
for (const l of rules) assert.ok(l.startsWith('html[data-gaya="neo"]'), 'aturan tanpa awalan gaya: ' + l.slice(0, 60));
// warna aksen toko tidak menimpa gaya Neo (applyTheme dilewati)
assert.ok(tpl.includes("if(C.gaya==='neo')return;"));

// CSP: hanya gaya Neo yang membuka font Google
const base = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors *";
const c = neo.csp(base);
assert.ok(c.includes("style-src 'unsafe-inline' https://fonts.googleapis.com;") && c.includes('font-src https://fonts.gstatic.com;'));
assert.ok(!base.includes('fonts.g'));
assert.ok(c.includes("script-src 'unsafe-inline';") && c.includes("default-src 'none'"), 'bagian CSP lain utuh');

// widget.js: gaya hanya aktif kalau server mengirim neo
const src = fs.readFileSync(path.join(__dirname, '../public/widget.js'), 'utf8');
assert.ok(src.includes("gaya: pick(c.gaya, ['neo'], '')"));
assert.ok(src.includes('var neo = c.gaya === \'neo\';'));
for (const col of ['#1f2255', '#ffd23f', '#ff5a43', '#fffbe8']) assert.ok(src.includes(col), 'widget.js: ' + col);
// palet widget.js sama dengan palet CSS chat
const pal = (t) => (t.match(/#[0-9a-fA-F]{6}/g) || []).map((x) => x.toLowerCase());
assert.ok(['#1f2255', '#ffd23f', '#ff5a43', '#fffbe8', '#4a4d7a'].every((x) => pal(neo.CSS).includes(x) && pal(src).includes(x)));

// jalankan neoCss dari widget.js apa adanya: menghasilkan CSS untuk tombol, jendela, tombol tutup, pemuat, dan pesan pop-up
const block = src.slice(src.indexOf('var NEO = {'), src.indexOf('  // Font Bungee'));
const neoCss = new Function(block + '; return neoCss;')();
const css = neoCss({}, 'right', 58);
for (const sel of ['#isengin-chat-btn{', '#isengin-chat-box{', '#isengin-chat-x{', '#isengin-chat-ld', '#isengin-chat-tip{', '#isengin-chat-badge{']) assert.ok(css.includes(sel), sel);
assert.ok(css.includes('box-shadow:4px 4px 0 #1f2255') && css.includes('border:3px solid #1f2255'));
assert.ok(!/undefined|NaN/.test(css));

if (keepI === undefined) delete process.env.ISENGIN_BOT; else process.env.ISENGIN_BOT = keepI;
if (keepW === undefined) delete process.env.WIDGET_BOT; else process.env.WIDGET_BOT = keepW;
console.log('gaya Neo ok');
