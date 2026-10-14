import Link from 'next/link';

const DEMO = [
  ['c', 'Pashmina ceruty dusty pink masih ada?'],
  ['r', 'Masih ada kak, sisa 12 pcs. Harganya Rp45.000. Mau dikirim ke mana?'],
  ['c', 'Ke Purwokerto. Berapa hari sampai?'],
  ['r', 'Estimasi 2-3 hari dengan JNE reguler, kak.'],
  ['c', 'Kalau beli 10 bisa dapat harga lebih murah?'],
  ['h', 'Harga grosir belum ada di data toko, jadi saya teruskan ke admin ya kak.']
];

export default function Beranda() {
  return (
    <>
      <header className="nav">
        <Link className="brand" href="/">Asisten<span>Toko</span></Link>
        <span className="grow"></span>
        <Link className="btn ghost sm" href="/login">Masuk</Link>
        <Link className="btn sm" href="/login#daftar">Daftar</Link>
      </header>

      <main className="land">
        <section className="hero">
          <div>
            <h1>Chatbot yang menjawab pelangganmu saat kamu sibuk</h1>
            <p className="lead">Isi produk, stok, dan FAQ tokomu sekali. Asisten menjawab dari data itu, dan menyerahkan ke kamu kalau ada yang tidak diketahui.</p>
            <div className="row">
              <Link className="btn lg" href="/login#daftar">Buat asisten tokomu</Link>
              <Link className="btn ghost lg" href="/login">Sudah punya akun</Link>
            </div>
            <p className="note">Tanpa coding. Cukup isi data toko, lalu tempel satu baris kode.</p>
          </div>

          <div className="demo" role="img" aria-label="Contoh percakapan pelanggan dengan asisten toko, berakhir dengan pertanyaan harga grosir yang diteruskan ke admin">
            <div className="demo-h">
              <span className="av" aria-hidden="true">A</span>
              <div><b>Asisten Toko Ayu Hijab</b><small>Membalas otomatis, 24 jam</small></div>
            </div>
            <div className="demo-b" aria-hidden="true">
              {DEMO.map(([k, t], i) => (
                <div key={i} className={'b ' + k} style={{ '--i': i }}>
                  {k === 'h' ? <em>Diteruskan ke admin</em> : null}
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" aria-labelledby="cara">
          <h2 id="cara">Tiga langkah sampai bot menjawab</h2>
          <ol className="flow">
            <li><h3>Isi data toko</h3><p>Produk, harga, stok, jam buka, ongkir, dan pertanyaan yang sering muncul.</p></li>
            <li><h3>Pasang di website</h3><p>Tempel satu baris kode, atau bagikan link chat ke bio Instagram dan toko online.</p></li>
            <li><h3>Ambil alih kapan saja</h3><p>Lihat semua percakapan, balas sendiri, lalu kembalikan ke asisten.</p></li>
          </ol>
        </section>

        <section className="sec" aria-labelledby="kontrol">
          <h2 id="kontrol">Kamu tetap yang memegang kendali</h2>
          <dl className="ctrl">
            <div><dt>Menjawab dari datamu</dt><dd>Kalau jawabannya tidak ada di data, asisten meneruskan ke kamu, bukan menebak.</dd></div>
            <div><dt>Balas langsung dari dashboard</dt><dd>Percakapan yang butuh admin diberi tanda, jadi tidak ada pelanggan yang terlewat.</dd></div>
            <div><dt>Biaya terkendali</dt><dd>Atur batas balasan otomatis per hari. Setelah batas, pesan baru masuk ke admin.</dd></div>
            <div><dt>Widget hanya di situsmu</dt><dd>Daftarkan domain yang boleh memasang chat. Situs lain tidak bisa memakai botmu.</dd></div>
          </dl>
        </section>

        <section className="cta">
          <h2>Biarkan asisten menjaga toko, kamu fokus jualan</h2>
          <p>Buat akun, isi data tokomu, dan coba chat-nya langsung di dashboard.</p>
          <Link className="btn inv lg" href="/login#daftar">Buat asisten tokomu</Link>
        </section>
      </main>

      <footer className="foot">Asisten Toko, chatbot untuk UMKM.</footer>
    </>
  );
}
