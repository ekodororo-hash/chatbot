'use client';
import { useState } from 'react';
import { useDash } from '../context';
import { Sk } from '../../components/Skeleton';

/* Halaman Coba bot: /dashboard/coba. Judul tab browser diatur di coba/layout.js. */
export default function CobaPage() {
  const { shop, toast } = useDash();
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState(0);
  const link = '/chat/' + shop.slug;

  // Percakapan disimpan di browser (kunci "chat:slug"). Setelah diteruskan ke admin, bot diam
  // untuk percakapan itu, jadi untuk mengetes lagi harus mulai percakapan baru.
  function restart() {
    try { window.localStorage.removeItem('chat:' + shop.slug); } catch (e) { /* abaikan */ }
    setReady(false);
    setRun((n) => n + 1);
    toast('Percakapan baru dimulai.');
  }

  return (
    <div className="card">
      <h2>Coba bot</h2>
      <p className="hint">Chat seperti pelanggan untuk melihat jawaban bot dari data tokomu. Percakapan percobaan ikut muncul di halaman Percakapan. Kalau bot berhenti menjawab karena percakapan sudah diteruskan ke admin, mulai percakapan baru.</p>
      <div className="preview-box">
        <iframe key={run} className="preview" style={{ height: 'min(680px, 72vh)' }} src={link} title="Pratinjau chat" onLoad={() => setReady(true)} />
        {!ready && <Sk h="100%" r={12} style={{ position: 'absolute', inset: 0 }} />}
      </div>
      <div className="row">
        <button className="btn sm" type="button" onClick={restart}>Mulai percakapan baru</button>
        <a className="btn ghost sm" href={link} target="_blank" rel="noopener">Buka di tab baru</a>
      </div>
    </div>
  );
}
