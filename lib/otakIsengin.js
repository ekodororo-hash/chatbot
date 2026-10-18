'use strict';
// "Otak isengin": otak khusus untuk asisten di web isengin.site (link-in-bio), dipakai toko yang slug-nya diisi di env ISENGIN_BOT.
// Ada tiga otak yang terpisah dan tidak pernah aktif bersamaan untuk satu toko:
//   1. otak EMAHAIRSHOP (lib/otak.js)   - toko milik ADMIN_EMAILS
//   2. info situs Asisten Toko (lib/pengetahuan.js) - toko widget situs, env WIDGET_BOT (tetap pola lama: data toko + info situs)
//   3. otak isengin (file ini)            - toko ISENGIN_BOT: menjawab calon pengguna dan pengguna isengin.site
// Yang ini tanpa tombol WhatsApp, tautan price list, atau gaya portal. Pengetahuannya ada di teks otak
// (lib/otak.isengin.template.js, bisa diubah admin di /admin/ai); harga Pro dibaca dari env dan ditempel ke penanda {{PRO_BULAN}}/{{PRO_TAHUN}}.
// Model membalas JSON {"reply":"..."}; penanda ([[HUMAN]], [[LEAD: ...]], [[NAME: ...]], [[UNKNOWN: ...]], [[OFFTOPIC]]) ada di akhir
// isi "reply" dan diurai di sini sebelum balasan dilihat pengunjung. Bahasa balasan memakai pendeteksi yang sama dengan otak EMAHAIRSHOP.
const settings = require('./settings');
const otak = require('./otak');
const DEFAULT_TEMPLATE = require('./otak.isengin.template');

const MAX_TEMPLATE = 60000;   // batas panjang teks yang boleh disimpan admin
const FALLBACK_OFFTOPIC = 'Maaf, itu di luar hal yang bisa saya bantu di sini. Coba tanya soal isengin.site ya.';
const FALLBACK_HUMAN = 'Baik, pesanmu saya teruskan ke admin. Admin akan membalas di chat ini ya.';

// Pengaturan: OTAK_ISENGIN_MODE ('off' mematikan; toko ISENGIN_BOT kembali ke data tokonya sendiri),
// OTAK_ISENGIN_TEMPLATE (teks buatan admin; kosong = bawaan), OTAK_ISENGIN_TEMPLATE_PREV (versi sebelumnya, untuk batal).
async function config() {
  const v = await settings.getAll();
  const custom = String(v.OTAK_ISENGIN_TEMPLATE || '').trim();
  return {
    on: String(v.OTAK_ISENGIN_MODE || '').trim().toLowerCase() !== 'off',
    template: custom || DEFAULT_TEMPLATE,
    custom: !!custom,
    hasPrev: !!String(v.OTAK_ISENGIN_TEMPLATE_PREV || '').trim()
  };
}

// Slug toko isengin dari env ISENGIN_BOT ('' = belum diatur). Kalau sama dengan WIDGET_BOT, WIDGET_BOT yang menang
// (pola lama toko widget Asisten Toko tidak berubah), jadi otak isengin tidak dipakai.
function botSlug() {
  const ib = String(process.env.ISENGIN_BOT || '').trim();
  const wb = String(process.env.WIDGET_BOT || '').trim();
  return ib && ib !== wb ? ib : '';
}
function isIsenginShop(shop) {
  const ib = botSlug();
  return !!ib && !!shop && shop.slug === ib;
}

// Harga Pro ke teks "Rp29.000". Env ISENGIN_PRO_PRICE_MONTH / ISENGIN_PRO_PRICE_YEAR; bawaan sama dengan isengin-link (29000 dan 290000).
const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
function prices() {
  return {
    month: Number(process.env.ISENGIN_PRO_PRICE_MONTH) || 29000,
    year: Number(process.env.ISENGIN_PRO_PRICE_YEAR) || 290000
  };
}
function fill(template) {
  const p = prices();
  return String(template).replace(/\{\{PRO_BULAN\}\}/g, rp(p.month)).replace(/\{\{PRO_TAHUN\}\}/g, rp(p.year));
}

// Teks otak untuk toko ini (penanda harga sudah diisi), atau '' kalau toko ini bukan toko ISENGIN_BOT atau saklarnya mati.
async function forShop(shop) {
  try {
    if (!isIsenginShop(shop)) return '';
    const c = await config();
    if (!c.on) return '';
    return fill(c.template);
  } catch (e) {
    console.error('Otak isengin dilewati:', e && e.message);
    return '';
  }
}

const FORMAT = 'ANSWER FORMAT (technical): reply with exactly ONE JSON object and nothing else: {"reply":"..."}. ' +
  'Put the whole visitor-facing text in "reply" as a JSON string (use \\n for line breaks). Plain text only. ' +
  'Any internal markers described in the rules above ([[HUMAN]], [[LEAD: ...]], [[NAME: ...]], [[UNKNOWN: ...]], [[OFFTOPIC]]) ' +
  'are written at the very end of the "reply" string, in the same text; they are removed automatically before the visitor sees the reply.';

// Perakit prompt: teks otak + tanggal + arahan bahasa (pendeteksi sama dengan otak EMAHAIRSHOP) + nama yang sudah dikenal + format.
// opts: knownName, siteLang (?lang= widget), lastText (pesan terakhir), recentTexts (pesan pengunjung sebelumnya, terbaru dulu).
function buildSystem(template, opts) {
  const o = opts || {};
  const parts = [
    String(template),
    'Current date & time: ' + otak.nowInfo() + '. If the visitor asks about the date or time, answer from this in the visitor\'s own language. Never guess a different date or time.'
  ];
  const lang = otak.detectLang(o.lastText);
  const prior = lang ? '' : otak.convLang(o.recentTexts);
  if (lang) parts.push('Automatic language detection of the visitor\'s LAST message: ' + lang + '. Write your whole reply in ' + lang + ' (unless that message is clearly in a different language, then use that one). Ignore the language of earlier replies.');
  else if (prior) parts.push('The visitor\'s LAST message is too short to tell its language. Earlier in this conversation the visitor wrote in ' + prior + ': reply in ' + prior + ', NOT in Indonesian by default. If that last message is clearly in another language, use that one instead.');
  else if (otak.siteLangName(o.siteLang)) {
    const sl = otak.siteLangName(o.siteLang);
    parts.push('Website language chosen by the visitor: ' + sl + '. Reply in the language of the visitor\'s last message; if that message is too short or ambiguous to tell (for example "ok", a number, a name, a link or an emoji), reply in ' + sl + '.');
  }
  parts.push('LANGUAGE PURITY: the rules above are written in Indonesian, and their example sentences are only samples. Whenever you reply in a language other than Indonesian, translate everything completely and never leave Indonesian words inside the reply (product names such as "isengin.site", "Pro", and menu names stay as they are). One reply = one language only.');
  const name = otak.validName(o.knownName);
  if (name) parts.push('The visitor already told you their name: ' + name + '. Never ask for their name again.');
  parts.push(FORMAT);
  return parts.join('\n\n');
}

// Pengunjung jelas minta disambungkan ke admin/manusia (jaring pengaman kalau model lupa [[HUMAN]]).
// Sengaja lebih ketat daripada otak EMAHAIRSHOP: di situs ini "admin" dan "chat" sering muncul sebagai topik fitur
// ("apakah admin bisa ambil alih chat?"), jadi hanya kalimat pendek yang berbentuk permintaan langsung yang dihitung.
const HUMAN_ASK_RE = /\b(?:bicara|ngomong|ngobrol|chat|hubungi|hubungkan|sambungkan|sambungin|connect|talk|speak|contact)\w*\s+(?:(?:dengan|sama|ama|ke|kepada|to|with)\s+)?(?:(?:si|a|an|the)\s+)?(?:admin|cs|manusia|orang asli|tim|team|human|real person|agent|staff|staf|pemilik|owner)\b/i;
const ABOUT_FEATURE_RE = /pelanggan|customer|pembeli|visitor|pengunjung|toko(?:ku| saya| kami)?\b.*\b(?:bisa|dapat)\b/i;
function wantsHuman(text) {
  const t = String(text || '').trim();
  return t.length > 0 && t.length <= 80 && HUMAN_ASK_RE.test(t) && !ABOUT_FEATURE_RE.test(t);
}

const EMAIL_RE = /[^\s@<>()[\],;:]+@[^\s@<>()[\],;:]+\.[A-Za-z]{2,}/;
function extractEmail(text) {
  const m = String(text || '').match(EMAIL_RE);
  return m ? m[0] : '';
}

// Keluaran model -> { reply, handoff, order:false, alert:'', unknown, lead, name }, atau null kalau tidak terbaca.
// opts.userText: pesan pengunjung yang sedang dijawab (untuk jaring pengaman wantsHuman).
function parseOutput(raw, template, opts) {
  const s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let reply = null;
  try { const o = JSON.parse(s); if (o && typeof o.reply === 'string') reply = o.reply; } catch (e) { /* coba cara lain */ }
  if (reply === null) {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { const o = JSON.parse(m[0]); if (o && typeof o.reply === 'string') reply = o.reply; } catch (e) { /* abaikan */ } }
  }
  if (reply === null && s && !s.startsWith('{')) reply = s;   // model membalas teks biasa: tetap dipakai
  if (reply === null) return null;

  const has = (re) => re.test(reply);
  const grab = (re) => { const m = reply.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
  const offtopic = has(/\[\[OFFTOPIC\]\]/i);
  const human = has(/\[\[HUMAN\]\]/i) || wantsHuman(opts && opts.userText);
  const lead = grab(/\[\[LEAD:([\s\S]*?)\]\]/i).slice(0, 300);
  const unknown = grab(/\[\[UNKNOWN:([\s\S]*?)\]\]/i).slice(0, 100);
  const name = otak.validName(grab(/\[\[NAME:([\s\S]*?)\]\]/i));

  let text = reply
    .replace(/\[\[(LEAD|NAME|UNKNOWN|ADMIN_DRAFT):[\s\S]*?\]\]/gi, '')
    .replace(/\[Team reply\]\s*/gi, '')
    .replace(/\[\[(OFFTOPIC|HUMAN|WA|URGENT|FRAUD)\]\]/gi, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*\*\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text && offtopic) text = FALLBACK_OFFTOPIC;
  if (!text && human) text = FALLBACK_HUMAN;
  if (!text) return null;

  return { reply: text.slice(0, 2000), handoff: human, order: false, alert: '', unknown, lead, name };
}

// Jaring pengaman lead: nomor/email hanya dari pesan pengunjung, bukan karangan model.
//  - kolom kontak/wa/email buatan model dibuang; yang dipakai adalah nomor dan email yang benar-benar ada di pesan pengunjung
//    (pesan ini, atau pesan sebelumnya di ctx.recentTexts, terbaru dulu)
//  - lead tanpa isi sama sekali tidak dicatat
// ctx: { userText, recentTexts }
function enrich(result, ctx) {
  if (!result) return result;
  const c = ctx || {};
  let lead = '';
  if (result.lead) {
    lead = result.lead.split(';').map((x) => x.trim()).filter((x) => x && !/^(kontak|wa|whatsapp|email|telp|telepon|hp|no)\s*=/i.test(x)).join('; ');
    const seen = [c.userText].concat(Array.isArray(c.recentTexts) ? c.recentTexts.slice(0, 8) : []);
    let phone = '', mail = '';
    for (const t of seen) {
      if (!phone) phone = otak.extractPhone(t);
      if (!mail) mail = extractEmail(t);
    }
    const contact = [phone, mail].filter(Boolean).join(' / ');
    if (contact) lead += (lead ? '; ' : '') + 'kontak=' + contact;
  }
  return Object.assign({}, result, { lead: lead.slice(0, 300), name: result.name || '' });
}

module.exports = {
  config, forShop, buildSystem, parseOutput, enrich, wantsHuman, extractEmail, botSlug, isIsenginShop, prices, fill,
  // Dipakai ulang dari otak EMAHAIRSHOP supaya bot.js memanggil nama yang sama untuk kedua otak.
  knownName: otak.knownName, detectLang: otak.detectLang, convLang: otak.convLang, indoLeak: otak.indoLeak, validName: otak.validName,
  DEFAULT_TEMPLATE, MAX_TEMPLATE
};
