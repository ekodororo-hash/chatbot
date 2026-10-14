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

const TABS = [
  ['chat', 'Percakapan'], ['produk', 'Produk'], ['faq', 'FAQ'],
  ['toko', 'Toko'], ['bot', 'Bot'], ['pasang', 'Pasang']
];

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

  function goTab(k) {
    setTab(k);
    setOpenConv(null);
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
    body = <p className="hint">Memuat...</p>;
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

  return (
    <>
      <div className="top">
        <Link className="brand" href="/">Asisten<span>Toko</span></Link>
        <span className="grow hint">{user ? user.email : ''}</span>
        <button className="btn ghost sm" type="button" onClick={signOut}>Keluar</button>
      </div>
      {shop && (
        <nav className="tabs" aria-label="Menu dashboard">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" aria-selected={tab === k} onClick={() => goTab(k)}>
              {label}
              {k === 'chat' && humanCount ? <i>{humanCount}</i> : null}
            </button>
          ))}
        </nav>
      )}
      <main className="wrap">{body}</main>
      {toastNode}
    </>
  );
}
