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

const FORMAT = 'ANSWER FORMAT (technical): reply with exactly ONE JSON object and nothing else: {"reply":"..."}. ' +
  'Put the whole visitor-facing text in "reply" as a JSON string (use \\n for line breaks). Plain text only. ' +
  'Any internal markers described in the rules above ([[WA]], [[URGENT]], [[FRAUD]], [[HUMAN]], [[LEAD: ...]], [[UNKNOWN: ...]], [[NAME: ...]], [[ADMIN_DRAFT: ...]], [[OFFTOPIC]]) ' +
  'are written at the very end of the "reply" string, in the same text; they are removed automatically before the visitor sees the reply.';

// opts.knownName: nama yang sudah disebut pengunjung di percakapan ini (kosong = belum tahu).
function buildSystem(template, opts) {
  const o = opts || {};
  const parts = [
    String(template),
    'Current date & time: ' + nowInfo() + '. If the visitor asks what day, date or time it is, answer using this, translating the day/month name and formatting naturally into the visitor\'s own language (do not just paste the English words), and mention it\'s WIB/GMT+7 only if relevant. Never guess or make up a different date/time.'
  ];
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

// Keluaran model -> { reply, handoff, order:false, alert:'urgent'|'fraud'|'', unknown, lead, name }, atau null kalau tidak terbaca.
function parseOutput(raw, template) {
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
  const human = has(/\[\[HUMAN\]\]/i);
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
  // Tombol WhatsApp di portal -> tautan di akhir balasan (kecuali sudah ada di teks).
  const link = waLink(template);
  if (wa && link && !text.includes(link)) text += '\n\nWhatsApp: ' + link;

  return {
    reply: text.slice(0, 2000),
    handoff: human,
    order: false,
    alert: fraud ? 'fraud' : urgent ? 'urgent' : '',
    unknown, lead, name
  };
}

module.exports = {
  config, forShop, ownerIsAdmin, buildSystem, parseOutput, validName, waLink, knownName, nowInfo,
  DEFAULT_TEMPLATE, MAX_TEMPLATE, _ownerCache: ownerCache
};
