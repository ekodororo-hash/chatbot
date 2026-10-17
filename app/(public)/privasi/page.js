import Link from 'next/link';
import LegalPage, { Contact } from '../../components/Legal';

// Daftar isi samping; ubah di sini kalau judul bagian berubah (id harus sama dengan id pada h2).
const TOC = [
  ['b-1', '1. Pihak yang Dimaksud'],
  ['b-2', '2. Data yang Kami Kumpulkan'],
  ['b-3', '3. Tujuan Penggunaan Data'],
  ['b-4', '4. Pihak Ketiga yang Terlibat'],
  ['b-5', '5. Akses terhadap Data'],
  ['b-6', '6. Penyimpanan dan Penghapusan'],
  ['b-7', '7. Keamanan Data'],
  ['b-8', '8. Hak Anda'],
  ['b-9', '9. Kewajiban Pemilik Toko terhadap Pengunjung'],
  ['b-10', '10. Anak-Anak'],
  ['b-11', '11. Perubahan Kebijakan'],
  ['b-12', '12. Kontak'],
];
const RINGKAS = [
  'Kami tidak menjual data pribadi dan tidak memakainya untuk iklan.',
  'Kata sandi tidak disimpan dalam bentuk aslinya, dan nomor kartu tidak kami simpan.',
  'Pemilik toko bisa menghapus percakapan lewat dashboard.',
];

export const metadata = { title: 'Kebijakan Privasi' };

export default function Privasi() {
  return (
    <LegalPage title="Kebijakan Privasi" active="privasi" toc={TOC} ringkas={RINGKAS}>
      <p>Kebijakan Privasi ini menjelaskan jenis data yang dikumpulkan oleh Asisten Toko, tujuan penggunaannya, serta pihak-pihak yang dapat mengaksesnya.</p>

      <h2 id="b-1">1. Pihak yang Dimaksud</h2>
      <ul>
        <li><b>Pemilik Toko</b> adalah pihak yang mendaftar, mengisi data toko, dan memasang asisten AI pada toko atau situs webnya.</li>
        <li><b>Pengunjung</b> adalah pelanggan Pemilik Toko yang berinteraksi dengan asisten AI melalui widget situs web, halaman chat, Telegram, atau WhatsApp.</li>
      </ul>
      <p>Untuk data akun dan pembayaran Pemilik Toko, Asisten Toko bertindak sebagai pengendali data pribadi. Untuk data Pengunjung, Pemilik Toko menentukan tujuan penggunaannya sebagai pengendali data pribadi, sedangkan Asisten Toko memprosesnya atas nama Pemilik Toko sebagai prosesor data pribadi, sebagaimana istilah dalam Undang-Undang Pelindungan Data Pribadi.</p>

      <h2 id="b-2">2. Data yang Kami Kumpulkan</h2>
      <h3>Dari Pemilik Toko</h3>
      <ul>
        <li>Alamat email dan kata sandi untuk masuk ke akun. Kata sandi tidak disimpan dalam bentuk aslinya.</li>
        <li>Data toko yang diisi oleh Pemilik Toko, meliputi nama toko, jam buka, alamat, produk dan harga, pertanyaan yang sering diajukan (FAQ), informasi pengiriman dan pembayaran, serta pengaturan asisten dan widget.</li>
        <li>Alamat email anggota tim yang diundang dan pengaturan notifikasi, misalnya Telegram.</li>
        <li>Data langganan dan pembayaran, yaitu paket, nomor pesanan, jumlah, dan status. Pembayaran diproses oleh penyedia pembayaran, dan kami tidak menyimpan nomor kartu maupun nomor rekening Anda.</li>
      </ul>
      <h3>Dari Pengunjung</h3>
      <ul>
        <li>Isi pesan dan balasan, waktu pesan, serta saluran yang digunakan (web, Telegram, atau WhatsApp).</li>
        <li>Nama, hanya apabila Pengunjung menyebutkannya dalam percakapan. Pada Telegram dan WhatsApp, kami juga menerima nama dan ID akun yang digunakan Pengunjung.</li>
        <li>Perkiraan lokasi (kota dan negara) serta alamat IP, yang dicatat satu kali pada awal percakapan web. Lokasi diperkirakan dari alamat IP sehingga tidak selalu akurat.</li>
        <li>Kontak (email atau nomor WhatsApp), apabila Pengunjung mengisinya pada kartu tawaran.</li>
        <li>Rincian pesanan, apabila Pengunjung memesan melalui chat, yaitu nama, nomor telepon, alamat, catatan, dan barang yang dipesan.</li>
      </ul>
      <h3>Pada Peramban</h3>
      <p>Peramban Pemilik Toko menyimpan sesi masuk. Peramban Pengunjung menyimpan percakapan yang sedang berlangsung agar dapat dilanjutkan setelah halaman dimuat ulang, paling lama 24 jam sejak pesan terakhir. Kami tidak memasang cookie iklan maupun pelacak pihak ketiga.</p>

      <h2 id="b-3">3. Tujuan Penggunaan Data</h2>
      <ul>
        <li>Menjalankan layanan, yaitu menjawab pertanyaan Pengunjung berdasarkan data toko, meneruskan percakapan kepada admin, dan mencatat pesanan.</li>
        <li>Mengirimkan notifikasi, laporan, tagihan, dan pengingat masa aktif langganan.</li>
        <li>Menjaga keamanan, termasuk mencegah penyalahgunaan, spam, dan penipuan melalui pembatasan penggunaan dan alamat IP.</li>
        <li>Meningkatkan kualitas layanan serta menangani pertanyaan dan keluhan.</li>
      </ul>
      <p>Kami tidak menjual data pribadi dan tidak menggunakannya untuk keperluan periklanan.</p>

      <h2 id="b-4">4. Pihak Ketiga yang Terlibat</h2>
      <p>Dalam menyelenggarakan layanan, kami bekerja sama dengan penyedia pihak ketiga berikut. Sebagian server mereka berada di luar wilayah Indonesia.</p>
      <ul>
        <li><b>Penyedia database dan autentikasi</b>, untuk menyimpan data akun, toko, dan percakapan, serta memverifikasi proses masuk ke akun.</li>
        <li><b>Penyedia hosting</b>, untuk menjalankan aplikasi. Perkiraan lokasi Pengunjung dibaca dari informasi koneksi yang diberikan oleh penyedia ini.</li>
        <li><b>Penyedia layanan AI</b>, untuk menyusun balasan asisten. Penyedia ini menerima isi percakapan dan data toko yang relevan, dan pemrosesannya tunduk pada ketentuan penyedia tersebut.</li>
        <li><b>Google Fonts</b>, untuk menampilkan jenis huruf. Peramban Anda memuat berkas huruf langsung dari server Google.</li>
        <li><b>Midtrans dan DOKU</b>, untuk memproses pembayaran langganan.</li>
        <li><b>Telegram dan WhatsApp (Meta)</b>, hanya apabila Pemilik Toko mengaktifkan saluran atau notifikasi tersebut.</li>
      </ul>
      <p>Kami juga dapat mengungkapkan data apabila diwajibkan oleh peraturan perundang-undangan atau permintaan resmi dari pihak yang berwenang.</p>

      <h2 id="b-5">5. Akses terhadap Data</h2>
      <ul>
        <li>Pemilik Toko dan anggota tim yang diundang dapat melihat percakapan, kota dan negara, kontak, serta pesanan pada toko mereka. Mereka tidak dapat melihat data toko lain.</li>
        <li>Alamat IP Pengunjung tidak ditampilkan kepada Pemilik Toko maupun anggota tim. Alamat IP hanya dapat dilihat oleh admin layanan Asisten Toko untuk keperluan keamanan dan dukungan.</li>
        <li>Admin layanan dapat mengakses data sebatas yang diperlukan untuk dukungan teknis, keamanan, dan penagihan.</li>
      </ul>

      <h2 id="b-6">6. Penyimpanan dan Penghapusan</h2>
      <p>Percakapan tidak dihapus secara otomatis. Pemilik Toko dapat menghapus percakapan melalui dashboard, dan penghapusan tersebut turut menghapus pesan serta lokasi dan alamat IP yang terkait. Catatan pesanan tetap tersimpan meskipun percakapannya dihapus, agar riwayat pesanan toko tidak hilang. Data akun dan toko disimpan selama akun masih aktif. Data pembayaran dapat disimpan lebih lama sepanjang diperlukan untuk pembukuan dan pemenuhan kewajiban hukum.</p>

      <h2 id="b-7">7. Keamanan Data</h2>
      <p>Kami menerapkan langkah-langkah berikut untuk melindungi data: koneksi terenkripsi (HTTPS), penyimpanan kata sandi dalam bentuk yang tidak dapat dibaca, pembatasan akses data per toko, penyimpanan kunci rahasia hanya di sisi server, serta pemisahan alamat IP Pengunjung dari data yang dapat dibaca melalui dashboard. Meskipun demikian, tidak ada sistem yang sepenuhnya bebas risiko. Apabila terjadi insiden yang berdampak pada data Anda, kami akan memberi tahu Anda sesuai ketentuan yang berlaku.</p>

      <h2 id="b-8">8. Hak Anda</h2>
      <p>Sesuai Undang-Undang Pelindungan Data Pribadi, Anda berhak meminta akses, perbaikan, atau penghapusan data pribadi Anda, menarik persetujuan, serta mengajukan keberatan atas pemrosesan tertentu. Pemilik Toko dapat mengelola sebagian besar datanya langsung melalui dashboard. Pengunjung disarankan menghubungi toko yang bersangkutan terlebih dahulu karena toko menentukan penggunaan datanya. Anda juga dapat menghubungi kami di <Contact />, dan kami akan membantu meneruskan permintaan tersebut.</p>

      <h2 id="b-9">9. Kewajiban Pemilik Toko terhadap Pengunjung</h2>
      <p>Karena Pemilik Toko menentukan penggunaan data Pengunjung, Pemilik Toko wajib memastikan Pengunjung mengetahui bahwa percakapan dijawab oleh AI, dicatat, dan dapat dibaca oleh toko. Pemilik Toko dapat menautkan halaman ini pada situsnya dan sebaiknya turut mencantumkan hal tersebut dalam kebijakan privasi tokonya sendiri. Pemilik Toko juga dilarang meminta data sensitif, seperti nomor kartu, kata sandi, atau dokumen identitas, melalui chat.</p>

      <h2 id="b-10">10. Anak-Anak</h2>
      <p>Layanan ini ditujukan bagi pelaku usaha dewasa. Kami tidak dengan sengaja meminta data pribadi anak.</p>

      <h2 id="b-11">11. Perubahan Kebijakan</h2>
      <p>Kebijakan ini dapat diperbarui dari waktu ke waktu. Tanggal pembaruan terakhir tercantum di bagian atas halaman. Untuk perubahan yang signifikan, kami akan memberi tahu Pemilik Toko melalui dashboard atau email.</p>

      <h2 id="b-12">12. Kontak</h2>
      <p>Pertanyaan mengenai privasi atau permintaan penghapusan data dapat disampaikan melalui <Contact />. Silakan baca juga <Link href="/syarat">Syarat dan Ketentuan</Link> kami.</p>
    </LegalPage>
  );
}
