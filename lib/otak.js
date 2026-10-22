'use strict';
// "Otak" EMAHAIRSHOP untuk asisten: aturan perilaku + info perusahaan yang dipindah dari portal (api/chat.js).
// Dipakai HANYA untuk toko milik email yang ada di ADMIN_EMAILS (lihat lib/admin.js); toko lain tetap memakai
// otak chatbot biasa (data toko di buildSystem). Teksnya disimpan di sisi server (app_settings, atau bawaan di
// lib/otak.template.js) dan tidak pernah dikirim ke browser pemilik toko.
//
// Cara kerja: model membalas JSON {"reply":"..."}; penanda internal portal ([[WA]], [[HUMAN]], [[URGENT]], ...)
// ditulis di akhir isi "reply" persis seperti di portal, lalu diurai di sini (parseOutput) dan dibuang sebelum
// balasan dilihat pelanggan.
const settings = require('./settings');
const adminLib = require('./admin');
const DEFAULT_TEMPLATE = require('./otak.template');

const MAX_TEMPLATE = 120000;           // batas panjang teks otak yang boleh disimpan admin
const OWNER_TTL_MS = 5 * 60 * 1000;    // hasil pemeriksaan "pemilik toko = admin layanan" disimpan 5 menit
const FALLBACK_OFFTOPIC = 'Maaf, itu di luar hal yang bisa saya bantu di sini. Coba tanya soal EMAHAIRSHOP atau hair extension ya.';

const ownerCache = new Map();          // owner_id -> { at, sig, ok }

// Pengaturan otak: OTAK_MODE ('off' mematikan), OTAK_TEMPLATE (teks buatan admin; kosong = bawaan).
async function config() {
  const v = await settings.getAll();
  const custom = String(v.OTAK_TEMPLATE || '').trim();
  return {
    on: String(v.OTAK_MODE || '').trim().toLowerCase() !== 'off',
    template: custom || DEFAULT_TEMPLATE,
    custom: !!custom,
    hasPrev: !!String(v.OTAK_TEMPLATE_PREV || '').trim()
  };
}

// Apakah pemilik toko ini salah satu email admin layanan? Gagal membaca = false (toko memakai otak biasa).
async function ownerIsAdmin(sb, shop) {
  const list = adminLib.adminEmails();
  if (!list.length || !shop || !shop.owner_id) return false;
  const sig = list.join(',');
  const hit = ownerCache.get(shop.owner_id);
  if (hit && hit.sig === sig && Date.now() - hit.at < OWNER_TTL_MS) return hit.ok;
  try {
    const r = await sb.auth.admin.getUserById(shop.owner_id);
    const email = r && r.data && r.data.user && r.data.user.email;
    const ok = !!email && list.includes(String(email).toLowerCase());
    ownerCache.set(shop.owner_id, { at: Date.now(), sig, ok });
    return ok;
  } catch (e) {
    console.error('Pemeriksaan pemilik toko untuk otak dilewati:', e && e.message);
    return false;
  }
}

// Teks otak untuk toko ini, atau '' kalau tokonya memakai otak chatbot biasa.
async function forShop(sb, shop) {
  try {
    const c = await config();
    if (!c.on) return '';
    // Toko untuk widget admin (env WIDGET_BOT) punya otak sendiri: pakai produk/FAQ tokonya, bukan otak EMAHAIRSHOP.
    const wb = String(process.env.WIDGET_BOT || '').trim();
    if (wb && shop && shop.slug === wb) return '';
    return (await ownerIsAdmin(sb, shop)) ? c.template : '';
  } catch (e) {
    console.error('Otak template dilewati:', e && e.message);
    return '';
  }
}

// Tanggal dan jam sekarang (WIB), sama seperti di portal.
function nowInfo() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  return fmt.format(new Date()) + ' WIB (GMT+7)';
}

// Nama pengunjung yang sah: 1-3 kata huruf (boleh ' . -), 2-30 karakter. Menolak isian model seperti "none" atau kalimat.
function validName(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 30) return '';
  if (!/^[\p{L}][\p{L}'’.-]*(?: [\p{L}][\p{L}'’.-]*){0,2}$/u.test(t)) return '';
  if (/^(none|unknown|visitor|anonymous|nama|name|tidak ada|belum ada|pengunjung|pelanggan)$/i.test(t)) return '';
  return t;
}

// Deteksi bahasa pesan pengunjung (deterministik), dipindah dari portal (detectLang di api/chat.js). Model kadang membalas
// dengan bahasa contoh di aturan (Indonesia) padahal pengunjung menulis bahasa lain, jadi bahasa pesan terakhir dideteksi di
// server dan dikirim ke model sebagai arahan tegas. Tidak yakin (pesan pendek, nama saja) = '' dan model memilih sendiri.
const SCRIPTS = [
  ['Arabic', /[\u0600-\u06FF]/g], ['Russian', /[\u0400-\u04FF]/g], ['Korean', /[\uAC00-\uD7AF]/g],
  ['Japanese', /[\u3040-\u30FF]/g], ['Chinese', /[\u4E00-\u9FFF]/g], ['Hindi', /[\u0900-\u097F]/g]
];
const STOP = {
  English: "the and you your please can could would for with this that what how need want hello hi i'm i'd am price list of to is are do does have any much i my me we our it its an on at by be will use own there some get from about where when which who why if or not thanks thank no yes very too expensive cheap cheaper more less than discount buy order shipping send sent too much many long short so but just also then now still again already really good bad okay please",
  Indonesian: 'yang dan saya aku mau minta mint ada apa bisa untuk dengan ini itu tidak harga kak halo tolong berapa dong ya sih nih banget gimana kapan dari ke di mahal murah banget kok lagi udah belum bukan jangan gak nggak ga',
  Italian: 'il che per con non sono vorrei grazie ciao prezzi listino quanto una mi piacerebbe buongiorno salve gli del della',
  Spanish: 'los las que para con por soy quisiera gracias hola precios lista cuánto cuanto una del buenas favor puede envía envia me',
  French: 'les des pour avec je suis voudrais merci bonjour prix liste vous une est pouvez pourriez svp',
  German: 'der die das und ich bin hätte gern bitte danke hallo preisliste für mit ein eine ist nicht guten',
  Portuguese: 'os as para com sou gostaria obrigado obrigada olá ola preços precos lista você voce uma pode não nao bom',
  Dutch: 'het een ik ben kunt prijslijst alstublieft dank hallo voor met niet graag u',
  Turkish: 'ben merhaba fiyat listesi için icin ve bir lütfen lutfen alabilir miyim',
  Polish: 'cześć czesc jestem proszę prosze cennik dla nie jak czy dzień',
  Vietnamese: 'xin chào chao tôi toi bảng giá cho của và là một'
};
const STOPSETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(/\s+/))]));

function detectLang(text) {
  const t = String(text || '');
  const letters = (t.match(/\p{L}/gu) || []).length;
  if (letters < 2) return '';
  for (const [name, re] of SCRIPTS) {
    const n = (t.match(re) || []).length;
    if (n >= 2 && n / letters >= 0.3) return name;
  }
  const words = (t.toLowerCase().match(/[\p{L}'’]+/gu) || []).map((w) => w.replace(/’/g, "'"));
  let best = '', bestN = 0, second = 0;
  for (const [lang, set] of Object.entries(STOPSETS)) {
    let n = 0;
    for (const w of words) if (set.has(w)) n++;
    if (n > bestN) { second = bestN; bestN = n; best = lang; }
    else if (n > second) second = n;
  }
  return bestN >= 2 && bestN >= second + 1 ? best : '';
}

// Kata khas Indonesia yang tidak ada padanan sama di bahasa lain. Dipakai untuk menangkap balasan campuran
// (misalnya balasan Inggris yang ditutup "Boleh tahu nama Anda?"), yang lolos dari detectLang karena mayoritas katanya Inggris.
const ID_ONLY = new Set('boleh tahu nama anda silakan silahkan terima kasih baik tolong mohon bisa kami kita saya aku kak mau ingin untuk dengan yang dan atau tidak belum sudah akan ada apa bagaimana berapa harga daftar pesanan pesan kirim toko hubungi admin selamat pagi siang sore malam sama-sama maaf lainnya jumlah gram'.split(/\s+/));
function indoLeak(text) {
  const words = new Set((String(text || '').toLowerCase().match(/[\p{L}]+/gu) || []));
  let n = 0;
  for (const w of words) if (ID_ONLY.has(w)) n++;
  return n;
}

// Bahasa percakapan: bahasa pesan pengunjung terbaru yang bisa dideteksi. texts = isi pesan pengunjung, terbaru dulu.
function convLang(texts) {
  for (const t of (Array.isArray(texts) ? texts : []).slice(0, 8)) { const l = detectLang(t); if (l) return l; }
  return '';
}

const FORMAT = 'ANSWER FORMAT (technical): reply with exactly ONE JSON object and nothing else: {"reply":"..."}. ' +
  'Put the whole visitor-facing text in "reply" as a JSON string (use \\n for line breaks). Plain text only. ' +
  'Any internal markers described in the rules above ([[WA]], [[URGENT]], [[FRAUD]], [[HUMAN]], [[LEAD: ...]], [[UNKNOWN: ...]], [[NAME: ...]], [[ADMIN_DRAFT: ...]], [[OFFTOPIC]]) ' +
  'are written at the very end of the "reply" string, in the same text; they are removed automatically before the visitor sees the reply.';

// opts.knownName: nama yang sudah disebut pengunjung di percakapan ini (kosong = belum tahu).
// opts.lastText: pesan terakhir pengunjung, untuk arahan bahasa otomatis (sama dengan portal).
// opts.recentTexts: pesan pengunjung sebelumnya (terbaru dulu), cadangan bahasa kalau pesan terakhir terlalu pendek.
// Kode bahasa halaman (?lang= di widget, sama dengan pilihan bahasa portal) -> nama bahasa untuk arahan model. Tidak dikenal = ''.
const SITE_LANGS = { id: 'Indonesian', en: 'English', it: 'Italian', es: 'Spanish', fr: 'French', ar: 'Arabic', de: 'German', ru: 'Russian' };
function siteLangName(code) { return SITE_LANGS[String(code || '').toLowerCase().slice(0, 2)] || ''; }

function buildSystem(template, opts) {
  const o = opts || {};
  const parts = [
    String(template),
    'Current date & time: ' + nowInfo() + '. If the visitor asks what day, date or time it is, answer using this, translating the day/month name and formatting naturally into the visitor\'s own language (do not just paste the English words), and mention it\'s WIB/GMT+7 only if relevant. Never guess or make up a different date/time.'
  ];
  const lang = detectLang(o.lastText);
  const prior = lang ? '' : convLang(o.recentTexts);
  if (lang) parts.push('Automatic language detection of the visitor\'s LAST message: ' + lang + '. Write your whole reply in ' + lang + ' (unless that message is clearly in a different language, then use that one). Ignore the language of earlier replies.');
  else if (prior) {
    // Pesan terakhir terlalu pendek/ambigu: lanjutkan bahasa percakapan (menang atas bahasa halaman).
    parts.push('The visitor\'s LAST message is too short to tell its language. Earlier in this conversation the visitor wrote in ' + prior + ': reply in ' + prior + ', NOT in Indonesian by default. Ignore the language of the examples in the rules above. If that last message is clearly in another language, use that one instead.');
  }
  else if (siteLangName(o.siteLang)) {
    const sl = siteLangName(o.siteLang);
    parts.push('Website language chosen by the visitor: ' + sl + '. The visitor may change it in the middle of the conversation, so earlier replies may be in another language. Reply in the language of the visitor\'s last message; if that message is too short or ambiguous to tell (for example "ok", "i dont know", a number, a name, a link or an emoji), reply in ' + sl + '. Ignore the language of the examples in the rules above.');
  }
  // Contoh kalimat di aturan ditulis Indonesia; model kecil sering menyalinnya mentah-mentah di tengah balasan bahasa lain.
  parts.push('LANGUAGE PURITY: the example sentences in the rules above are written in Indonesian only as samples. Whenever you reply in a language other than Indonesian, translate them completely, and never leave any Indonesian word or phrase (for example "Boleh tahu nama Anda?", "Silakan", "Terima kasih") inside the reply. One reply = one language only. The only exceptions are product or field names and the words "rambut warna" / "rambut natural" when the visitor is Indonesian.');
  const name = validName(o.knownName);
  if (name) parts.push('The visitor already told you their name: ' + name + '. Never ask for their name again.');
  parts.push(FORMAT);
  return parts.join('\n\n');
}

// Tautan WhatsApp resmi diambil dari teks otak itu sendiri (satu sumber kebenaran); kosong bila tidak ada.
function waLink(template) {
  const m = String(template || '').match(/https:\/\/wa\.me\/\d+/);
  return m ? m[0] : '';
}

// Nama pengunjung yang sudah tercatat di percakapan web (kolom customer_name; bawaannya "Pengunjung").
async function knownName(sb, convId) {
  try {
    const r = await sb.from('conversations').select('customer_name').eq('id', convId).maybeSingle();
    return validName(r && r.data && r.data.customer_name);
  } catch (e) { return ''; }
}

// Label tombol WhatsApp per bahasa (sama dengan portal). Bahasa tidak terdeteksi = Indonesia (bahasa halaman chat);
// bahasa terdeteksi tetapi tidak ada di daftar = Inggris.
const WA_LABELS = {
  Indonesian: 'Tanya lewat WhatsApp', English: 'Ask on WhatsApp', Italian: 'Chiedi su WhatsApp', Spanish: 'Preguntar por WhatsApp',
  French: 'Demander sur WhatsApp', Arabic: 'اسأل عبر واتساب', German: 'Per WhatsApp fragen', Russian: 'Спросить в WhatsApp'
};
function waLabel(userText, recentTexts) {
  const lang = detectLang(userText) || convLang(recentTexts);
  return WA_LABELS[lang] || (lang ? WA_LABELS.English : WA_LABELS.Indonesian);
}

// Nomor telepon dari pesan pengunjung: deterministik (pola angka), 8-15 digit. "+" atau "00" di depan = internasional.
function extractPhone(text) {
  const found = String(text || '').match(/(?:\+|00)?\d[\d\s().-]{6,20}\d/g);
  if (!found) return '';
  for (const raw of found.reverse()) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) continue;
    const t = raw.trim();
    return t.startsWith('+') ? '+' + digits : digits.startsWith('00') ? '+' + digits.slice(2) : digits;
  }
  return '';
}

// Jaring pengaman lead seperti portal (bagian yang tidak butuh panggilan model tambahan):
//  - field wa= buatan model dibuang; nomor hanya dari pesan pengunjung (extractPhone)
//  - lead hanya dianggap sah kalau namanya sah (nama= di lead, atau nama yang sudah dikenal pada percakapan harga)
//  - model lupa [[LEAD]] tetapi nama atau nomor ada di percakapan harga: lead dibuat otomatis
//  - nama sah dicatat sebagai nama pelanggan walau model lupa [[NAME]]
// ctx: { userText, knownName, prevBot }. Percakapan harga = balasan ini atau balasan bot sebelumnya memuat tautan price list.
const PRICE_RE = /shop\.emahairshop\.com\/price-list/i;
function enrich(result, ctx) {
  if (!result) return result;
  const c = ctx || {};
  const nm = result.lead ? (result.lead.match(/(?:^|;)\s*nama\s*=\s*([^;]*)/i) || [])[1] : '';
  const clean = result.lead ? result.lead.split(';').map((x) => x.trim()).filter((x) => x && !/^wa\s*=/i.test(x)).join('; ') : '';
  let leadName = validName(nm);
  let lead = leadName ? clean : '';
  const phone = extractPhone(c.userText);
  const priceConvo = PRICE_RE.test(result.reply) || PRICE_RE.test(c.prevBot || '');
  if (!leadName && validName(c.knownName) && priceConvo) leadName = validName(c.knownName);
  if (!lead && (leadName || (phone && priceConvo))) {
    lead = 'minta=price list; nama=' + (leadName || '-') + '; catatan=nama/nomor diambil otomatis, detail lain ada di percakapan';
  }
  if (lead && phone && priceConvo) lead += '; wa=' + phone;
  return Object.assign({}, result, { lead: lead.slice(0, 300), name: result.name || leadName || '' });
}

// Pengunjung jelas minta bicara dengan admin/manusia, dibaca langsung dari pesannya (sama dengan wantsHuman di portal).
// Jaring pengaman kalau model lupa menulis [[HUMAN]]; bukan pengganti penanda model.
const HUMAN_WHO_RE = /\badmin|\bcs\b|\btim\b|\bteam\b|manusia|orang asli|real person|real admin|\bhuman\b|\bagent\b|\bstaff\b|\bstaf\b/i;
const HUMAN_TALK_RE = /\b(bicara|ngomong|ngobrol|chat|hubungi|hubungkan|sambungkan|connect|talk|speak|terhubung)\w*/i;
function wantsHuman(text) {
  const t = String(text || '');
  return HUMAN_WHO_RE.test(t) && HUMAN_TALK_RE.test(t);
}

// Keluaran model -> { reply, handoff, order:false, alert:'urgent'|'fraud'|'', unknown, lead, name }, atau null kalau tidak terbaca.
// opts.userText: pesan pengunjung yang sedang dijawab (untuk jaring pengaman wantsHuman).
// Jaring pengaman tata letak: model kadang menulis satu paragraf panjang tanpa baris baru. Paragraf yang panjang dan tanpa
// baris baru dipecah per 1-2 kalimat (dipisah baris kosong). Baris daftar ("- ", "1. "), baris URL, dan teks pendek tidak disentuh.
function tidyLayout(text) {
  return String(text).split(/\n{2,}/).map((para) => {
    if (para.includes('\n') || para.length < 180 || /^\s*(?:[-\d]+[.)]?\s|https?:\/\/)/.test(para)) return para;
    const sents = para.split(/(?<=[.!?])\s+(?=[A-Z"\u201C])/);
    if (sents.length < 3) return para;
    const out = [];
    let cur = '';
    sents.forEach((sn) => {
      if (cur && (cur.length + sn.length > 170)) { out.push(cur); cur = sn; }
      else cur = cur ? cur + ' ' + sn : sn;
    });
    if (cur) out.push(cur);
    return out.join('\n\n');
  }).join('\n\n');
}

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
  const wa = has(/\[\[WA\]\]/i);
  const urgent = has(/\[\[URGENT\]\]/i);
  const fraud = has(/\[\[FRAUD\]\]/i);
  // Jaring pengaman wantsHuman tidak dipakai bila model sudah menandai FRAUD/URGENT: di chatbot serah-terima membungkam bot,
  // dan pesan penipuan ("ada yang chat saya minta transfer, ini admin kalian?") memuat kata admin + chat tanpa minta disambungkan.
  const human = has(/\[\[HUMAN\]\]/i) || (!fraud && !urgent && wantsHuman(opts && opts.userText));
  const lead = grab(/\[\[LEAD:([\s\S]*?)\]\]/i).slice(0, 300);
  const unknown = grab(/\[\[UNKNOWN:([\s\S]*?)\]\]/i).slice(0, 100);
  const name = validName(grab(/\[\[NAME:([\s\S]*?)\]\]/i));

  let text = reply
    .replace(/\[\[(LEAD|ADMIN_DRAFT|NAME|UNKNOWN):[\s\S]*?\]\]/gi, '')
    .replace(/\[Team reply\]\s*/gi, '')
    .replace(/\[\[(OFFTOPIC|WA|URGENT|FRAUD|HUMAN)\]\]/gi, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*\*\s+/gm, '- ')
    .trim();
  if (!text && offtopic) text = FALLBACK_OFFTOPIC;
  if (!text) return null;
  text = tidyLayout(text);
  // Model kadang menulis tautan wa.me sendiri di tengah kalimat ("Silakan hubungi kami melalui WhatsApp: https://wa.me/..."), padahal
  // tombol WA ditambahkan server. Baris seperti itu dibuang dan dianggap permintaan tombol, supaya label tombol tidak terpotong
  // dan tidak dobel. Kecuali FRAUD: di sana model memang boleh menampilkan nomor resmi sebagai pembanding.
  let waWritten = false;
  if (!fraud && /https:\/\/wa\.me\//i.test(text)) {
    waWritten = true;
    const kept = text.split('\n').filter((ln) => !/https:\/\/wa\.me\//i.test(ln)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (kept) text = kept;
  }
  // Tombol WhatsApp di portal -> tautan di akhir balasan (kecuali sudah ada di teks).
  // Saat pengunjung diserahkan ke admin lewat chat ini, tautan WhatsApp tidak ditambahkan (sama dengan portal).
  const link = waLink(template);
  // Jaring pengaman anti-spam (portal tidak punya riwayat tersimpan, chatbot punya): tautan yang sudah dikirim di 2 balasan terakhir
  // tidak diulang, dan tombol WhatsApp tidak dipasang lagi bila dalam 3 balasan terakhir sudah ada. Pengecualian: FRAUD/URGENT,
  // atau pengunjung sendiri menyebut WhatsApp/kontak/admin.
  const recent = (opts && Array.isArray(opts.recentBot)) ? opts.recentBot.map(String) : [];
  const critical = fraud || urgent;
  const asksContact = /whats\s?app|\bwa\b|\bw\.?a\b|kontak|contact|hubungi|nomor|number|telepon|phone/i.test(String(opts && opts.userText || ''));
  if (recent.length && !critical && !asksContact) {
    const seen = new Set();
    recent.slice(0, 2).forEach((t) => (t.match(/https?:\/\/[^\s<>)]+[^\s<>)\].,;:!?]/g) || []).forEach((u) => seen.add(u.replace(/\/$/, '').toLowerCase())));
    // Hanya halaman induk (shop/blog/help tanpa path) yang tidak diulang. Tautan spesifik (price-list, track, verify, refund-policy,
    // view-review) selalu boleh dikirim lagi: pengunjung yang meminta ulang justru butuh tautannya.
    const ROOT = /^https?:\/\/(shop|blog|help|www)?\.?emahairshop\.com\/?$/i;
    const kept = text.split('\n').filter((ln) => {
      const m = ln.match(/^\s*(https?:\/\/\S*[^\s.,;:!?)\]])\s*$/);
      return !(m && ROOT.test(m[1]) && seen.has(m[1].replace(/\/$/, '').toLowerCase()));
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (kept) text = kept;
  }
  // Pengunjung jelas minta price list tetapi model lupa menyertakan tautannya (aturan "jangan ulangi info" sering memicunya saat
  // diminta dua kali): tautan price list ditambahkan server. Tidak dipakai saat serah-terima admin, URGENT/FRAUD, atau di luar topik.
  const PL_ASK = /price\s?-?list|pricelist|\bPL\b|daftar harga|list harga|listino|lista de precios|liste de prix|preisliste|прайс|قائمة الأسعار/i;
  if (!human && !critical && !offtopic && PL_ASK.test(String(opts && opts.userText || '')) && !/shop\.emahairshop\.com\/price-list/i.test(text)) {
    text += '\n\nhttps://shop.emahairshop.com/price-list';
  }
  const waRecently = recent.slice(0, 3).some((t) => /https:\/\/wa\.me\//i.test(t));
  const showWa = (wa || waWritten) && !human && link && !text.includes(link) && (critical || asksContact || !waRecently);
  if (showWa) text += '\n\n' + waLabel(opts && opts.userText, opts && opts.recentTexts) + ': ' + link;

  return {
    reply: text.slice(0, 2000),
    handoff: human,
    order: false,
    alert: fraud ? 'fraud' : urgent ? 'urgent' : '',
    unknown, lead, name
  };
}

module.exports = {
  config, forShop, ownerIsAdmin, buildSystem, siteLangName, parseOutput, validName, waLink, knownName, nowInfo, wantsHuman, detectLang, convLang, indoLeak, waLabel, extractPhone, enrich,
  DEFAULT_TEMPLATE, MAX_TEMPLATE, _ownerCache: ownerCache
};
