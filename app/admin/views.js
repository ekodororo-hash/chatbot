'use client';
/* Isi halaman-halaman admin layanan. Data & aksi datang dari AdminShell lewat context. */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Busy, rp, dayTime } from '../dashboard/helpers';
import { useAdmin } from './context';

const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const STATUS = { paid: 'Lunas', pending: 'Menunggu', failed: 'Gagal', expired: 'Kedaluwarsa' };
const num = (n) => Number(n || 0).toLocaleString('id-ID');

function Stat({ label, value, note }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <span className="hint">{label}</span>
      <h2 style={{ margin: '2px 0 0' }}>{value}</h2>
      <span className="hint">{note}</span>
    </div>
  );
}

function PaymentRows({ payments }) {
  if (!payments.length) return <p className="hint">Belum ada pembayaran.</p>;
  return payments.map((p) => (
    <div className="li" key={p.order_id}>
      <div className="t stack">
        <b>{(p.shop_name || 'Toko') + ' · ' + p.plan + ' ' + p.months + ' bulan'}</b>
        <small>{rp(p.amount) + ' · ' + (p.provider || '-') + ' · ' + dayTime(p.created_at)}</small>
      </div>
      <span className={'tag' + (p.status === 'paid' ? ' a' : p.status === 'pending' ? '' : ' w')}>{STATUS[p.status] || p.status}</span>
    </div>
  ));
}

function ShopUsage({ s }) {
  const pct = s.quota ? Math.min(100, Math.round((s.used / s.quota) * 100)) : 0;
  return (
    <>
      <div className={'bar' + (pct >= 90 ? ' hot' : '')} aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
      <small className="hint">{num(s.used) + ' / ' + num(s.quota) + ' balasan bulan ini · ' + s.convs + ' percakapan' + (s.expires_at ? ' · berakhir ' + dateOnly(s.expires_at) : '')}</small>
    </>
  );
}

export function RingkasanView() {
  const { data } = useAdmin();
  const t = data.totals;
  return (
    <>
      <div className="grid2" style={{ marginBottom: 14 }}>
        <Stat label="Total toko" value={t.shops} note={t.paidShops + ' berlangganan aktif'} />
        <Stat label="Pendapatan bulan ini" value={rp(t.revenueMonth)} note="dari pembayaran lunas" />
        <Stat label="Balasan bot bulan ini" value={num(t.botRepliesMonth)} note="semua toko" />
        <Stat label="Total percakapan" value={num(t.conversations)} note="sejak awal" />
      </div>
      <div className="card">
        <h2>Toko terbaru</h2>
        {!data.shops.length ? <p className="hint">Belum ada toko.</p> : null}
        {data.shops.slice(0, 5).map((s) => (
          <div key={s.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
            <div className="li" style={{ border: 0, padding: 0 }}>
              <div className="t"><b>{s.name}</b><small>{(s.owner || 'pemilik tidak diketahui') + ' · /chat/' + s.slug}</small></div>
              {!s.bot_on ? <span className="tag w">Bot mati</span> : null}
              <span className={'tag' + (s.plan !== 'free' ? ' a' : '')}>{s.plan_name}</span>
            </div>
            <ShopUsage s={s} />
          </div>
        ))}
        {data.shops.length ? <Link className="btn ghost sm" href="/admin/toko">Lihat semua toko</Link> : null}
      </div>
      <div className="card">
        <h2>Pembayaran terbaru</h2>
        <PaymentRows payments={data.payments.slice(0, 5)} />
        {data.payments.length ? <Link className="btn ghost sm" href="/admin/pembayaran">Lihat semua pembayaran</Link> : null}
      </div>
    </>
  );
}

export function TokoView() {
  const { data, act } = useAdmin();
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [plan, setPlan] = useState('starter');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState('');
  const [delText, setDelText] = useState('');

  const shops = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data.shops;
    return data.shops.filter((s) => [s.name, s.slug, s.owner].some((x) => String(x || '').toLowerCase().includes(t)));
  }, [data, q]);

  async function run(key, body, okMsg) {
    setBusy(key);
    const ok = await act(body, okMsg);
    setBusy('');
    return ok;
  }

  return (
    <div className="card">
      <input type="search" placeholder="Cari nama toko, slug, atau email pemilik" aria-label="Cari toko" value={q} onChange={(e) => setQ(e.target.value)} />
      {data.totals.capped ? <p className="hint">{'Menampilkan 200 toko terbaru dari ' + data.totals.shops + '.'}</p> : null}
      <div style={{ marginTop: 8 }}>
        {!shops.length ? <p className="hint">Tidak ada toko yang cocok.</p> : null}
        {shops.map((s) => {
          const open = openId === s.id;
          return (
            <div key={s.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
              <div className="li" style={{ border: 0, padding: 0 }}>
                <button type="button" className="open" onClick={() => { setOpenId(open ? null : s.id); setDelText(''); }} aria-expanded={open}>
                  <div className="t">
                    <b>{s.name}</b>
                    <small>{(s.owner || 'pemilik tidak diketahui') + ' · /chat/' + s.slug}</small>
                  </div>
                </button>
                {!s.bot_on ? <span className="tag w">Bot mati</span> : null}
                <span className={'tag' + (s.plan !== 'free' ? ' a' : '')}>{s.plan_name}</span>
              </div>
              <ShopUsage s={s} />

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
                    <button className="btn sm" type="button" disabled={!!busy} onClick={() => run('plan' + s.id, { action: 'set_plan', shopId: s.id, plan, days }, 'Paket diubah.')}>
                      <Busy on={busy === 'plan' + s.id} label="Menyimpan...">Simpan paket</Busy>
                    </button>
                    <button className="btn ghost sm" type="button" disabled={!!busy} onClick={() => run('bot' + s.id, { action: 'set_bot', shopId: s.id, on: !s.bot_on }, s.bot_on ? 'Bot dimatikan.' : 'Bot dinyalakan.')}>
                      <Busy on={busy === 'bot' + s.id} label="Menyimpan...">{s.bot_on ? 'Matikan bot' : 'Nyalakan bot'}</Busy>
                    </button>
                    <a className="btn ghost sm" href={'/chat/' + s.slug} target="_blank" rel="noopener">Buka chat</a>
                  </div>
                  <b style={{ display: 'block', marginTop: 14 }}>Hapus toko</b>
                  <p className="hint">{'Menghapus permanen toko ini beserta produk, FAQ, percakapan, tim, saluran, dan riwayat pembayarannya. Tidak bisa dibatalkan. Ketik alamat chat (' + s.slug + ') untuk konfirmasi.'}</p>
                  <input aria-label="Ketik alamat chat untuk konfirmasi" autoComplete="off" value={delText} onChange={(e) => setDelText(e.target.value)} />
                  <div className="row">
                    <button className="btn danger solid sm" type="button" disabled={!!busy || delText.trim() !== s.slug}
                      onClick={async () => { if (await run('del' + s.id, { action: 'delete_shop', shopId: s.id, confirm: delText.trim() }, 'Toko dihapus.')) { setOpenId(null); setDelText(''); } }}>
                      <Busy on={busy === 'del' + s.id} label="Menghapus...">Hapus permanen</Busy>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PembayaranView() {
  const { data } = useAdmin();
  return (
    <div className="card">
      <PaymentRows payments={data.payments} />
    </div>
  );
}
