'use client';
/* Kerangka admin pengelola layanan: sidebar + sesi login + data layanan.
   Hanya untuk email di ADMIN_EMAILS (atau DEVELOPER_EMAILS). Pemeriksaan akses dilakukan di server
   (/api/admin). Selama belum terbukti admin, isi halaman tidak ditampilkan; akun yang bukan admin
   langsung dialihkan ke /dashboard. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabaseBrowser';
import { useToast } from '../components/useToast';
import { Sk, SkForm, SkNav } from '../components/Skeleton';
import { AdminCtx } from './context';

const TABS = [
  ['/admin', 'Ringkasan', 'ringkasan'],
  ['/admin/toko', 'Toko', 'toko'],
  ['/admin/pengguna', 'Pengguna', 'pengguna'],
  ['/admin/paket', 'Paket', 'paket'],
  ['/admin/pembayaran', 'Pembayaran', 'pembayaran'],
  ['/admin/pengaturan', 'Pengaturan', 'pengaturan']
];

const ICON = {
  ringkasan: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  toko: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M9 20v-6h6v6',
  pengguna: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  paket: 'M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8',
  pembayaran: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2ZM2 10h20M6 15h4',
  pengaturan: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  dashboard: 'M3 3h7v9H3ZM14 3h7v5h-7ZM14 12h7v9h-7ZM3 16h7v5H3Z'
};
const Icon = ({ k }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[k]} /></svg>;

function activeTab(pathname) {
  return TABS.find(([href]) => (href === '/admin' ? pathname === href : pathname.startsWith(href))) || null;
}

export default function AdminShell({ supabaseUrl, supabaseAnonKey, error, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [toast, toastNode] = useToast();
  const [sb, setSb] = useState(null);
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [fatal, setFatal] = useState(error || '');
  const [loading, setLoading] = useState(!error);
  const [menuOpen, setMenuOpen] = useState(false);

  const call = useCallback(async (client, method, body) => {
    const { data: s } = await client.auth.getSession();
    const tok = s && s.session && s.session.access_token;
    const res = await fetch('/api/admin', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(j.error || 'Terjadi kesalahan'); e.status = res.status; throw e; }
    return j;
  }, []);

  const load = useCallback(async (client) => {
    try { setData(await call(client, 'GET')); setFatal(''); }
    catch (e) {
      // Bukan admin: jangan tampilkan apa pun dari halaman admin, kembalikan ke dashboard toko.
      if (e.status === 403) { router.replace('/dashboard'); return; }
      setFatal(e.message || 'Gagal memuat data.');
    }
    setLoading(false);
  }, [call, router]);

  useEffect(() => {
    if (error) return;
    const client = getBrowserClient(supabaseUrl, supabaseAnonKey);
    let alive = true;
    (async () => {
      const { data: sess } = await client.auth.getSession();
      if (!alive) return;
      if (!sess.session) { router.replace('/login'); return; }
      setSb(client); setUser(sess.session.user);
      await load(client);
    })();
    const { data: sub } = client.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT') router.replace('/login');
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [error, supabaseUrl, supabaseAnonKey, router, load]);

  // Pindah halaman: tutup sidebar di layar kecil. Esc juga menutupnya.
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const act = useCallback(async (body, okMsg) => {
    try { await call(sb, 'POST', body); toast(okMsg); await load(sb); return true; }
    catch (e) { toast(e.message || 'Gagal.'); return false; }
  }, [call, sb, toast, load]);

  async function signOut() {
    if (sb) await sb.auth.signOut();
    router.replace('/login');
  }

  const ctx = useMemo(() => ({ sb, user, data, act, toast }), [sb, user, data, act, toast]);
  const current = activeTab(pathname || '');
  const verified = !!data; // sudah terbukti admin
  const waiting = loading && !fatal;

  let body;
  if (fatal) body = <div className="card"><p className="err" role="alert">{fatal}</p></div>;
  else if (!verified) body = <div className="card"><SkForm fields={3} /></div>;
  else body = children;

  return (
    <AdminCtx.Provider value={ctx}>
      <div className="app">
        <header className="mbar">
          <button type="button" aria-label="Buka menu" aria-expanded={menuOpen} aria-controls="side" onClick={() => setMenuOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <Link className="brand" href="/">Asisten<span>Toko</span></Link>
          <span className="grow"></span>
          <span className="tag a">Admin</span>
        </header>
        <div className={'scrim' + (menuOpen ? ' on' : '')} onClick={() => setMenuOpen(false)} aria-hidden="true" />

        <aside id="side" className={'side' + (menuOpen ? ' open' : '')} aria-label="Menu admin">
          <Link className="brand" href="/">Asisten<span>Toko</span></Link>
          <div className="shopbox">
            <b>Admin layanan</b>
            <small>Kelola semua toko</small>
          </div>
          {verified && (
            <nav aria-label="Menu utama">
              {TABS.map(([href, label, icon]) => (
                <Link key={href} href={href} className="nav-i" aria-current={current && current[0] === href ? 'page' : undefined}>
                  <Icon k={icon} />{label}
                </Link>
              ))}
              <Link href="/dashboard" className="nav-i" style={{ marginTop: 'auto' }}>
                <Icon k="dashboard" />Dashboard toko
              </Link>
            </nav>
          )}
          {waiting && <div style={{ flex: 1 }}><SkNav rows={3} /></div>}
          {!verified && !waiting && <div style={{ flex: 1 }} />}
          <div className="side-foot">
            {user ? <span className="hint" title={user.email}>{user.email}</span> : waiting ? <Sk w="70%" h={12} /> : null}
            <button className="btn ghost sm" type="button" onClick={signOut}>Keluar</button>
          </div>
        </aside>

        <div className="app-main">
          <main className="wrap" style={{ maxWidth: 1000 }}>
            {current && verified && <h1 className="ptitle">{current[1]}</h1>}
            {body}
          </main>
        </div>
        {toastNode}
      </div>
    </AdminCtx.Provider>
  );
}
