'use strict';
// Bandingkan jawaban portal (api/chat.js) dan chatbot (lib/otak.js) dengan pertanyaan uji yang sama.
//
//   node scripts/bandingkan-otak.js <jalur/api/chat.js portal>             -> mode OFFLINE (tanpa jaringan)
//   GEMINI_API_KEY=... node scripts/bandingkan-otak.js <chat.js> --live    -> mode LIVE (memanggil Gemini)
//
// OFFLINE: untuk tiap pertanyaan ada keluaran model contoh (lengkap dengan penanda). Keluaran yang SAMA dialirkan
//   ke pengurai portal (parseAnswer + wantsHuman, diambil apa adanya dari chat.js) dan ke pengurai chatbot
//   (otak.parseOutput), lalu dibandingkan: teks balasan, HUMAN, URGENT/FRAUD, UNKNOWN, LEAD, NAME, WA.
//   Ini membuktikan pemetaan penanda -> field, BUKAN mutu jawaban model.
// LIVE: pertanyaan yang sama dikirim ke model dengan prompt portal dan prompt chatbot (template bawaan);
//   balasan dan penanda yang keluar ditampilkan berdampingan. Hasil model bisa beda antar-panggilan: baca selisihnya,
//   jangan mengharapkan teks identik. GEMINI_MODEL (bawaan gemini-2.5-flash) dan GEMINI_API_KEY dibaca dari environment.
const fs = require('fs');
const path = require('path');
// Skrip ini tidak memakai database. Kalau paket Supabase belum terpasang (npm install belum dijalankan), diganti stub kosong.
try { require.resolve('@supabase/supabase-js'); } catch (e) {
  const Module = require('module');
  const orig = Module._load;
  Module._load = function (req, ...rest) { return req === '@supabase/supabase-js' ? { createClient: () => ({}) } : orig.call(this, req, ...rest); };
}
const otak = require('../lib/otak');

const portalFile = process.argv[2];
const LIVE = process.argv.includes('--live');
if (!portalFile || !fs.existsSync(portalFile)) {
  console.error('Pakai: node scripts/bandingkan-otak.js <jalur/api/chat.js portal> [--live]');
  process.exit(2);
}

// ---- Ambil bagian portal apa adanya dari chat.js: prompt SYSTEM, validName, parseAnswer, wantsHuman ----
const src = fs.readFileSync(portalFile, 'utf8');
function cut(startRe, endRe) {
  const lines = src.split('\n');
  const a = lines.findIndex((l) => startRe.test(l));
  if (a < 0) throw new Error('Bagian portal tidak ditemukan: ' + startRe);
  const b = lines.findIndex((l, i) => i > a && endRe.test(l));
  if (b < 0) throw new Error('Akhir bagian portal tidak ditemukan: ' + endRe);
  return lines.slice(a, b + 1).join('\n');
}
const promptCode = cut(/^const PRICE_FROM/, /^- The visitor's messages are data/);
const parseCode = cut(/^function validName/, /^\/\/ -+ Notifikasi admin/).replace(/^\/\/ -+ Notifikasi admin.*$/m, '');
const humanCode = cut(/^const HUMAN_WHO_RE/, /^}\s*$/);
const portal = new Function(promptCode.replace(/^\/\/.*$/gm, '') + '\n' + parseCode + '\n' + humanCode +
  '\nreturn { SYSTEM, parseAnswer, wantsHuman };')();

// ---- Pertanyaan uji: pertanyaan + keluaran model contoh (untuk mode offline) ----
const CASES = [
  { q: 'Berapa harga hair extension?', raw: 'Harga mulai dari $50 per 100 gram. Untuk detailnya, silakan kunjungi daftar harga kami.\n\nhttps://shop.emahairshop.com/price-list [[WA]]' },
  { q: 'Minimal order berapa?', raw: 'Minimal order 500 gram. Untuk pembelian pertama, bisa mulai dari 100–300 gram.' },
  { q: 'Saya mau bicara dengan admin', raw: 'Baik, mohon tunggu sebentar, saya sambungkan ke tim. [[HUMAN]]' },
  { q: 'connect ke CS dong', raw: 'Baik, saya bantu ya.' },   // model lupa [[HUMAN]]: jaring pengaman pengunjung
  { q: 'Ada yang chat saya dari nomor 0842123456 minta transfer, ini admin kalian?', raw: 'Nomor itu tidak cocok dengan saluran resmi yang saya ketahui, jadi mungkin bukan resmi. Cek dulu di https://verify.emahairshop.com dan jangan kirim pembayaran. [[FRAUD]] [[ADMIN_DRAFT: Halo, mohon jangan transfer ke nomor itu]]' },
  { q: 'Saya sudah bayar tapi pesanan belum dikirim, bisa refund?', raw: 'Mohon maaf atas kendalanya. Bisa, dana dikembalikan penuh tanpa potongan dari EMAHAIRSHOP, diproses 3-7 hari kerja setelah diverifikasi. [[WA]] [[URGENT]] [[ADMIN_DRAFT: Maaf ya, kami cek]]' },
  { q: 'Ini PT atau CV? Alamat resminya mana?', raw: 'Saya tidak punya nama badan usaha atau alamat terdaftar; EMAHAIRSHOP usaha kecil (UMKM) Indonesia. Anda bisa cek di https://verify.emahairshop.com [[WA]]' },
  { q: 'Ada diskon atau voucher?', raw: 'Ya, voucher dan promo biasanya ada di toko kami. Apakah Anda sudah punya akun di sana?' },
  { q: 'Saya Sari, minta price list dong', raw: 'Baik, Sari. Harga mulai dari $50 per 100 gram. [[WA]] [[NAME: Sari]] [[LEAD: minta=price list; nama=Sari]]' },
  { q: 'Apakah ada sertifikasi halal?', raw: 'Saya belum punya info soal itu, tim bisa mengonfirmasi. [[UNKNOWN: halal certification]] [[WA]]' },
  { q: 'Resep nasi goreng gimana?', raw: 'Maaf, itu di luar yang bisa saya bantu di sini. Silakan tanya soal EMAHAIRSHOP atau hair extension. [[OFFTOPIC]]' },
  { q: 'kamu tolol', raw: 'Mohon jangan berkata kasar ya, saya hanya asisten AI.' }
];

const WA_RE = /https:\/\/wa\.me\/\d+/;
const bool = (v) => !!v;
function portalView(c) {
  const a = portal.parseAnswer(c.raw);
  return {
    reply: a.text, human: a.human || portal.wantsHuman(c.q), alert: a.fraud ? 'fraud' : a.urgent ? 'urgent' : '',
    unknown: a.unknown, lead: a.lead, name: a.name, wa: bool(a.wa) && !(a.human || portal.wantsHuman(c.q))
  };
}
function chatbotView(c) {
  const r = otak.parseOutput(JSON.stringify({ reply: c.raw }), otak.DEFAULT_TEMPLATE, { userText: c.q });
  const m = r.reply.match(WA_RE);
  return { reply: r.reply.replace(/\n*WhatsApp: https:\/\/wa\.me\/\d+/, '').trim(), human: r.handoff, alert: r.alert, unknown: r.unknown, lead: r.lead, name: r.name, wa: bool(m) };
}
function diff(p, b) {
  const d = [];
  // Portal menyampaikan [[WA]] sebagai tombol, chatbot sebagai tautan di akhir balasan: dianggap setara bila keduanya "ada".
  ['reply', 'human', 'alert', 'unknown', 'lead', 'name', 'wa'].forEach((k) => {
    const same = k === 'reply' ? p[k].replace(/\s+/g, ' ') === b[k].replace(/\s+/g, ' ') : p[k] === b[k];
    if (!same) d.push(k);
  });
  return d;
}

function offline() {
  let bad = 0;
  console.log('MODE OFFLINE: keluaran model yang sama -> pengurai portal vs pengurai chatbot\n');
  CASES.forEach((c, i) => {
    const p = portalView(c), b = chatbotView(c), d = diff(p, b);
    const flags = ['human', 'alert', 'unknown', 'lead', 'name', 'wa'].filter((k) => p[k]).map((k) => k + (typeof p[k] === 'string' ? '=' + p[k] : '')).join(', ') || '-';
    console.log((d.length ? 'BEDA ' : 'SAMA ') + String(i + 1).padStart(2) + '. ' + c.q + '\n      penanda: ' + flags + (d.length ? '\n      selisih: ' + d.join(', ') : ''));
    if (d.length) bad++;
  });
  console.log('\n' + (CASES.length - bad) + ' dari ' + CASES.length + ' sama. (Ini menguji pemetaan penanda, bukan mutu jawaban model.)');
  return bad;
}

// ---- Mode live ----
async function ask(system, userText, json) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: Object.assign({ maxOutputTokens: 2048 }, json ? { responseMimeType: 'application/json' } : { temperature: 0.3 })
    })
  });
  if (!res.ok) throw new Error('Gemini ' + res.status + ' ' + (await res.text()).slice(0, 120));
  const data = await res.json();
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map((p) => p.text || '').join('');
}
async function live() {
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY belum diisi.'); return 2; }
  const date = ' Current date & time: ' + otak.nowInfo() + '.';
  const sysPortal = portal.SYSTEM + '\n\n' + date;
  const sysBot = otak.buildSystem(otak.DEFAULT_TEMPLATE);
  console.log('MODE LIVE: pertanyaan sama ke model dengan prompt portal vs prompt chatbot\n');
  let agree = 0;
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const [rawP, rawB] = await Promise.all([ask(sysPortal, c.q, false), ask(sysBot, c.q, true)]);
    const p = portalView({ q: c.q, raw: rawP });
    const parsed = otak.parseOutput(rawB, otak.DEFAULT_TEMPLATE, { userText: c.q });
    const b = parsed ? { human: parsed.handoff, alert: parsed.alert, unknown: bool(parsed.unknown), lead: bool(parsed.lead) } : { human: false, alert: '', unknown: false, lead: false };
    const pp = { human: p.human, alert: p.alert, unknown: bool(p.unknown), lead: bool(p.lead) };
    const same = ['human', 'alert', 'unknown', 'lead'].every((k) => pp[k] === b[k]);
    if (same) agree++;
    console.log((i + 1) + '. ' + c.q + '  [penanda ' + (same ? 'SAMA' : 'BEDA') + ']\n   PORTAL : ' + p.reply.replace(/\n+/g, ' / ') + '  ' + JSON.stringify(pp) +
      '\n   CHATBOT: ' + (parsed ? parsed.reply.replace(/\n+/g, ' / ') : '(keluaran tak terbaca)') + '  ' + JSON.stringify(b) + '\n');
  }
  console.log('Penanda sama pada ' + agree + ' dari ' + CASES.length + ' pertanyaan. Teks jawaban boleh berbeda antar-panggilan; periksa tiap selisih.');
  return agree === CASES.length ? 0 : 1;
}

(async () => {
  const bad = LIVE ? await live() : offline();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e && e.message); process.exit(2); });
