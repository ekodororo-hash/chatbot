'use client';
import { useCallback, useRef, useState } from 'react';

// Pesan yang bernada gagal/peringatan tampil merah, sisanya hijau. Bisa dipaksa lewat argumen kedua: toast('...', 'err').
const ERR = /gagal|harus|isi |tidak|error|valid/i;

// Pemakaian: const [toast, toastNode] = useToast();  lalu render {toastNode} sekali di halaman.
export function useToast() {
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState('ok');
  const [on, setOn] = useState(false);
  const timer = useRef(null);
  const toast = useCallback((m, k) => {
    setMsg(m);
    setKind(k || (ERR.test(m) ? 'err' : 'ok'));
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), 2600);
  }, []);
  const node = (
    <div className={'toast' + (on ? ' on' : '') + (kind === 'err' ? ' err' : '')} role="status" aria-live="polite">
      <i aria-hidden="true">
        <svg viewBox="0 0 24 24">{kind === 'err' ? <path d="M12 7v6m0 4h.01" /> : <path d="m5 12.5 4.5 4.5L19 7.5" />}</svg>
      </i>
      <span>{msg}</span>
    </div>
  );
  return [toast, node];
}
