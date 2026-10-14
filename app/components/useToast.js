'use client';
import { useCallback, useRef, useState } from 'react';

// Pemakaian: const [toast, toastNode] = useToast();  lalu render {toastNode} sekali di halaman.
export function useToast() {
  const [msg, setMsg] = useState('');
  const [on, setOn] = useState(false);
  const timer = useRef(null);
  const toast = useCallback((m) => {
    setMsg(m);
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), 2600);
  }, []);
  const node = <div className={'toast' + (on ? ' on' : '')} role="status">{msg}</div>;
  return [toast, node];
}
