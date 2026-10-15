'use strict';
// Penilaian pelanggan (jempol atas/bawah) setelah percakapan. Hanya logika murni, tanpa akses database
// (akses database ada di lib/bot.js), jadi aman dipakai juga di dashboard.

// Pesan dari tombol cepat di halaman chat, bukan pertanyaan sungguhan.
const QUICK = new Set(['tanya produk', 'cek status pesanan', 'bicara dengan admin']);
const QWORD = /\b(apa|apakah|berapa|bagaimana|gimana|kenapa|mengapa|kapan|dimana|siapa|bisa|boleh|ada|how|what|when|where|why|can)\b/i;
const MAX_Q = 200;

// 1 = jempol atas, -1 = jempol bawah, 0 = tidak valid.
function parseValue(v) {
  if (v === 1 || v === '1' || v === 'up') return 1;
  if (v === -1 || v === '-1' || v === 'down') return -1;
  return 0;
}

// Dari pesan pelanggan (urut dari yang terbaru), pilih yang paling pantas jadi bahan FAQ:
// pesan bernada pertanyaan dulu, lalu pesan yang cukup panjang, terakhir pesan terbaru apa adanya.
// Pesan tombol cepat dan pesan yang sangat pendek ("ok", "makasih") dilewati.
function pickQuestion(texts) {
  const list = (texts || []).map(x => String(x || '').replace(/\s+/g, ' ').trim())
    .filter(x => x && !QUICK.has(x.toLowerCase())).slice(0, 5);
  if (!list.length) return '';
  const q = list.find(x => x.length >= 8 && (x.includes('?') || QWORD.test(x)))
    || list.find(x => x.length >= 12)
    || list.find(x => x.length >= 4);
  return q ? q.slice(0, MAX_Q) : '';
}

// rows: [{ rating: 1 | -1 }]. pct = persen jempol atas, atau null kalau belum ada penilaian.
function summarize(rows) {
  let up = 0, down = 0;
  (rows || []).forEach(r => { if (r.rating === 1) up++; else if (r.rating === -1) down++; });
  const total = up + down;
  return { up, down, total, pct: total ? Math.round(up / total * 100) : null };
}

module.exports = { parseValue, pickQuestion, summarize, MAX_Q };
