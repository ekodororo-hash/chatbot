'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch } from './helpers';

// Spanduk pengingat masa langganan, cadangan untuk toko yang belum menghubungkan Telegram.
// Muncul 7 hari sebelum habis sampai 3 hari sesudahnya (sama dengan pengingat Telegram). Khusus pemilik toko.
const DAY = 86400000;
const fmt = (d) => d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });

export default function ExpiryBanner({ sb, shopId }) {
  const [st, setSt] = useState(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await authFetch(sb, shopId, '/api/billing'); if (alive) setSt(r); } catch (e) { /* spanduk bersifat tambahan: diam saja kalau gagal */ }
    })();
    return () => { alive = false; };
  }, [sb, shopId]);

  if (!st || closed) return null;
  const name = (id) => { const p = (st.plans || []).find((x) => x.id === id); return p ? p.name : id; };
  const now = Date.now();
  let msg = '';
  if (st.plan !== 'free' && st.expiresAt) {
    const left = new Date(st.expiresAt).getTime() - now;
    if (left > 0 && left <= 7 * DAY) {
      const days = Math.ceil(left / DAY);
      msg = 'Paket ' + name(st.plan) + ' berakhir ' + (days <= 1 ? 'dalam 1 hari' : days + ' hari lagi') + ' (' + fmt(new Date(st.expiresAt)) + '). Setelah itu toko memakai paket Gratis.';
    }
  } else if (st.endedAt) {
    const past = now - new Date(st.endedAt).getTime();
    if (past >= 0 && past <= 3 * DAY) msg = 'Paket ' + name(st.endedPlan) + ' sudah berakhir pada ' + fmt(new Date(st.endedAt)) + '. Toko sekarang memakai paket Gratis.';
  }
  if (!msg) return null;
  return (
    <div className="expiry" role="status">
      <span>{msg}</span>
      <Link className="btn sm" href="/dashboard/langganan">Perpanjang</Link>
      <button className="btn ghost sm" type="button" onClick={() => setClosed(true)}>Tutup</button>
    </div>
  );
}
