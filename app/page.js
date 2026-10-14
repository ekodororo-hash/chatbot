import Link from 'next/link';

export default function Beranda() {
  return (
    <>
      <div className="top">
        <Link className="brand" href="/">Asisten<span>Toko</span></Link>
        <span className="grow"></span>
        <Link className="btn ghost sm" href="/login">Masuk</Link>
        <a className="btn sm" href="/login#daftar">Daftar</a>
      </div>
      <main className="wrap">
        <h1>Chatbot yang menjawab pelangganmu saat kamu sibuk</h1>
        <p className="lead">Isi produk, stok, dan FAQ tokomu sekali. Asisten menjawab dari data itu, dan menyerahkan ke kamu kalau ada yang tidak diketahui.</p>
        <div className="row"><a className="btn" href="/login#daftar">Buat asisten tokomu</a></div>
        <div className="steps">
          <div className="card"><h2>Isi data toko</h2><p className="hint">Produk, harga, stok, jam buka, ongkir, dan pertanyaan yang sering muncul.</p></div>
          <div className="card"><h2>Pasang di website</h2><p className="hint">Tempel satu baris kode, atau bagikan link chat ke bio Instagram dan toko online.</p></div>
          <div className="card"><h2>Ambil alih kapan saja</h2><p className="hint">Lihat semua percakapan, balas sendiri, lalu kembalikan ke asisten.</p></div>
        </div>
      </main>
    </>
  );
}
