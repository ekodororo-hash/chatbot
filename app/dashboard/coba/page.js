'use client';
import { useState } from 'react';
import { useDash } from '../context';
import { Sk } from '../../components/Skeleton';

/* Halaman Coba bot: /dashboard/coba. Judul tab browser diatur di coba/layout.js. */
export default function CobaPage() {
  const { shop } = useDash();
  const [ready, setReady] = useState(false);
  const link = '/chat/' + shop.slug;

  return (
    <div className="card">
      <h2>Coba bot</h2>
      <p className="hint">Chat seperti pelanggan untuk melihat jawaban bot dari data tokomu. Percakapan percobaan ikut muncul di halaman Percakapan.</p>
      <div className="preview-box">
        <iframe className="preview" style={{ height: 'min(680px, 72vh)' }} src={link} title="Pratinjau chat" onLoad={() => setReady(true)} />
        {!ready && <Sk h="100%" r={12} style={{ position: 'absolute', inset: 0 }} />}
      </div>
      <div className="row">
        <a className="btn ghost sm" href={link} target="_blank" rel="noopener">Buka di tab baru</a>
      </div>
    </div>
  );
}
