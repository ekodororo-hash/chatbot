import { useEffect, useState } from 'react';

export const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : NaN; };
export const rp = (n) => 'Rp' + Math.round(Number(n)).toLocaleString('id-ID');
export const hhmm = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
export const dayTime = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', ':');

// Awal hari menurut WIB (UTC+7), dipakai untuk menghitung balasan bot hari ini.
export function startOfTodayWIB() {
  const w = new Date(Date.now() + 7 * 3600000);
  w.setUTCHours(0, 0, 0, 0);
  return new Date(w.getTime() - 7 * 3600000);
}

// Alamat situs ini (https://domainmu). Kosong sampai komponen tampil di browser.
export function useOrigin() {
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  return origin;
}

export function Field({ id, label, children }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {children}
    </>
  );
}
