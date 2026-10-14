'use client';

// Kotak panduan yang bisa dibuka-tutup, dengan ikon informasi biru.
export function Panduan({ title, children }) {
  return (
    <details className="guide">
      <summary>
        <svg className="gi" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="M12 11v5M12 7.6h.01" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <span>{title}</span>
        <svg className="gc" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      <div className="guide-body">{children}</div>
    </details>
  );
}
