'use strict';
// Pemakaian balasan bot (untuk kuota harian dan bulanan).
// Dibaca dari tabel bot_usage (satu baris per toko per hari WIB, diisi trigger saat bot membalas),
// BUKAN dari jumlah baris pesan, supaya menghapus percakapan tidak mengembalikan jatah.
// Kalau tabelnya belum ada (migrasi pemakaian_bot.sql belum dijalankan), kembali menghitung dari tabel messages.
const WIB = 7 * 3600000;

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
  const m = await sb.from('messages').select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId).eq('role', 'bot').gte('created_at', from.toISOString());
  if (m.error) throw m.error;
  return m.count || 0;
}

module.exports = { dayKey, repliesSince };
