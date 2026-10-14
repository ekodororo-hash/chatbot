'use client';
// Anak-anaknya masuk satu per satu saat bagian ini terlihat di layar.
// Awalnya disembunyikan dari server (class "arm") supaya tidak berkedip; tanpa JS, <noscript> di page.js menampilkannya.
import { useEffect, useRef, useState } from 'react';

export default function Reveal({ className = '', children }) {
  const ref = useRef(null);
  const [st, setSt] = useState('arm');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSt('in'); return; }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { setSt('in'); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={'rv ' + st + ' ' + className}>{children}</div>;
}
