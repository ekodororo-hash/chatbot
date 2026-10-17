import Link from 'next/link';
import { LegalFooter } from '../components/Legal';
import plans from '@/lib/plans';
import settings from '@/lib/settings';

// Harga dibaca dari pengaturan admin (/admin/paket), jadi halaman depan selalu sama dengan halaman Langganan.
export const revalidate = 60;

const Check = () => <svg className="ck" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const Ic = ({ d }) => <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
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
      { id: 'free', name: P.free.name, price: 'Rp0', per: 'selamanya', quota: chat(P.free.quota), pts: ['Semua fitur dasar'], cta: 'Coba gratis', feat: false },
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
  ['c', 'Pashmina ceruty dusty pink masih ada? 😍'],
  ['r', 'Masih ada kak, sisa 12 pcs 😊 Harganya Rp45.000. Mau dikirim ke mana?'],
  ['c', 'Ke Purwokerto. Berapa hari sampai? 🙏'],
  ['r', 'Estimasi 2-3 hari dengan JNE reguler, kak 📦'],
  ['c', 'Kalau beli 10 bisa lebih murah? 🤭'],
  ['h', 'Harga grosir belum ada di data toko, jadi saya teruskan ke admin ya kak 🙏']
];

const STEPS = [
  ['Isi data toko', 'Produk, harga, stok, jam buka, ongkir, dan pertanyaan yang sering muncul.', 'M3 9.5 4.5 4h15L21 9.5M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12.5V20h14v-7.5M10 20v-4.5h4V20'],
  ['Pasang di website', 'Tempel satu baris kode, atau bagikan link chat ke bio Instagram dan toko online.', 'M3 5.5h18v13H3zM3 9.5h18M6.5 7.5h.01M9.5 7.5h.01'],
  ['Ambil alih kapan saja', 'Lihat semua percakapan, balas sendiri, lalu kembalikan ke asisten.', 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7']
];

const CONTROL = [
  ['Menjawab dari datamu', 'Kalau tidak ada di data, asisten meneruskan ke kamu, bukan menebak.'],
  ['Balas dari dashboard', 'Percakapan yang butuh admin diberi tanda, jadi tidak ada yang terlewat.'],
  ['Biaya terkendali', 'Atur batas balasan per hari. Lewat batas, pesan masuk ke admin.'],
  ['Widget hanya di situsmu', 'Hanya domain yang kamu daftarkan yang bisa menampilkan chat.'],
  ['Web, Telegram, WhatsApp', 'Satu asisten dan satu dashboard untuk semua saluran.'],
  ['Tim admin dan banyak toko', 'Undang admin lewat email. Satu akun bisa mengelola sampai 5 toko.']
];

export default async function Beranda() {
  const { list, note } = await loadPlans();
  return (
    <div className="pub">
      <header className="lp-w lp-nav">
        <Link className="brand" href="/">Asisten<span>Toko</span></Link>
        <span className="grow"></span>
        <a className="navlink" href="#paket">Paket</a>
        <Link className="btn ghost sm" href="/login">Masuk</Link>
        <Link className="btn sm" href="/login#daftar">Daftar</Link>
      </header>

      <main>
        <section className="lp-w lp-hero">
          <div>
            <h1>Asisten AI yang menjawab pelangganmu saat kamu sibuk</h1>
            <p className="lead">Isi produk, stok, dan FAQ tokomu sekali. Asisten menjawab dari data itu, dan menyerahkan ke kamu kalau ada yang tidak diketahui.</p>
            <div className="row">
              <Link className="btn lg" href="/login#daftar">Coba gratis</Link>
              <Link className="btn ghost lg" href="/login">Sudah punya akun</Link>
            </div>
            <p className="note">Tanpa coding, cukup isi data toko lalu tempel satu baris kode.</p>
          </div>

          <div className="lp-phone" role="img" aria-label="Contoh percakapan pelanggan dengan asisten toko, berakhir dengan pertanyaan harga grosir yang diteruskan ke admin">
            <div className="lp-screen" aria-hidden="true">
              <div className="lp-notch"></div>
              <div className="lp-chath">
                <span className="av">A</span>
                <div><b>Ayu Hijab</b><small>Membalas otomatis, 24 jam</small></div>
              </div>
              <div className="lp-msgs">
                {DEMO.map(([k, t], i) => (
                  <div key={i} className={'lp-b ' + k} style={{ '--i': i }}>
                    {k === 'h' ? <em>Diteruskan ke admin</em> : null}
                    {t}
                  </div>
                ))}
              </div>
              <div className="lp-input">
                <span>Tulis pesan</span>
                <span className="lp-send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg></span>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-band" aria-labelledby="cara">
          <div className="lp-w">
            <h2 id="cara">Tiga langkah sampai AI menjawab</h2>
            <ol className="lp-steps">
              {STEPS.map(([t, d, ic], i) => (
                <li key={t}><span className="ic"><Ic d={ic} /></span><span className="lbl">{'Langkah ' + (i + 1)}</span><h3>{t}</h3><p>{d}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-w lp-sec" aria-labelledby="kontrol">
          <h2 id="kontrol">Kamu tetap yang memegang kendali</h2>
          <dl className="lp-ctrl">
            {CONTROL.map(([t, d]) => (
              <div key={t}><dt>{t}</dt><dd>{d}</dd></div>
            ))}
          </dl>
        </section>

        <section className="lp-band acc" id="paket" aria-labelledby="paket-h">
          <div className="lp-w">
            <h2 id="paket-h">Mulai gratis, naik paket kalau toko makin ramai</h2>
            <div className="lp-prices">
              {list.map((p) => (
                <div key={p.id} className={'lp-price' + (p.feat ? ' feat' : '')}>
                  <div className="ph"><b>{p.name}</b>{p.feat ? <span className="lp-chip">Terpopuler</span> : null}{p.promo ? <span className="lp-chip w">{'Diskon ' + p.promo + '%'}</span> : null}</div>
                  <div className="amt">{p.price}<small>{' ' + p.per}</small></div>
                  {p.was ? <div className="was"><s>{p.was}</s></div> : null}
                  <ul>
                    <li><Check /><b>{p.quota}</b></li>
                    {p.pts.map((t) => <li key={t}><Check />{t}</li>)}
                  </ul>
                  <Link className={'btn' + (p.id === 'bisnis' ? ' ghost' : '')} href="/login#daftar">{p.cta}</Link>
                </div>
              ))}
            </div>
            <p className="lp-note">{'Setelah batas balasan bulanan, pesan baru masuk ke admin dan kamu tetap bisa membalas sendiri. ' + note}</p>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
