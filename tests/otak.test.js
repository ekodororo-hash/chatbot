'use strict';
// Jalankan: node tests/otak.test.js  (tanpa jaringan: Supabase dan Gemini dipalsukan)
// Menguji otak EMAHAIRSHOP (lib/otak.js): gerbang owner, perakit prompt, pengurai penanda, dan sambungannya ke handleMessage.
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

const tests = [];
const t = (name, fn) => tests.push([name, fn]);
const WA = otak.waLink(otak.DEFAULT_TEMPLATE);

t('template bawaan: ada, memuat info EMAHAIRSHOP, aturan, dan tautan WhatsApp resmi', async () => {
  const T = otak.DEFAULT_TEMPLATE;
  assert.ok(T.length > 20000);
  for (const s of ['COMPANY INFO:', 'Rules:', '[[HUMAN]]', '[[URGENT]]', '[[WA]]', 'EMAHAIRSHOP']) assert.ok(T.includes(s), s);
  assert.strictEqual(WA, 'https://wa.me/62895379994528');
  assert.ok(!T.includes('${'), 'tidak ada placeholder yang tertinggal');
});

t('template bawaan: aturan privasi tidak menyangkal bahwa percakapan disimpan', async () => {
  const T = otak.DEFAULT_TEMPLATE;
  assert.ok(!T.includes('no database that stores full conversations'));
  assert.ok(!T.includes('session storage'));
  assert.ok(T.includes('saved on the server of the EMAHAIRSHOP chat service'));
  assert.ok(T.includes('then append [[OFFTOPIC]]'), 'aturan di luar topik minta kalimat singkat + penanda');
});

t('buildSystem: template + tanggal WIB + format JSON; nama hanya bila sah', async () => {
  const a = otak.buildSystem('ATURAN-X');
  assert.ok(a.startsWith('ATURAN-X'));
  assert.ok(/Current date & time: \w+, .*WIB \(GMT\+7\)/.test(a));
  assert.ok(a.includes('{"reply":"..."}') && a.includes('[[HUMAN]]'));
  assert.ok(!a.includes('already told you their name'));
  assert.ok(otak.buildSystem('X', { knownName: 'Sari' }).includes('already told you their name: Sari'));
  assert.ok(!otak.buildSystem('X', { knownName: 'Pengunjung' }).includes('already told you'), 'nama bawaan bukan nama yang disebut pelanggan');
  assert.ok(!otak.buildSystem('X', { knownName: '-(nama belum diberikan)' }).includes('already told you'));
});

t('bahasa: pesan terakhir dideteksi dan dikirim ke model sebagai arahan (kasus "can i have price list" dijawab Indonesia)', async () => {
  assert.strictEqual(otak.detectLang('can i have price list'), 'English');
  assert.strictEqual(otak.detectLang('mau minta price list dong'), 'Indonesian');
  assert.strictEqual(otak.detectLang('ciao vorrei il listino prezzi'), 'Italian');
  assert.strictEqual(otak.detectLang('مرحبا كيف حالك'), 'Arabic');
  assert.strictEqual(otak.detectLang('ok'), '', 'terlalu pendek: tidak yakin');
  assert.strictEqual(otak.detectLang('Sari'), '', 'nama saja: tidak yakin');
  const en = otak.buildSystem('ATURAN', { lastText: 'can i have price list' });
  assert.ok(en.includes("LAST message: English. Write your whole reply in English"), en.slice(-600));
  assert.ok(!otak.buildSystem('ATURAN', { lastText: 'ok' }).includes('Automatic language detection'));
  assert.ok(!otak.buildSystem('ATURAN').includes('Automatic language detection'));
});

t('label tombol WhatsApp mengikuti bahasa pengunjung (sama dengan portal)', async () => {
  const wa = (q) => otak.parseOutput('{"reply":"Hi [[WA]]"}', otak.DEFAULT_TEMPLATE, { userText: q }).reply.split('\n').pop();
  assert.strictEqual(wa('can i have price list'), 'Ask on WhatsApp: ' + WA);
  assert.strictEqual(wa('mau minta price list dong'), 'Tanya lewat WhatsApp: ' + WA);
  assert.strictEqual(wa('ciao vorrei il listino prezzi'), 'Chiedi su WhatsApp: ' + WA);
  assert.strictEqual(wa('ok'), 'Tanya lewat WhatsApp: ' + WA, 'tidak terdeteksi: bahasa halaman (Indonesia)');
  const short = otak.parseOutput('{"reply":"Hi [[WA]]"}', otak.DEFAULT_TEMPLATE, { userText: 'good', recentTexts: ['good', 'can i have price list'] }).reply.split('\n').pop();
  assert.strictEqual(short, 'Ask on WhatsApp: ' + WA, 'pesan pendek: label ikut bahasa percakapan');
  assert.strictEqual(wa('olá gostaria de preços, obrigado'), 'Ask on WhatsApp: ' + WA, 'bahasa di luar daftar: Inggris');
});

t('enrich: lead, nomor, dan nama seperti jaring pengaman portal (tanpa panggilan model tambahan)', async () => {
  const base = { reply: 'Harga mulai $50.\n\nhttps://shop.emahairshop.com/price-list', handoff: false, order: false, alert: '', unknown: '', lead: '', name: '' };
  // Model lupa [[LEAD]] dan [[NAME]], nama sudah dikenal, percakapan harga -> lead otomatis + nama tercatat.
  let r = otak.enrich(base, { userText: 'minta price list', knownName: 'Sari', prevBot: '' });
  assert.ok(r.lead.startsWith('minta=price list; nama=Sari'), r.lead);
  assert.strictEqual(r.name, 'Sari');
  // Pengunjung kirim nomor di percakapan harga: nomor masuk lead (wa=), dari pola angka, bukan dari model.
  r = otak.enrich(Object.assign({}, base, { reply: 'Terima kasih.' }), { userText: 'wa saya +62 812-3456-7890', knownName: '', prevBot: 'lihat https://shop.emahairshop.com/price-list' });
  assert.ok(r.lead.includes('wa=+6281234567890'), r.lead);
  // wa= buatan model dibuang; lead tanpa nama sah dibuang.
  r = otak.enrich(Object.assign({}, base, { reply: 'x', lead: 'minta=quote; nama=Dewi; wa=0811' }), { userText: 'halo' });
  assert.strictEqual(r.lead, 'minta=quote; nama=Dewi');
  r = otak.enrich(Object.assign({}, base, { reply: 'x', lead: 'minta=quote; nama=none' }), { userText: 'halo' });
  assert.strictEqual(r.lead, '');
  // Bukan percakapan harga dan tanpa lead: tidak ada yang dibuat.
  r = otak.enrich(Object.assign({}, base, { reply: 'Halo.' }), { userText: 'halo', knownName: 'Sari', prevBot: '' });
  assert.strictEqual(r.lead, '');
  assert.strictEqual(otak.extractPhone('pesanan 12345'), '');
});

t('gayaPortal: hanya toko owner (dan saklar menyala) yang tampil seperti portal; hasilnya cuma true/false', async () => {
  const fs = require('fs'), p = require('path');
  const route = fs.readFileSync(p.join(__dirname, '..', 'app/chat/[slug]/route.js'), 'utf8');
  assert.ok(route.includes('cfg.portal = await gayaPortal.aktif('), 'halaman chat memasang penanda portal');
  const gp = require('../lib/gayaPortal');
  const mine = ownerShop(), other = otherShop();
  otak._ownerCache.clear();
  assert.strictEqual(await gp.aktif(fake, mine), true);
  assert.strictEqual(await gp.aktif(fake, other), false, 'toko lain tidak berubah');
  assert.strictEqual(await gp.aktif(fake, Object.assign({}, mine, { owner_id: null })), false);
  await settings.save({ OTAK_MODE: 'off' });
  assert.strictEqual(await gp.aktif(fake, mine), false, 'saklar mati: semua toko kembali seperti biasa');
  await settings.save({ OTAK_MODE: 'on' });
  const keep = fake.auth; fake.auth = undefined; otak._ownerCache.clear();
  assert.strictEqual(await gp.aktif(fake, mine), false, 'gagal baca: false, tidak melempar');
  fake.auth = keep; otak._ownerCache.clear();
});

t('bahasa: pesan terakhir terlalu pendek ("good") melanjutkan bahasa percakapan, bukan Indonesia', async () => {
  const hist = ['good', 'what your country', 'can i have price list'];   // terbaru dulu
  assert.strictEqual(otak.detectLang('good'), '');
  assert.strictEqual(otak.convLang(hist), 'English');
  const sys = otak.buildSystem('ATURAN', { lastText: 'good', recentTexts: hist });
  assert.ok(sys.includes('too short to tell its language') && sys.includes('wrote in English: reply in English, NOT in Indonesian'), sys.slice(-700));
  // Pesan terakhir jelas: arahan utama, tanpa cadangan.
  const clear = otak.buildSystem('ATURAN', { lastText: 'mau minta price list dong', recentTexts: ['mau minta price list dong', 'can i have price list'] });
  assert.ok(clear.includes('LAST message: Indonesian') && !clear.includes('too short to tell'));
  // Tidak ada riwayat yang bisa dideteksi: tidak menambah arahan apa pun.
  assert.ok(!otak.buildSystem('ATURAN', { lastText: 'ok', recentTexts: ['ok', 'halo'] }).includes('Automatic language') );
  assert.ok(!otak.buildSystem('ATURAN', { lastText: 'ok', recentTexts: ['ok'] }).includes('too short to tell'));
  assert.strictEqual(otak.convLang(undefined), '');
});

t('parseOutput: penanda dibuang, tindakannya dicatat, tautan WA ditambahkan', async () => {
  const r = otak.parseOutput(JSON.stringify({ reply: 'Halo Sari, silakan hubungi tim.\n\nhttps://shop.emahairshop.com/ [[WA]] [[URGENT]] [[ADMIN_DRAFT: Maaf ya, kami cek]] [[NAME: Sari]] [[LEAD: minta=price list; nama=Sari]] [[UNKNOWN: refund rate]]' }), otak.DEFAULT_TEMPLATE);
  assert.ok(!/\[\[|\]\]/.test(r.reply), r.reply);
  assert.ok(r.reply.startsWith('Halo Sari, silakan hubungi tim.'));
  assert.ok(r.reply.endsWith('Tanya lewat WhatsApp: ' + WA));
  assert.deepStrictEqual([r.handoff, r.order, r.alert, r.name, r.lead, r.unknown], [false, false, 'urgent', 'Sari', 'minta=price list; nama=Sari', 'refund rate']);
  assert.strictEqual(otak.parseOutput('{"reply":"x [[FRAUD]] [[URGENT]]"}', '').alert, 'fraud', 'fraud lebih penting dari urgent');
  const h = otak.parseOutput('{"reply":"Baik, mohon tunggu. [[HUMAN]]"}', otak.DEFAULT_TEMPLATE);
  assert.strictEqual(h.handoff, true);
  assert.ok(!h.reply.includes('WhatsApp:'), 'tanpa [[WA]] tidak ada tautan WA');
  const dup = otak.parseOutput('{"reply":"Hubungi ' + WA + ' ya [[WA]]"}', otak.DEFAULT_TEMPLATE);
  assert.strictEqual(dup.reply.split(WA).length, 2, 'tautan tidak digandakan');
});

t('parseOutput: jaring pengaman minta admin (seperti wantsHuman portal) dan tanpa tautan WA saat serah-terima', async () => {
  // Model lupa menulis [[HUMAN]], tapi pengunjung jelas minta bicara dengan admin -> tetap diserahkan.
  const a = otak.parseOutput('{"reply":"Baik, saya bantu."}', otak.DEFAULT_TEMPLATE, { userText: 'saya mau ngomong sama admin' });
  assert.strictEqual(a.handoff, true);
  // Pertanyaan biasa tidak memicu serah-terima.
  for (const q of ['berapa harga hair extension?', 'apa itu tape-in', 'admin tidak ada di sini ya?', 'ok terima kasih']) {
    assert.strictEqual(otak.parseOutput('{"reply":"Halo."}', otak.DEFAULT_TEMPLATE, { userText: q }).handoff, false, q);
  }
  for (const q of ['connect ke CS dong', 'mau bicara sama orang asli', 'can I talk to a real person', 'hubungkan saya dengan tim']) {
    assert.strictEqual(otak.wantsHuman(q), true, q);
  }
  // Model sudah menandai FRAUD/URGENT: pesan penipuan yang memuat "admin" + "chat" tidak membungkam bot.
  const f = otak.parseOutput('{"reply":"Nomor itu mungkin bukan resmi. [[FRAUD]]"}', otak.DEFAULT_TEMPLATE, { userText: 'ada yang chat saya minta transfer, ini admin kalian?' });
  assert.deepStrictEqual([f.handoff, f.alert], [false, 'fraud']);
  // Tanpa userText perilaku lama tidak berubah.
  assert.strictEqual(otak.parseOutput('{"reply":"Halo."}', otak.DEFAULT_TEMPLATE).handoff, false);
  // Serah-terima + [[WA]] dari model: tautan WhatsApp tidak ditambahkan (pelanggan sedang disambungkan di chat ini).
  const h = otak.parseOutput('{"reply":"Mohon tunggu ya. [[WA]] [[HUMAN]]"}', otak.DEFAULT_TEMPLATE);
  assert.strictEqual(h.handoff, true);
  assert.ok(!h.reply.includes('WhatsApp:') && !h.reply.includes(WA), h.reply);
});

t('parseOutput: di luar topik, markdown, JSON berpagar, teks biasa, dan keluaran rusak', async () => {
  assert.strictEqual(otak.parseOutput('{"reply":"[[OFFTOPIC]]"}', '').reply.includes('EMAHAIRSHOP'), true, 'hanya penanda: pakai kalimat cadangan');
  assert.strictEqual(otak.parseOutput('{"reply":"Itu di luar bidang saya. [[OFFTOPIC]]"}', '').reply, 'Itu di luar bidang saya.');
  assert.strictEqual(otak.parseOutput('{"reply":"**Tebal** dan `kode`\\n# Judul\\n* butir"}', '').reply, 'Tebal dan kode\nJudul\n- butir');
  assert.strictEqual(otak.parseOutput('```json\n{"reply":"Hai"}\n```', '').reply, 'Hai');
  assert.strictEqual(otak.parseOutput('Halo langsung teks', '').reply, 'Halo langsung teks');
  assert.strictEqual(otak.parseOutput('{"reply":"[Team reply] Sudah dicek"}', '').reply, 'Sudah dicek');
  assert.strictEqual(otak.parseOutput('{"reply":"   "}', ''), null);
  assert.strictEqual(otak.parseOutput('{"bukan":"reply"}', ''), null);
  assert.strictEqual(otak.parseOutput('', ''), null);
  assert.strictEqual(otak.parseOutput('{"reply":"' + 'a'.repeat(5000) + '"}', '').reply.length, 2000);
});

t('gerbang: hanya toko milik email ADMIN_EMAILS (tak peduli huruf besar), bisa dimatikan, gagal baca = otak biasa', async () => {
  const mine = ownerShop(), other = otherShop();
  assert.strictEqual(await otak.forShop(fake, mine), otak.DEFAULT_TEMPLATE);
  assert.strictEqual(await otak.forShop(fake, other), '');
  const upper = seedShop(); users[upper.owner_id] = 'LAIN@X.TEST';
  assert.ok(await otak.forShop(fake, upper), 'huruf besar/kecil email diabaikan');
  assert.strictEqual(await otak.forShop(fake, Object.assign({}, mine, { owner_id: null })), '');
  const ghost = seedShop();   // pemilik tidak ditemukan di auth
  assert.strictEqual(await otak.forShop(fake, ghost), '');
  const broken = seedShop(); users[broken.owner_id] = 'owner@emahair.test';
  const keep = fake.auth; fake.auth = undefined; otak._ownerCache.clear();
  assert.strictEqual(await otak.forShop(fake, broken), '', 'auth tidak tersedia: tidak melempar, pakai otak biasa');
  fake.auth = keep; otak._ownerCache.clear();
  await settings.save({ OTAK_MODE: 'off' });
  assert.strictEqual(await otak.forShop(fake, mine), '', 'saklar mati');
  await settings.save({ OTAK_MODE: 'on' });
  assert.ok(await otak.forShop(fake, mine));
  const keepEnv = process.env.ADMIN_EMAILS; delete process.env.ADMIN_EMAILS; delete process.env.DEVELOPER_EMAILS; otak._ownerCache.clear();
  assert.strictEqual(await otak.forShop(fake, mine), '', 'tanpa ADMIN_EMAILS tidak ada toko yang memakai otak');
  process.env.ADMIN_EMAILS = keepEnv; otak._ownerCache.clear();
});

t('teks otak buatan admin menggantikan bawaan; kosong kembali ke bawaan', async () => {
  const mine = ownerShop();
  await settings.save({ OTAK_TEMPLATE: 'ATURAN KUSTOM TOKO' });
  assert.strictEqual(await otak.forShop(fake, mine), 'ATURAN KUSTOM TOKO');
  assert.strictEqual((await otak.config()).custom, true);
  await settings.save({ OTAK_TEMPLATE: '' });   // kosong = hapus isian web, kembali ke bawaan
  assert.strictEqual(await otak.forShop(fake, mine), otak.DEFAULT_TEMPLATE);
});

t('handleMessage toko owner: prompt dari otak, tanpa katalog, penanda dibuang dari balasan tersimpan', async () => {
  const s = ownerShop();
  geminiCalls = []; alerts = [];
  geminiImpl = say('Wholesale mulai $50 per 100 gram.\n\nhttps://shop.emahairshop.com/price-list [[WA]]');
  const r = await chat(s, 'Berapa harga hair extension?');
  const sys = geminiCalls[0].system;
  assert.ok(sys.includes('COMPANY INFO:') && sys.includes('Rules:'));
  assert.ok(!sys.includes('DATA TOKO') && !sys.includes('Produk Biasa'), 'produk toko tidak ikut');
  assert.deepStrictEqual([geminiCalls[0].maxTokens, geminiCalls[0].lowThinking], [2048, true], 'jawaban panjang dan berpikir minimal seperti portal');
  const out = r.messages.filter(m => m.role === 'bot').map(m => m.content).join('\n');
  assert.ok(out.includes('Wholesale mulai $50') && !out.includes('[[') && out.endsWith('WhatsApp: ' + WA) || out.endsWith('Ask on WhatsApp: ' + WA) || out.endsWith('Tanya lewat WhatsApp: ' + WA));
  assert.strictEqual(conv(r).status, 'bot');
  assert.strictEqual(alerts.length, 0);
  assert.strictEqual(r.offerLead, undefined, 'kartu tawaran kontak chatbot biasa tidak dipakai');
});

t('handleMessage toko owner: [[HUMAN]] menyerahkan ke admin dan memberi tahu', async () => {
  const s = ownerShop();
  geminiCalls = []; alerts = [];
  geminiImpl = say('Baik, mohon tunggu sebentar, saya sambungkan ke tim. [[HUMAN]]');
  const r = await chat(s, 'Saya mau bicara dengan admin');
  assert.strictEqual(conv(r).status, 'human');
  assert.strictEqual(conv(r).unanswered, true);
  assert.deepStrictEqual(alerts.map(a => a.reason), ['handoff']);
  const bots = r.messages.filter(m => m.role === 'bot');
  assert.ok(bots.length === 1 && !bots[0].content.includes('[['));
});

t('handleMessage toko owner: model lupa [[HUMAN]] tapi pengunjung minta admin -> tetap diserahkan (jaring pengaman portal)', async () => {
  const s = ownerShop();
  geminiCalls = []; alerts = [];
  geminiImpl = say('Baik, saya bantu ya.');
  const r = await chat(s, 'Saya mau bicara dengan admin');
  assert.strictEqual(conv(r).status, 'human');
  assert.deepStrictEqual(alerts.map(a => a.reason), ['handoff']);
  // Pertanyaan biasa dengan balasan tanpa penanda: tidak diserahkan.
  const s2 = ownerShop(); alerts = [];
  geminiImpl = say('Harga mulai dari $50 per 100 gram. [[WA]]');
  const r2 = await chat(s2, 'berapa harga rambut?');
  assert.strictEqual(conv(r2).status, 'bot');
  assert.deepStrictEqual(alerts, []);
});

t('handleMessage toko owner: [[URGENT]] tidak membungkam bot, hanya menandai dan memberi tahu; nama dan lead tercatat', async () => {
  const s = ownerShop();
  geminiCalls = []; alerts = [];
  geminiImpl = say('Maaf atas ketidaknyamanannya. [[URGENT]] [[NAME: Dewi]] [[LEAD: minta=quote; nama=Dewi]] [[ADMIN_DRAFT: Halo Dewi]]');
  const r = await chat(s, 'PESANAN SAYA BELUM SAMPAI!!! Saya Dewi');
  const c = conv(r);
  assert.strictEqual(c.status, 'bot', 'bot tetap menjawab');
  assert.strictEqual(c.unanswered, true);
  assert.ok(c.last_question.startsWith('Calon pembeli: minta=quote'));
  assert.strictEqual(c.customer_name, 'Dewi');
  assert.deepStrictEqual(alerts.map(a => a.reason), ['urgent']);
  // pesan berikutnya: nama sudah diketahui dan balasan admin diberi label [Team reply]
  db.messages.push({ id: db._mid++, conversation_id: c.id, shop_id: s.id, role: 'admin', content: 'Kami cek ya', created_at: new Date().toISOString() });
  geminiCalls = [];
  geminiImpl = say('Baik.');
  await chat(s, 'Terima kasih', r);
  assert.ok(geminiCalls[0].system.includes('already told you their name: Dewi'));
  assert.ok(geminiCalls[0].contents.some(x => x.parts[0].text.includes('[Team reply] Kami cek ya')));
});

t('handleMessage toko owner: [[UNKNOWN]] menandai pertanyaan belum terjawab tanpa mengganti status', async () => {
  const s = ownerShop();
  alerts = [];
  geminiImpl = say('Saya belum punya info soal itu, tim bisa bantu. [[UNKNOWN: ship by sea]] [[WA]]');
  const r = await chat(s, 'Bisa kirim lewat laut?');
  const c = conv(r);
  assert.deepStrictEqual([c.status, c.unanswered, c.last_question], ['bot', true, 'Bisa kirim lewat laut?']);
  assert.strictEqual(alerts.length, 0, 'tanpa notifikasi push (hanya tampil di dashboard)');
});

t('handleMessage toko owner: keluaran rusak dua kali -> pesan gangguan, bukan error', async () => {
  const s = ownerShop();
  geminiImpl = async () => '{"bukan":"reply"}';
  const r = await chat(s, 'Halo');
  assert.ok(r.messages.some(m => m.role === 'bot' && /gangguan/.test(m.content)));
});

t('handleMessage toko lain: tetap otak chatbot biasa (data toko), tidak tersentuh template', async () => {
  const s = otherShop();
  geminiCalls = []; alerts = [];
  geminiImpl = async () => JSON.stringify({ reply: 'Ada Produk Biasa', handoff: false, order: false });
  await chat(s, 'ada produk apa?');
  const sys = geminiCalls[0].system;
  assert.ok(sys.includes('DATA TOKO') && sys.includes('Produk Biasa'));
  assert.ok(!sys.includes('COMPANY INFO') && !sys.includes('EMAHAIRSHOP'));
  assert.deepStrictEqual([geminiCalls[0].maxTokens, geminiCalls[0].lowThinking], [undefined, undefined], 'toko lain: pengaturan lama tidak berubah');
});

t('otak tidak ikut terkirim lewat konfigurasi publik widget/chat', async () => {
  const fs = require('fs'), p = require('path');
  for (const f of ['lib/publicConfig.js', 'lib/widgetConfig.js', 'app/api/widget/[slug]/route.js', 'app/api/toko/route.js', 'app/chat/[slug]/route.js']) {
    const src = fs.readFileSync(p.join(__dirname, '..', f), 'utf8');
    assert.ok(!/\botak\b|OTAK_/i.test(src), f + ' tidak boleh menyentuh otak');   // \b: kata "kotak" bukan otak
  }
});


const TPL_WA = 'x https://wa.me/62895379994528 y';
t('anti-spam: tombol WA tidak diulang bila 3 balasan terakhir sudah memuatnya', () => {
  const recentBot = ['Info.\n\nTanya lewat WhatsApp: https://wa.me/62895379994528'];
  const r = otak.parseOutput('{"reply":"Baik. [[WA]]"}', TPL_WA, { userText: 'gokil', recentBot });
  assert.ok(!/wa\.me/.test(r.reply));
  const r2 = otak.parseOutput('{"reply":"Baik. [[WA]]"}', TPL_WA, { userText: 'boleh minta nomor WA?', recentBot });
  assert.ok(/wa\.me/.test(r2.reply));
  const r3 = otak.parseOutput('{"reply":"Maaf ya. [[WA]][[URGENT]]"}', TPL_WA, { userText: 'parah', recentBot });
  assert.ok(/wa\.me/.test(r3.reply));
  const r4 = otak.parseOutput('{"reply":"Baik. [[WA]]"}', TPL_WA, { userText: 'gokil', recentBot: [] });
  assert.ok(/wa\.me/.test(r4.reply));
});
t('anti-spam: tautan berdiri sendiri yang sudah dikirim tidak diulang, kecuali FRAUD', () => {
  const recentBot = ['Cek di sini.\n\nhttps://shop.emahairshop.com/'];
  const r = otak.parseOutput('{"reply":"Boleh tahu nama Anda?\\n\\nhttps://shop.emahairshop.com/"}', TPL_WA, { userText: 'gokil', recentBot });
  assert.strictEqual(r.reply, 'Boleh tahu nama Anda?');
  const f = otak.parseOutput('{"reply":"Cek dulu.\\n\\nhttps://verify.emahairshop.com [[FRAUD]]"}', TPL_WA, { userText: 'x', recentBot: ['a\n\nhttps://verify.emahairshop.com'] });
  assert.ok(/verify\.emahairshop\.com/.test(f.reply));
});


t('wa.me tulisan model dibuang dan diganti satu tombol dengan label bersih (tidak terpotong)', () => {
  const r = otak.parseOutput('{"reply":"Maaf, soal itu tim kami yang tahu.\\nSilakan hubungi tim kami melalui WhatsApp untuk konfirmasi lebih lanjut: https://wa.me/62895379994528"}', TPL_WA, { userText: 'mahal', recentBot: [] });
  assert.strictEqual((r.reply.match(/wa\.me/g) || []).length, 1);
  assert.ok(/\n\nTanya lewat WhatsApp: https:\/\/wa\.me\/\d+$/.test(r.reply));
  assert.ok(!/hubungi tim kami melalui/.test(r.reply));
});


t('bahasa: pesan pendek memakai bahasa halaman (?lang), bukan bahasa percakapan sebelumnya', () => {
  const sys = otak.buildSystem('RULES', { lastText: 'i dont know', siteLang: 'en', recentTexts: ['kok lama amat', 'halo saya mau tanya'] });
  assert.ok(/Website language chosen by the visitor: English/.test(sys));
  assert.ok(!/NOT in Indonesian by default/.test(sys));
});
t('bahasa: balasan Indonesia untuk pengunjung berbahasa Inggris dicoba ulang sekali dan diberi arahan bahasa', async () => {
  const s = ownerShop();
  geminiCalls = []; alerts = [];
  let n = 0;
  geminiImpl = async () => JSON.stringify({ reply: n++ === 0 ? 'Harga mulai dari $50 per 100 gram. Untuk detailnya, silakan kunjungi daftar harga kami.' : 'Prices start from $50 per 100 grams. Please see our price list for details.' });
  const r = await bot.handleMessage({ slug: s.slug, text: 'can i have price list', lang: 'en' });
  assert.strictEqual(geminiCalls.length, 2);
  assert.ok(/write your whole reply in English/.test(JSON.stringify(geminiCalls[0].contents)));
  assert.ok(/do NOT use Indonesian/.test(JSON.stringify(geminiCalls[1].contents)));
  const out = r.messages.filter(m => m.role === 'bot').map(m => m.content).join('\n');
  assert.ok(/Prices start from/.test(out) && !/Harga mulai/.test(out));
});
t('anti-spam: tautan spesifik (price-list) boleh dikirim ulang, hanya halaman induk yang tidak diulang', () => {
  const recentBot = ['Lihat.\n\nhttps://shop.emahairshop.com/price-list'];
  const r = otak.parseOutput('{"reply":"Prices start from $50.\\n\\nhttps://shop.emahairshop.com/price-list"}', TPL_WA, { userText: 'price list please', recentBot });
  assert.ok(/shop\.emahairshop\.com\/price-list/.test(r.reply));
});


t('price list diminta tapi model lupa tautan: server menambahkan tautan price-list (tidak dobel, tidak untuk pertanyaan lain)', () => {
  const miss = otak.parseOutput('{"reply":"Prices start from $50 per 100 grams. For full details, please visit our price list."}', TPL_WA, { userText: 'can i have price list please', recentBot: ['x'] });
  assert.ok(/\n\nhttps:\/\/shop\.emahairshop\.com\/price-list$/.test(miss.reply));
  const has = otak.parseOutput('{"reply":"Ok.\\n\\nhttps://shop.emahairshop.com/price-list"}', TPL_WA, { userText: 'price list', recentBot: [] });
  assert.strictEqual((has.reply.match(/price-list/g) || []).length, 1);
  const other = otak.parseOutput('{"reply":"Bisa pakai JNE."}', TPL_WA, { userText: 'bisa kirim pake jne', recentBot: [] });
  assert.ok(!/price-list/.test(other.reply));
});


t('pelanggan mengakhiri percakapan: status selesai, token salah ditolak, pesan baru membuka lagi', async () => {
  const s = ownerShop();
  geminiImpl = say('Halo, ada yang bisa dibantu?');
  const r = await chat(s, 'Halo');
  await assert.rejects(() => bot.closeConversation({ slug: s.slug, conversationId: r.conversationId, token: '00000000-0000-4000-8000-000000000000' }));
  assert.strictEqual(conv(r).status, 'bot');
  const c = await bot.closeConversation({ slug: s.slug, conversationId: r.conversationId, token: r.token });
  assert.deepStrictEqual(c, { ok: true, status: 'selesai' });
  assert.strictEqual(conv(r).status, 'selesai');
  assert.strictEqual(conv(r).closed_by_customer, true, 'ditandai ditutup pelanggan');
  const r2 = await chat(s, 'Satu lagi ya', r);
  assert.strictEqual(conv(r2).status, 'bot');
  assert.strictEqual(conv(r2).closed_by_customer, false, 'dibuka lagi = penanda dihapus');
});

(async () => {
  let fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('  ok   ' + name); } catch (e) { fail++; console.log('  GAGAL ' + name + '\n       ' + (e && e.stack || e)); }
  }
  console.log(fail ? '\n' + fail + ' tes gagal' : '\nSemua ' + tests.length + ' tes lulus');
  process.exit(fail ? 1 : 0);
})();
