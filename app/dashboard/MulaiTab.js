'use client';
/* Panduan mulai: checklist 6 langkah supaya asisten siap menjawab pelanggan.
   Langkah tercentang otomatis saat datanya terisi (profil, produk, FAQ, nama asisten, widget terpasang).
   "Coba asisten" tidak bisa dideteksi, jadi ditandai manual. Tanda manual disimpan di browser per toko. */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sk } from '../components/Skeleton';

const head = (q) => q.then((r) => (r.error ? 0 : r.count || 0));
const storeKey = (shopId) => 'mulai:' + shopId;

const INFO = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 11v5M12 7.6h.01" />
  </svg>
);

const STEPS = [
  {
    key: 'profil', title: 'Lengkapi profil toko', sub: 'Jam buka, alamat, dan deskripsi singkat', href: '/dashboard/toko', menu: 'Toko', time: '2 menit',
    intro: 'Asisten memakai data ini untuk menjawab "buka jam berapa?" dan "alamatnya di mana?".',
    todo: [<>Buka menu <b>Toko</b>.</>, 'Isi deskripsi, alamat, dan jam buka.', 'Simpan.'],
    tip: 'Tulis seperti kamu menjelaskan toko ke pelanggan baru, bukan seperti slogan.',
    ex: <><b>Contoh deskripsi:</b> Toko hijab online di Bandung. Kirim ke seluruh Indonesia, kain adem dan tidak menerawang.</>
  },
  {
    key: 'produk', title: 'Tambah produk', sub: 'Nama, harga, dan keterangan tiap produk', href: '/dashboard/produk', menu: 'Produk', time: '5 menit',
    intro: 'Tanpa produk, asisten tidak bisa menyebut harga atau stok. Mulai dari 5 sampai 10 produk terlaris, sisanya menyusul.',
    todo: [<>Buka menu <b>Produk</b>.</>, 'Klik tambah produk, isi nama, harga, dan keterangan.', 'Ulangi untuk produk lain.'],
    tip: 'Cantumkan ukuran, warna, atau varian di keterangan. Pelanggan sering menanyakannya.',
    ex: <><b>Contoh:</b> Pashmina Ceruty Baby Doll, Rp 45.000, warna: hitam, dusty pink, sage. Ukuran 175 x 75 cm.</>
  },
  {
    key: 'faq', title: 'Tulis jawaban untuk pertanyaan umum', sub: 'FAQ: ongkir, pembayaran, retur, dan lainnya', href: '/dashboard/faq', menu: 'FAQ', time: '4 menit',
    intro: 'Jawaban di FAQ dipakai apa adanya, jadi aman untuk hal yang tidak boleh meleset seperti kebijakan retur.',
    todo: [<>Buka menu <b>FAQ</b>.</>, 'Tulis pertanyaan dan jawabannya.', 'Mulai dari: cara pesan, pembayaran, pengiriman, retur.'],
    tip: 'Nanti pertanyaan yang belum terjawab muncul di menu Belum terjawab. Tinggal ubah jadi FAQ.',
    ex: <><b>Contoh:</b> "Bisa COD?" &rarr; "Bisa untuk area Bandung. Di luar itu transfer atau e-wallet."</>
  },
  {
    key: 'asisten', title: 'Atur asisten dan tampilan widget', sub: 'Nama, gaya bahasa, warna, ikon, dan posisi tombol chat', href: '/dashboard/bot', menu: 'Asisten AI / Widget', time: '4 menit',
    intro: 'Di sini kamu menentukan nama dan gaya bicara asisten, serta bagaimana tombol chat terlihat di websitemu.',
    todo: [
      <>Buka menu <b>Asisten AI / Widget</b>.</>,
      <>Di <b>Identitas</b>, isi nama asisten dan pilih gaya bahasa.</>,
      <>Di <b>Tampilan chat di website</b>, atur warna, ikon, label, dan posisi tombol. Pratinjau langsung terlihat di samping.</>,
      <>Klik <b>Simpan</b>.</>
    ],
    tip: 'Aktifkan Tombol WhatsApp dan Pilihan cepat kalau pelanggan sering minta bicara langsung dengan penjual.',
    ex: <><b>Contoh label tombol:</b> "Tanya Ayu" dengan ikon sapaan, posisi kanan bawah, muncul setelah 5 detik.</>
  },
  {
    key: 'coba', title: 'Coba asisten sendiri', sub: 'Tanya seperti pelanggan, lihat jawabannya', href: '/dashboard/coba', menu: 'Coba asisten', time: '2 menit',
    intro: 'Sebelum dibuka ke pelanggan, pastikan jawabannya sudah sesuai.',
    todo: [<>Buka menu <b>Coba asisten</b>.</>, 'Tanyakan harga produk, jam buka, dan cara retur.', 'Kalau jawabannya salah, perbaiki di Produk atau FAQ, lalu coba lagi.'],
    tip: 'Pesan dari halaman ini tidak dihitung ke kuota chat.',
    ex: null
  },
  {
    key: 'pasang', title: 'Bagikan link atau pasang di website', sub: 'Biar pelanggan bisa mulai chat', href: '/dashboard/pasang', menu: 'Pasang', time: '2 menit',
    intro: 'Pilih salah satu cara. Keduanya bisa dipakai bersamaan.',
    todo: [
      <><b>Link chat:</b> salin link atau unduh QR code, tempel di bio Instagram atau status WhatsApp.</>,
      <><b>Widget website:</b> salin kode, tempel sebelum &lt;/body&gt;, lalu klik Cek pemasangan.</>
    ],
    tip: 'Belum punya website? Link chat dan QR sudah cukup untuk mulai. Langkah ini tercentang otomatis saat widget pertama kali dimuat di websitemu, atau tandai manual kalau kamu hanya memakai link.',
    ex: null
  }
];

const OPTIONAL = [
  { href: '/dashboard/notifikasi', title: 'Hubungkan Telegram atau WhatsApp', text: 'Pelanggan bisa chat lewat aplikasi yang mereka pakai.' },
  { href: '/dashboard/notifikasi', title: 'Aktifkan notifikasi', text: 'Dapat kabar di Telegram saat ada pesan yang perlu dibalas manual.' },
  { href: '/dashboard/tim', title: 'Undang anggota tim', text: 'Beri akses ke karyawan untuk membalas chat.' }
];

// Langkah yang bisa dideteksi dari data. Langkah tanpa fungsi di sini hanya bisa ditandai manual.
function detect(shop, n) {
  const filled = (v) => !!String(v || '').trim();
  return {
    profil: filled(shop.about) && (filled(shop.hours) || filled(shop.address)),
    produk: n.produk > 0,
    faq: n.faq > 0,
    asisten: (filled(shop.bot_name) && shop.bot_name.trim() !== 'Asisten Toko') || filled(shop.widget_label),
    pasang: n.views > 0
  };
}

export default function MulaiTab({ sb, shop }) {
  const [n, setN] = useState(null);
  const [manual, setManual] = useState([]);
  const [open, setOpen] = useState(undefined);   // undefined = ikuti langkah berikutnya

  const load = useCallback(async () => {
    const [produk, faq, views] = await Promise.all([
      head(sb.from('products').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id)),
      head(sb.from('faqs').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id)),
      // Tabel widget_stats ada setelah migrasi widget_statistik.sql; kalau belum ada, dianggap belum ada data.
      sb.from('widget_stats').select('views').eq('shop_id', shop.id).gt('views', 0).limit(1)
        .then((r) => (r.error ? 0 : (r.data || []).length))
    ]);
    setN({ produk, faq, views });
  }, [sb, shop.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(storeKey(shop.id)) || '[]');
      setManual(Array.isArray(raw) ? raw : []);
    } catch (e) { setManual([]); }
  }, [shop.id]);

  function toggle(key) {
    setManual((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      try { window.localStorage.setItem(storeKey(shop.id), JSON.stringify(next)); } catch (e) { /* abaikan */ }
      return next;
    });
    setOpen(undefined);
  }

  if (!n) {
    return (
      <>
        <div className="card"><Sk w={180} h={18} /><Sk h={10} r={999} style={{ marginTop: 14 }} /></div>
        <div className="card"><Sk h={64} r={12} /><Sk h={64} r={12} style={{ marginTop: 10 }} /><Sk h={64} r={12} style={{ marginTop: 10 }} /></div>
      </>
    );
  }

  const auto = detect(shop, n);
  const isDone = (s) => !!auto[s.key] || manual.includes(s.key);
  const total = STEPS.length;
  const count = STEPS.filter(isDone).length;
  const pct = Math.round(count * 100 / total);
  const nextStep = STEPS.find((s) => !isDone(s));
  const openKey = open === undefined ? (nextStep ? nextStep.key : null) : open;
  const status = count === 0 ? 'Baru mulai' : count === total ? 'Semua selesai' : count < 4 ? 'Sedang berjalan' : 'Hampir selesai';

  return (
    <>
      <p className="lead mulai-lead">
        {'Asisten untuk ' + shop.name + ' sudah dibuat, tapi belum tahu apa-apa soal tokomu. Ikuti enam langkah ini supaya ia bisa menjawab pelanggan dengan benar. Totalnya sekitar 20 menit.'}
      </p>

      <div className="card">
        <div className="mulai-prog">
          <b>{status}</b>
          <span>{count + ' dari ' + total + ' selesai'}</span>
        </div>
        <div className="bar" role="progressbar" aria-label="Progres setup toko" aria-valuemin={0} aria-valuemax={total} aria-valuenow={count}>
          <i style={{ width: pct + '%', transition: 'width .35s' }} />
        </div>
      </div>

      <div className="card mulai-flush">
        <ol className="mulai-steps">
          {STEPS.map((s, i) => {
            const done = isDone(s);
            const current = !!nextStep && nextStep.key === s.key;
            const isOpen = openKey === s.key;
            const canToggle = !auto[s.key];
            return (
              <li key={s.key} className={'mulai-step' + (done ? ' done' : '') + (current ? ' cur' : '') + (isOpen ? ' open' : '')}>
                <button type="button" className="mulai-sh" aria-expanded={isOpen} aria-controls={'mulai-b-' + s.key}
                  onClick={() => setOpen(isOpen ? null : s.key)}>
                  <span className="mulai-chk" aria-hidden="true">{done ? '\u2713' : current ? '\u25CF' : ''}</span>
                  <span className="mulai-st">
                    <b>{(i + 1) + '. ' + s.title}</b>
                    <small>{s.sub}</small>
                  </span>
                  <span className={'mulai-tag' + (current ? ' a' : '')}>{done ? 'Selesai' : current ? 'Berikutnya' : s.time}</span>
                  <svg className="mulai-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {isOpen ? (
                  <div className="mulai-sb" id={'mulai-b-' + s.key}>
                    <p>{s.intro}</p>
                    <ol>{s.todo.map((t, k) => <li key={k}>{t}</li>)}</ol>
                    {s.ex ? <div className="mulai-ex">{s.ex}</div> : null}
                    <div className="mulai-tip">{INFO}<span>{s.tip}</span></div>
                    <div className="row">
                      <Link className="btn" href={s.href}>{'Buka menu ' + s.menu}</Link>
                      {canToggle ? (
                        <button className="btn ghost" type="button" onClick={() => toggle(s.key)}>
                          {done ? 'Batalkan tanda selesai' : 'Tandai selesai'}
                        </button>
                      ) : null}
                    </div>
                    {!canToggle && done ? <p className="hint mulai-auto">Terdeteksi otomatis dari data tokomu.</p> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {count === total ? (
        <div className="card mulai-donecard">
          <h2>Asistenmu siap bekerja</h2>
          <p className="hint">Semua langkah dasar selesai. Pantau pesan yang masuk di Percakapan, dan lihat pertanyaan yang belum bisa dijawab di Belum terjawab supaya bisa kamu tambahkan ke FAQ.</p>
          <div className="row"><Link className="btn" href="/dashboard/ringkasan">Lihat Ringkasan</Link></div>
        </div>
      ) : null}

      <div className="card">
        <h2>Opsional, kalau sudah sempat</h2>
        <div className="mulai-opt">
          {OPTIONAL.map((o) => (
            <Link key={o.title} href={o.href}>
              <b>{o.title}</b>
              <small>{o.text}</small>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
