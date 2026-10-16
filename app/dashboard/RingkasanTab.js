'use client';
/* Ringkasan toko: angka penting hari ini, pemakaian kuota (pemilik), dan hal yang perlu ditangani.
   Semua angka dibaca langsung dari Supabase dengan sesi login (dibatasi RLS). */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sk } from '../components/Skeleton';
import ratingLib from '@/lib/rating';
import usage from '@/lib/usage';
import { Busy, authFetch, dayTime, startOfTodayWIB } from './helpers';
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

export default function RingkasanTab({ sb, shop, role, onMakeFaq, fail, toast }) {
  const [d, setD] = useState(null);
  const [quota, setQuota] = useState(null);
  const [busy, setBusy] = useState('');
  // Pemilik: kartu kuota ditahan tempatnya (kerangka) selagi data paket dimuat, supaya halaman tidak bergeser.
  const [quotaLoading, setQuotaLoading] = useState(role === 'owner');

  const load = useCallback(async () => {
    const today = startOfTodayWIB();
    const week = new Date(today.getTime() - 6 * DAY);
    const month = startOfMonthWIB();
    const iso = (x) => x.toISOString();
    const c = () => sb.from('conversations').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id);
    // Balasan bot dibaca dari bot_usage, jadi tidak berkurang saat percakapan dihapus.
    const m = (from) => usage.repliesSince(sb, shop.id, from).catch(() => null);
    try {
      const [convToday, botToday, botMonth, human, unanswered, ordersNew, ordersProses, week7] = await Promise.all([
        head(c().gte('created_at', iso(today))),
        m(today),
        m(month),
        head(c().eq('status', 'human')),
        head(c().eq('unanswered', true)),
        head(c().eq('order_status', 'baru')),      // null bila migrasi pesanan belum dijalankan
        head(c().eq('order_status', 'diproses')),
        sb.from('conversations').select('created_at,channel').eq('shop_id', shop.id).gte('created_at', iso(week)).limit(5000)
      ]);
      if (week7.error) throw week7.error;
      // Kepuasan 30 hari terakhir. Null kalau kolom rating belum ada (migrasi rating_dan_kontak.sql belum dijalankan): kartunya disembunyikan.
      const since = iso(new Date(Date.now() - 30 * DAY));
      const rated = await sb.from('conversations').select('rating').eq('shop_id', shop.id).not('rating', 'is', null).gte('rated_at', since).limit(5000);
      let csat = null, bad = [];
      if (!rated.error) {
        csat = ratingLib.summarize(rated.data || []);
        const b = await sb.from('conversations').select('id,rating_q,rated_at').eq('shop_id', shop.id)
          .eq('rating', -1).eq('rating_done', false).order('rated_at', { ascending: false }).limit(5);
        if (!b.error) bad = b.data || [];
      }
      // Statistik widget 30 hari (null kalau migrasi widget_statistik.sql belum dijalankan: kartunya disembunyikan).
      let ws = null;
      const wr = await sb.from('widget_stats').select('day,views,opens,orders').eq('shop_id', shop.id)
        .gte('day', dayKey(Date.now() - 29 * DAY)).limit(40);
      if (!wr.error) {
        const sum = (from) => (wr.data || []).filter((x) => x.day >= from).reduce((a, x) => ({
          views: a.views + (x.views || 0), opens: a.opens + (x.opens || 0), orders: a.orders + (x.orders || 0)
        }), { views: 0, opens: 0, orders: 0 });
        ws = { d7: sum(dayKey(Date.now() - 6 * DAY)), d30: sum('0000') };
      }
      const leads = await head(sb.from('leads').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id));
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
        week: (week7.data || []).length, days, byChannel, csat, bad, leads, ws
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

  async function markDone(id) {
    setBusy(id);
    const { error } = await sb.from('conversations').update({ rating_done: true }).eq('id', id);
    setBusy('');
    if (error) { fail(error); return; }
    setD((x) => ({ ...x, bad: x.bad.filter((r) => r.id !== id) }));
    toast('Ditandai beres.');
  }

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

      {d.ws ? (
        <div className="card">
          <div className="chead">
            <div>
              <h2>Statistik widget</h2>
              <p className="hint">Dari tombol chat di website: berapa kali tampil, dibuka, dan jadi pesanan.</p>
            </div>
          </div>
          {[['7 hari terakhir', d.ws.d7], ['30 hari terakhir', d.ws.d30]].map(([title, w]) => (
            <div key={title}>
              <h3 style={{ margin: '4px 0 6px', fontSize: 15 }}>{title}</h3>
              <div className="stats">
                <Stat label="Tombol dilihat" value={num(w.views)} note="kali halaman dimuat" />
                <Stat label="Chat dibuka" value={num(w.opens)} note={w.views ? Math.round(w.opens / w.views * 100) + '% dari yang melihat' : 'belum ada data'} />
                <Stat label="Jadi pesanan" value={num(w.orders)} note={w.opens ? Math.round(w.orders / w.opens * 100) + '% dari chat dibuka' : 'belum ada data'} />
              </div>
            </div>
          ))}
          {!d.ws.d30.views ? <p className="hint">Belum ada data. Angka mulai terkumpul setelah ada pengunjung yang memuat halaman dengan widget terpasang.</p> : null}
        </div>
      ) : null}

      {d.csat ? (
        <div className="card">
          <div className="chead">
            <div>
              <h2>Kepuasan pelanggan</h2>
              <p className="hint">Penilaian jempol atas/bawah dari pelanggan chat web dalam 30 hari terakhir.</p>
            </div>
          </div>
          {d.csat.total ? (
            <div className="stats">
              <Stat label="Puas" value={d.csat.pct + '%'} note={num(d.csat.total) + ' penilaian'} />
              <Stat label="Jempol atas" value={num(d.csat.up)} note="puas" />
              <Stat label="Jempol bawah" value={num(d.csat.down)} note="kurang puas" />
            </div>
          ) : <p className="hint">Belum ada penilaian. Pelanggan bisa menilai lewat tautan "Beri nilai percakapan" di chat, atau otomatis saat percakapan ditandai selesai.</p>}
          {d.bad.length ? (
            <>
              <h3 style={{ margin: '4px 0 6px', fontSize: 15 }}>Dinilai kurang baik</h3>
              <p className="hint">Pertanyaan pelanggan di percakapan ini bisa dijadikan FAQ, supaya asisten menjawabnya lebih baik lain kali.</p>
              <div className="rows">
                {d.bad.map((r) => (
                  <div key={r.id} className="srow">
                    <div className="t stack">
                      <b style={{ whiteSpace: 'normal' }}>{r.rating_q || 'Pelanggan tidak menulis pertanyaan yang jelas'}</b>
                      <small>{'Dinilai ' + dayTime(r.rated_at)}</small>
                    </div>
                    <div className="row">
                      {r.rating_q ? <button className="btn sm" type="button" onClick={() => onMakeFaq(r.rating_q)}>Jadikan FAQ</button> : null}
                      <Link className="btn ghost sm" href={'/dashboard?c=' + r.id}>Buka chat</Link>
                      <button className="btn ghost sm" type="button" disabled={busy === r.id} onClick={() => markDone(r.id)}>
                        <Busy on={busy === r.id} label="Menyimpan...">Tandai beres</Busy>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {d.leads ? (
        <div className="card">
          <div className="chead">
            <div>
              <h2>Kontak pelanggan</h2>
              <p className="hint">{num(d.leads) + ' pengunjung bersedia dikabari soal promo.'}</p>
            </div>
            <Link className="btn ghost sm" href="/dashboard/kontak">Lihat kontak</Link>
          </div>
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
