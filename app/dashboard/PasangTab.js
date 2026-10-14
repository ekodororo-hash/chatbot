'use client';
import { useState } from 'react';
import domains from '@/lib/domains';
import { Busy, useOrigin } from './helpers';

export default function PasangTab({ sb, shop, onShopChange, fail, toast }) {
  const origin = useOrigin();
  const [dom, setDom] = useState((shop.allowed_domains || []).join('\n'));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const link = origin + '/chat/' + shop.slug;
  const snippet = '<script src="' + origin + '/widget.js" data-bot="' + shop.slug +
    '" defer></' + 'script>';

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Disalin.'), () => toast('Tekan lama pada teks untuk menyalin.'));
    } else {
      toast('Tekan lama pada teks untuk menyalin.');
    }
  }

  async function saveDomains() {
    setErr('');
    const raw = dom.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const out = [], bad = [];
    raw.forEach((r) => {
      const n = domains.normalizeDomain(r);
      if (n) { if (!out.includes(n)) out.push(n); } else bad.push(r);
    });
    if (bad.length) { setErr('Domain tidak valid: ' + bad.join(', ')); return; }
    if (out.length > 20) { setErr('Maksimal 20 domain.'); return; }
    setBusy(true);
    const { error } = await sb.from('shops').update({ allowed_domains: out }).eq('id', shop.id);
    setBusy(false);
    if (error) return fail(error);
    onShopChange({ allowed_domains: out });
    setDom(out.join('\n'));
    toast('Domain disimpan.');
  }

  return (
    <>
      <section className="card pstep" aria-labelledby="ps1">
        <header className="pstep-h">
          <span className="pstep-no" aria-hidden="true">1</span>
          <div>
            <h2 id="ps1">Pasang di website</h2>
            <p className="hint">{'Tempel kode ini sebelum penutup </body> di website klien (WordPress, Shopify, Wix, atau HTML biasa). Warna, posisi, ikon, dan teks tombol diatur di halaman Asisten AI dan berubah otomatis, tidak perlu menempel ulang.'}</p>
          </div>
        </header>
        <div className="codebox">
          <div className="codebox-bar">
            <span>Kode widget</span>
            <button className="btn sm" type="button" onClick={() => copy(snippet)}>Salin kode</button>
          </div>
          <pre>{snippet}</pre>
        </div>
      </section>

      <section className="card pstep" aria-labelledby="ps2">
        <header className="pstep-h">
          <span className="pstep-no" aria-hidden="true">2</span>
          <div>
            <h2 id="ps2">Domain yang boleh memasang widget</h2>
            <p className="hint">Satu domain per baris. Browser hanya menampilkan chat di situs yang terdaftar, jadi orang lain tidak bisa menempelkan botmu di situs mereka. Subdomain ikut diizinkan.</p>
          </div>
        </header>
        <label className="sr" htmlFor="pd">Daftar domain</label>
        <textarea id="pd" className="mono" rows={4} placeholder={'tokoayu.com\nwww.tokoayu.com'} value={dom} onChange={(e) => setDom(e.target.value)} />
        <p className="hint pstep-note">Kosong berarti widget tidak bisa dipasang di situs mana pun. Maksimal 20 domain.</p>
        <div className="err" role="alert">{err}</div>
        <div className="row"><button className="btn" type="button" disabled={busy} onClick={saveDomains}><Busy on={busy} label="Menyimpan...">Simpan domain</Busy></button></div>
      </section>

      <section className="card pstep" aria-labelledby="ps3">
        <header className="pstep-h">
          <span className="pstep-no" aria-hidden="true">3</span>
          <div>
            <h2 id="ps3">Link chat</h2>
            <p className="hint">Untuk bio Instagram, Tokopedia, atau Shopee. Marketplace tidak bisa dipasangi widget, jadi taruh link ini di bio atau deskripsi toko.</p>
          </div>
        </header>
        <div className="linkbox">
          <code className="linkbox-url">{link}</code>
          <div className="linkbox-act">
            <button className="btn sm" type="button" onClick={() => copy(link)}>Salin link</button>
            <a className="btn ghost sm" href={link} target="_blank" rel="noopener">Buka</a>
          </div>
        </div>
      </section>
    </>
  );
}
