import Link from 'next/link';
import plans from '@/lib/plans';
import settings from '@/lib/settings';

// Harga dibaca dari pengaturan admin (/admin/paket), jadi halaman depan selalu sama dengan halaman Langganan.
export const revalidate = 60;

const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
const chat = (n) => Number(n).toLocaleString('id-ID') + ' balasan bot per bulan';

async function loadPlans() {
  try {
    const v = await settings.getAll();
    plans.configure(v.PLANS_CONFIG ? JSON.parse(v.PLANS_CONFIG) : null);
  } catch (e) { plans.configure(null); }
  const P = plans.PLANS, T = plans.TERMS;
  const disc = Object.keys(T).map(Number).filter((m) => m > 1 && T[m] > 0).sort((a, b) => a - b);
  return {
    list: [
      { id: 'free', name: P.free.name, price: 'Rp0', per: 'selamanya', quota: chat(P.free.quota), pts: ['Semua fitur dasar', 'Tidak perlu kartu kredit'], cta: 'Coba gratis', feat: false },
      ...['starter', 'bisnis'].map((id) => ({
        id, name: P[id].name, promo: P[id].promo,
        price: rp(plans.priceFor(id, 1)), was: P[id].promo ? rp(plans.listPriceFor(id, 1)) : '', per: 'per bulan',
        quota: chat(P[id].quota), pts: ['Semua fitur dasar', id === 'bisnis' ? 'Cocok untuk toko ramai' : 'Cocok untuk toko yang mulai tumbuh'],
        cta: 'Pilih ' + P[id].name, feat: id === 'starter'
      }))
    ],
    note: disc.length ? 'Langganan lebih lama lebih hemat: ' + disc.map((m) => m + ' bulan hemat ' + T[m] + '%').join(', ') + '.' : ''
  };
}

const DEMO = [
  ['c', 'Pashmina ceruty dusty pink masih ada?'],
  ['r', 'Masih ada kak, sisa 12 pcs. Harganya Rp45.000. Mau dikirim ke mana?'],
  ['c', 'Ke Purwokerto. Berapa hari sampai?'],
  ['r', 'Estimasi 2-3 hari dengan JNE reguler, kak.'],
  ['c', 'Kalau beli 10 bisa dapat harga lebih murah?'],
  ['h', 'Harga grosir belum ada di data toko, jadi saya teruskan ke admin ya kak.']
];

export default async function Beranda() {
  const { list, note } = await loadPlans();
  return (
    <>
      <header className="nav">
        <Link className="brand" href="/">Asisten<span>Toko</span></Link>
        <span className="grow"></span>
        <a className="navlink" href="#paket">Paket</a>
        <Link className="btn ghost sm" href="/login">Masuk</Link>
        <Link className="btn sm" href="/login#daftar">Daftar</Link>
      </header>

      <main className="land">
        <section className="hero">
          <div>
            <h1>Chatbot yang menjawab pelangganmu saat kamu sibuk</h1>
            <p className="lead">Isi produk, stok, dan FAQ tokomu sekali. Asisten menjawab dari data itu, dan menyerahkan ke kamu kalau ada yang tidak diketahui.</p>
            <div className="row">
              <Link className="btn lg" href="/login#daftar">Coba gratis</Link>
              <Link className="btn ghost lg" href="/login">Sudah punya akun</Link>
            </div>
            <p className="note">Gratis tanpa kartu kredit. Tanpa coding: isi data toko, lalu tempel satu baris kode.</p>
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

        <section className="sec" aria-labelledby="paket-h" id="paket">
          <h2 id="paket-h">Mulai gratis, naik paket kalau toko makin ramai</h2>
          <div className="prices">
            {list.map((p) => (
              <div key={p.id} className={'price-c' + (p.feat ? ' feat' : '')}>
                <div className="ph"><b>{p.name}</b>{p.feat ? <span className="tag a">Terpopuler</span> : null}{p.promo ? <span className="tag w">{'Diskon ' + p.promo + '%'}</span> : null}</div>
                <div className="amt">{p.price}<small>{' ' + p.per}</small></div>
                {p.was ? <div className="was"><s>{p.was}</s></div> : null}
                <ul>
                  <li><b>{p.quota}</b></li>
                  {p.pts.map((t) => <li key={t}>{t}</li>)}
                </ul>
                <Link className={'btn' + (p.id === 'free' ? '' : ' ghost')} href="/login#daftar">{p.cta}</Link>
              </div>
            ))}
          </div>
          <p className="hint">{'Setelah batas balasan bulanan, pesan baru masuk ke admin dan kamu tetap bisa membalas sendiri. ' + note}</p>
        </section>

        <section className="cta">
          <h2>Biarkan asisten menjaga toko, kamu fokus jualan</h2>
          <p>Buat akun gratis, isi data tokomu, dan coba chat-nya langsung di dashboard.</p>
          <Link className="btn inv lg" href="/login#daftar">Coba gratis</Link>
        </section>
      </main>

      <footer className="foot">Asisten Toko, chatbot untuk UMKM.</footer>
    </>
  );
}
