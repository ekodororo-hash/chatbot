'use client';
/* Halaman admin pengelola layanan: /admin. Hanya untuk email di ADMIN_EMAILS (atau DEVELOPER_EMAILS).
   Data lewat /api/admin (server, service role); pemeriksaan akses dilakukan di server, bukan di sini. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabaseBrowser';
import { useToast } from '../components/useToast';
import { Sk } from '../components/Skeleton';
import { Busy, rp, dayTime } from '../dashboard/helpers';

const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const STATUS = { paid: 'Lunas', pending: 'Menunggu', failed: 'Gagal', expired: 'Kedaluwarsa' };

export default function AdminClient({ supabaseUrl, supabaseAnonKey, error }) {
  const router = useRouter();
  const [toast, toastNode] = useToast();
  const [sb, setSb] = useState(null);
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [fatal, setFatal] = useState(error || '');
  const [loading, setLoading] = useState(!error);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [plan, setPlan] = useState('starter');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState('');

  const call = useCallback(async (client, method, body) => {
    const { data: s } = await client.auth.getSession();
    const tok = s && s.session && s.session.access_token;
    const res = await fetch('/api/admin', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Terjadi kesalahan');
    return j;
  }, []);

  const load = useCallback(async (client) => {
    try { setData(await call(client, 'GET')); setFatal(''); }
    catch (e) { setFatal(e.message || 'Gagal memuat data.'); }
    setLoading(false);
  }, [call]);

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
    return () => { alive = false; };
  }, [error, supabaseUrl, supabaseAnonKey, router, load]);

  async function act(key, body, okMsg) {
    setBusy(key);
    try { await call(sb, 'POST', body); toast(okMsg); await load(sb); }
    catch (e) { toast(e.message || 'Gagal.'); }
    setBusy('');
  }

  const shops = useMemo(() => {
    const list = (data && data.shops) || [];
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((s) => [s.name, s.slug, s.owner].some((x) => String(x || '').toLowerCase().includes(t)));
  }, [data, q]);

  const t = data && data.totals;

  return (
    <div className="wrap" style={{ paddingTop: 20 }}>
      <div className="top" style={{ padding: '0 0 12px' }}>
        <Link className="brand" href="/">Asisten<span>Toko</span></Link>
        <span className="tag a">Admin layanan</span>
        <span className="grow"></span>
        <Link className="btn ghost sm" href="/dashboard">Dashboard toko</Link>
        <button className="btn ghost sm" type="button" onClick={async () => { if (sb) await sb.auth.signOut(); router.replace('/login'); }}>Keluar</button>
      </div>
      <h1 className="ptitle">Admin layanan</h1>
      {user ? <p className="hint" style={{ marginTop: -10 }}>{'Masuk sebagai ' + user.email}</p> : null}

      {fatal ? (
        <div className="card">
          <p className="err" role="alert">{fatal}</p>
          <p className="hint">Isi variabel <b>ADMIN_EMAILS</b> di Vercel dengan emailmu (pisahkan dengan koma kalau lebih dari satu), lalu deploy ulang.</p>
        </div>
      ) : null}

      {loading && !fatal ? <div className="card"><Sk h={20} w={180} /><Sk h={120} r={12} style={{ marginTop: 14 }} /></div> : null}

      {t ? (
        <>
          <div className="grid2" style={{ marginBottom: 14 }}>
            <div className="card" style={{ marginBottom: 0 }}><span className="hint">Total toko</span><h2 style={{ margin: '2px 0 0' }}>{t.shops}</h2><span className="hint">{t.paidShops + ' berlangganan aktif'}</span></div>
            <div className="card" style={{ marginBottom: 0 }}><span className="hint">Pendapatan bulan ini</span><h2 style={{ margin: '2px 0 0' }}>{rp(t.revenueMonth)}</h2><span className="hint">dari pembayaran lunas</span></div>
            <div className="card" style={{ marginBottom: 0 }}><span className="hint">Balasan bot bulan ini</span><h2 style={{ margin: '2px 0 0' }}>{t.botRepliesMonth.toLocaleString('id-ID')}</h2><span className="hint">semua toko</span></div>
            <div className="card" style={{ marginBottom: 0 }}><span className="hint">Total percakapan</span><h2 style={{ margin: '2px 0 0' }}>{t.conversations.toLocaleString('id-ID')}</h2><span className="hint">sejak awal</span></div>
          </div>

          <div className="card">
            <h2>Toko</h2>
            <input type="search" placeholder="Cari nama toko, slug, atau email pemilik" aria-label="Cari toko" value={q} onChange={(e) => setQ(e.target.value)} />
            {t.capped ? <p className="hint">{'Menampilkan 200 toko terbaru dari ' + t.shops + '.'}</p> : null}
            <div style={{ marginTop: 8 }}>
              {!shops.length ? <p className="hint">Tidak ada toko yang cocok.</p> : null}
              {shops.map((s) => {
                const pct = s.quota ? Math.min(100, Math.round((s.used / s.quota) * 100)) : 0;
                const open = openId === s.id;
                return (
                  <div key={s.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
                    <div className="li" style={{ border: 0, padding: 0 }}>
                      <button type="button" className="open" onClick={() => setOpenId(open ? null : s.id)} aria-expanded={open}>
                        <div className="t">
                          <b>{s.name}</b>
                          <small>{(s.owner || 'pemilik tidak diketahui') + ' · /chat/' + s.slug}</small>
                        </div>
                      </button>
                      {!s.bot_on ? <span className="tag w">Bot mati</span> : null}
                      <span className={'tag' + (s.plan !== 'free' ? ' a' : '')}>{s.plan_name}</span>
                    </div>
                    <div className={'bar' + (pct >= 90 ? ' hot' : '')} aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
                    <small className="hint">{s.used.toLocaleString('id-ID') + ' / ' + s.quota.toLocaleString('id-ID') + ' balasan bulan ini · ' + s.convs + ' percakapan' + (s.expires_at ? ' · berakhir ' + dateOnly(s.expires_at) : '')}</small>

                    {open ? (
                      <div className="item" style={{ marginTop: 10 }}>
                        <b>Ubah paket manual</b>
                        <p className="hint">Untuk klien yang bayar lewat transfer. Masa berlaku dihitung mulai hari ini.</p>
                        <div className="grid2">
                          <select aria-label="Paket" value={plan} onChange={(e) => setPlan(e.target.value)}>
                            {data.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <input type="number" min="1" max="3650" aria-label="Lama (hari)" placeholder="Lama (hari)" value={days} disabled={plan === 'free'} onChange={(e) => setDays(e.target.value)} />
                        </div>
                        <div className="row">
                          <button className="btn sm" type="button" disabled={!!busy} onClick={() => act('plan' + s.id, { action: 'set_plan', shopId: s.id, plan, days }, 'Paket diubah.')}>
                            <Busy on={busy === 'plan' + s.id} label="Menyimpan...">Simpan paket</Busy>
                          </button>
                          <button className="btn ghost sm" type="button" disabled={!!busy} onClick={() => act('bot' + s.id, { action: 'set_bot', shopId: s.id, on: !s.bot_on }, s.bot_on ? 'Bot dimatikan.' : 'Bot dinyalakan.')}>
                            <Busy on={busy === 'bot' + s.id} label="Menyimpan...">{s.bot_on ? 'Matikan bot' : 'Nyalakan bot'}</Busy>
                          </button>
                          <a className="btn ghost sm" href={'/chat/' + s.slug} target="_blank" rel="noopener">Buka chat</a>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2>Pembayaran terbaru</h2>
            {!data.payments.length ? <p className="hint">Belum ada pembayaran.</p> : null}
            {data.payments.map((p) => (
              <div className="li" key={p.order_id}>
                <div className="t stack">
                  <b>{(p.shop_name || 'Toko') + ' · ' + p.plan + ' ' + p.months + ' bulan'}</b>
                  <small>{rp(p.amount) + ' · ' + (p.provider || '-') + ' · ' + dayTime(p.created_at)}</small>
                </div>
                <span className={'tag' + (p.status === 'paid' ? ' a' : p.status === 'pending' ? '' : ' w')}>{STATUS[p.status] || p.status}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {toastNode}
    </div>
  );
}
