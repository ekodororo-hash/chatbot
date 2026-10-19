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
  'Penilaian chat: pelanggan bisa memberi jempol atas atau bawah setelah menekan Akhiri percakapan (atau lewat tautan Beri nilai percakapan). Pemilik toko melihat hasilnya di dashboard; jempol bawah menyimpan pertanyaannya sebagai bahan FAQ.',
  'Ambil alih kapan saja: admin bisa melihat semua percakapan, membalas langsung dari dashboard, lalu mengembalikan ke asisten. Percakapan yang butuh admin diberi tanda.',
  'Pesanan: kalau pelanggan ingin membeli, asisten mencatat produk, jumlah, dan nama sebagai pesanan. Admin yang mengonfirmasi; status pesanan: baru, diproses, selesai, dibatalkan. Asisten tidak bisa mengubah harga, stok, atau pesanan.',
  'Belum terjawab: pertanyaan yang tidak bisa dijawab dikelompokkan, dan bisa dijadikan FAQ dengan satu klik.',
  'Notifikasi ke admin lewat Telegram saat percakapan diteruskan, ada pesanan, atau kuota hampir habis. Ada ringkasan harian (percakapan, balasan, pesanan, pemakaian kuota).',
  'Kontrol biaya: batas balasan otomatis per hari bisa diatur. Setelah batas atau kuota bulanan habis, pesan baru masuk ke admin tanpa memanggil AI, dan admin tetap bisa membalas sendiri.',
  'Tim dan banyak toko: undang admin tambahan lewat email (admin tambahan mengurus Percakapan, Produk, dan FAQ). Satu akun bisa mengelola sampai 5 toko.',
  'Privasi: pesan pelanggan disimpan di database dan halaman chat memberi tahu hal itu.',
  'Data yang disimpan dari pengunjung chat: isi pesan dan balasan, waktu, saluran (web/Telegram/WhatsApp), perkiraan kota dan negara serta alamat IP (dicatat sekali di awal percakapan web), dan nama, kontak, atau rincian pesanan hanya kalau pengunjung sendiri mengisinya. Alamat IP tidak ditampilkan ke pemilik toko, hanya bisa dilihat admin layanan untuk keamanan dan dukungan.',
  'Data toko dan isi yang dimasukkan pemilik toko tetap milik pemilik toko. Data tidak dijual dan tidak dipakai untuk iklan. Tidak ada cookie iklan atau pelacak pihak ketiga.',
  'Penyimpanan: percakapan tidak dihapus otomatis. Pemilik toko bisa menghapus percakapan dari dashboard (pesan, lokasi, dan IP terkait ikut terhapus). Catatan pesanan tetap tersimpan meskipun percakapannya dihapus. Chat di browser pengunjung disimpan paling lama 24 jam sejak pesan terakhir.',
  'Pihak ketiga yang dipakai untuk menjalankan layanan: penyedia database dan login, hosting, layanan AI untuk menyusun balasan (menerima isi percakapan dan data toko yang relevan), Google Fonts, Midtrans dan DOKU untuk pembayaran, serta Telegram dan WhatsApp hanya kalau saluran itu diaktifkan. Nomor kartu dan rekening tidak disimpan oleh Asisten Toko.',
  'Hak atas data: pemilik toko dan pengunjung bisa meminta akses, perbaikan, atau penghapusan data pribadi. Pengunjung sebaiknya menghubungi tokonya dulu karena toko yang menentukan penggunaan datanya. Permintaan juga bisa dikirim ke email kontak Asisten Toko.',
  'Syarat penting: balasan AI bisa keliru dan tidak dijamin akurat. Pemilik toko wajib menjaga data toko tetap benar (harga, stok, jam buka, ongkir), mengonfirmasi pesanan dan harga akhir sendiri, dan memberi tahu pengunjung bahwa chat dijawab AI dan dicatat. Asisten AI bukan sumber nasihat medis, hukum, atau keuangan.',
  'Larangan: dipakai untuk kegiatan melanggar hukum atau penipuan, konten yang melanggar hak pihak lain atau menyesatkan, menyamar sebagai pihak lain, mengganggu sistem, atau meminta data sensitif (nomor kartu, kata sandi, dokumen identitas) lewat chat. Pelanggaran bisa membuat akun dibatasi atau ditutup.',
  'Pemilik toko bisa berhenti kapan saja dan meminta penghapusan data. Pengguna wajib berusia minimal 18 tahun atau cakap hukum, atau mewakili usaha yang sah. Hukum yang berlaku adalah hukum Indonesia. Teks lengkapnya ada di halaman Syarat dan Ketentuan (/syarat) dan Kebijakan Privasi (/privasi).',
  'Permintaan pengembalian dana langganan disampaikan lewat email kontak dan dinilai per kasus sesuai ketentuan hukum. Jangan menjanjikan refund pasti.',
  'Peran hukum: untuk data akun dan pembayaran pemilik toko, Asisten Toko adalah pengendali data pribadi. Untuk data pengunjung, pemilik toko yang menentukan tujuan penggunaannya (pengendali), sedangkan Asisten Toko memprosesnya atas nama pemilik toko (prosesor), sesuai UU Pelindungan Data Pribadi.',
  'Keamanan data: koneksi terenkripsi (HTTPS), kata sandi tidak disimpan dalam bentuk aslinya, akses data dipisah per toko (toko lain tidak bisa melihat data tokomu), kunci rahasia hanya disimpan di sisi server, dan alamat IP pengunjung dipisah dari data yang terbaca di dashboard. Tidak ada sistem yang sepenuhnya bebas risiko; kalau ada insiden yang berdampak pada data, pengguna akan diberi tahu sesuai ketentuan yang berlaku.',
  'Data pembayaran: lewat Midtrans atau DOKU. Asisten Toko tidak menyimpan nomor kartu atau rekening, hanya paket, nomor pesanan, jumlah, dan status. Data pembayaran bisa disimpan lebih lama untuk pembukuan dan kewajiban hukum. Data akun dan toko disimpan selama akun aktif.',
  'Anak-anak: layanan ditujukan bagi pelaku usaha dewasa, dan Asisten Toko tidak dengan sengaja meminta data pribadi anak.',
  'Batasan tanggung jawab: sejauh diizinkan hukum, Asisten Toko tidak bertanggung jawab atas kerugian tidak langsung, kehilangan penjualan atau keuntungan akibat jawaban AI yang keliru, gangguan layanan, atau keputusan berdasarkan layanan. Tanggung jawab dibatasi pada jumlah yang dibayarkan untuk periode terkait, dan tidak mengurangi hak pengguna yang tidak bisa dikesampingkan menurut hukum.',
  'Ketersediaan layanan: berusaha tetap berjalan tapi tidak dijamin bebas gangguan. Layanan bergantung pada pihak ketiga (hosting, database, AI, pembayaran, Telegram, WhatsApp), dan pemeliharaan sistem bisa dilakukan sewaktu-waktu.',
  'Kepemilikan: data toko dan isi yang dimasukkan pemilik toko tetap milik pemilik toko, dan Asisten Toko hanya diberi izin terbatas untuk menyimpan dan memprosesnya demi menjalankan layanan. Software, merek, dan tampilan Asisten Toko milik Asisten Toko, dan tidak boleh disalin, dibongkar, atau dijual kembali tanpa izin tertulis.',
  'Perubahan ketentuan: Syarat dan Kebijakan Privasi bisa diperbarui, tanggal pembaruan terakhir ada di bagian atas halamannya. Untuk perubahan penting, pengguna diberi tahu lewat dashboard atau email. Tetap memakai layanan setelah perubahan berarti menyetujuinya.',
  'Sengketa: diupayakan lewat musyawarah dulu, kalau tidak sepakat diselesaikan lewat pengadilan yang berwenang di Indonesia.',
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
  const mail = String(process.env.CONTACT_EMAIL || 'emahairshop@gmail.com').trim();
  lines.push('KONTAK RESMI ASISTEN TOKO: email ' + mail + ' (untuk pertanyaan syarat, privasi, penghapusan data, refund langganan).');
  lines.push('');
  lines.push('Hal di luar daftar ini (fitur yang belum disebut, kerja sama khusus, status refund tertentu) jangan dikarang; teruskan ke admin.');
  return lines.join('\n');
}

module.exports = { forShop, FITUR };
