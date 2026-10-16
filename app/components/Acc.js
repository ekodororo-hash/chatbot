// Bagian yang bisa dilipat (<details>), dipakai di halaman Asisten AI dan Pasang supaya form tidak terasa panjang.
// Ringkasan isi (hint) tampil di bawah judul saat tertutup. Ukuran ikon panah ditulis langsung di SVG
// supaya tetap kecil walau CSS belum termuat.
export default function Acc({ title, hint, open, children }) {
  return (
    <details className="acc" open={open || undefined}>
      <summary>
        <span className="acc-t"><b>{title}</b>{hint ? <small>{hint}</small> : null}</span>
        <svg className="acc-c" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="acc-b">{children}</div>
    </details>
  );
}
