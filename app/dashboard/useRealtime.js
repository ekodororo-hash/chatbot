'use client';
import { useEffect, useRef } from 'react';

/* Memanggil onChange setiap ada perubahan di tabel (Supabase Realtime, dibatasi RLS).
   filter contoh: 'shop_id=eq.<id>'. Sebagai jaring pengaman (koneksi putus, event DELETE yang tidak bisa
   difilter) onChange juga dipanggil tiap fallbackMs dan saat tab kembali dibuka. */
export function useRealtime(sb, table, filter, onChange, fallbackMs) {
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; });

  useEffect(() => {
    if (!sb || !filter) return undefined;
    let timer = null;
    const fire = () => { clearTimeout(timer); timer = setTimeout(() => cb.current(), 250); };
    const name = 'rt:' + table + ':' + filter + ':' + Math.random().toString(36).slice(2, 8);
    const ch = sb.channel(name)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, fire)
      .subscribe();
    const poll = setInterval(() => { if (!document.hidden) cb.current(); }, fallbackMs || 60000);
    const vis = () => { if (!document.hidden) cb.current(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', vis);
      sb.removeChannel(ch);
    };
  }, [sb, table, filter, fallbackMs]);
}
