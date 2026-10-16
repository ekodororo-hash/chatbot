'use client';
/* Kontak pengunjung yang bersedia dikabari soal promo (diisi dari kartu tawaran di chat).
   Pemilik dan admin bisa menyalin, menghubungi lewat WhatsApp, mengunduh CSV, atau menghapus kontak. */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SkConvRows } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import leadLib from '@/lib/leads';
import { Busy, dayTime } from './helpers';

export default function KontakTab({ sb, shop, fail, toast }) {
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [removing, setRemoving] = useState('');
  const [ask, confirmNode] = useConfirm();

  const load = useCallback(async () => {
    const { data, error } = await sb.from('leads').select('id,kind,contact,conversation_id,created_at')
      .eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(2000);
    if (error) {
      // Tabel belum ada = migrasi rating_dan_kontak.sql belum dijalankan.
      if (error.code === '42P01' || error.code === 'PGRST205') { setMissing(true); setRows([]); return; }
      fail(error); return;
    }
    const list = data || [];
    // Konteks tiap kontak: pesan pelanggan di percakapan itu sampai kontak ditinggalkan (maksimal 3 terakhir).
    // Gagal membaca pesan tidak mengganggu daftar kontak, hanya tanpa keterangan.
    try {
      const ids = Array.from(new Set(list.map((r) => r.conversation_id).filter(Boolean)));
      if (ids.length) {
        const m = await sb.from('messages').select('conversation_id,content,created_at')
          .in('conversation_id', ids).eq('role', 'customer').order('created_at', { ascending: true }).limit(5000);
        if (m.error) throw m.error;
        const by = {};
        (m.data || []).forEach((x) => { (by[x.conversation_id] = by[x.conversation_id] || []).push(x); });
        list.forEach((r) => {
          const msgs = (by[r.conversation_id] || []).filter((x) => x.created_at <= r.created_at).slice(-3);
          r.topic = msgs.map((x) => { const t = String(x.content || '').replace(/\s+/g, ' ').trim(); return t.length > 80 ? t.slice(0, 80) + '...' : t; }).filter(Boolean).join(' · ');
        });
      }
    } catch (e) { /* abaikan: kontak tetap tampil */ }
    setRows(list);
  }, [sb, shop.id, fail]);

  useEffect(() => { load(); }, [load]);

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Disalin.'); } catch (e) { toast('Gagal menyalin. Salin manual: ' + text); }
  }

  async function remove(r) {
    const ok = await ask({ title: 'Hapus kontak?', message: leadLib.formatContact(r.kind, r.contact) + ' akan dihapus permanen dari daftar. Pakai ini juga kalau pelanggan minta berhenti dikabari.' });
    if (!ok) return;
    setRemoving(r.id);
    const { data, error } = await sb.from('leads').delete().eq('id', r.id).select('id');
    setRemoving('');
    if (error) { fail(error); return; }
    if (!data || !data.length) { toast('Gagal menghapus.'); return; }
    setRows((list) => list.filter((x) => x.id !== r.id));
    toast('Kontak dihapus.');
  }

  function download() {
    const blob = new Blob(['\ufeff' + leadLib.toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'kontak-' + shop.slug + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const on = shop.lead_on === true;

  return (
    <>
      {confirmNode}
      <div className="card">
        <div className="chead">
          <div>
            <h2>{'Kontak pelanggan' + (rows && rows.length ? ' (' + rows.length + ')' : '')}</h2>
            <p className="hint">Nomor WhatsApp atau email pengunjung yang mau dikabari kalau ada promo atau produk yang dicari tersedia. Mereka mengisinya sendiri lewat kartu tawaran di chat.</p>
          </div>
          {rows && rows.length ? <button className="btn ghost sm" type="button" onClick={download}>Unduh CSV</button> : null}
        </div>
        {missing ? (
          <p className="hint note">Fitur ini belum aktif di database. Jalankan <b>supabase/migrations/rating_dan_kontak.sql</b> di Supabase SQL Editor, lalu muat ulang halaman ini.</p>
        ) : !on ? (
          <p className="hint note">Tawaran kontak sedang <b>mati</b>, jadi chat tidak meminta nomor atau email. Nyalakan di <Link href="/dashboard/bot">Asisten AI / Widget</Link> (bagian Perilaku bot).</p>
        ) : null}
        {!rows && <SkConvRows rows={3} />}
        {rows && !rows.length && !missing && <p className="hint">Belum ada kontak. Kartu tawaran muncul sekali per percakapan, setelah pengunjung bertanya beberapa kali tanpa memesan.</p>}
        <div className="rows">
          {(rows || []).map((r) => {
            const label = leadLib.formatContact(r.kind, r.contact);
            const wa = leadLib.waLink(r.kind, r.contact);
            return (
              <div key={r.id} className="srow">
                <div className="t stack">
                  <b style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{label}</b>
                  <small>{(r.kind === 'email' ? 'Email' : 'Telepon') + ' · ' + dayTime(r.created_at)}</small>
                  {r.topic ? <small style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{'Bertanya: ' + r.topic}</small> : null}
                </div>
                <div className="row">
                  <button className="btn ghost sm" type="button" onClick={() => copy(r.kind === 'email' ? r.contact : '+' + r.contact)}>Salin</button>
                  {wa ? <a className="btn ghost sm" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}
                  {r.conversation_id ? <Link className="btn ghost sm" href={'/dashboard?c=' + r.conversation_id}>Buka chat</Link> : null}
                  <button className="btn danger sm" type="button" disabled={removing === r.id} onClick={() => remove(r)}>
                    <Busy on={removing === r.id} label="Menghapus...">Hapus</Busy>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="hint">Hanya hubungi kontak ini soal promo toko, sesuai yang ditawarkan di chat. Kalau pelanggan minta berhenti, hapus kontaknya di sini.</p>
      </div>
    </>
  );
}
