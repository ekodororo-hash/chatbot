'use strict';
// Pengetahuan otomatis tentang situs Asisten Toko ini sendiri, khusus untuk toko widget situs (env WIDGET_BOT).
// Tidak perlu diisi manual di dashboard: harga, kuota, dan diskon dibaca langsung dari pengaturan paket (/admin/paket),
// jadi selalu sama dengan halaman depan dan halaman Langganan. Penjelasan fitur ada di FITUR di bawah: kalau menambah
// fitur baru, cukup ubah daftar itu lalu deploy. FAQ/produk yang diisi manual di dashboard tetap dipakai bersama teks ini.
const plans = require('./plans');

const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
const num = (n) => Number(n).toLocaleString('id-ID');

const FITUR = [
  'Asisten Toko adalah asisten AI untuk UMKM: menjawab pertanyaan pelanggan 24 jam dari data toko (produk, harga, stok, jam buka, ongkir, pembayaran, FAQ), dan meneruskan ke admin kalau jawabannya tidak ada di data, bukan menebak.',
  'Cara mulai: daftar (gratis, tanpa kartu kredit) -> isi data toko dan produk/FAQ -> pasang di website atau bagikan link chat. Tanpa coding.',
  'Isi data: produk (nama, harga, stok, deskripsi), FAQ, jam buka, alamat, pengiriman, pembayaran. Produk bisa diimpor massal dari CSV atau hasil tempel Excel/Google Sheets.',
  'Pasang: tempel satu baris kode <script> widget di website, atau pakai link chat dan QR code (cocok untuk bio Instagram dan toko online). Ada fitur Cek pemasangan di dashboard untuk memastikan kode sudah terpasang benar.',
  'Tampilan widget bisa diatur dari dashboard tanpa pasang ulang kode: warna, posisi (kiri/kanan), ukuran, bentuk, ikon, teks tombol, jarak dari tepi, dan pesan pop-up.',
  'Keamanan widget: daftarkan domain yang boleh memasang chat, jadi situs lain tidak bisa menampilkan widget tokomu.',
  'Saluran: web (widget/link chat), Telegram, dan WhatsApp (Cloud API Meta). Semua percakapan masuk ke satu dashboard.',
  'Ambil alih kapan saja: admin bisa melihat semua percakapan, membalas langsung dari dashboard, lalu mengembalikan ke asisten. Percakapan yang butuh admin diberi tanda.',
  'Pesanan: kalau pelanggan ingin membeli, asisten mencatat produk, jumlah, dan nama sebagai pesanan. Admin yang mengonfirmasi; status pesanan: baru, diproses, selesai, dibatalkan. Asisten tidak bisa mengubah harga, stok, atau pesanan.',
  'Belum terjawab: pertanyaan yang tidak bisa dijawab dikelompokkan, dan bisa dijadikan FAQ dengan satu klik.',
  'Notifikasi ke admin lewat Telegram saat percakapan diteruskan, ada pesanan, atau kuota hampir habis. Ada ringkasan harian (percakapan, balasan, pesanan, pemakaian kuota).',
  'Kontrol biaya: batas balasan otomatis per hari bisa diatur. Setelah batas atau kuota bulanan habis, pesan baru masuk ke admin tanpa memanggil AI, dan admin tetap bisa membalas sendiri.',
  'Tim dan banyak toko: undang admin tambahan lewat email (admin tambahan mengurus Percakapan, Produk, dan FAQ). Satu akun bisa mengelola sampai 5 toko.',
  'Privasi: pesan pelanggan disimpan di database dan halaman chat memberi tahu hal itu.',
  'Pembayaran langganan lewat Midtrans atau DOKU.'
];

// Teks pengetahuan untuk toko ini; '' kalau toko ini bukan toko widget situs (env WIDGET_BOT).
// Dipanggil setelah billing.currentPlan, yang sudah menerapkan pengaturan paket terbaru ke plans.PLANS/TERMS.
function forShop(shop) {
  const wb = String(process.env.WIDGET_BOT || '').trim();
  if (!wb || !shop || shop.slug !== wb) return '';
  const P = plans.PLANS, T = plans.TERMS;
  const lines = ['PAKET DAN HARGA (selalu ikut pengaturan terbaru):'];
  lines.push('- ' + P.free.name + ': Rp0 selamanya, ' + num(P.free.quota) + ' balasan AI per bulan.');
  ['starter', 'bisnis'].forEach((id) => {
    const p = P[id];
    const promo = p.promo ? ' (diskon paket ' + p.promo + '%, harga normal ' + rp(plans.listPriceFor(id, 1)) + ')' : '';
    lines.push('- ' + p.name + ': ' + rp(plans.priceFor(id, 1)) + ' per bulan' + promo + ', ' + num(p.quota) + ' balasan AI per bulan.');
  });
  const disc = Object.keys(T).map(Number).filter((m) => m > 1 && T[m] > 0).sort((a, b) => a - b);
  if (disc.length) lines.push('- Langganan lebih lama lebih hemat: ' + disc.map((m) => m + ' bulan hemat ' + T[m] + '%').join(', ') + '.');
  lines.push('- Satu bulan langganan = 30 hari. Setelah kuota bulanan habis, pesan baru masuk ke admin toko dan admin tetap bisa membalas sendiri.');
  lines.push('');
  lines.push('FITUR DAN CARA KERJA:');
  FITUR.forEach((f) => lines.push('- ' + f));
  lines.push('');
  lines.push('Hal di luar daftar ini (kebijakan refund, fitur yang belum disebut, kerja sama khusus) jangan dikarang; teruskan ke admin.');
  return lines.join('\n');
}

module.exports = { forShop, FITUR };
