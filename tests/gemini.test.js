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

(async () => {
  let fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('ok  - ' + name); } catch (e) { fail++; console.log('GAGAL - ' + name + '\n' + (e && e.stack)); }
  }
  console.log(fail ? fail + ' tes gagal' : 'Semua tes lulus (' + tests.length + ')');
  process.exit(fail ? 1 : 0);
})();
