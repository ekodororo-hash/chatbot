'use client';
import { useState } from 'react';
import { useDash } from '../context';
import { Busy } from '../helpers';
import { Sk } from '../../components/Skeleton';

/* Halaman Coba bot: /dashboard/coba. Judul tab browser diatur di coba/layout.js. */
export default function CobaPage() {
  const { sb, shop, toast } = useDash();
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState(0);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState('');
  const link = '/chat/' + shop.slug;

  // Percakapan disimpan di browser (kunci "chat:slug"). Setelah diteruskan ke admin, bot diam
  // untuk percakapan itu, jadi untuk mengetes lagi harus mulai percakapan baru.
  function restart() {
    try { window.localStorage.removeItem('chat:' + shop.slug); } catch (e) { /* abaikan */ }
    setReady(false);
    setRun((n) => n + 1);
    toast('Percakapan baru dimulai.');
  }

  async function diagnose() {
    setChecking(true); setProblem('');
    try {
      const { data } = await sb.auth.getSession();
      const token = data.session && data.session.access_token;
      const r = await fetch('/api/diagnosa', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'X-Shop-Id': shop.id } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Gagal memeriksa bot.');
      setResult(j);
    } catch (e) {
      setResult(null);
      setProblem(e.message || 'Gagal memeriksa bot.');
    }
    setChecking(false);
  }

  return (
    <>
      <section className="card" aria-labelledby="cb">
        <div className="chead">
          <div>
            <h2 id="cb">Coba bot</h2>
            <p className="hint">Chat seperti pelanggan untuk melihat jawaban bot dari data tokomu. Percakapan percobaan ikut muncul di halaman Percakapan. Kalau bot berhenti menjawab karena percakapan sudah diteruskan ke admin, mulai percakapan baru.</p>
          </div>
        </div>
        <div className="coba-frame">
          <div className="preview-box">
            <iframe key={run} className="preview" style={{ height: 'min(680px, 72vh)' }} src={link} title="Pratinjau chat" onLoad={() => setReady(true)} />
            {!ready && <Sk h="100%" r={12} style={{ position: 'absolute', inset: 0 }} />}
          </div>
        </div>
        <div className="coba-act">
          <button className="btn sm" type="button" onClick={restart}>Mulai percakapan baru</button>
          <a className="btn ghost sm" href={link} target="_blank" rel="noopener">Buka di tab baru</a>
        </div>
      </section>

      <section className="card" aria-labelledby="cd">
        <div className="chead">
          <div>
            <h2 id="cd">Bot tidak menjawab?</h2>
            <p className="hint">Periksa pengaturan bot, kuota, data toko, dan layanan AI. Hasilnya menunjukkan bagian yang perlu diperbaiki.</p>
          </div>
          <button className="btn" type="button" disabled={checking} onClick={diagnose}>
            <Busy on={checking} label="Memeriksa...">Cek kesiapan bot</Busy>
          </button>
        </div>
        <div className="err" role="alert">{problem}</div>
        {result && (
          <div role="status">
            <div className={'diag-sum ' + (result.ok ? 'ok' : 'bad')}>
              {result.ok ? 'Semua beres. Kalau chat masih diam, klik "Mulai percakapan baru" lalu coba lagi.' : 'Perbaiki yang bertanda merah, lalu klik "Mulai percakapan baru" dan coba lagi.'}
            </div>
            <div className="diag-list">
              {result.checks.map((c) => (
                <div className="diag" key={c.id}>
                  <span className={'diag-i' + (c.ok ? '' : ' bad')} aria-hidden="true">
                    <svg viewBox="0 0 24 24">{c.ok ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 7v6M12 17h.01" />}</svg>
                  </span>
                  <div className="t">
                    <b>{c.label}</b>
                    <small>{c.detail}</small>
                    {c.tech ? <small className="tech">{'Teknis (hanya pengembang): ' + c.tech}</small> : null}
                  </div>
                  <span className={'tag ' + (c.ok ? '' : 'w')}>{c.ok ? 'Beres' : 'Perlu diperbaiki'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
