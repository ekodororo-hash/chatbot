import Link from 'next/link';
import LegalPage, { Contact, LEGAL } from '../../components/Legal';

export const metadata = { title: 'Syarat dan Ketentuan' };

export default function Syarat() {
  return (
    <LegalPage title="Syarat dan Ketentuan">
      <p>Dengan mendaftar atau menggunakan Asisten Toko (“Layanan”), Anda menyatakan telah membaca, memahami, dan menyetujui Syarat dan Ketentuan ini. Apabila Anda tidak menyetujuinya, mohon untuk tidak menggunakan Layanan. Pengelolaan data pribadi dijelaskan dalam <Link href="/privasi">Kebijakan Privasi</Link>.</p>

      <h2>1. Tentang Layanan</h2>
      <p>Asisten Toko adalah layanan asisten AI untuk UMKM, yang mencakup dashboard untuk mengelola data toko, widget dan halaman chat untuk Pengunjung, serta saluran opsional seperti Telegram dan WhatsApp. Layanan diselenggarakan oleh {LEGAL.entity}. Fitur dan paket dapat berubah dari waktu ke waktu.</p>

      <h2>2. Akun</h2>
      <ul>
        <li>Anda harus berusia minimal 18 tahun atau cakap hukum, atau bertindak mewakili usaha yang sah.</li>
        <li>Data yang Anda berikan harus benar, dan Anda harus berhak menggunakannya.</li>
        <li>Anda wajib menjaga kerahasiaan kata sandi dan bertanggung jawab atas seluruh aktivitas pada akun Anda, termasuk aktivitas anggota tim yang Anda undang.</li>
        <li>Segera hubungi kami apabila akun Anda digunakan tanpa izin.</li>
      </ul>

      <h2>3. Paket, Pembayaran, dan Langganan</h2>
      <ul>
        <li>Harga dan batas setiap paket, misalnya jumlah balasan AI per bulan, tercantum pada halaman depan dan halaman Langganan di dashboard.</li>
        <li>Pembayaran diproses melalui penyedia pembayaran pihak ketiga. Langganan berlaku untuk periode yang telah Anda bayar.</li>
        <li>Setelah batas balasan AI bulanan tercapai, pesan baru dari Pengunjung diteruskan kepada admin toko dan dapat dibalas secara langsung.</li>
        <li>Permintaan pengembalian dana dapat disampaikan melalui <Contact />. Kami akan menilainya berdasarkan kondisi masing-masing kasus dan ketentuan hukum yang berlaku.</li>
      </ul>

      <h2>4. Jawaban AI dan Tanggung Jawab atas Isinya</h2>
      <ul>
        <li>Balasan AI disusun secara otomatis berdasarkan data toko yang Anda isi, sehingga dapat mengandung kekeliruan. Kami tidak menjamin keakuratannya.</li>
        <li>Anda bertanggung jawab menjaga data toko tetap benar dan terbaru, antara lain harga, stok, jam buka, ongkos kirim, dan kebijakan retur, serta memantau percakapan melalui dashboard.</li>
        <li>Asisten AI tidak mengonfirmasi pembayaran dan tidak menggantikan keputusan Anda. Pesanan, harga akhir, dan ongkos kirim tetap Anda konfirmasi sendiri.</li>
        <li>Asisten AI tidak dimaksudkan sebagai sumber nasihat medis, hukum, maupun keuangan.</li>
      </ul>

      <h2>5. Kewajiban terhadap Pengunjung</h2>
      <ul>
        <li>Anda wajib memberi tahu Pengunjung bahwa percakapan dijawab oleh AI dan dicatat. Anda dapat menautkan <Link href="/privasi">Kebijakan Privasi</Link> kami pada situs Anda.</li>
        <li>Data Pengunjung hanya boleh digunakan untuk melayani mereka, dan tidak boleh digunakan untuk spam atau diperjualbelikan.</li>
        <li>Anda wajib menanggapi permintaan Pengunjung atas datanya, yaitu akses, perbaikan, dan penghapusan, sesuai hukum yang berlaku.</li>
      </ul>

      <h2>6. Larangan</h2>
      <p>Anda dilarang untuk:</p>
      <ul>
        <li>menggunakan Layanan untuk kegiatan yang melanggar hukum, penipuan, atau penjualan barang dan jasa terlarang,</li>
        <li>menyebarkan konten yang melanggar hak pihak lain, mengandung ujaran kebencian atau pornografi, atau bersifat menyesatkan,</li>
        <li>menyamar sebagai pihak lain, atau membuat asisten AI mengaku sebagai manusia dengan tujuan menipu,</li>
        <li>mengganggu sistem, termasuk membanjiri Layanan dengan permintaan, menghindari batas penggunaan, memindai celah keamanan, atau mencoba mengakses data toko lain, dan</li>
        <li>menyalin, membongkar, atau menjual kembali Layanan tanpa izin tertulis.</li>
      </ul>
      <p>Apabila terjadi pelanggaran, kami berhak membatasi, menangguhkan, atau menutup akun Anda.</p>

      <h2>7. Kepemilikan dan Hak atas Data</h2>
      <p>Data toko dan seluruh isi yang Anda masukkan tetap menjadi milik Anda. Anda memberi kami izin terbatas untuk menyimpan dan memprosesnya sebatas yang diperlukan untuk menjalankan Layanan. Perangkat lunak, merek, dan tampilan Asisten Toko merupakan milik kami.</p>

      <h2>8. Ketersediaan Layanan</h2>
      <p>Kami berupaya menjaga Layanan tetap berjalan, tetapi tidak menjamin Layanan selalu tersedia tanpa gangguan. Layanan bergantung pada penyedia pihak ketiga, seperti hosting, database, AI, pembayaran, Telegram, dan WhatsApp, sehingga gangguan atau perubahan pada penyedia tersebut dapat memengaruhi Layanan. Pemeliharaan sistem dapat dilakukan sewaktu-waktu.</p>

      <h2>9. Batasan Tanggung Jawab</h2>
      <p>Sejauh diizinkan oleh hukum, kami tidak bertanggung jawab atas kerugian tidak langsung, kehilangan penjualan, atau kehilangan keuntungan yang timbul akibat jawaban AI yang keliru, gangguan Layanan, atau keputusan yang Anda ambil berdasarkan Layanan ini. Tanggung jawab kami dibatasi pada jumlah yang Anda bayarkan untuk Layanan pada periode yang bersangkutan. Ketentuan ini tidak mengurangi hak Anda yang tidak dapat dikesampingkan menurut hukum.</p>

      <h2>10. Penghentian Layanan</h2>
      <p>Anda dapat berhenti menggunakan Layanan kapan saja dan meminta penghapusan data melalui <Contact />. Kami berhak menghentikan Layanan bagi akun yang melanggar ketentuan ini. Penghapusan data mengikuti ketentuan penyimpanan dalam Kebijakan Privasi.</p>

      <h2>11. Perubahan Ketentuan</h2>
      <p>Syarat dan Ketentuan ini dapat diperbarui dari waktu ke waktu. Tanggal pembaruan terakhir tercantum di bagian atas halaman. Dengan tetap menggunakan Layanan setelah perubahan berlaku, Anda dianggap menyetujui perubahan tersebut. Untuk perubahan yang signifikan, kami akan memberi tahu Anda melalui dashboard atau email.</p>

      <h2>12. Hukum yang Berlaku dan Penyelesaian Sengketa</h2>
      <p>Syarat dan Ketentuan ini tunduk pada hukum Republik Indonesia. Setiap perselisihan akan diupayakan penyelesaiannya secara musyawarah terlebih dahulu. Apabila tidak tercapai kesepakatan, perselisihan akan diselesaikan melalui pengadilan yang berwenang di Indonesia.</p>

      <h2>13. Kontak</h2>
      <p>Pertanyaan mengenai Syarat dan Ketentuan ini dapat disampaikan melalui <Contact />.</p>
    </LegalPage>
  );
}
