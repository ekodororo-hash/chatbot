'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabaseBrowser';

function friendly(x) {
  let m = String((x && x.message) || '');
  if (/invalid login/i.test(m)) m = 'Email atau password salah.';
  else if (/already registered|already been registered/i.test(m)) m = 'Email ini sudah terdaftar. Silakan masuk.';
  else if (/not confirmed/i.test(m)) m = 'Email belum dikonfirmasi. Cek kotak masuk emailmu.';
  return m || 'Terjadi kesalahan. Coba lagi.';
}

export default function LoginForm({ supabaseUrl, supabaseAnonKey, error }) {
  const router = useRouter();
  const [reg, setReg] = useState(false);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState(error || '');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error) return;
    setReg(window.location.hash === '#daftar');
    let alive = true;
    getBrowserClient(supabaseUrl, supabaseAnonKey).auth.getSession().then(({ data }) => {
      if (alive && data.session) router.replace('/dashboard');
    });
    return () => { alive = false; };
  }, [error, supabaseUrl, supabaseAnonKey, router]);

  function mode(next) {
    if (next === reg) return;
    setReg(next);
    setMsg(''); setOk(false);
    window.history.replaceState(null, '', next ? '#daftar' : '#');
  }

  async function submit(e) {
    e.preventDefault();
    if (error) return;
    const mail = email.trim();
    setMsg(''); setOk(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setMsg('Format email belum benar.'); return; }
    if (pass.length < 8) { setMsg('Password minimal 8 karakter.'); return; }
    setBusy(true);
    const sb = getBrowserClient(supabaseUrl, supabaseAnonKey);
    try {
      if (reg) {
        const r = await sb.auth.signUp({ email: mail, password: pass });
        if (r.error) throw r.error;
        if (r.data.session) { router.replace('/dashboard'); return; }
        setOk(true);
        setMsg('Akun dibuat. Cek email untuk konfirmasi, lalu masuk.');
      } else {
        const l = await sb.auth.signInWithPassword({ email: mail, password: pass });
        if (l.error) throw l.error;
        router.replace('/dashboard');
      }
    } catch (x) {
      setOk(false);
      setMsg(friendly(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth pub">
      <aside className="auth-art" aria-hidden="true">
        <Link className="brand" href="/" tabIndex={-1}>Asisten<span>Toko</span></Link>
        <div>
          <h2>Pelanggan bertanya, asistenmu menjawab.</h2>
          <div className="art-chat" style={{ marginTop: 28 }}>
            <span className="l">Kak, ongkir ke Bandung berapa?</span>
            <span className="r">Reguler Rp18.000, estimasi 2 hari kak.</span>
            <span className="l">Oke, aku pesan ya</span>
          </div>
        </div>
        <span style={{ fontSize: 14, opacity: 0.85 }}>Kamu tinggal ambil alih kalau ada yang perlu dijawab sendiri.</span>
      </aside>

      <div className="auth-form">
        <Link className="brand" href="/">Asisten<span>Toko</span></Link>
        <div className="auth-box">
          <Link className="auth-back" href="/">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
            Kembali
          </Link>
          <h1>{reg ? 'Buat akun' : 'Masuk ke dashboard'}</h1>
          <p className="sub">{reg ? 'Daftar, lalu isi data tokomu.' : 'Lihat percakapan dan atur asisten AI tokomu.'}</p>

          <div className="seg" role="group" aria-label="Pilih masuk atau daftar">
            <button type="button" aria-pressed={!reg} onClick={() => mode(false)}>Masuk</button>
            <button type="button" aria-pressed={reg} onClick={() => mode(true)}>Daftar</button>
          </div>

          <form onSubmit={submit} noValidate>
            <label htmlFor="e">Email</label>
            <input id="e" type="email" autoComplete="email" inputMode="email" placeholder="nama@tokomu.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="p">Password</label>
            <div className="pw">
              <input id="p" type={showPw ? 'text' : 'password'} placeholder="Minimal 8 karakter" autoComplete={reg ? 'new-password' : 'current-password'} minLength={8} required value={pass} onChange={(e) => setPass(e.target.value)} />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}>{showPw ? 'Sembunyikan' : 'Tampilkan'}</button>
            </div>
            {reg && <p className="field-hint">Dengan mendaftar, kamu menyetujui <Link href="/syarat" target="_blank">Syarat dan Ketentuan</Link> serta <Link href="/privasi" target="_blank">Kebijakan Privasi</Link>.</p>}
            <div className={'err' + (ok ? ' ok' : '')} role="alert">{msg}</div>
            <button className="btn lg" type="submit" disabled={busy || !!error} style={{ width: '100%', marginTop: 12 }}>
              {busy ? <span className="spin" aria-hidden="true" /> : null}
              {busy ? 'Memproses...' : (reg ? 'Daftar' : 'Masuk')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
