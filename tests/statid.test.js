const assert = require('assert');
const { statVisitorId, dayWib } = require('../lib/statId');

const o = { secret: 's', now: Date.UTC(2026, 9, 19, 5, 0, 0) };
const a = statVisitorId('203.0.113.9', 'Chrome/1', o);
assert.strictEqual(a, statVisitorId('203.0.113.9', 'Chrome/1', o), 'input sama = hash sama');
assert.notStrictEqual(a, statVisitorId('203.0.113.10', 'Chrome/1', o), 'IP beda = hash beda');
assert.notStrictEqual(a, statVisitorId('203.0.113.9', 'Firefox/2', o), 'browser beda = hash beda');
assert.notStrictEqual(a, statVisitorId('203.0.113.9', 'Chrome/1', { ...o, now: o.now + 86400000 }), 'hari beda = hash beda');
assert.notStrictEqual(a, statVisitorId('203.0.113.9', 'Chrome/1', { ...o, secret: 'x' }), 'secret beda = hash beda');
assert.ok(/^[0-9a-f]{32}$/.test(a) && !a.includes('203'), 'hash hex 32 karakter');
assert.strictEqual(statVisitorId(null, 'Chrome/1', o), null, 'tanpa IP = tanpa dedup');
assert.strictEqual(statVisitorId('1.2.3.4', undefined, o).length, 32, 'UA kosong tetap jalan');

// Batas hari memakai WIB (UTC+7): 16.59 UTC masih hari yang sama, 17.00 UTC sudah besoknya.
assert.strictEqual(dayWib(Date.UTC(2026, 9, 19, 16, 59)), '2026-10-19');
assert.strictEqual(dayWib(Date.UTC(2026, 9, 19, 17, 0)), '2026-10-20');
console.log('statid.test.js OK');
