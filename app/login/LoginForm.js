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

  function toggle(e) {
    e.preventDefault();
    const next = !reg;
    setReg(next);
    setMsg('');
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
    <>
      <div className="top"><Link className="brand" href="/">Asisten<span>Toko</span></Link></div>
      <main className="wrap">
        <div className="narrow">
          <h1 style={{ fontSize: 32, marginTop: 12 }}>{reg ? 'Buat akun' : 'Masuk'}</h1>
          <div className="card">
            <form onSubmit={submit} noValidate>
              <label htmlFor="e">Email</label>
              <input id="e" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <label htmlFor="p">Password</label>
              <input id="p" type="password" autoComplete={reg ? 'new-password' : 'current-password'} minLength={8} required value={pass} onChange={(e) => setPass(e.target.value)} />
              <div className={'err' + (ok ? ' ok' : '')} role="alert">{msg}</div>
              <button className="btn" type="submit" disabled={busy || !!error} style={{ width: '100%', marginTop: 12 }}>{reg ? 'Daftar' : 'Masuk'}</button>
            </form>
          </div>
          <p className="hint" style={{ textAlign: 'center' }}>
            <a href="#" onClick={toggle}>{reg ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}</a>
          </p>
        </div>
      </main>
    </>
  );
}
