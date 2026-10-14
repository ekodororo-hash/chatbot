'use client';
/* Daftar pesanan: percakapan yang ditandai bot sebagai pesanan, dengan status
   baru -> diproses -> selesai (atau dibatalkan). Rincian pesanan (produk, jumlah, nama, alamat)
   ada di isi percakapan, jadi tiap pesanan bisa dibuka untuk melihat pesan terakhirnya. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SkConvRows } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import { Busy, dayTime } from './helpers';
import { useRealtime } from './useRealtime';

const CHANNEL = { web: 'Web', telegram: 'Telegram', whatsapp: 'WhatsApp' };
const STATUS = { baru: ['Baru', 'w'], diproses: ['Diproses', 'a'], selesai: ['Selesai', 'ok'], batal: ['Dibatalkan', ''] };
const FILTERS = [['baru', 'Baru'], ['diproses', 'Diproses'], ['selesai', 'Selesai'], ['batal', 'Dibatalkan'], ['semua', 'Semua']];
const ROLE = { customer: 'Pelanggan', bot: 'Asisten', admin: 'Admin' };

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
  const [filter, setFilter] = useState('baru');
  const [openId, setOpenId] = useState('');
  const [busy, setBusy] = useState('');
  const [ask, confirmNode] = useConfirm();

  const load = useCallback(async () => {
    const { data, error } = await sb.from('conversations')
      .select('id,customer_name,channel,order_status,updated_at')
      .eq('shop_id', shop.id).not('order_status', 'is', null)
      .order('updated_at', { ascending: false }).limit(200);
    if (error) { fail(error); setRows([]); return; }
    setRows(data || []);
  }, [sb, shop.id, fail]);

  useEffect(() => { load(); }, [load]);
  useRealtime(sb, 'conversations', 'shop_id=eq.' + shop.id, load, 60000);

  const counts = useMemo(() => {
    const c = { semua: 0 };
    (rows || []).forEach((r) => { c[r.order_status] = (c[r.order_status] || 0) + 1; c.semua++; });
    return c;
  }, [rows]);

  const shown = (rows || []).filter((r) => filter === 'semua' || r.order_status === filter);

  async function setStatus(r, next, msg) {
    setBusy(r.id + next);
    const { error } = await sb.from('conversations').update({ order_status: next }).eq('id', r.id);
    setBusy('');
    if (error) { fail(error); return; }
    setRows((list) => list.map((x) => (x.id === r.id ? { ...x, order_status: next } : x)));
    refreshBadges();
    toast(msg);
  }

  async function cancel(r) {
    const ok = await ask({ title: 'Batalkan pesanan?', message: 'Pesanan dari ' + r.customer_name + ' ditandai dibatalkan. Percakapannya tetap ada.', okLabel: 'Batalkan pesanan' });
    if (ok) setStatus(r, 'batal', 'Pesanan dibatalkan.');
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
      <p className="hint">Pesanan yang dicatat asisten dari chat. Konfirmasi total dan ongkir langsung ke pelanggan lewat percakapan, lalu ubah statusnya di sini.</p>
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
          return (
            <div key={r.id} className="srow">
              <div className="srow-h">
                <div className="t">
                  <b>{r.customer_name}</b>
                  <small>{dayTime(r.updated_at) + (CHANNEL[r.channel] ? ' · ' + CHANNEL[r.channel] : '')}</small>
                </div>
                <span className={'tag ' + st[1]}>{st[0]}</span>
              </div>
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
    </div>
  );
}
