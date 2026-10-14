'use strict';
// Tes pemilihan key dan model Gemini per paket. Jalankan: node tests/gemini.test.js
const assert = require('assert');
const path = require('path');

let store = {};
const settingsPath = require.resolve(path.join('..', 'lib', 'settings.js'));
require.cache[settingsPath] = { id: settingsPath, filename: settingsPath, loaded: true, exports: { getAll: async () => store } };
const gemini = require('../lib/gemini');

let fetched = [];
global.fetch = async (url, init) => {
  fetched.push({ url, key: init.headers['x-goog-api-key'] });
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"reply":"ok"}' }] } }] }) };
};

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('model per paket dipakai, paket tanpa isian jatuh ke bawaan', async () => {
  store = { GEMINI_API_KEY: 'k-web', AI_CONFIG: JSON.stringify({ models: { free: 'gemini-a', bisnis: 'gemini-c' } }) };
  fetched = [];
  for (const plan of ['free', 'starter', 'bisnis']) await gemini.generate({ system: 's', contents: [], plan });
  assert.ok(fetched[0].url.includes('/models/gemini-a:'));
  assert.ok(fetched[1].url.includes('/models/' + gemini.DEFAULT_MODEL + ':'));
  assert.ok(fetched[2].url.includes('/models/gemini-c:'));
  assert.ok(fetched.every((f) => f.key === 'k-web'));
});

test('tanpa key melempar galat jelas', async () => {
  store = {};
  await assert.rejects(() => gemini.generate({ system: 's', contents: [], plan: 'free' }), /GEMINI_API_KEY/);
});

test('AI_CONFIG rusak atau berisi nama tidak sah diabaikan', async () => {
  assert.deepStrictEqual(gemini.parseModels('{bukan json'), {});
  assert.deepStrictEqual(gemini.parseModels(JSON.stringify({ models: { free: 'a/../b', starter: 'ok-model', bisnis: 5 } })), { starter: 'ok-model' });
  store = { GEMINI_API_KEY: 'k', AI_CONFIG: '{rusak' };
  fetched = [];
  await gemini.generate({ system: 's', contents: [], plan: 'free' });
  assert.ok(fetched[0].url.includes('/models/' + gemini.DEFAULT_MODEL + ':'));
});

test('sanitizeModels: kosong dilewati, nama tidak sah ditolak 400', async () => {
  assert.deepStrictEqual(gemini.sanitizeModels({ free: ' gemini-x ', starter: '', bisnis: undefined }), { free: 'gemini-x' });
  assert.throws(() => gemini.sanitizeModels({ free: 'a b' }), (e) => e.httpStatus === 400);
  assert.throws(() => gemini.sanitizeModels({ starter: '../x' }), (e) => e.httpStatus === 400);
});

test('key per paket dipakai, paket tanpa key sendiri ikut key bawaan', async () => {
  store = { GEMINI_API_KEY: 'k-bawaan', GEMINI_API_KEY_STARTER: 'k-starter', GEMINI_API_KEY_BISNIS: 'k-bisnis' };
  fetched = [];
  for (const plan of ['free', 'starter', 'bisnis']) await gemini.generate({ system: 's', contents: [], plan });
  assert.deepStrictEqual(fetched.map((f) => f.key), ['k-bawaan', 'k-starter', 'k-bisnis']);
  assert.strictEqual((await gemini.resolve('free')).keySource, 'default');
  assert.strictEqual((await gemini.resolve('starter')).keySource, 'plan');
});

test('tanpa key bawaan, paket yang punya key sendiri tetap jalan; yang lain gagal jelas', async () => {
  store = { GEMINI_API_KEY_BISNIS: 'k-bisnis' };
  fetched = [];
  await gemini.generate({ system: 's', contents: [], plan: 'bisnis' });
  assert.strictEqual(fetched[0].key, 'k-bisnis');
  await assert.rejects(() => gemini.generate({ system: 's', contents: [], plan: 'free' }), /GEMINI_API_KEY/);
});

// fetch tiruan yang menolak key tertentu dengan kode HTTP tertentu.
function rejectKeys(map) {
  global.fetch = async (url, init) => {
    const key = init.headers['x-goog-api-key'];
    fetched.push({ url, key });
    if (map[key]) return { ok: false, status: map[key].status, text: async () => map[key].body || '' };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"reply":"ok"}' }] } }] }) };
  };
}
const okFetch = global.fetch;

test('satu paket boleh punya 3 key; dipakai bergantian', async () => {
  store = { GEMINI_API_KEY_STARTER: 'a1', GEMINI_API_KEY_STARTER_2: 'a2', GEMINI_API_KEY_STARTER_3: 'a3', GEMINI_API_KEY: 'bawaan' };
  const r = await gemini.resolve('starter');
  assert.deepStrictEqual(r.keys.map((k) => k.value), ['a1', 'a2', 'a3']);
  assert.strictEqual(r.keySource, 'plan');
  fetched = [];
  for (let i = 0; i < 6; i++) await gemini.generate({ system: 's', contents: [], plan: 'starter' });
  const used = fetched.map((f) => f.key);
  ['a1', 'a2', 'a3'].forEach((k) => assert.strictEqual(used.filter((u) => u === k).length, 2));
  assert.ok(!used.includes('bawaan'));
});

test('key paket lain tidak tercampur', async () => {
  store = { GEMINI_API_KEY_FREE: 'f1', GEMINI_API_KEY_FREE_2: 'f2', GEMINI_API_KEY_BISNIS_3: 'b3' };
  assert.deepStrictEqual((await gemini.resolve('free')).keys.map((k) => k.slot), [1, 2]);
  assert.deepStrictEqual((await gemini.resolve('bisnis')).keys.map((k) => [k.slot, k.value]), [[3, 'b3']]);
  assert.strictEqual(gemini.keyName('free', 1), 'GEMINI_API_KEY_FREE');
  assert.strictEqual(gemini.keyName('free', 3), 'GEMINI_API_KEY_FREE_3');
});

test('key kena limit (429) atau ditolak: pindah ke key berikutnya, hasil tetap ada', async () => {
  store = { GEMINI_API_KEY_FREE: 'f1', GEMINI_API_KEY_FREE_2: 'f2', GEMINI_API_KEY_FREE_3: 'f3' };
  rejectKeys({ f1: { status: 429 }, f2: { status: 400, body: 'API key not valid' } });
  for (let i = 0; i < 3; i++) {
    fetched = [];
    const out = await gemini.generate({ system: 's', contents: [], plan: 'free' });
    assert.ok(out.includes('ok'));
    assert.strictEqual(fetched[fetched.length - 1].key, 'f3');
  }
  global.fetch = okFetch;
});

test('semua key gagal: galat terakhir dilempar; galat model salah (404) tidak mencoba key lain', async () => {
  store = { GEMINI_API_KEY_FREE: 'f1', GEMINI_API_KEY_FREE_2: 'f2' };
  rejectKeys({ f1: { status: 429 }, f2: { status: 503 } });
  await assert.rejects(() => gemini.generate({ system: 's', contents: [], plan: 'free' }), /Gemini (429|503)/);
  rejectKeys({ f1: { status: 404, body: 'model not found' }, f2: { status: 404, body: 'model not found' } });
  fetched = [];
  await assert.rejects(() => gemini.generate({ system: 's', contents: [], plan: 'free' }), /Gemini 404/);
  assert.strictEqual(fetched.length, 1);
  global.fetch = okFetch;
});

test('slot: tes satu key saja', async () => {
  store = { GEMINI_API_KEY_FREE: 'f1', GEMINI_API_KEY_FREE_2: 'f2' };
  fetched = [];
  await gemini.generate({ system: 's', contents: [], plan: 'free', slot: 2 });
  assert.deepStrictEqual(fetched.map((f) => f.key), ['f2']);
  await assert.rejects(() => gemini.generate({ system: 's', contents: [], plan: 'free', slot: 3 }), /GEMINI_API_KEY/);
});

(async () => {
  let fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('ok  - ' + name); } catch (e) { fail++; console.log('GAGAL - ' + name + '\n' + (e && e.stack)); }
  }
  console.log(fail ? fail + ' tes gagal' : 'Semua tes lulus (' + tests.length + ')');
  process.exit(fail ? 1 : 0);
})();
