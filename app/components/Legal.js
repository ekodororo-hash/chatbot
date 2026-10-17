import Link from 'next/link';

// Data pengelola untuk halaman Syarat & Ketentuan dan Kebijakan Privasi.
// Email kontak bawaan: emahairshop@gmail.com. Bisa diganti lewat env CONTACT_EMAIL. LEGAL_ENTITY opsional: nama badan usaha/pengelola resmi.
// Ubah UPDATED setiap kali isi kedua halaman berubah.
export const LEGAL = {
  app: 'Asisten Toko',
  entity: process.env.LEGAL_ENTITY || 'pengelola Asisten Toko',
  email: process.env.CONTACT_EMAIL || 'emahairshop@gmail.com',
  updated: '16 Oktober 2026'
};

export function Contact() {
  return LEGAL.email
    ? <a href={'mailto:' + LEGAL.email}>{LEGAL.email}</a>
    : <>pengelola layanan melalui dashboard</>;
}

export function LegalFooter() {
  return (
    <footer className="foot">
      <Link className="brand" href="/">Asisten<span>Toko</span></Link>
      <p>Asisten AI untuk UMKM</p>
      <nav aria-label="Dokumen hukum">
        <Link href="/syarat">Syarat dan Ketentuan</Link>
        <Link href="/privasi">Kebijakan Privasi</Link>
      </nav>
    </footer>
  );
}

// active: 'syarat' atau 'privasi'. toc: daftar [id, judul] untuk menu samping (id sama dengan id pada h2).
// ringkas: poin "Versi singkat" di atas halaman, hanya untuk membantu membaca.
export default function LegalPage({ title, active, toc = [], ringkas = [], children }) {
  return (
    <div className="pub">
      <header className="lp-w lp-nav">
        <Link className="brand" href="/">Asisten<span>Toko</span></Link>
        <span className="grow"></span>
        <Link className="btn ghost sm" href="/login">Masuk</Link>
        <Link className="btn sm" href="/login#daftar">Daftar</Link>
      </header>
      <main className="legal-wrap">
        <aside className="legal-side">
          <nav className="legal-tabs" aria-label="Pilih dokumen">
            <Link href="/syarat" aria-current={active === 'syarat' ? 'page' : undefined}>Syarat</Link>
            <Link href="/privasi" aria-current={active === 'privasi' ? 'page' : undefined}>Privasi</Link>
          </nav>
          {toc.length ? (
            <nav className="legal-toc" aria-label="Isi halaman">
              {toc.map(([id, t]) => <a key={id} href={'#' + id}>{t}</a>)}
            </nav>
          ) : null}
        </aside>
        <article className="legal">
          <h1>{title}</h1>
          <p className="hint">Terakhir diperbarui: {LEGAL.updated}</p>
          {ringkas.length ? (
            <div className="legal-sum">
              <b>Versi singkat</b>
              <ul>{ringkas.map((t) => <li key={t}>{t}</li>)}</ul>
              <small>Ringkasan ini membantu membaca. Yang berlaku adalah isi lengkap di bawah.</small>
            </div>
          ) : null}
          {children}
        </article>
      </main>
      <LegalFooter />
    </div>
  );
}
