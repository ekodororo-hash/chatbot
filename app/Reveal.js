'use client';
// Anak-anaknya masuk satu per satu saat bagian ini terlihat di layar. Tanpa JS atau dengan "kurangi gerakan", semuanya langsung tampil.
import { useEffect, useRef, useState } from 'react';

export default function Reveal({ className = '', children }) {
  const ref = useRef(null);
  const [st, setSt] = useState('');   // '' = tampil biasa, 'arm' = siap animasi, 'in' = sudah masuk
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;   // sudah terlihat saat dibuka: tidak perlu animasi
    setSt('arm');
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { setSt('in'); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={'rv ' + st + ' ' + className}>{children}</div>;
}
