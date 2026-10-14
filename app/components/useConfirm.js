'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Pengganti confirm() bawaan browser.
// Pemakaian: const [ask, confirmNode] = useConfirm();  render {confirmNode} sekali di komponen,
// lalu: if (!(await ask({ title: 'Hapus produk?', message: '...', okLabel: 'Hapus' }))) return;
export function useConfirm() {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);
  const cancelRef = useRef(null);

  const ask = useCallback((o) => new Promise((resolve) => {
    resolver.current = resolve;
    setOpts(o);
  }), []);

  const close = useCallback((v) => {
    if (resolver.current) resolver.current(v);
    resolver.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    if (!opts) return undefined;
    if (cancelRef.current) cancelRef.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [opts, close]);

  const node = opts ? (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-m">
        <h3 id="cf-t">{opts.title || 'Yakin?'}</h3>
        {opts.message ? <p id="cf-m">{opts.message}</p> : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost sm" type="button" ref={cancelRef} onClick={() => close(false)}>Batal</button>
          <button className="btn danger solid sm" type="button" onClick={() => close(true)}>{opts.okLabel || 'Hapus'}</button>
        </div>
      </div>
    </div>
  ) : null;

  return [ask, node];
}
