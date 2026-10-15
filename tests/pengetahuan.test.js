'use strict';
// Tes pengetahuan otomatis situs untuk toko widget (env WIDGET_BOT). Jalankan: node tests/pengetahuan.test.js
const assert = require('assert');
const plans = require('../lib/plans');
const pengetahuan = require('../lib/pengetahuan');
const bot = require('../lib/bot');

delete process.env.WIDGET_BOT;
assert.strictEqual(pengetahuan.forShop({ slug: 'asistenai' }), '', 'tanpa env WIDGET_BOT = kosong');

process.env.WIDGET_BOT = 'asistenai';
assert.strictEqual(pengetahuan.forShop({ slug: 'toko-lain' }), '', 'toko lain tidak kebagian');
assert.strictEqual(pengetahuan.forShop(null), '');

plans.configure(null);
let t = pengetahuan.forShop({ slug: 'asistenai' });
assert(t.includes('Rp49.000') && t.includes('Rp149.000'), 'harga bawaan muncul');
assert(t.includes('1.500') && t.includes('6.000') && t.includes('100 balasan'), 'kuota muncul');
assert(/3 bulan hemat 5%/.test(t) && /12 bulan hemat 15%/.test(t), 'diskon lama langganan muncul');

// Harga mengikuti pengaturan admin, tanpa mengubah kode.
plans.configure({ plans: { free: { name: 'Gratis', quota: 100 }, starter: { name: 'Starter', price: 59000, quota: 2000, promo: 10 }, bisnis: { name: 'Bisnis', price: 149000, quota: 6000 } }, terms: { 1: 0, 3: 5, 12: 15 } });
t = pengetahuan.forShop({ slug: 'asistenai' });
assert(t.includes('Rp53.100') && t.includes('diskon paket 10%') && t.includes('2.000'), 'harga promo mengikuti pengaturan admin');
plans.configure(null);
t = pengetahuan.forShop({ slug: 'asistenai' });

// Masuk ke prompt sebagai data toko, hanya bila ada.
const shop = { slug: 'asistenai', name: 'Asisten Toko', bot_name: 'Asisten AI', tone: 'ramah', hours: '', address: '', shipping: '', payment: '', fallback: 'x', reply_language: 'id', general_on: false, general_topic: '' };
const withInfo = bot._internal.buildSystem(shop, [], [], false, { siteInfo: t });
assert(withInfo.includes('info_situs') && withInfo.includes('Rp49.000'));
assert(!bot._internal.buildSystem(shop, [], [], false, {}).includes('info_situs'));
console.log('pengetahuan.test.js OK');
