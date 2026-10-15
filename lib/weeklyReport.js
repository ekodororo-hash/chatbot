'use strict';
// Laporan 7 hari terakhir ke Telegram admin toko: percakapan, pesanan dan omzet, pertanyaan yang belum
// terjawab. Dipanggil terjadwal lewat /api/cron/laporan (sekali seminggu), atau manual dari halaman Notifikasi.
const notify = require('./notify');
const orders = require('./orders');

const DAY = 86400000;
const GAP_DAYS = 6;        // laporan otomatis tidak dikirim lagi kalau yang terakhir kurang dari ini
const TOP_QUESTIONS = 5;
const rp = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
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

// s: { from, to, conversations, botReplies, unanswered, ordersOn, orderCount, summary, questions }
function build(shop, s) {
  const lines = ['[' + shop.name + '] Laporan mingguan', dateWIB(s.from) + ' - ' + dateWIB(new Date(s.to.getTime() - 1)), ''];
  lines.push('Percakapan: ' + num(s.conversations));
  lines.push('Balasan asisten: ' + num(s.botReplies));
  lines.push('Belum terjawab / butuh admin: ' + num(s.unanswered));
  if (s.ordersOn) {
    const m = s.summary;
    lines.push('', 'Pesanan: ' + num(m.count) + (m.canceled ? ' (' + num(m.canceled) + ' dibatalkan)' : ''));
    lines.push('Omzet selesai: ' + rp(m.revenue) + ' dari ' + num(m.done) + ' pesanan');
    if (m.open) lines.push('Masih berjalan: ' + num(m.open) + ' pesanan senilai ' + rp(m.pending));
    if (m.top.length) lines.push('Terlaris: ' + m.top.map((x) => x.name + ' (' + num(x.qty) + ')').join(', '));
  } else if (s.orderCount) {
    lines.push('', 'Pesanan: ' + num(s.orderCount));
  }
  if (s.questions.length) {
    lines.push('', 'Pertanyaan yang belum terjawab:');
    s.questions.forEach((q) => lines.push('- ' + q.text + (q.count > 1 ? ' (' + q.count + 'x)' : '')));
    lines.push('Ajari asisten lewat menu Belum terjawab di dashboard.');
  } else {
    lines.push('', 'Tidak ada pertanyaan yang tertinggal. Bagus!');
  }
  const base = notify.appUrl();
  if (base) lines.push('', 'Dashboard: ' + base + '/dashboard/ringkasan');
  return { subject: '[' + shop.name + '] Laporan mingguan', text: lines.join('\n') };
}

async function collect(sb, shopId, from, to) {
  const iso = (d) => d.toISOString();
  const conv = await sb.from('conversations').select('unanswered,last_question,flag')
    .eq('shop_id', shopId).gte('created_at', iso(from)).limit(5000);
  if (conv.error) throw conv.error;
  const rows = conv.data || [];
  const bot = await sb.from('messages').select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId).eq('role', 'bot').gte('created_at', iso(from));
  if (bot.error) throw bot.error;
  const un = rows.filter((r) => r.unanswered);
  const out = {
    from, to, conversations: rows.length, botReplies: bot.count || 0, unanswered: un.length,
    questions: groupQuestions(un.map((r) => r.last_question)),
    ordersOn: false, orderCount: rows.filter((r) => r.flag === 'Pesanan').length, summary: orders.summarize([])
  };
  // Tabel pesanan bisa belum ada (migrasi belum dijalankan): laporan tetap jalan, tanpa bagian omzet.
  try {
    const o = await sb.from('orders').select('status,items,subtotal').eq('shop_id', shopId).gte('created_at', iso(from)).limit(5000);
    if (o.error) throw o.error;
    out.ordersOn = true;
    out.summary = orders.summarize(o.data || []);
  } catch (e) { console.error('Laporan: data pesanan dilewati:', e && e.message); }
  return out;
}

// Kirim laporan satu toko. Mengembalikan hasil notify.deliver, atau { skipped: true } kalau tidak ada aktivitas.
// force: true (tombol "kirim sekarang") tetap mengirim walau minggu ini sepi.
async function sendForShop(sb, shop, now, force) {
  now = now || new Date();
  const s = await collect(sb, shop.id, new Date(now.getTime() - 7 * DAY), now);
  if (!force && !s.conversations && !(s.summary && s.summary.count)) return { skipped: true };
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

module.exports = { run, sendForShop, build, collect, groupQuestions, GAP_DAYS };
