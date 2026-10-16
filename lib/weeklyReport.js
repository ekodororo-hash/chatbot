'use strict';
// Laporan 7 hari terakhir ke Telegram admin toko: percakapan, calon pembeli, pertanyaan yang belum
// terjawab. Dipanggil terjadwal lewat /api/cron/laporan (sekali seminggu), atau manual dari halaman Notifikasi.
const notify = require('./notify');

const DAY = 86400000;
const GAP_DAYS = 6;        // laporan otomatis tidak dikirim lagi kalau yang terakhir kurang dari ini
const TOP_QUESTIONS = 5;
const TOP_LEADS = 10;
const LEAD_PREFIX = 'Calon pembeli:';
const num = (n) => Number(n || 0).toLocaleString('id-ID');
const dateWIB = (d) => d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' });

// Pertanyaan belum terjawab yang sama (abaikan huruf besar/kecil dan spasi) digabung dan dihitung.
function groupQuestions(list, n) {
  const map = new Map();
  for (const q of list || []) {
    const text = String(q || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    const cur = map.get(key);
    if (cur) cur.count++; else map.set(key, { text: text.slice(0, 120), count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, n || TOP_QUESTIONS);
}

// "Calon pembeli: minta=price list; pembeli=-; gram=1000; nama=Takemi" -> "Takemi: minta price list, 1.000 gram".
// Isian kosong ("-") dibuang. Mengembalikan null kalau teksnya bukan data calon pembeli.
function parseLead(text) {
  const t = String(text || '').trim();
  if (!t.startsWith(LEAD_PREFIX)) return null;
  const f = {};
  for (const part of t.slice(LEAD_PREFIX.length).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const v = part.slice(i + 1).trim();
    if (v && v !== '-') f[part.slice(0, i).trim().toLowerCase()] = v;
  }
  const bits = [];
  if (f.minta) bits.push('minta ' + f.minta);
  if (f.pembeli) bits.push(f.pembeli);
  if (f.produk) bits.push(f.produk);
  if (f.tekstur) bits.push(f.tekstur);
  if (f.panjang) bits.push(f.panjang);
  if (f.gram) {
    const g = Number(String(f.gram).replace(/[^\d.]/g, ''));
    bits.push(g > 0 ? num(g) + ' gram' : f.gram);
  }
  return (f.nama || 'Tanpa nama') + (f.negara ? ' (' + f.negara + ')' : '') + (bits.length ? ': ' + bits.join(', ') : '');
}

// s: { from, to, conversations, botReplies, leads, questions }  (leads: daftar teks yang sudah dirapikan)
function build(shop, s) {
  const leads = s.leads || [];
  const lines = ['[' + shop.name + '] Laporan mingguan', dateWIB(s.from) + ' - ' + dateWIB(new Date(s.to.getTime() - 1)), ''];
  lines.push('RINGKASAN');
  lines.push('• Percakapan: ' + num(s.conversations));
  lines.push('• Balasan asisten: ' + num(s.botReplies));
  lines.push('• Calon pembeli: ' + num(leads.length));
  lines.push('• Pertanyaan belum terjawab: ' + num(s.unanswered));
  if (leads.length) {
    lines.push('', 'CALON PEMBELI');
    leads.slice(0, TOP_LEADS).forEach((l) => lines.push('• ' + l));
    if (leads.length > TOP_LEADS) lines.push('• dan ' + num(leads.length - TOP_LEADS) + ' lainnya (lihat menu Kontak)');
  }
  lines.push('', 'PERTANYAAN BELUM TERJAWAB');
  if (s.questions.length) {
    s.questions.forEach((q) => lines.push('• ' + q.text + (q.count > 1 ? ' (' + q.count + 'x)' : '')));
    lines.push('Ajari asisten lewat menu Belum terjawab di dashboard.');
  } else {
    lines.push('Tidak ada. Bagus!');
  }
  const base = notify.appUrl();
  if (base) lines.push('', 'Dashboard:', base + '/dashboard/ringkasan');
  return { subject: '[' + shop.name + '] Laporan mingguan', text: lines.join('\n') };
}

async function collect(sb, shopId, from, to) {
  const iso = (d) => d.toISOString();
  const conv = await sb.from('conversations').select('unanswered,last_question')
    .eq('shop_id', shopId).gte('created_at', iso(from)).limit(5000);
  if (conv.error) throw conv.error;
  const rows = conv.data || [];
  const bot = await sb.from('messages').select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId).eq('role', 'bot').gte('created_at', iso(from));
  if (bot.error) throw bot.error;
  // Calon pembeli (lead) ditandai belum terjawab oleh bot, tapi bukan pertanyaan yang tertinggal: dipisah.
  const leads = [];
  const un = [];
  for (const r of rows) {
    if (!r.unanswered) continue;
    const lead = parseLead(r.last_question);
    if (lead) leads.push(lead); else un.push(r.last_question);
  }
  return {
    from, to, conversations: rows.length, botReplies: bot.count || 0,
    leads, unanswered: un.length, questions: groupQuestions(un)
  };
}

// Kirim laporan satu toko. Mengembalikan hasil notify.deliver, atau { skipped: true } kalau tidak ada percakapan.
// force: true (tombol "kirim sekarang") tetap mengirim walau minggu ini sepi.
async function sendForShop(sb, shop, now, force) {
  now = now || new Date();
  const s = await collect(sb, shop.id, new Date(now.getTime() - 7 * DAY), now);
  if (!force && !s.conversations) return { skipped: true };
  return notify.deliver(sb, shop, build(shop, s));
}

async function run(sb, now) {
  now = now || new Date();
  const r = await sb.from('shop_notify').select('shop_id,tg_chat_ids,weekly_sent_at').eq('weekly_on', true).eq('tg_on', true).limit(5000);
  if (r.error) throw r.error;
  const out = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  for (const row of r.data || []) {
    if (!(row.tg_chat_ids || []).length) continue;
    if (row.weekly_sent_at && now.getTime() - Date.parse(row.weekly_sent_at) < GAP_DAYS * DAY) continue;
    out.checked++;
    try {
      const s = await sb.from('shops').select('id,name').eq('id', row.shop_id).maybeSingle();
      if (s.error || !s.data) continue;
      const res = await sendForShop(sb, s.data, now, false);
      if (res.skipped) { out.skipped++; continue; }
      if (res.telegram.sent > 0) {
        const u = await sb.from('shop_notify').update({ weekly_sent_at: now.toISOString() }).eq('shop_id', row.shop_id);
        if (u.error) throw u.error;
        out.sent++;
      } else out.failed++;
    } catch (e) {
      out.failed++;
      console.error('Laporan mingguan gagal:', e && e.message);
    }
  }
  return out;
}

module.exports = { run, sendForShop, build, collect, groupQuestions, parseLead, GAP_DAYS };
