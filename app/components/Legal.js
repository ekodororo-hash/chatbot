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
      Asisten Toko, asisten AI untuk UMKM. <Link href="/syarat">Syarat dan Ketentuan</Link> · <Link href="/privasi">Kebijakan Privasi</Link>
    </footer>
  );
}

export default function LegalPage({ title, children }) {
  return (
    <>
      <header className="top">
        <Link className="brand" href="/">Asisten<span>Toko</span></Link>
        <span className="grow"></span>
        <Link className="btn ghost sm" href="/login">Masuk</Link>
        <Link className="btn sm" href="/login#daftar">Daftar</Link>
      </header>
      <main className="legal">
        <article>
          <h1>{title}</h1>
          <p className="hint">Terakhir diperbarui: {LEGAL.updated}</p>
          {children}
        </article>
      </main>
      <LegalFooter />
    </>
  );
}
