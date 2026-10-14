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

// Isi tombol saat proses berjalan: teks tetap di tempatnya (disembunyikan) dan spinner muncul di tengahnya,
// jadi ukuran tombol tidak berubah. <Busy on={busy} label="Menyimpan...">Simpan</Busy>
export function Busy({ on, label, children }) {
  return (
    <span className={'busy' + (on ? ' on' : '')}>
      <span className="busy-t">{children}</span>
      {on ? <span className="spin" aria-hidden="true" /> : null}
      {on && label ? <span className="sr" role="status">{label}</span> : null}
    </span>
  );
}

// Jumlah data terakhir yang dilihat, dipakai agar skeleton sepanjang isi aslinya.
export function readCount(key) {
  try {
    const v = window.localStorage.getItem('cnt:' + key);
    const n = v === null ? NaN : parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch (e) { return null; }
}
export function saveCount(key, n) {
  try { window.localStorage.setItem('cnt:' + key, String(n)); } catch (e) { /* abaikan */ }
}
