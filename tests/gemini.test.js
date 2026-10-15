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

/* ---------- Penyedia lain (Groq, OpenRouter, ...) untuk paket tertentu ---------- */
const withFetch = async (impl, fn) => { const real = global.fetch; global.fetch = impl; try { return await fn(); } finally { global.fetch = real; } };
const oai = (calls, text) => async (url, init) => {
  calls.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
  return { ok: true, json: async () => ({ choices: [{ message: { content: text == null ? '{"reply":"ok"}' : text }, finish_reason: 'stop' }] }) };
};

test('penyedia per paket: parse dan sanitize (kosong/gemini = bawaan, tidak dikenal ditolak 400)', async () => {
  assert.deepStrictEqual(gemini.parseProviders('{rusak'), {});
  assert.deepStrictEqual(gemini.parseProviders(JSON.stringify({ providers: { free: 'groq', starter: 'gemini', bisnis: 'tidakada' } })), { free: 'groq' });
  assert.deepStrictEqual(gemini.sanitizeProviders({ free: ' groq ', starter: '', bisnis: 'gemini' }), { free: 'groq' });
  assert.throws(() => gemini.sanitizeProviders({ free: 'toString' }), (e) => e.httpStatus === 400);
  assert.throws(() => gemini.sanitizeProviders({ free: 'xyz' }), (e) => e.httpStatus === 400);
  assert.deepStrictEqual(gemini.parseModels(JSON.stringify({ models: { free: 'meta-llama/llama-3.3-70b-instruct:free', starter: 'a/../b' } })), { free: 'meta-llama/llama-3.3-70b-instruct:free' });
});

test('paket gratis memakai Groq, paket berbayar tetap Gemini dengan key bawaan', async () => {
  store = { GEMINI_API_KEY: 'k-gemini', GEMINI_API_KEY_FREE: 'gsk-free', AI_CONFIG: JSON.stringify({ providers: { free: 'groq' } }) };
  const calls = []; fetched = [];
  const contents = [{ role: 'user', parts: [{ text: 'halo' }] }, { role: 'model', parts: [{ text: 'hai kak' }] }, { role: 'user', parts: [{ text: 'stok?' }] }, { role: 'user', parts: [{ text: 'ada?' }] }];
  const out = await withFetch(oai(calls, '<think>mikir dulu</think>{"reply":"ada kak"}'), () => gemini.generate({ system: 'SISTEM JSON', contents, plan: 'free' }));
  assert.strictEqual(out, '{"reply":"ada kak"}', 'blok <think> dibuang');
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.strictEqual(calls[0].auth, 'Bearer gsk-free');
  assert.strictEqual(calls[0].body.model, gemini.PROVIDERS.groq.model);
  assert.deepStrictEqual(calls[0].body.response_format, { type: 'json_object' });
  assert.deepStrictEqual(calls[0].body.messages, [
    { role: 'system', content: 'SISTEM JSON' }, { role: 'user', content: 'halo' },
    { role: 'assistant', content: 'hai kak' }, { role: 'user', content: 'stok?\nada?' }
  ]);
  await gemini.generate({ system: 's', contents: [], plan: 'starter' });
  assert.strictEqual(fetched.length, 1); assert.strictEqual(fetched[0].key, 'k-gemini');
  assert.ok(fetched[0].url.includes('generativelanguage.googleapis.com'));
  const r = await gemini.resolve('free');
  assert.strictEqual(r.provider, 'groq'); assert.strictEqual(r.keySource, 'plan');
  assert.strictEqual((await gemini.resolve('starter')).provider, 'gemini');
});

test('penyedia lain tidak memakai key bawaan Gemini dan gagal jelas tanpa key sendiri', async () => {
  store = { GEMINI_API_KEY: 'k-gemini', AI_CONFIG: JSON.stringify({ providers: { free: 'groq' } }) };
  const calls = [];
  const r = await gemini.resolve('free');
  assert.strictEqual(r.keySource, null); assert.strictEqual(r.key, '');
  await withFetch(oai(calls), () => assert.rejects(() => gemini.generate({ system: 's', contents: [], plan: 'free' }), /Groq untuk paket free belum diatur/));
  assert.strictEqual(calls.length, 0, 'key Gemini tidak bocor ke Groq');
});

test('OpenRouter: model wajib diisi (tanpa bawaan); nama model bergaris miring dan titik dua diterima', async () => {
  store = { GEMINI_API_KEY_FREE: 'sk-or-1', AI_CONFIG: JSON.stringify({ providers: { free: 'openrouter' } }) };
  const calls = [];
  await withFetch(oai(calls), () => assert.rejects(() => gemini.generate({ system: 's', contents: [], plan: 'free' }), /Model OpenRouter untuk paket free belum diisi/));
  store.AI_CONFIG = JSON.stringify({ providers: { free: 'openrouter' }, models: { free: 'meta-llama/llama-3.3-70b-instruct:free' } });
  await withFetch(oai(calls), () => gemini.generate({ system: 's', contents: [{ role: 'user', parts: [{ text: 'x' }] }], plan: 'free' }));
  assert.strictEqual(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.strictEqual(calls[0].body.model, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.strictEqual(calls[0].body.response_format, undefined, 'OpenRouter tidak dipaksa json_object');
});

test('penyedia lain: key kena limit (429) pindah ke key berikutnya; galat membawa nama penyedia; jawaban kosong ditolak', async () => {
  store = { GEMINI_API_KEY_FREE: 'g1', GEMINI_API_KEY_FREE_2: 'g2', AI_CONFIG: JSON.stringify({ providers: { free: 'groq' } }) };
  const seen = [];
  const impl = async (url, init) => {
    seen.push(init.headers.Authorization);
    if (init.headers.Authorization === 'Bearer g1') return { ok: false, status: 429, text: async () => 'rate limit' };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"reply":"ok"}' } }] }) };
  };
  const out = await withFetch(impl, () => gemini.generate({ system: 's', contents: [], plan: 'free', slot: undefined }));
  assert.strictEqual(out, '{"reply":"ok"}');
  assert.ok(seen.includes('Bearer g1') || seen.includes('Bearer g2'));
  store = { GEMINI_API_KEY_FREE: 'g1', AI_CONFIG: JSON.stringify({ providers: { free: 'groq' } }) };
  await withFetch(async () => ({ ok: false, status: 429, text: async () => 'limit' }), () => assert.rejects(() => gemini.generate({ system: 's', contents: [], plan: 'free' }), /Groq 429/));
  await withFetch(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '<think>x</think>' }, finish_reason: 'length' }] }) }),
    () => assert.rejects(() => gemini.generate({ system: 's', contents: [], plan: 'free' }), /Groq kosong/));
});


(async () => {
  let fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('ok  - ' + name); } catch (e) { fail++; console.log('GAGAL - ' + name + '\n' + (e && e.stack)); }
  }
  console.log(fail ? fail + ' tes gagal' : 'Semua tes lulus (' + tests.length + ')');
  process.exit(fail ? 1 : 0);
})();
