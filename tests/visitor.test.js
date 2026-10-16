'use strict';
const assert = require('assert');
const { visitorFromHeaders } = require('../lib/visitor');

const H = (o) => ({ get: (k) => (o[k.toLowerCase()] !== undefined ? o[k.toLowerCase()] : null) });

// Header Vercel lengkap: kode negara jadi nama Indonesia, kota di-decode.
let v = visitorFromHeaders(H({ 'x-vercel-forwarded-for': '103.45.12.34', 'x-vercel-ip-country': 'ID', 'x-vercel-ip-city': 'Yogyakarta' }));
assert.strictEqual(v.ip, '103.45.12.34');
assert.strictEqual(v.country, 'Indonesia');
assert.strictEqual(v.city, 'Yogyakarta');

// Nama kota ber-spasi/aksen dikirim URL-encoded.
v = visitorFromHeaders(H({ 'x-vercel-ip-city': 'S%C3%A3o%20Paulo', 'x-vercel-ip-country': 'BR' }));
assert.strictEqual(v.city, 'São Paulo');
assert.ok(v.country && v.country !== 'BR');

// x-forwarded-for berisi beberapa alamat: ambil yang pertama.
v = visitorFromHeaders(H({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }));
assert.strictEqual(v.ip, '203.0.113.9');

// IPv6 diterima.
v = visitorFromHeaders(H({ 'x-real-ip': '2001:db8::1' }));
assert.strictEqual(v.ip, '2001:db8::1');

// Tanpa header (lokal): semua null, tidak error.
v = visitorFromHeaders(H({}));
assert.deepStrictEqual(v, { ip: null, country: null, city: null });

// Nilai tidak valid atau tidak diketahui dibuang.
v = visitorFromHeaders(H({ 'x-forwarded-for': '<script>alert(1)</script>', 'x-vercel-ip-country': 'XX', 'x-vercel-ip-city': '%E0%A4%A' }));
assert.strictEqual(v.ip, null);
assert.strictEqual(v.country, null);
assert.ok(v.city === null || !/[<>]/.test(v.city));

console.log('visitor.test.js OK');
