'use client';
/* Dashboard pemilik toko. Semua akses data lewat Supabase dengan sesi login,
   dan dibatasi oleh Row Level Security (lihat supabase/schema.sql). */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabaseBrowser';
import { useToast } from '../components/useToast';
import Onboarding from './Onboarding';
import ChatTab from './ChatTab';
import ProdukTab from './ProdukTab';
import FaqTab from './FaqTab';
import TokoTab from './TokoTab';
import BotTab from './BotTab';
import PasangTab from './PasangTab';
import { Sk, SkConvRows, SkNav } from '../components/Skeleton';

const TABS = [
  ['chat', 'Percakapan'], ['produk', 'Produk'], ['faq', 'FAQ'],
  ['toko', 'Toko'], ['bot', 'Bot'], ['pasang', 'Pasang']
];

// Ikon garis sederhana untuk menu sidebar.
const ICON = {
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z',
  produk: 'M21 8 12 3 3 8m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  faq: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  toko: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M9 20v-6h6v6',
  bot: 'M12 8V4m-4 4h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3ZM9.5 13h.01M14.5 13h.01',
  pasang: 'm8 8-4 4 4 4m8-8 4 4-4 4m-2.5-11-3 14'
};
const Icon = ({ k }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[k]} /></svg>;

export default function Dashboard({ supabaseUrl, supabaseAnonKey, error }) {
  const router = useRouter();
  const [toast, toastNode] = useToast();
  const [sb, setSb] = useState(null);
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(!error);
  const [fatal, setFatal] = useState(error || '');
  const [tab, setTab] = useState('chat');
  const [openConv, setOpenConv] = useState(null);
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
      const { data, error: e } = await client.from('shops').select('*').eq('owner_id', u.id).maybeSingle();
      if (!alive) return;
      if (e) { setFatal(e.message); setLoading(false); return; }
      setSb(client); setUser(u); setShop(data); setLoading(false);
    })();
    const { data: sub } = client.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT') router.replace('/login');
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [error, supabaseUrl, supabaseAnonKey, router]);

  const shopId = shop ? shop.id : null;
  const refreshHumanCount = useCallback(async () => {
    if (!sb || !shopId) return;
    const { count } = await sb.from('conversations').select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId).eq('status', 'human');
    setHumanCount(count || 0);
  }, [sb, shopId]);
  useEffect(() => { refreshHumanCount(); }, [refreshHumanCount]);

  const onShopChange = useCallback((patch) => setShop((s) => ({ ...s, ...patch })), []);

  // Esc menutup sidebar di layar kecil.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  function goTab(k) {
    setTab(k);
    setOpenConv(null);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }

  async function signOut() {
    if (sb) await sb.auth.signOut();
    router.replace('/login');
  }

  let body;
  if (fatal) {
    body = <p className="err" role="alert">{fatal}</p>;
  } else if (loading || !sb) {
    body = (
      <div className="card">
        <SkConvRows rows={5} />
      </div>
    );
  } else if (!shop) {
    body = (
      <Onboarding sb={sb} user={user} onCreated={(s) => {
        setShop(s); setTab('toko'); toast('Toko dibuat. Lengkapi datanya.');
      }} />
    );
  } else {
    const common = { sb, shop, fail, toast, onShopChange };
    body = {
      chat: (
        <ChatTab {...common} openConv={openConv} setOpenConv={setOpenConv}
          onHumanCount={setHumanCount} refreshHumanCount={refreshHumanCount}
          onMakeFaq={(q) => { setPrefillQ(q); setTab('faq'); setOpenConv(null); window.scrollTo(0, 0); }} />
      ),
      produk: <ProdukTab {...common} />,
      faq: <FaqTab {...common} prefillQ={prefillQ} onPrefillUsed={() => setPrefillQ('')} />,
      toko: <TokoTab {...common} />,
      bot: <BotTab {...common} />,
      pasang: <PasangTab {...common} />
    }[tab];
  }

  const showNav = !!shop && !fatal;
  const waiting = loading && !fatal;

  return (
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
            <b>{shop.name}</b>
            <small>{'/chat/' + shop.slug}</small>
          </div>
        )}
        {waiting && <Sk h={52} r={12} style={{ margin: '0 4px' }} />}
        {showNav && (
          <nav aria-label="Menu utama">
            {TABS.map(([k, label]) => (
              <button key={k} type="button" className="nav-i" aria-current={tab === k ? 'page' : undefined} onClick={() => goTab(k)}>
                <Icon k={k} />
                {label}
                {k === 'chat' && humanCount ? <i>{humanCount}</i> : null}
              </button>
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
          {showNav && <h1 className="ptitle">{TABS.find((t) => t[0] === tab)[1]}</h1>}
          {body}
        </main>
      </div>
      {toastNode}
    </div>
  );
}
