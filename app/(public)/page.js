import Link from 'next/link';
import Reveal from '../Reveal';
import plans from '@/lib/plans';
import settings from '@/lib/settings';

// Harga dibaca dari pengaturan admin (/admin/paket), jadi halaman depan selalu sama dengan halaman Langganan.
export const revalidate = 60;

const Ic = ({ d }) => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const Check = () => <svg className="ck" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
const chat = (n) => Number(n).toLocaleString('id-ID') + ' balasan AI / bulan';

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
        price: rp(plans.priceFor(id, 1)), was: P[id].promo ? rp(plans.listPriceFor(id, 1)) : '', per: '/ bulan',
        quota: chat(P[id].quota), pts: ['Semua fitur dasar', id === 'bisnis' ? 'Cocok untuk toko ramai' : 'Cocok untuk toko yang mulai tumbuh'],
        cta: 'Pilih ' + P[id].name, feat: id === 'starter'
      }))
    ],
    note: disc.length ? 'Langganan lebih lama lebih hemat, ' + disc.map((m) => m + ' bulan hemat ' + T[m] + '%').join(' dan ') + '.' : ''
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
      <noscript><style>{'.rv .flow li,.rv .price-c{opacity:1!important;transform:none!important}'}</style></noscript>
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
            <h1>Asisten AI yang menjawab pelangganmu saat kamu sibuk</h1>
            <p className="lead">Isi produk, stok, dan FAQ tokomu sekali. Asisten menjawab dari data itu, dan menyerahkan ke kamu kalau ada yang tidak diketahui.</p>
            <div className="row">
              <Link className="btn lg" href="/login#daftar">Coba gratis</Link>
              <Link className="btn ghost lg" href="/login">Sudah punya akun</Link>
            </div>
            <p className="note">Gratis tanpa kartu kredit. Tanpa coding, cukup isi data toko lalu tempel satu baris kode.</p>
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
          <h2 id="cara">Tiga langkah sampai AI menjawab</h2>
          <Reveal><ol className="flow">
            <li><span className="ic"><Ic d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" /></span><span className="n">Langkah 1</span><h3>Isi data toko</h3><p>Produk, harga, stok, jam buka, ongkir, dan pertanyaan yang sering muncul.</p></li>
            <li><span className="ic"><Ic d="m8 8-4 4 4 4m8-8 4 4-4 4m-2.5-11-3 14" /></span><span className="n">Langkah 2</span><h3>Pasang di website</h3><p>Tempel satu baris kode, atau bagikan link chat ke bio Instagram dan toko online.</p></li>
            <li><span className="ic"><Ic d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l1.9-5.7A8.4 8.4 0 1 1 21 11.5Z" /></span><span className="n">Langkah 3</span><h3>Ambil alih kapan saja</h3><p>Lihat semua percakapan, balas sendiri, lalu kembalikan ke asisten.</p></li>
          </ol></Reveal>
        </section>

        <section className="sec" aria-labelledby="kontrol">
          <h2 id="kontrol">Kamu tetap yang memegang kendali</h2>
          <dl className="ctrl">
            <div><dt>Menjawab dari datamu</dt><dd>Kalau jawabannya tidak ada di data, asisten meneruskan ke kamu, bukan menebak.</dd></div>
            <div><dt>Balas langsung dari dashboard</dt><dd>Percakapan yang butuh admin diberi tanda, jadi tidak ada pelanggan yang terlewat.</dd></div>
            <div><dt>Biaya terkendali</dt><dd>Atur batas balasan otomatis per hari. Setelah batas, pesan baru masuk ke admin.</dd></div>
            <div><dt>Widget hanya di situsmu</dt><dd>Daftarkan domain yang boleh memasang chat. Situs lain tidak bisa menampilkan widget-mu.</dd></div>
            <div><dt>Web, Telegram, dan WhatsApp</dt><dd>Asisten yang sama bisa melayani ketiga saluran. Semua percakapan masuk ke satu dashboard.</dd></div>
            <div><dt>Tim admin dan banyak toko</dt><dd>Undang admin tambahan lewat email. Satu akun bisa mengelola sampai 5 toko.</dd></div>
          </dl>
        </section>

        <section className="sec" aria-labelledby="paket-h" id="paket">
          <h2 id="paket-h">Mulai gratis, naik paket kalau toko makin ramai</h2>
          <Reveal><div className="prices">
            {list.map((p) => (
              <div key={p.id} className={'price-c' + (p.feat ? ' feat' : '')}>
                <div className="ph"><b>{p.name}</b>{p.feat ? <span className="tag a">Terpopuler</span> : null}{p.promo ? <span className="tag w">{'Diskon ' + p.promo + '%'}</span> : null}</div>
                <div className="amt">{p.price}<small>{' ' + p.per}</small></div>
                {p.was ? <div className="was"><s>{p.was}</s></div> : null}
                <ul>
                  <li><Check /><b>{p.quota}</b></li>
                  {p.pts.map((t) => <li key={t}><Check />{t}</li>)}
                </ul>
                <Link className={'btn' + (p.id === 'free' ? '' : ' ghost')} href="/login#daftar">{p.cta}</Link>
              </div>
            ))}
          </div></Reveal>
          <p className="hint">{'Setelah batas balasan bulanan, pesan baru masuk ke admin dan kamu tetap bisa membalas sendiri. ' + note}</p>
        </section>

      </main>

      <footer className="foot">Asisten Toko, asisten AI untuk UMKM.</footer>
    </>
  );
}
