'use client';
/* Ringkasan toko: angka penting hari ini, pemakaian kuota (pemilik), dan hal yang perlu ditangani.
   Semua angka dibaca langsung dari Supabase dengan sesi login (dibatasi RLS). */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sk } from '../components/Skeleton';
import orderLib from '@/lib/orders';
import { authFetch, rp, startOfTodayWIB } from './helpers';
import { useRealtime } from './useRealtime';

const DAY = 86400000;
const WIB = 7 * 3600000;
const CHANNEL = { web: 'Web', telegram: 'Telegram', whatsapp: 'WhatsApp' };
const num = (n) => Number(n || 0).toLocaleString('id-ID');
const dateOnly = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

function startOfMonthWIB() {
  const w = new Date(Date.now() + WIB);
  w.setUTCDate(1); w.setUTCHours(0, 0, 0, 0);
  return new Date(w.getTime() - WIB);
}

// Kunci tanggal WIB (yyyy-mm-dd) untuk mengelompokkan percakapan per hari.
const dayKey = (ms) => new Date(ms + WIB).toISOString().slice(0, 10);

function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <span className="hint">{label}</span>
      <b>{value}</b>
      <small>{note}</small>
    </div>
  );
}

const head = (q) => q.then((r) => (r.error ? null : r.count || 0));

export default function RingkasanTab({ sb, shop, role, fail }) {
  const [d, setD] = useState(null);
  const [quota, setQuota] = useState(null);
  // Pemilik: kartu kuota ditahan tempatnya (kerangka) selagi data paket dimuat, supaya halaman tidak bergeser.
  const [quotaLoading, setQuotaLoading] = useState(role === 'owner');

  const load = useCallback(async () => {
    const today = startOfTodayWIB();
    const week = new Date(today.getTime() - 6 * DAY);
    const month = startOfMonthWIB();
    const iso = (x) => x.toISOString();
    const c = () => sb.from('conversations').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id);
    const m = () => sb.from('messages').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('role', 'bot');
    try {
      const [convToday, botToday, botMonth, human, unanswered, ordersNew, ordersProses, week7] = await Promise.all([
        head(c().gte('created_at', iso(today))),
        head(m().gte('created_at', iso(today))),
        head(m().gte('created_at', iso(month))),
        head(c().eq('status', 'human')),
        head(c().eq('unanswered', true)),
        head(c().eq('order_status', 'baru')),      // null bila migrasi pesanan belum dijalankan
        head(c().eq('order_status', 'diproses')),
        sb.from('conversations').select('created_at,channel').eq('shop_id', shop.id).gte('created_at', iso(week)).limit(5000)
      ]);
      if (week7.error) throw week7.error;
      // Penjualan bulan ini dari tabel orders. Null kalau tabelnya belum ada (migrasi belum dijalankan): kartunya disembunyikan.
      const ord = await sb.from('orders').select('status,items,subtotal').eq('shop_id', shop.id).gte('created_at', iso(month)).limit(5000);
      const sales = ord.error ? null : orderLib.summarize(ord.data || [], 5);
      const perDay = {};
      const byChannel = {};
      (week7.data || []).forEach((r) => {
        const k = dayKey(Date.parse(r.created_at));
        perDay[k] = (perDay[k] || 0) + 1;
        byChannel[r.channel] = (byChannel[r.channel] || 0) + 1;
      });
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const t = today.getTime() - i * DAY;
        days.push({
          key: dayKey(t),
          label: new Date(t + WIB).toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'UTC' }),
          n: perDay[dayKey(t)] || 0
        });
      }
      setD({
        convToday, botToday, botMonth, human, unanswered,
        ordersNew: ordersNew || 0, ordersProses: ordersProses || 0, ordersOn: ordersNew !== null,
        week: (week7.data || []).length, days, byChannel, sales
      });
    } catch (e) { fail(e); }
  }, [sb, shop.id, fail]);

  useEffect(() => { load(); }, [load]);
  useRealtime(sb, 'conversations', 'shop_id=eq.' + shop.id, load, 60000);

  // Kuota dan paket hanya untuk pemilik (API Langganan memang khusus pemilik).
  useEffect(() => {
    if (role !== 'owner') return undefined;
    let alive = true;
    authFetch(sb, shop.id, '/api/billing?brief=1')
      .then((b) => { if (alive) setQuota(b); })
      .catch(() => { /* kartu kuota disembunyikan kalau gagal */ })
      .finally(() => { if (alive) setQuotaLoading(false); });
    return () => { alive = false; };
  }, [sb, shop.id, role]);

  if (!d) {
    return (
      <>
        <div className="stats s4">{[0, 1, 2, 3].map((i) => <Sk key={i} h={78} r={14} />)}</div>
        {role === 'owner' ? <div className="card"><Sk w={200} h={18} /><Sk h={44} r={12} style={{ marginTop: 14 }} /></div> : null}
        <div className="card"><Sk w={160} h={18} /><Sk h={120} r={12} style={{ marginTop: 14 }} /></div>
      </>
    );
  }

  const max = Math.max(1, ...d.days.map((x) => x.n));
  const todo = [];
  if (d.human) todo.push({ href: '/dashboard', n: d.human, text: 'percakapan menunggu balasan admin', cta: 'Buka percakapan' });
  if (d.ordersOn && d.ordersNew) todo.push({ href: '/dashboard/pesanan', n: d.ordersNew, text: 'pesanan baru belum diproses', cta: 'Lihat pesanan' });
  if (d.unanswered) todo.push({ href: '/dashboard/belum-terjawab', n: d.unanswered, text: 'pertanyaan belum terjawab oleh asisten', cta: 'Ajari asisten' });

  const pct = quota && quota.quota ? Math.min(100, Math.round(quota.used / quota.quota * 100)) : 0;
  const planName = quota ? ((quota.plans || []).find((p) => p.id === quota.plan) || {}).name || quota.plan : '';
  const channels = Object.keys(d.byChannel).sort((a, b) => d.byChannel[b] - d.byChannel[a]);

  return (
    <>
      <div className="stats s4">
        <Stat label="Percakapan hari ini" value={num(d.convToday)} note={num(d.week) + ' dalam 7 hari'} />
        <Stat label="Balasan asisten hari ini" value={num(d.botToday)} note={num(d.botMonth) + ' bulan ini'} />
        <Stat label="Butuh admin" value={num(d.human)} note="menunggu balasan" />
        <Stat label="Pesanan baru" value={d.ordersOn ? num(d.ordersNew) : '-'} note={d.ordersOn ? num(d.ordersProses) + ' sedang diproses' : 'jalankan migrasi pesanan'} />
      </div>

      {d.sales ? (
        <div className="card">
          <div className="chead">
            <div>
              <h2>Penjualan bulan ini</h2>
              <p className="hint">Dari pesanan yang dicatat asisten. Omzet dihitung dari pesanan berstatus selesai, belum termasuk ongkir.</p>
            </div>
            <Link className="btn ghost sm" href="/dashboard/pesanan">Lihat pesanan</Link>
          </div>
          <div className="stats">
            <Stat label="Omzet (selesai)" value={rp(d.sales.revenue)} note={num(d.sales.done) + ' pesanan selesai'} />
            <Stat label="Sedang berjalan" value={rp(d.sales.pending)} note={num(d.sales.open) + ' pesanan'} />
            <Stat label="Pesanan bulan ini" value={num(d.sales.count)} note={d.sales.canceled ? num(d.sales.canceled) + ' dibatalkan' : 'tidak ada yang dibatalkan'} />
          </div>
          {d.sales.top.length ? (
            <>
              <h3 style={{ margin: '4px 0 6px', fontSize: 15 }}>Produk terlaris</h3>
              <div className="rows">
                {d.sales.top.map((x) => (
                  <div key={x.name} className="li">
                    <div className="t stack"><b>{x.name}</b></div>
                    <span className="tag">{num(x.qty) + ' terjual'}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="hint">Belum ada pesanan dengan rincian bulan ini.</p>}
        </div>
      ) : null}

      {role === 'owner' && quotaLoading ? (
        <div className="card"><Sk w={200} h={18} /><Sk h={44} r={12} style={{ marginTop: 14 }} /></div>
      ) : null}
      {role === 'owner' && !quotaLoading && quota ? (
        <div className="card">
          <div className="chead">
            <div>
              <h2>Kuota balasan bulan ini</h2>
              <p className="hint">{'Paket ' + planName + (quota.expiresAt ? ' · berakhir ' + dateOnly(quota.expiresAt) : '')}</p>
            </div>
            <Link className="btn ghost sm" href="/dashboard/langganan">Kelola paket</Link>
          </div>
          <b>{num(quota.used) + ' / ' + num(quota.quota)}</b> <span className="hint">balasan terpakai ({pct}%)</span>
          <div className={'bar' + (pct >= 80 ? ' hot' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Pemakaian kuota"><i style={{ width: pct + '%' }} /></div>
          {pct >= 100 ? (
            <p className="hint note">Kuota habis. Sampai awal bulan depan, pesan pelanggan langsung masuk ke admin. Tambah kuota lewat menu Langganan.</p>
          ) : pct >= 80 ? (
            <p className="hint note">Kuota hampir habis. Setelah habis, pesan pelanggan langsung masuk ke admin tanpa dijawab asisten.</p>
          ) : null}
        </div>
      ) : null}

      <div className="card">
        <h2>Perlu ditangani</h2>
        {todo.length ? (
          <div className="rows">
            {todo.map((x) => (
              <div key={x.href} className="li">
                <div className="t stack"><b>{num(x.n) + ' ' + x.text}</b></div>
                <Link className="btn sm" href={x.href}>{x.cta}</Link>
              </div>
            ))}
          </div>
        ) : <p className="hint">Tidak ada yang perlu ditangani sekarang.</p>}
      </div>

      <div className="card">
        <div className="chead">
          <div>
            <h2>Percakapan 7 hari terakhir</h2>
            <p className="hint">{channels.length ? channels.map((k) => (CHANNEL[k] || k) + ' ' + num(d.byChannel[k])).join(' · ') : 'Belum ada percakapan minggu ini.'}</p>
          </div>
        </div>
        <div className="mini" role="img" aria-label={'Percakapan per hari: ' + d.days.map((x) => x.label + ' ' + x.n).join(', ')}>
          {d.days.map((x) => (
            <div key={x.key} className="mini-c">
              <span className="mini-n">{x.n || ''}</span>
              <i style={{ height: Math.max(x.n ? 6 : 2, Math.round(x.n / max * 96)) + 'px' }} />
              <small>{x.label}</small>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
