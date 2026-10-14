'use client';
/* Kerangka dashboard pemilik toko: sidebar + sesi login + data toko.
   Tiap menu adalah halaman sendiri (/dashboard, /dashboard/produk, dst), jadi reload
   tetap di halaman yang sama. Akses data lewat Supabase dengan sesi login,
   dibatasi Row Level Security (lihat supabase/schema.sql). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabaseBrowser';
import { useToast } from '../components/useToast';
import { Sk, SkConvRows, SkForm, SkItems, SkNav } from '../components/Skeleton';
import { DashCtx } from './context';
import Onboarding from './Onboarding';
import { useRealtime } from './useRealtime';

const TABS = [
  ['/dashboard', 'Percakapan', 'chat'],
  ['/dashboard/produk', 'Produk', 'produk'],
  ['/dashboard/faq', 'FAQ', 'faq'],
  ['/dashboard/toko', 'Toko', 'toko'],
  ['/dashboard/bot', 'Bot', 'bot'],
  ['/dashboard/coba', 'Coba bot', 'coba'],
  ['/dashboard/pasang', 'Pasang', 'pasang'],
  ['/dashboard/notifikasi', 'Notifikasi', 'notifikasi'],
  ['/dashboard/tim', 'Tim', 'tim']
];
// Halaman yang hanya boleh dibuka pemilik toko. Admin tambahan hanya mengurus percakapan, produk, dan FAQ.
const OWNER_ONLY = new Set(['/dashboard/toko', '/dashboard/bot', '/dashboard/pasang', '/dashboard/notifikasi', '/dashboard/tim']);

// Ikon garis sederhana untuk menu sidebar.
const ICON = {
  chat: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z',
  produk: 'M21 8 12 3 3 8m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  faq: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  toko: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M9 20v-6h6v6',
  bot: 'M12 8V4m-4 4h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3ZM9.5 13h.01M14.5 13h.01',
  coba: 'M6 4l14 8-14 8V4Z',
  pasang: 'm8 8-4 4 4 4m8-8 4 4-4 4m-2.5-11-3 14',
  notifikasi: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  tim: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'
};
const Icon = ({ k }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[k]} /></svg>;

function activeTab(pathname) {
  return TABS.find(([href]) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href))) || null;
}

// Kerangka sementara saat sesi dan data toko dimuat, mengikuti halaman yang dibuka.
function PageSkeleton({ href }) {
  if (href === '/dashboard/produk' || href === '/dashboard/faq') {
    return (
      <div className="card">
        <SkItems rows={2} variant={href === '/dashboard/faq' ? 'faq' : 'produk'} />
      </div>
    );
  }
  if (href === '/dashboard/coba') {
    return (
      <div className="card">
        <Sk w={140} h={20} />
        <Sk h={420} r={12} style={{ marginTop: 14 }} />
      </div>
    );
  }
  if (href === '/dashboard' || !href) return <div className="card"><SkConvRows rows={4} /></div>;
  return <div className="card"><SkForm fields={href === '/dashboard/bot' ? 5 : 4} /></div>;
}

export default function DashShell({ supabaseUrl, supabaseAnonKey, error, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [toast, toastNode] = useToast();
  const [sb, setSb] = useState(null);
  const [user, setUser] = useState(null);
  const [shops, setShops] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(!error);
  const [fatal, setFatal] = useState(error || '');
  const [prefillQ, setPrefillQ] = useState('');
  const [humanCount, setHumanCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const fail = useCallback((err) => {
    console.error(err);
    toast(err && err.message ? err.message : 'Terjadi kesalahan');
  }, [toast]);

  // Cek sesi login, lalu muat toko milik user ini.
  useEffect(() => {
    if (error) return;
    const client = getBrowserClient(supabaseUrl, supabaseAnonKey);
    let alive = true;
    (async () => {
      const { data: sess } = await client.auth.getSession();
      if (!alive) return;
      if (!sess.session) { router.replace('/login'); return; }
      const u = sess.session.user;
      // Terima undangan admin yang menunggu untuk email ini (diabaikan kalau migrasi SQL belum dijalankan).
      try { await client.rpc('accept_invites'); } catch (e2) { /* abaikan */ }
      const { data, error: e } = await client.from('shops').select('*').order('created_at', { ascending: true });
      if (!alive) return;
      if (e) { setFatal(e.message); setLoading(false); return; }
      const list = data || [];
      let want = '';
      try { want = new URLSearchParams(window.location.search).get('s') || window.localStorage.getItem('shop:active') || ''; } catch (e3) { /* abaikan */ }
      const first = list.find((x) => x.id === want) || list[0] || null;
      setSb(client); setUser(u); setShops(list); setActiveId(first ? first.id : null); setLoading(false);
    })();
    const { data: sub } = client.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT') router.replace('/login');
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [error, supabaseUrl, supabaseAnonKey, router]);

  const shop = useMemo(() => shops.find((x) => x.id === activeId) || null, [shops, activeId]);
  const role = shop && user && shop.owner_id === user.id ? 'owner' : 'admin';
  const shopId = shop ? shop.id : null;
  useEffect(() => {
    if (!shopId) return;
    try { window.localStorage.setItem('shop:active', shopId); } catch (e) { /* abaikan */ }
  }, [shopId]);
  const refreshHumanCount = useCallback(async () => {
    if (!sb || !shopId) return;
    const { count } = await sb.from('conversations').select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId).eq('status', 'human');
    setHumanCount(count || 0);
  }, [sb, shopId]);
  useEffect(() => { refreshHumanCount(); }, [refreshHumanCount]);
  // Realtime: angka "butuh admin" di menu ikut berubah begitu ada percakapan baru atau status berubah.
  useRealtime(sb, 'conversations', shopId ? 'shop_id=eq.' + shopId : '', refreshHumanCount, 60000);

  const onShopChange = useCallback((patch) => {
    setShops((list) => list.map((x) => (x.id === activeId ? { ...x, ...patch } : x)));
  }, [activeId]);

  const switchShop = useCallback((id) => {
    setActiveId(id); setHumanCount(0); setAdding(false);
  }, []);

  // Pindah halaman: tutup sidebar di layar kecil.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Esc menutup sidebar di layar kecil.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  async function signOut() {
    if (sb) await sb.auth.signOut();
    router.replace('/login');
  }

  const ctx = useMemo(() => ({
    sb, user, shop, shops, role, fail, toast, onShopChange,
    humanCount, setHumanCount, refreshHumanCount, prefillQ, setPrefillQ
  }), [sb, user, shop, shops, role, fail, toast, onShopChange, humanCount, refreshHumanCount, prefillQ]);

  const current = activeTab(pathname || '');
  const showNav = !!shop && !fatal;
  const tabs = TABS.filter(([href]) => role === 'owner' || !OWNER_ONLY.has(href));
  const blocked = !!current && role !== 'owner' && OWNER_ONLY.has(current[0]);
  const waiting = loading && !fatal;

  let body;
  if (fatal) {
    body = <p className="err" role="alert">{fatal}</p>;
  } else if (loading || !sb) {
    body = <PageSkeleton href={current && current[0]} />;
  } else if (!shop || adding) {
    body = (
      <Onboarding sb={sb} user={user} first={!shops.length} onCancel={shops.length ? () => setAdding(false) : null}
        onCreated={(s) => {
          setShops((list) => [...list, s]); setActiveId(s.id); setAdding(false);
          router.push('/dashboard/toko'); toast('Toko dibuat. Lengkapi datanya.');
        }} />
    );
  } else if (blocked) {
    body = (
      <div className="card">
        <h2>Khusus pemilik toko</h2>
        <p className="hint">Halaman ini hanya bisa dibuka pemilik toko. Sebagai admin, kamu bisa mengurus percakapan, produk, dan FAQ.</p>
        <Link className="btn sm" href="/dashboard">Ke Percakapan</Link>
      </div>
    );
  } else {
    // key: pindah toko memuat ulang isi halaman dengan data toko yang baru.
    body = <div key={shop.id}>{children}</div>;
  }

  return (
    <DashCtx.Provider value={ctx}>
      <div className="app">
        <header className="mbar">
          <button type="button" aria-label="Buka menu" aria-expanded={menuOpen} aria-controls="side" onClick={() => setMenuOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <Link className="brand" href="/">Asisten<span>Toko</span></Link>
          <span className="grow"></span>
          {humanCount ? <i title="Percakapan butuh admin">{humanCount}</i> : null}
        </header>
        <div className={'scrim' + (menuOpen ? ' on' : '')} onClick={() => setMenuOpen(false)} aria-hidden="true" />

        <aside id="side" className={'side' + (menuOpen ? ' open' : '')} aria-label="Menu dashboard">
          <Link className="brand" href="/">Asisten<span>Toko</span></Link>
          {showNav && (
            <div className="shopbox">
              {shops.length > 1 ? (
                <select aria-label="Pilih toko" value={shop.id} onChange={(e) => switchShop(e.target.value)}>
                  {shops.map((x) => <option key={x.id} value={x.id}>{x.name + (user && x.owner_id !== user.id ? ' (admin)' : '')}</option>)}
                </select>
              ) : <b>{shop.name}</b>}
              <small>{'/chat/' + shop.slug + (role !== 'owner' ? ' · admin' : '')}</small>
              <button className="linkbtn" type="button" onClick={() => { setAdding(true); setMenuOpen(false); }}>+ Tambah toko</button>
            </div>
          )}
          {waiting && <Sk h={52} r={12} style={{ margin: '0 4px' }} />}
          {showNav && (
            <nav aria-label="Menu utama">
              {tabs.map(([href, label, icon]) => (
                <Link key={href} href={href} className="nav-i" aria-current={current && current[0] === href ? 'page' : undefined}>
                  <Icon k={icon} />
                  {label}
                  {href === '/dashboard' && humanCount ? <i>{humanCount}</i> : null}
                </Link>
              ))}
            </nav>
          )}
          {waiting && <div style={{ flex: 1 }}><SkNav /></div>}
          {!showNav && !waiting && <div style={{ flex: 1 }} />}
          <div className="side-foot">
            {user ? <span className="hint" title={user.email}>{user.email}</span> : waiting ? <Sk w="70%" h={12} /> : null}
            <button className="btn ghost sm" type="button" onClick={signOut}>Keluar</button>
          </div>
        </aside>

        <div className="app-main">
          <main className="wrap">
            {current && (showNav || waiting) && !adding && <h1 className="ptitle">{current[1]}</h1>}
            {body}
          </main>
        </div>
        {toastNode}
      </div>
    </DashCtx.Provider>
  );
}
