'use strict';
// Pemakaian balasan bot (untuk kuota harian dan bulanan).
// Dibaca dari tabel bot_usage (satu baris per toko per hari WIB, ditambah record() setiap AI selesai membalas),
// BUKAN dari jumlah baris pesan, supaya menghapus percakapan tidak mengembalikan jatah.
// Pesan otomatis (asisten nonaktif, kuota habis) tidak dicatat: hanya balasan AI yang memakai kuota.
// Kalau tabelnya belum ada (migrasi pemakaian_bot.sql belum dijalankan), kembali menghitung dari tabel messages.
const WIB = 7 * 3600000;

// Pola (SQL LIKE) pesan otomatis bot yang tidak memanggil AI: "asisten nonaktif" dan "kuota habis".
// Dipakai pada cara hitung cadangan di bawah. Harus cocok dengan kalimat di lib/bot.js (dijaga oleh tes).
const AUTO_PATTERNS = ['Maaf %, asisten otomatis sedang nonaktif.%', 'Maaf %, kuota balasan otomatis %'];

// Tanggal WIB (yyyy-mm-dd) dari sebuah waktu. Awal hari/bulan WIB (yang dipakai plans.startOfMonthWIB dan startOfTodayWIB) juga jatuh ke tanggal yang benar.
function dayKey(d) {
  return new Date((d ? new Date(d) : new Date()).getTime() + WIB).toISOString().slice(0, 10);
}

// Jumlah balasan bot sejak waktu "from" (Date) sampai sekarang untuk satu toko.
async function repliesSince(sb, shopId, from) {
  try {
    const r = await sb.from('bot_usage').select('n').eq('shop_id', shopId).gte('day', dayKey(from)).limit(40);
    if (!r.error) return (r.data || []).reduce((sum, x) => sum + (Number(x.n) || 0), 0);
  } catch (e) { /* tabel belum ada: pakai cara lama di bawah */ }
  // Cadangan (migrasi belum dijalankan): hitung dari pesan, tetap tanpa pesan otomatis.
  let q = sb.from('messages').select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId).eq('role', 'bot').gte('created_at', from.toISOString());
  AUTO_PATTERNS.forEach((p) => { q = q.not('content', 'like', p); });
  const m = await q;
  if (m.error) throw m.error;
  return m.count || 0;
}

// Catat satu balasan AI. Gagal mencatat tidak boleh mengganggu balasan ke pelanggan.
let warned = false;
async function record(sb, shopId) {
  try {
    const r = await sb.rpc('bot_usage_add', { sid: shopId });
    if (r && r.error) throw r.error;
  } catch (e) {
    if (!warned) { warned = true; console.error('Pencatatan pemakaian dilewati (jalankan migrasi pemakaian_bot.sql):', e && e.message); }
  }
}

module.exports = { dayKey, repliesSince, record, AUTO_PATTERNS };
