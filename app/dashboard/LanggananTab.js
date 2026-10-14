'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Busy, authFetch, rp } from './helpers';
import { Sk } from '../components/Skeleton';

const STATUS = { pending: 'Menunggu bayar', paid: 'Lunas', failed: 'Gagal', expired: 'Kedaluwarsa' };
const tgl = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

// Halaman Langganan (hanya pemilik): paket aktif, pemakaian bulan ini, beli/perpanjang lewat Midtrans.
export default function LanggananTab({ sb, shop, fail, toast }) {
  const [st, setSt] = useState(null);
  const [months, setMonths] = useState(1);
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState('');
  const order = useSearchParams().get('order');

  const load = useCallback(async () => {
    try { setSt(await authFetch(sb, shop.id, '/api/billing')); } catch (e) { fail(e); }
  }, [sb, shop.id, fail]);
  useEffect(() => { load(); }, [load]);

  // Kembali dari halaman bayar Midtrans: periksa langsung, jangan menunggu webhook.
  useEffect(() => {
    if (!order) return;
    (async () => {
      try { setSt(await authFetch(sb, shop.id, '/api/billing', 'POST', { action: 'check', orderId: order })); } catch (e) { /* tampilan biasa tetap dimuat */ }
    })();
  }, [order, sb, shop.id]);

  // Metode bayar yang dipilih (default: yang pertama aktif).
  const prov = st && st.providers.length ? (st.providers.find((x) => x.id === provider) || st.providers[0]) : null;

  async function buy(plan) {
    setBusy(plan);
    try {
      const r = await authFetch(sb, shop.id, '/api/billing', 'POST', { action: 'checkout', plan, months, provider: prov && prov.id });
      window.location.href = r.url;
    } catch (e) { toast(e.message); setBusy(''); }
  }

  async function check(orderId) {
    setBusy('c' + orderId);
    try {
      setSt(await authFetch(sb, shop.id, '/api/billing', 'POST', { action: 'check', orderId }));
      toast('Status pembayaran diperbarui.');
    } catch (e) { toast(e.message); }
    setBusy('');
  }

  if (!st) return <div className="card"><Sk h={18} w="40%" /><Sk h={10} w="100%" /></div>;

  const cur = st.plans.find((p) => p.id === st.plan);
  const pct = Math.min(100, Math.round(st.used / st.quota * 100));
  const term = st.terms.find((x) => x.months === months);
  const paid = st.plans.filter((p) => p.price > 0);
  const rank = { free: 0, starter: 1, bisnis: 2 };

  return (
    <>
      <div className="card">
        <h2>Paket saat ini: {cur.name}</h2>
        <div className="hint">
          {st.expiresAt ? 'Aktif sampai ' + tgl(st.expiresAt) : 'Paket gratis tidak punya masa berlaku.'}
        </div>
        <div className="hint" style={{ marginTop: 10 }}>{'Balasan bot bulan ini: ' + st.used.toLocaleString('id-ID') + ' dari ' + st.quota.toLocaleString('id-ID')}</div>
        <div className={'bar' + (pct > 80 ? ' hot' : '')}><i style={{ width: pct + '%' }} /></div>
        <p className="hint">Kuota dihitung per bulan kalender (WIB) untuk toko ini. Setelah habis, pesan baru diteruskan ke admin sampai bulan berikutnya atau sampai paket dinaikkan.</p>
      </div>

      <div className="card">
        <h2>Beli atau perpanjang</h2>
        {!st.ready ? <p className="hint">Pembayaran online belum diaktifkan oleh pengelola layanan. Hubungi pengelola untuk aktivasi paket.</p> : null}
        {prov && prov.sandbox ? <p className="hint"><b>Mode uji coba ({prov.name}):</b> pembayaran di sini tidak memakai uang sungguhan.</p> : null}
        {st.providers.length > 1 ? (
          <>
            <label htmlFor="lp">Bayar lewat</label>
            <select id="lp" value={prov.id} onChange={(e) => setProvider(e.target.value)}>
              {st.providers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </>
        ) : null}
        <label htmlFor="lm">Lama langganan</label>
        <select id="lm" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          {st.terms.map((x) => <option key={x.months} value={x.months}>{x.months + ' bulan' + (x.discount ? ' (hemat ' + x.discount + '%)' : '')}</option>)}
        </select>
        {paid.map((p) => {
          const lower = rank[st.plan] > rank[p.id];
          return (
            <div key={p.id} className="li" style={{ alignItems: 'center' }}>
              <div className="t">
                <b>{p.name}{st.plan === p.id ? ' (paket kamu)' : ''}{p.promo ? <span className="tag a" style={{ marginLeft: 8 }}>{'Diskon ' + p.promo + '%'}</span> : null}</b>
                <small>
                  {p.quota.toLocaleString('id-ID') + ' balasan per bulan. '}
                  {term.listPrices[p.id] > term.prices[p.id] ? <s style={{ opacity: 0.6 }}>{rp(term.listPrices[p.id])}</s> : null}
                  {term.listPrices[p.id] > term.prices[p.id] ? ' ' : ''}
                  {rp(term.prices[p.id]) + ' untuk ' + months + ' bulan'}
                </small>
              </div>
              <button className="btn sm" type="button" disabled={!st.ready || lower || !!busy} onClick={() => buy(p.id)}>
                <Busy on={busy === p.id} label="Membuka pembayaran...">{st.plan === p.id ? 'Perpanjang' : lower ? 'Paket lebih rendah' : 'Pilih'}</Busy>
              </button>
            </div>
          );
        })}
        <p className="hint">Pembayaran lewat Midtrans atau DOKU (QRIS, transfer bank, e-wallet, kartu; metode yang tampil mengikuti pengaturan akun penyedia). Memperpanjang paket yang sama menyambung dari tanggal berakhir. Pindah ke paket lain dihitung mulai hari pembayaran.</p>
      </div>

      <div className="card">
        <h2>Riwayat pembayaran</h2>
        {st.payments.length === 0 ? <p className="hint">Belum ada pembayaran.</p> : st.payments.map((p) => (
          <div key={p.order_id} className="li">
            <div className="t">
              <b>{(st.plans.find((x) => x.id === p.plan) || {}).name + ' ' + p.months + ' bulan, ' + rp(p.amount)}</b>
              <small>{tgl(p.created_at) + ' · ' + (p.provider === 'doku' ? 'DOKU' : 'Midtrans') + ' · ' + p.order_id}</small>
            </div>
            <span className={'tag' + (p.status === 'paid' ? ' a' : p.status === 'pending' ? ' w' : '')}>{STATUS[p.status] || p.status}</span>
            {p.status === 'pending' ? (
              <button className="btn ghost sm" type="button" disabled={!!busy} onClick={() => check(p.order_id)}>
                <Busy on={busy === 'c' + p.order_id} label="Memeriksa...">Periksa</Busy>
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
