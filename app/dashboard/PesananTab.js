'use client';
/* Daftar pesanan: percakapan yang ditandai bot sebagai pesanan, dengan status
   baru -> diproses -> selesai (atau dibatalkan). Rincian (item, total, alamat) dibaca dari tabel orders;
   pesanan lama sebelum tabel itu ada hanya punya isi percakapan. Mengubah status lewat /api/orders/status,
   yang sekaligus mengabari pelanggan. Ekspor CSV dibuat di browser dari tabel orders (dibatasi RLS). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SkConvRows } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import orderLib from '@/lib/orders';
import { Busy, authFetch, dayTime, rp } from './helpers';
import { useRealtime } from './useRealtime';

const CHANNEL = { web: 'Web', telegram: 'Telegram', whatsapp: 'WhatsApp' };
const STATUS = { baru: ['Baru', 'w'], diproses: ['Diproses', 'a'], selesai: ['Selesai', 'ok'], batal: ['Dibatalkan', ''] };
const FILTERS = [['baru', 'Baru'], ['diproses', 'Diproses'], ['selesai', 'Selesai'], ['batal', 'Dibatalkan'], ['semua', 'Semua']];
const ROLE = { customer: 'Pelanggan', bot: 'Asisten', admin: 'Admin' };
const PERIODS = [['bulan', 'Bulan ini'], ['30', '30 hari terakhir'], ['semua', 'Semua']];
const WIB = 7 * 3600000;

// Awal periode ekspor menurut WIB. null = tanpa batas.
function periodStart(key) {
  if (key === 'semua') return null;
  if (key === '30') return new Date(Date.now() - 30 * 86400000);
  const w = new Date(Date.now() + WIB);
  w.setUTCDate(1); w.setUTCHours(0, 0, 0, 0);
  return new Date(w.getTime() - WIB);
}

function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Rincian pesanan terstruktur: barang, total, alamat, telepon, catatan.
function OrderInfo({ o }) {
  const items = Array.isArray(o.items) ? o.items : [];
  const unknown = items.some((x) => !x.matched);
  return (
    <div style={{ marginTop: 10, fontSize: 14 }}>
      {items.map((x, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{x.qty + 'x ' + x.name}</span>
          <span className="hint">{x.price != null ? rp(x.subtotal) : 'harga belum diketahui'}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
        <b>Total barang</b><b>{rp(o.subtotal)}</b>
      </div>
      <p className="hint" style={{ margin: '4px 0 0' }}>
        {'Belum termasuk ongkir, konfirmasi ke pelanggan.' + (unknown ? ' Ada barang yang tidak ditemukan di katalog, cek manual.' : '')}
      </p>
      {o.address ? <p className="hint" style={{ margin: '6px 0 0' }}>{'Alamat: ' + o.address}</p> : null}
      {o.phone ? <p className="hint" style={{ margin: '2px 0 0' }}>{'Telepon: ' + o.phone}</p> : null}
      {o.note ? <p className="hint" style={{ margin: '2px 0 0' }}>{'Catatan: ' + o.note}</p> : null}
    </div>
  );
}

function Detail({ sb, id, fail }) {
  const [msgs, setMsgs] = useState(null);
  useEffect(() => {
    let alive = true;
    sb.from('messages').select('id,role,content,created_at').eq('conversation_id', id)
      .order('id', { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { fail(error); setMsgs([]); return; }
        setMsgs((data || []).reverse());
      });
    return () => { alive = false; };
  }, [sb, id, fail]);
  if (!msgs) return <p className="hint">Memuat pesan...</p>;
  if (!msgs.length) return <p className="hint">Belum ada pesan.</p>;
  return (
    <div className="msgs" style={{ maxHeight: 280 }}>
      {msgs.map((m) => (
        <div key={m.id} className={'m ' + m.role}>
          <em>{ROLE[m.role] || m.role}</em>{m.content}
        </div>
      ))}
    </div>
  );
}

export default function PesananTab({ sb, shop, refreshBadges, fail, toast }) {
  const [rows, setRows] = useState(null);
  const [details, setDetails] = useState({});      // conversation_id -> baris orders terbaru
  const [detailsOn, setDetailsOn] = useState(true); // false bila tabel orders belum ada (migrasi belum dijalankan)
  const [filter, setFilter] = useState('baru');
  const [openId, setOpenId] = useState('');
  const [busy, setBusy] = useState('');
  const [period, setPeriod] = useState('bulan');
  const [exporting, setExporting] = useState(false);
  const [ask, confirmNode] = useConfirm();

  const load = useCallback(async () => {
    const { data, error } = await sb.from('conversations')
      .select('id,customer_name,channel,order_status,updated_at')
      .eq('shop_id', shop.id).not('order_status', 'is', null)
      .order('updated_at', { ascending: false }).limit(200);
    if (error) { fail(error); setRows([]); return; }
    setRows(data || []);
    // Rincian pesanan: kalau tabelnya belum ada, daftar tetap jalan dengan cara lama.
    const o = await sb.from('orders').select('*').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(500);
    if (o.error) { setDetailsOn(false); return; }
    setDetailsOn(true);
    const map = {};
    (o.data || []).forEach((r) => { if (!map[r.conversation_id]) map[r.conversation_id] = r; });
    setDetails(map);
  }, [sb, shop.id, fail]);

  useEffect(() => { load(); }, [load]);
  useRealtime(sb, 'conversations', 'shop_id=eq.' + shop.id, load, 60000);
  useRealtime(sb, 'orders', 'shop_id=eq.' + shop.id, load, 300000);

  const counts = useMemo(() => {
    const c = { semua: 0 };
    (rows || []).forEach((r) => { c[r.order_status] = (c[r.order_status] || 0) + 1; c.semua++; });
    return c;
  }, [rows]);

  const shown = (rows || []).filter((r) => filter === 'semua' || r.order_status === filter);

  async function setStatus(r, next, msg) {
    setBusy(r.id + next);
    try {
      await authFetch(sb, shop.id, '/api/orders/status', 'POST', { conversationId: r.id, status: next });
      setRows((list) => list.map((x) => (x.id === r.id ? { ...x, order_status: next } : x)));
      setDetails((m) => (m[r.id] ? { ...m, [r.id]: { ...m[r.id], status: next } } : m));
      refreshBadges();
      toast(msg);
    } catch (e) { fail(e); } finally { setBusy(''); }
  }

  async function cancel(r) {
    const ok = await ask({ title: 'Batalkan pesanan?', message: 'Pesanan dari ' + ((details[r.id] && details[r.id].customer_name) || r.customer_name) + ' ditandai dibatalkan' + '. Percakapannya tetap ada.', okLabel: 'Batalkan pesanan' });
    if (ok) setStatus(r, 'batal', 'Pesanan dibatalkan.');
  }

  async function exportCsv() {
    setExporting(true);
    try {
      let q = sb.from('orders').select('*,conversations(channel)').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(5000);
      const from = periodStart(period);
      if (from) q = q.gte('created_at', from.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      if (!data || !data.length) { toast('Tidak ada pesanan pada periode ini.'); return; }
      const list = data.map((r) => ({ ...r, channel: r.conversations && r.conversations.channel }));
      const day = new Date(Date.now() + WIB).toISOString().slice(0, 10);
      downloadText('pesanan-' + shop.slug + '-' + day + '.csv', orderLib.toCsv(list));
      toast(list.length + ' pesanan diekspor.');
    } catch (e) { fail(e); } finally { setExporting(false); }
  }

  const btn = (r, next, label, msg, ghost) => (
    <button className={'btn sm' + (ghost ? ' ghost' : '')} type="button" disabled={!!busy} onClick={() => setStatus(r, next, msg)}>
      <Busy on={busy === r.id + next} label="Menyimpan...">{label}</Busy>
    </button>
  );

  return (
    <div className="card">
      {confirmNode}
      <h2>Pesanan dari pelanggan</h2>
      <p className="hint">Pesanan yang dicatat asisten dari chat. Status di sini hanya catatan untuk admin dan tidak dikirim ke pelanggan. Konfirmasi total dan ongkir langsung ke pelanggan lewat percakapan atau WhatsApp, lalu ubah statusnya di sini.</p>
      {!detailsOn ? <p className="hint note">Rincian barang dan total belum aktif. Jalankan migrasi <b>pesanan_terstruktur.sql</b> di Supabase.</p> : null}
      <div className="chips" role="group" aria-label="Filter status pesanan">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} className={'btn sm' + (filter === k ? '' : ' ghost')} onClick={() => setFilter(k)}>
            {label + (counts[k] ? ' (' + counts[k] + ')' : '')}
          </button>
        ))}
      </div>
      {!rows && <SkConvRows rows={3} />}
      {rows && !shown.length && (
        <p className="hint note">{filter === 'semua' ? 'Belum ada pesanan. Pesanan muncul di sini saat pelanggan memesan lewat chat.' : 'Tidak ada pesanan dengan status ini.'}</p>
      )}
      <div className="rows">
        {shown.map((r) => {
          const st = STATUS[r.order_status] || ['', ''];
          const open = openId === r.id;
          const o = details[r.id];
          return (
            <div key={r.id} className="srow">
              <div className="srow-h">
                <div className="t">
                  <b>{(o && o.customer_name) || r.customer_name}</b>
                  <small>{dayTime(r.updated_at) + (CHANNEL[r.channel] ? ' · ' + CHANNEL[r.channel] : '')}</small>
                </div>
                <span className={'tag ' + st[1]}>{st[0]}</span>
              </div>
              {o ? <OrderInfo o={o} /> : null}
              <div className="row">
                {r.order_status === 'baru' && btn(r, 'diproses', 'Proses pesanan', 'Pesanan diproses.')}
                {r.order_status === 'diproses' && btn(r, 'selesai', 'Tandai selesai', 'Pesanan selesai.')}
                {(r.order_status === 'selesai' || r.order_status === 'batal') && btn(r, 'diproses', 'Buka lagi', 'Pesanan dibuka lagi.', true)}
                <button className="btn ghost sm" type="button" aria-expanded={open} onClick={() => setOpenId(open ? '' : r.id)}>{open ? 'Tutup rincian' : 'Lihat rincian'}</button>
                <Link className="btn ghost sm" href={'/dashboard?c=' + r.id}>Buka chat</Link>
                {(r.order_status === 'baru' || r.order_status === 'diproses') && (
                  <button className="btn danger sm" type="button" disabled={!!busy} onClick={() => cancel(r)}>Batalkan</button>
                )}
              </div>
              {open ? <div className="detail"><Detail sb={sb} id={r.id} fail={fail} /></div> : null}
            </div>
          );
        })}
      </div>
      {detailsOn ? (
        <div className="row" style={{ marginTop: 14, alignItems: 'center' }}>
          <select aria-label="Periode ekspor" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 'auto' }}>
            {PERIODS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <button className="btn ghost sm" type="button" disabled={exporting} onClick={exportCsv}>
            <Busy on={exporting} label="Menyiapkan...">Unduh CSV</Busy>
          </button>
          <span className="hint">Dibuka langsung di Excel atau Google Sheets.</span>
        </div>
      ) : null}
    </div>
  );
}
