'use strict';
// Jalankan: node tests/otak.isengin.test.js  (tanpa jaringan: Supabase dan Gemini dipalsukan)
// Menguji otak isengin.site (lib/otakIsengin.js): gerbang ISENGIN_BOT (terpisah dari WIDGET_BOT dan otak EMAHAIRSHOP), perakit prompt, pengurai penanda, jaring pengaman, dan sambungannya ke handleMessage.
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');

/* ---------- Supabase palsu di memori ---------- */
class Q {
  constructor(db, t) { this.db = db; this.t = t; this.op = 'select'; this.f = []; this.ord = null; this.lim = null; this.head = false; this.cnt = false; this.ret = false; this.one = null; }
  select(cols, opt) { if (this.op === 'insert' || this.op === 'update') this.ret = true; if (opt && opt.count) this.cnt = true; if (opt && opt.head) this.head = true; return this; }
  insert(row) { this.op = 'insert'; this.payload = row; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.f.push(r => r[c] === v); return this; }
  neq(c, v) { this.f.push(r => r[c] !== v); return this; }
  upsert(row, opt) { this.op = 'upsert'; this.payload = row; this.key = (opt && opt.onConflict) || 'id'; return this; }
  or(expr) {
    const parts = String(expr).split(',').map(x => x.split('.'));
    this.f.push(r => parts.some(([c, op, ...v]) => (op === 'is' ? r[c] == null : op === 'lt' ? r[c] != null && r[c] < v.join('.') : op === 'eq' ? r[c] === v.join('.') : op === 'neq' ? r[c] != null && r[c] !== v.join('.') : false)));
    return this;
  }
  not(c, op, v) {
    if (op !== 'like') throw new Error('operator not belum didukung tiruan: ' + op);
    const re = new RegExp('^' + String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 's');
    this.f.push(r => !re.test(String(r[c]))); return this;
  }
  gte(c, v) { this.f.push(r => r[c] >= v); return this; }
  gt(c, v) { this.f.push(r => r[c] > v); return this; }
  in(c, a) { this.f.push(r => a.includes(r[c])); return this; }
  order(c, o) { this.ord = [c, !(o && o.ascending === false)]; return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  single() { this.one = 'single'; return this; }
  then(res, rej) { try { res(this.run()); } catch (e) { rej(e); } }
  run() {
    const rows = this.db[this.t];
    if (!rows) throw new Error('tabel ' + this.t + ' tidak ada');
    if (this.op === 'upsert') {
      // settings.save mengirim larik baris sekaligus; tiruan ini menanganinya baris per baris.
      (Array.isArray(this.payload) ? this.payload : [this.payload]).forEach(p => {
        const ex = rows.find(r => r[this.key] === p[this.key]);
        if (ex) Object.assign(ex, p); else rows.push(Object.assign({ created_at: new Date().toISOString() }, p));
      });
      return { data: null, error: null, count: null };
    }
    if (this.op === 'insert') {
      const r = Object.assign({ created_at: new Date().toISOString() }, this.payload);
      if (this.t === 'messages') r.id = this.db._mid++;
      if (this.t === 'conversations') Object.assign(r, { id: crypto.randomUUID(), visitor_token: crypto.randomUUID(), status: 'bot', unanswered: false, flag: null });
      rows.push(r);
      return { data: this.ret ? r : null, error: null, count: null };
    }
    if (this.op === 'delete') {
      const keep = rows.filter(r => !this.f.every(fn => fn(r)));
      rows.length = 0; keep.forEach(r => rows.push(r));
      return { data: null, error: null, count: null };
    }
    let m = rows.filter(r => this.f.every(fn => fn(r)));
    if (this.op === 'update') { m.forEach(r => Object.assign(r, this.payload)); return { data: this.ret ? m : null, error: null, count: null }; }
    if (this.ord) { const [c, asc] = this.ord; m = m.slice().sort((a, b) => (a[c] > b[c] ? 1 : -1) * (asc ? 1 : -1)); }
    if (this.lim != null) m = m.slice(0, this.lim);
    const count = this.cnt ? m.length : null;
    if (this.head) return { data: null, error: null, count };
    if (this.one) return { data: m[0] || null, error: null, count };
    return { data: m, error: null, count };
  }
}
const db = { app_settings: [], shops: [], products: [], faqs: [], conversations: [], messages: [], shop_notify: [], shop_channels: [], shop_members: [], shop_billing: [], payments: [], leads: [], _mid: 1 };
let rpcFail = false;
const fake = {
  from: t => new Q(db, t),
  // Tiruan sederhana fungsi SQL search_products / search_faqs (skor: nama 3, deskripsi 1).
  rpc: async (fn, a) => {
    if (fn === 'bot_usage_add') {      // tiruan fungsi SQL bot_usage_add; ada hanya bila tes menyediakan db.bot_usage
      if (!db.bot_usage) return { data: null, error: { message: 'fungsi belum ada' } };
      const day = require('../lib/usage').dayKey();
      const u = db.bot_usage.find(x => x.shop_id === a.sid && x.day === day);
      if (u) u.n += 1; else db.bot_usage.push({ shop_id: a.sid, day, n: 1 });
      return { data: null, error: null };
    }
    if (rpcFail) return { data: null, error: { message: 'fungsi belum ada' } };
    const isP = fn === 'search_products';
    const rows = (isP ? db.products : db.faqs).filter(r => r.shop_id === a.sid).map(r => {
      const head = String(isP ? r.name : r.question).toLowerCase(), body = String(isP ? r.description || '' : r.answer).toLowerCase();
      const score = a.terms.reduce((sum, w) => sum + (head.includes(w) ? 3 : body.includes(w) ? 1 : 0), 0);
      return Object.assign({}, r, { score });
    }).filter(r => r.score > 0).sort((x, y) => y.score - x.score);
    return { data: rows.slice(0, a.n), error: null };
  }
};

// auth.admin.getUserById palsu: peta id pemilik -> email
const users = {};
fake.auth = { admin: { getUserById: async (id) => (users[id] ? { data: { user: { id, email: users[id] } }, error: null } : { data: { user: null }, error: { message: 'tidak ada' } }) } };

/* ---------- Gemini dan notifikasi palsu ---------- */
let geminiCalls = [], geminiImpl = null;
function stub(file, exports) {
  const p = require.resolve(path.join('..', 'lib', file));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
}
stub('supabase.js', { getAdmin: () => fake });
stub('gemini.js', { generate: async (a) => { geminiCalls.push(a); return geminiImpl(a); } });
const bot = require('../lib/bot');
const otak = require('../lib/otak');
const settings = require('../lib/settings');
const notify = require('../lib/notify');
let alerts = [];
notify.notifyAdmin = async (a) => { alerts.push(a); return { skipped: true }; };

process.env.ADMIN_EMAILS = 'owner@emahair.test, Lain@x.test';
let n = 0;
function seedShop(over) {
  n++;
  const shop = Object.assign({ id: 'shop-' + n, slug: 'toko-' + n, name: 'Toko', bot_name: 'Asisten', tone: 'ramah', hours: '', address: '', shipping: '', payment: '', fallback: 'Maaf {k}, belum tahu.', bot_on: true, daily_limit: 500, owner_id: 'own-' + n }, over);
  db.shops.push(shop);
  db.products.push({ shop_id: shop.id, name: 'Produk Biasa', price: 1000, stock: 5, description: '' });
  return shop;
}
const ownerShop = () => { const s = seedShop(); users[s.owner_id] = 'owner@emahair.test'; return s; };
const otherShop = () => { const s = seedShop(); users[s.owner_id] = 'orang@lain.test'; return s; };
const say = (reply) => async () => JSON.stringify({ reply });
async function chat(shop, text, prev) {
  return bot.handleMessage({ slug: shop.slug, text, conversationId: prev && prev.conversationId, token: prev && prev.token });
}
const conv = (r) => db.conversations.find(c => c.id === r.conversationId);

process.env.WIDGET_BOT = 'asisten-toko';
process.env.ISENGIN_BOT = 'isengin';
process.env.ADMIN_EMAILS = 'owner@emahair.test';
delete process.env.ISENGIN_PRO_PRICE_MONTH; delete process.env.ISENGIN_PRO_PRICE_YEAR;
const otakIsengin = require('../lib/otakIsengin');
const gayaPortal = require('../lib/gayaPortal');
const isgShop = () => seedShop({ slug: 'isengin', name: 'isengin.site' });
const widgetShop = () => seedShop({ slug: 'asisten-toko', name: 'Asisten Toko' });
const T = otakIsengin.DEFAULT_TEMPLATE;

const tests = [];
const t = (name, fn) => tests.push([name, fn]);

t('template bawaan: pengetahuan isengin.site lengkap, penanda, tanpa sisa EMAHAIRSHOP/Asisten Toko', async () => {
  for (const s of ['INFO ISENGIN.SITE', 'PAKET GRATIS', 'PAKET PRO', 'DOMAIN KUSTOM', 'CENTANG', 'REFERRAL', 'cname.vercel-dns.com', '76.76.21.21', 'Midtrans', '{{PRO_BULAN}}', '{{PRO_TAHUN}}', '[[HUMAN]]', '[[LEAD:', '[[NAME:', '[[UNKNOWN:', '[[OFFTOPIC]]', 'https://isengin.site/daftar']) assert.ok(T.includes(s), s);
  assert.ok(!/emahairshop|wa\.me|price-list|Asisten Toko/i.test(T), 'tidak ada sisa otak lain');
  assert.ok(!/Rp\s?\d/.test(T), 'harga tidak ditulis mati di template');
  assert.ok(!T.includes('${'));
});

t('forShop: hanya toko ISENGIN_BOT; penanda harga diisi dari env (bawaan 29000/290000)', async () => {
  const x = await otakIsengin.forShop(isgShop());
  assert.ok(x.includes('INFO ISENGIN.SITE') && x.includes('Rp29.000') && x.includes('Rp290.000') && !x.includes('{{PRO_'));
  process.env.ISENGIN_PRO_PRICE_MONTH = '35000'; process.env.ISENGIN_PRO_PRICE_YEAR = '350000';
  const y = await otakIsengin.forShop(isgShop());
  assert.ok(y.includes('Rp35.000') && y.includes('Rp350.000') && !y.includes('Rp29.000'));
  delete process.env.ISENGIN_PRO_PRICE_MONTH; delete process.env.ISENGIN_PRO_PRICE_YEAR;
  assert.strictEqual(await otakIsengin.forShop(seedShop()), '', 'toko lain tidak');
  assert.strictEqual(await otakIsengin.forShop(widgetShop()), '', 'toko WIDGET_BOT tidak');
  assert.strictEqual(await otakIsengin.forShop(null), '');
  const keep = process.env.ISENGIN_BOT; process.env.ISENGIN_BOT = '';
  assert.strictEqual(await otakIsengin.forShop(isgShop()), '', 'tanpa ISENGIN_BOT tidak dipakai');
  process.env.ISENGIN_BOT = keep;
});

t('forShop: ISENGIN_BOT sama dengan WIDGET_BOT = WIDGET_BOT menang; saklar mati dan teks kustom', async () => {
  const s = isgShop();
  process.env.WIDGET_BOT = 'isengin';
  assert.strictEqual(await otakIsengin.forShop(s), '', 'bentrok: pola lama WIDGET_BOT tidak berubah');
  assert.strictEqual(otakIsengin.botSlug(), '');
  process.env.WIDGET_BOT = 'asisten-toko';
  await settings.save({ OTAK_ISENGIN_TEMPLATE: 'ATURAN KUSTOM ISENGIN Pro {{PRO_BULAN}}' });
  assert.strictEqual(await otakIsengin.forShop(s), 'ATURAN KUSTOM ISENGIN Pro Rp29.000');
  await settings.save({ OTAK_ISENGIN_TEMPLATE: '' });
  await settings.save({ OTAK_ISENGIN_MODE: 'off' });
  assert.strictEqual(await otakIsengin.forShop(s), '');
  await settings.save({ OTAK_ISENGIN_MODE: 'on' });
  assert.ok((await otakIsengin.forShop(s)).includes('INFO ISENGIN.SITE'));
});

t('buildSystem: template, tanggal, format JSON; arahan bahasa dan nama hanya bila ada', async () => {
  const a = otakIsengin.buildSystem('ATURAN-X');
  assert.ok(a.startsWith('ATURAN-X') && a.includes('Current date & time:') && a.includes('{"reply":"..."}') && a.includes('[[HUMAN]]'));
  assert.ok(!a.includes('[[WA]]') && !a.includes('rambut warna'), 'tanpa penanda dan aturan EMAHAIRSHOP');
  assert.ok(!a.includes('Automatic language detection'));
  const b = otakIsengin.buildSystem('ATURAN-X', { lastText: 'what is the price of the pro plan please', knownName: 'Budi' });
  assert.ok(b.includes('detection of the visitor\'s LAST message: English') && b.includes('already told you their name: Budi'));
  assert.ok(otakIsengin.buildSystem('ATURAN-X', { lastText: 'ok', recentTexts: ['can i have the price please'] }).includes('wrote in English'));
  assert.ok(otakIsengin.buildSystem('ATURAN-X', { lastText: 'ok', siteLang: 'fr' }).includes('French'));
  assert.ok(!otakIsengin.buildSystem('ATURAN-X', { knownName: 'none' }).includes('already told you'));
});

t('parseOutput: balasan bersih, penanda diurai dan dibuang, markdown dibersihkan', async () => {
  const r = otakIsengin.parseOutput(JSON.stringify({ reply: '**Pro** membuka domain kustom.\n\n# Judul\n* satu\n* dua\n[[NAME: Budi]] [[LEAD: minat=Pro; nama=Budi; kontak=0812]] [[UNKNOWN: soal integrasi X]]' }), T);
  assert.deepStrictEqual([r.handoff, r.order, r.alert, r.name, r.unknown], [false, false, '', 'Budi', 'soal integrasi X']);
  assert.ok(r.lead.startsWith('minat=Pro'));
  assert.ok(!r.reply.includes('[[') && !r.reply.includes('**') && !r.reply.includes('# ') && r.reply.includes('- satu'));
  assert.strictEqual(otakIsengin.parseOutput('```json\n{"reply":"Halo Kak"}\n```', T).reply, 'Halo Kak');
  assert.strictEqual(otakIsengin.parseOutput('Halo, ada yang bisa dibantu?', T).reply, 'Halo, ada yang bisa dibantu?');
  assert.strictEqual(otakIsengin.parseOutput('{"foo":1}', T), null);
  assert.strictEqual(otakIsengin.parseOutput('', T), null);
});

t('parseOutput: [[OFFTOPIC]] kosong = kalimat cadangan; [[HUMAN]] menyerahkan; penanda EMAHAIRSHOP dibuang; tanpa WA/price list', async () => {
  assert.ok(otakIsengin.parseOutput('{"reply":"[[OFFTOPIC]]"}', T).reply.includes('isengin.site'));
  assert.strictEqual(otakIsengin.parseOutput('{"reply":"Saya teruskan ke admin ya. [[HUMAN]]"}', T).handoff, true);
  assert.ok(otakIsengin.parseOutput('{"reply":"[[HUMAN]]"}', T).reply.length > 10);
  const w = otakIsengin.parseOutput('{"reply":"Mohon tunggu. [[WA]] [[URGENT]] [[FRAUD]]"}', T);
  assert.deepStrictEqual([w.reply, w.alert], ['Mohon tunggu.', '']);
  const p = otakIsengin.parseOutput('{"reply":"Pro Rp29.000 per bulan."}', T, { userText: 'minta price list dong' });
  assert.ok(!/wa\.me|emahairshop|price-list/i.test(p.reply));
});

t('wantsHuman: permintaan langsung ya, pertanyaan tentang fitur admin tidak', async () => {
  for (const s of ['Saya mau bicara dengan admin', 'bisa chat dengan admin?', 'hubungi admin dong', 'sambungkan ke manusia', 'I want to talk to a human', 'contact the team']) assert.strictEqual(otakIsengin.wantsHuman(s), true, s);
  for (const s of ['Apakah admin bisa menyetujui centang saya?', 'pelanggan bisa chat dengan admin toko?', 'Apa bedanya Gratis dan Pro?', '', 'saya ingin tahu apakah halaman saya bisa dilaporkan ke admin kalau ada yang menyalahgunakan nama saya dan bagaimana prosesnya']) assert.strictEqual(otakIsengin.wantsHuman(s), false, s);
  assert.strictEqual(otakIsengin.parseOutput('{"reply":"Baik."}', T, { userText: 'tolong sambungkan ke admin' }).handoff, true, 'jaring pengaman kalau model lupa');
});

t('enrich: kontak buatan model dibuang, hanya nomor/email dari pesan pengunjung', async () => {
  const base = { reply: 'ok', handoff: false, lead: 'minat=Pro; nama=Budi; kontak=08999999999; wa=0811', name: '' };
  assert.strictEqual(otakIsengin.enrich(Object.assign({}, base), { userText: 'Nomor saya 0812-3456-7890 ya' }).lead, 'minat=Pro; nama=Budi; kontak=081234567890');
  const b = otakIsengin.enrich(Object.assign({}, base), { userText: 'oke terima kasih', recentTexts: ['emailnya budi@toko.test ya', 'halo'] });
  assert.ok(b.lead.endsWith('kontak=budi@toko.test') && !b.lead.includes('08999999999') && !b.lead.includes('wa='));
  assert.strictEqual(otakIsengin.enrich(Object.assign({}, base), { userText: 'oke' }).lead, 'minat=Pro; nama=Budi');
  assert.strictEqual(otakIsengin.enrich({ reply: 'ok', lead: '', name: '' }, { userText: 'Nomor saya 081234567890' }).lead, '', 'tanpa [[LEAD]] dari model, lead tidak dibuat otomatis');
  assert.strictEqual(otakIsengin.enrich(null, {}), null);
});

t('handleMessage toko isengin: pakai otak isengin, produk toko tidak ikut, tanpa kartu kontak', async () => {
  const s = isgShop();
  geminiCalls = []; alerts = [];
  geminiImpl = say('Pro Rp29.000 untuk 30 hari, Kak.');
  const r = await chat(s, 'Berapa harga Pro?');
  const sys = geminiCalls[0].system;
  assert.ok(sys.includes('Kamu adalah asisten AI di isengin.site') && sys.includes('Rp29.000') && sys.includes('Rp290.000'));
  assert.ok(!sys.includes('DATA TOKO') && !sys.includes('Produk Biasa') && !sys.includes('info_situs'), 'bukan data toko / info Asisten Toko');
  assert.ok(!sys.includes('COMPANY INFO:'), 'bukan otak EMAHAIRSHOP');
  assert.deepStrictEqual([geminiCalls[0].maxTokens, geminiCalls[0].lowThinking], [2048, true]);
  assert.strictEqual(r.messages.filter(m => m.role === 'bot').map(m => m.content).join('\n'), 'Pro Rp29.000 untuk 30 hari, Kak.');
  assert.strictEqual(conv(r).status, 'bot');
  assert.strictEqual(alerts.length, 0);
  assert.strictEqual(r.offerLead, undefined);
});

t('toko isengin milik admin layanan (ADMIN_EMAILS) tetap otak isengin, bukan EMAHAIRSHOP, dan bukan gaya portal', async () => {
  const s = isgShop(); users[s.owner_id] = 'owner@emahair.test';
  assert.strictEqual(await otak.ownerIsAdmin(fake, s), true, 'pemiliknya memang admin layanan');
  assert.strictEqual(await gayaPortal.aktif(fake, s), false, 'bukan gaya portal');
  geminiCalls = [];
  geminiImpl = say('Halo Kak.');
  await chat(s, 'Halo');
  assert.ok(geminiCalls[0].system.includes('Kamu adalah asisten AI di isengin.site') && !geminiCalls[0].system.includes('COMPANY INFO:'));
});

t('handleMessage toko isengin: [[HUMAN]] menyerahkan ke admin; pertanyaan tentang admin tidak', async () => {
  geminiCalls = []; alerts = [];
  geminiImpl = say('Baik, saya teruskan ke admin ya. [[HUMAN]]');
  const r = await chat(isgShop(), 'Pro saya belum aktif padahal sudah bayar');
  assert.strictEqual(conv(r).status, 'human');
  assert.deepStrictEqual(alerts.map(a => a.reason), ['handoff']);
  geminiCalls = []; alerts = [];
  geminiImpl = say('Admin menyetujui pengajuan centang secara manual.');
  const r2 = await chat(isgShop(), 'Apakah admin yang menyetujui centang?');
  assert.strictEqual(conv(r2).status, 'bot');
  assert.strictEqual(alerts.length, 0);
});

t('handleMessage toko isengin: [[LEAD]] dan [[UNKNOWN]] menandai belum dibalas, nama tersimpan, kontak hanya dari pengunjung', async () => {
  geminiCalls = []; alerts = [];
  geminiImpl = say('Siap Kak Budi, saya catat ya. [[NAME: Budi]] [[LEAD: minat=Pro tahunan; nama=Budi; kontak=089999]]');
  const r = await chat(isgShop(), 'Saya Budi, mau beli Pro tahunan. WA saya 081234567890');
  const c = conv(r);
  assert.strictEqual(c.unanswered, true);
  assert.ok(c.last_question.startsWith('Calon pembeli: minat=Pro tahunan; nama=Budi; kontak=081234567890'), c.last_question);
  assert.ok(!c.last_question.includes('089999'));
  assert.strictEqual(c.customer_name, 'Budi');
  assert.strictEqual(alerts.length, 0);
  geminiImpl = say('Belum ada info itu, Kak. Mau saya sambungkan ke admin? [[UNKNOWN: integrasi Tokopedia]]');
  assert.strictEqual(conv(await chat(isgShop(), 'Bisa terhubung ke Tokopedia?')).unanswered, true);
});

t('toko widget Asisten Toko (WIDGET_BOT) tetap pola lama: data toko + info situs, bukan otak isengin', async () => {
  geminiCalls = [];
  geminiImpl = async () => JSON.stringify({ reply: 'Halo', handoff: false, order: false });
  await chat(widgetShop(), 'Berapa harga paket Bisnis?');
  const sys = geminiCalls[0].system;
  assert.ok(sys.includes('Produk Biasa') && sys.includes('info_situs') && sys.includes('PAKET DAN HARGA'));
  assert.ok(!sys.includes('Kamu adalah asisten AI di isengin.site') && !sys.includes('INFO ISENGIN.SITE'));
});

t('saklar otak isengin mati = toko isengin kembali ke data tokonya; toko owner dan toko biasa tidak terpengaruh', async () => {
  await settings.save({ OTAK_ISENGIN_MODE: 'off' });
  geminiCalls = [];
  geminiImpl = async () => JSON.stringify({ reply: 'Halo', handoff: false, order: false });
  await chat(isgShop(), 'Halo');
  assert.ok(geminiCalls[0].system.includes('Produk Biasa') && !geminiCalls[0].system.includes('INFO ISENGIN.SITE'));
  await settings.save({ OTAK_ISENGIN_MODE: 'on' });
  geminiCalls = [];
  geminiImpl = say('Wholesale mulai $50 per 100 gram.');
  await chat(ownerShop(), 'Berapa harga hair extension?');
  assert.ok(geminiCalls[0].system.includes('COMPANY INFO:') && !geminiCalls[0].system.includes('INFO ISENGIN.SITE'), 'toko owner tetap otak EMAHAIRSHOP');
  geminiCalls = [];
  geminiImpl = async () => JSON.stringify({ reply: 'Halo', handoff: false, order: false });
  await chat(otherShop(), 'Halo');
  assert.ok(geminiCalls[0].system.includes('Produk Biasa') && !geminiCalls[0].system.includes('INFO ISENGIN.SITE'));
});

t('toko isengin: balasan Indonesia untuk pengunjung berbahasa Inggris dicoba sekali lagi', async () => {
  geminiCalls = [];
  let n = 0;
  geminiImpl = async () => JSON.stringify({ reply: n++ === 0 ? 'Silakan daftar gratis, Kak. Terima kasih sudah bertanya, boleh tahu nama Anda?' : 'You can sign up for free, no credit card needed.' });
  const r = await chat(isgShop(), 'how much is the pro plan please? can i try it first');
  assert.strictEqual(geminiCalls.length, 2);
  assert.ok(r.messages.filter(m => m.role === 'bot').map(m => m.content).join('\n').startsWith('You can sign up'));
});

(async () => {
  let fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('  ok   ' + name); } catch (e) { fail++; console.log('  GAGAL ' + name + '\n       ' + (e && e.stack || e)); }
  }
  console.log(fail ? '\n' + fail + ' tes gagal' : '\nSemua ' + tests.length + ' tes lulus');
  process.exit(fail ? 1 : 0);
})();
