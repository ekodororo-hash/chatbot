'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import domains from '@/lib/domains';
import widgetPaths from '@/lib/widgetPaths';
import Acc from '../components/Acc';
import qrLib from '@/lib/qr';
import { Busy, authFetch, useOrigin } from './helpers';

// Pratinjau situs klien di iframe, di bawah hasil cek. Dimuat langsung oleh browser pengguna (bukan lewat server),
// jadi tampilannya sama dengan saat dibuka biasa, termasuk tombol chat kalau widgetnya sudah terpasang.
// Sebagian situs melarang ditampilkan di iframe; itu dideteksi dari header di server (noFrame).
function SitePreview({ base, noFrame }) {
  const origin = useMemo(() => {
    try { const u = new URL(base); return /^https?:$/.test(u.protocol) ? u : null; } catch (e) { return null; }
  }, [base]);
  const [path, setPath] = useState('');
  const [src, setSrc] = useState('');
  const [device, setDevice] = useState('desktop');
  const [dim, setDim] = useState({ w: 0, h: 520 });
  const boxRef = useRef(null);
  // Lebar scrollbar bawaan browser ini. Iframe dibuat selebar itu lebih lebar dan kelebihannya dipotong kotak,
  // supaya lebar halaman yang dilihat situs pas (HP 393 px) tanpa scrollbar desktop yang menyempitkannya.
  const [sbw, setSbw] = useState(0);
  useEffect(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
    document.body.appendChild(d);
    setSbw(d.offsetWidth - d.clientWidth);
    document.body.removeChild(d);
  }, []);
  // Ukuran kotak dipantau supaya tampilan desktop (lebar 1280 px) bisa diperkecil pas dengan lebar kotak.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const read = () => setDim({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device, noFrame, origin]);
  useEffect(() => {
    if (!origin) return;
    setPath(origin.pathname + origin.search);
    setSrc(origin.href);
  }, [origin]);
  if (!origin) return null;
  const insecure = origin.protocol === 'http:';   // dashboard https, browser memblokir iframe http
  const DT_W = 1280;   // lebar virtual tampilan desktop
  const scale = device === 'desktop' && dim.w ? Math.min(1, dim.w / DT_W) : 1;
  const scaled = device === 'desktop' && scale < 1;
  function go(e) {
    e.preventDefault();
    let p = path.trim().replace(/^https?:\/\/[^/]+/i, '');
    if (!p) p = '/';
    if (p[0] !== '/') p = '/' + p;
    setPath(p);
    setSrc(origin.origin + p);
  }
  return (
    <div className="chkres sprev">
      <p className="chk-h">Pratinjau situs</p>
      <p className="hint">Isi halaman lain di bawah untuk menguji aturan tampil, misalnya /checkout: tombol chat seharusnya hilang di sana.</p>
      <form className="chk-form" onSubmit={go}>
        <label className="sr" htmlFor="pv">Halaman yang dilihat</label>
        <input id="pv" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="/checkout" value={path} onChange={(e) => setPath(e.target.value)} />
        <button className="btn ghost" type="submit">Buka</button>
      </form>
      {noFrame || insecure ? (
        <p className="hint chk-n">
          {insecure
            ? 'Situs ini memakai http (tanpa HTTPS), jadi browser memblokir tampilannya di sini.'
            : 'Situs ini melarang dirinya ditampilkan di dalam halaman lain, jadi pratinjau tidak bisa dibuka di sini.'}
          {' '}<a href={src || origin.href} target="_blank" rel="noopener noreferrer">Buka di tab baru</a>
        </p>
      ) : (
        <>
          <div className="seg" role="group" aria-label="Ukuran tampilan">
            <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>Desktop</button>
            <button type="button" aria-pressed={device === 'hp'} onClick={() => setDevice('hp')}>HP</button>
          </div>
          <div className={'sprev-box' + (device === 'hp' ? ' hp' : '')} ref={boxRef}>
            <iframe
              title="Pratinjau situs" src={src || origin.href} loading="lazy" referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={scaled ? { width: DT_W + sbw, height: dim.h / scale, transform: 'scale(' + scale + ')', transformOrigin: '0 0' } : { width: 'calc(100% + ' + sbw + 'px)', height: '100%' }}
            />
          </div>
          <p className="hint chk-n">Kotak kosong atau tampil error? Berarti situsnya menolak dibuka di sini. <a href={src || origin.href} target="_blank" rel="noopener noreferrer">Buka di tab baru</a></p>
        </>
      )}
    </div>
  );
}

// Tombol salin yang memberi tanda: tulisannya berubah jadi "Tersalin" beberapa detik.
function useCopy(toast) {
  const [done, setDone] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback((key, text) => {
    const ok = () => {
      setDone(key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(''), 2500);
    };
    const fallback = () => {
      // Cadangan untuk browser lama atau halaman tanpa HTTPS.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const good = document.execCommand('copy');
        document.body.removeChild(ta);
        if (good) return ok();
      } catch (e) { /* lanjut ke pesan di bawah */ }
      toast('Tekan lama pada teks untuk menyalin.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  }, [toast]);
  return [done, copy];
}

function CopyBtn({ id, done, onCopy, children }) {
  const on = done === id;
  return (
    <button className={'btn sm copy' + (on ? ' done' : '')} type="button" onClick={onCopy}>
      {on ? (
        <span><svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>Tersalin</span>
      ) : children}
    </button>
  );
}

function parseDomains(text) {
  const raw = text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const out = [], bad = [];
  raw.forEach((r) => {
    const n = domains.normalizeDomain(r);
    if (n) { if (!out.includes(n)) out.push(n); } else bad.push(r);
  });
  return { out, bad };
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BORDER = 4;

function Ico({ k }) {
  return (
    <span className="chk-i" aria-hidden="true">
      <svg viewBox="0 0 24 24">{k === 'ok' ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6 6 18" />}</svg>
    </span>
  );
}

export default function PasangTab({ sb, shop, onShopChange, fail, toast }) {
  const origin = useOrigin();
  const saved = shop.allowed_domains || [];
  const [dom, setDom] = useState(saved.join('\n'));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, copy] = useCopy(toast);

  const [plat, setPlat] = useState('wp');
  const [quick, setQuick] = useState('');
  const [quickErr, setQuickErr] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);

  const [site, setSite] = useState(saved[0] || '');
  const [checking, setChecking] = useState(false);
  const [cerr, setCerr] = useState('');
  const [res, setRes] = useState(null);
  const [adding, setAdding] = useState(false);

  // Aturan tampil per halaman (kolom ada setelah migrasi widget_halaman.sql).
  const pathsReady = Object.prototype.hasOwnProperty.call(shop, 'widget_paths_mode');
  const pSaved = {
    hide: shop.widget_hide_checkout !== false,
    mode: widgetPaths.countLines(shop.widget_paths) ? (shop.widget_paths_mode === 'only' ? 'only' : 'hide') : 'all',
    text: shop.widget_paths || ''
  };
  const [hideCo, setHideCo] = useState(pSaved.hide);
  const [pmode, setPmode] = useState(pSaved.mode);
  const [ptext, setPtext] = useState(pSaved.text);
  const [pbusy, setPbusy] = useState(false);
  const [perr, setPerr] = useState('');
  const pdirty = hideCo !== pSaved.hide || pmode !== pSaved.mode || ptext !== pSaved.text;

  const link = origin + '/chat/' + shop.slug;
  const snippet = '<script src="' + origin + '/widget.js" data-bot="' + shop.slug +
    '" defer></' + 'script>';
  const nextCode = "import Script from 'next/script';\n\n// di dalam <body> pada app/layout.js\n<Script\n  src=\"" + origin + '/widget.js"\n  data-bot="' + shop.slug + '"\n  strategy="afterInteractive"\n/>';

  const qr = useMemo(() => {
    if (!origin) return null;
    try { return qrLib.encode(link); } catch (e) { return null; }
  }, [origin, link]);

  async function persist(out) {
    setBusy(true);
    const { error } = await sb.from('shops').update({ allowed_domains: out }).eq('id', shop.id);
    setBusy(false);
    if (error) { fail(error); return false; }
    onShopChange({ allowed_domains: out });
    setDom(out.join('\n'));
    return true;
  }

  async function savePaths() {
    setPerr('');
    const list = widgetPaths.cleanPaths(ptext);
    if (pmode !== 'all') {
      const bad = widgetPaths.invalidLines(ptext);
      if (bad.length) { setPerr('Alamat halaman tidak valid: ' + bad[0].slice(0, 40) + '. Pakai huruf, angka, / - _ . dan *.'); return; }
      if (widgetPaths.countLines(ptext) > widgetPaths.MAX_PATHS) { setPerr('Alamat halaman maksimal ' + widgetPaths.MAX_PATHS + ' baris.'); return; }
      if (!list.length) { setPerr('Isi minimal satu alamat halaman, atau pilih "Tampil di semua halaman".'); return; }
    }
    const patch = {
      widget_hide_checkout: !!hideCo,
      widget_paths_mode: pmode === 'only' ? 'only' : 'hide',
      widget_paths: pmode === 'all' ? '' : list.join('\n')
    };
    setPbusy(true);
    const { error } = await sb.from('shops').update(patch).eq('id', shop.id);
    setPbusy(false);
    if (error) return fail(error);
    onShopChange(patch);
    setPtext(patch.widget_paths);
    toast('Aturan tampil disimpan. Berlaku di website paling lambat sekitar 1 menit.');
  }

  async function saveDomains() {
    setErr('');
    const { out, bad } = parseDomains(dom);
    if (bad.length) { setErr('Domain tidak valid: ' + bad.join(', ')); return; }
    if (out.length > 20) { setErr('Maksimal 20 domain.'); return; }
    if (await persist(out)) toast('Domain disimpan.');
  }

  // Tambah satu domain ke daftar (dipakai kotak peringatan dan hasil cek pemasangan).
  async function addDomain(raw) {
    const n = domains.normalizeDomain(raw);
    if (!n) return { ok: false, msg: 'Domain tidak valid. Contoh: tokoayu.com' };
    const draft = parseDomains(dom);
    const base = draft.bad.length ? saved : draft.out;
    if (base.includes(n)) return { ok: true };
    if (base.length >= 20) return { ok: false, msg: 'Maksimal 20 domain.' };
    const ok = await persist(base.concat(n));
    if (ok) toast('Domain ditambahkan.');
    return { ok, msg: '' };
  }

  async function quickAdd(e) {
    e.preventDefault();
    setQuickErr('');
    setQuickBusy(true);
    const r = await addDomain(quick);
    setQuickBusy(false);
    if (!r.ok) { if (r.msg) setQuickErr(r.msg); return; }
    setQuick('');
  }

  async function runCheck(e) {
    if (e) e.preventDefault();
    setCerr('');
    if (!site.trim()) { setCerr('Isi alamat situs dulu, misalnya tokoayu.com'); return; }
    setChecking(true);
    setRes(null);
    try {
      setRes(await authFetch(sb, shop.id, '/api/pasang/cek', 'POST', { url: site.trim() }));
    } catch (er) {
      setCerr(er.message);
    }
    setChecking(false);
  }

  async function addFromCheck() {
    if (!res || !res.domain) return;
    setAdding(true);
    const r = await addDomain(res.domain);
    setAdding(false);
    if (r.ok) setRes((p) => (p ? { ...p, domainOk: true } : p));
    else if (r.msg) setCerr(r.msg);
  }

  function downloadPng() {
    if (!qr) return;
    const total = qr.size + BORDER * 2;
    const scale = Math.max(8, Math.floor(1024 / total));
    const c = document.createElement('canvas');
    c.width = c.height = total * scale;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000';
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) ctx.fillRect((x + BORDER) * scale, (y + BORDER) * scale, scale, scale);
    }
    c.toBlob((b) => { if (b) { saveBlob(b, 'qr-chat-' + shop.slug + '.png'); toast('QR code diunduh.'); } }, 'image/png');
  }

  function downloadSvg() {
    if (!qr) return;
    saveBlob(new Blob([qrLib.toSvg(qr, BORDER)], { type: 'image/svg+xml' }), 'qr-chat-' + shop.slug + '.svg');
    toast('QR code diunduh.');
  }

  const code = (s) => <code className="ic">{s}</code>;
  const PLATFORMS = [
    {
      id: 'wp', name: 'WordPress', steps: [
        <>Pasang plugin header/footer, misalnya {code('WPCode')} atau {code('Insert Headers and Footers')}, lalu buka menu pengaturannya.</>,
        <>Tempel kode widget di kolom <b>Footer</b>, lalu simpan.</>,
        <>Kalau memakai plugin cache, kosongkan cache-nya, lalu muat ulang situs.</>
      ]
    },
    {
      id: 'shopify', name: 'Shopify', steps: [
        <>Buka {code('Online Store')} &gt; {code('Themes')}, klik titik tiga pada tema aktif, pilih {code('Edit code')}.</>,
        <>Buka file {code('layout/theme.liquid')}, tempel kode widget tepat sebelum {code('</body>')}.</>,
        <>Klik <b>Save</b>, lalu buka toko untuk memastikan tombol chat muncul.</>
      ]
    },
    {
      id: 'wix', name: 'Wix', steps: [
        <>Buka {code('Settings')} &gt; {code('Custom Code')} lalu klik {code('Add Custom Code')}.</>,
        <>Tempel kode widget, pilih <b>All pages</b>, dan taruh di <b>Body - end</b>.</>,
        <>Klik <b>Apply</b>, lalu publikasikan situs. Fitur ini biasanya butuh paket Wix berbayar dengan domain sendiri.</>
      ]
    },
    {
      id: 'html', name: 'HTML biasa', steps: [
        <>Buka file halaman (misalnya {code('index.html')}) di editor.</>,
        <>Tempel kode widget tepat sebelum {code('</body>')}. Kalau situs punya banyak halaman, tempel di template atau footer yang dipakai bersama.</>,
        <>Unggah ulang file ke hosting, lalu muat ulang situs.</>
      ]
    },
    {
      id: 'next', name: 'Next.js', steps: [
        <>Buka {code('app/layout.js')} (atau {code('pages/_app.js')} kalau memakai Pages Router).</>,
        <>Tambahkan komponen {code('<Script>')} di dalam {code('<body>')}, seperti kode di bawah.</>,
        <>Deploy ulang situsnya.</>
      ], code: nextCode
    }
  ];
  const cur = PLATFORMS.find((p) => p.id === plat) || PLATFORMS[0];

  function onTabKey(e) {
    const i = PLATFORMS.findIndex((p) => p.id === plat);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % PLATFORMS.length;
    else if (e.key === 'ArrowLeft') n = (i + PLATFORMS.length - 1) % PLATFORMS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = PLATFORMS.length - 1;
    if (n < 0) return;
    e.preventDefault();
    setPlat(PLATFORMS[n].id);
    const el = document.getElementById('ptab-' + PLATFORMS[n].id);
    if (el) el.focus();
  }

  const noDomain = saved.length === 0;
  const qsvg = qr ? qrLib.svgPath(qr, BORDER) : null;

  let head = null;
  if (res && res.fetched) {
    if (res.match && res.domainOk) head = { k: 'ok', t: 'Terpasang' };
    else if (res.match) head = { k: 'warn', t: 'Kode terpasang, tapi domain belum terdaftar' };
    else if (res.found) head = { k: 'bad', t: 'Kodenya untuk toko lain' };
    else head = { k: 'bad', t: 'Belum ketemu kodenya' };
  }
  return (
    <>
      <span className="sr" role="status">{done ? 'Tersalin ke papan klip.' : ''}</span>
      <section className="card pstep" aria-labelledby="ps1">
        <header className="pstep-h">
          <span className="pstep-no" aria-hidden="true">1</span>
          <div>
            <h2 id="ps1">Pasang di website</h2>
            <p className="hint">{'Tempel kode ini sebelum penutup </body> di website klien. Pilih platformnya di bawah untuk langkah yang lebih rinci. Warna, posisi, ikon, dan teks tombol diatur di halaman Asisten AI / Widget dan berubah otomatis, tidak perlu menempel ulang.'}</p>
          </div>
        </header>

        <div className="codebox">
          <div className="codebox-bar">
            <span>Kode widget</span>
            <CopyBtn id="snippet" done={done} onCopy={() => copy('snippet', snippet)}>Salin kode</CopyBtn>
          </div>
          <pre>{snippet}</pre>
        </div>

        <Acc title="Panduan per platform" hint="WordPress, Shopify, Wix, HTML biasa, Next.js">
        <div className="ptabs" role="tablist" aria-label="Platform website" onKeyDown={onTabKey}>
          {PLATFORMS.map((p) => (
            <button key={p.id} id={'ptab-' + p.id} type="button" role="tab" aria-selected={plat === p.id} aria-controls="ppanel"
              tabIndex={plat === p.id ? 0 : -1} onClick={() => setPlat(p.id)}>{p.name}</button>
          ))}
        </div>
        <div className="ppanel" id="ppanel" role="tabpanel" aria-labelledby={'ptab-' + cur.id}>
          <ol>{cur.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          {cur.code ? (
            <div className="codebox ppanel-code">
              <div className="codebox-bar">
                <span>Komponen Script</span>
                <CopyBtn id="next" done={done} onCopy={() => copy('next', cur.code)}>Salin kode</CopyBtn>
              </div>
              <pre>{cur.code}</pre>
            </div>
          ) : null}
        </div>
        </Acc>
      </section>

      <section className="card pstep" aria-labelledby="ps2">
        <header className="pstep-h">
          <span className="pstep-no" aria-hidden="true">2</span>
          <div>
            <h2 id="ps2">Domain yang boleh memasang widget</h2>
            <p className="hint">Satu domain per baris. Browser hanya menampilkan chat di situs yang terdaftar, jadi orang lain tidak bisa menempelkan botmu di situs mereka. Subdomain ikut diizinkan.</p>
          </div>
        </header>
        {noDomain ? (
          <div className="pwarn" role="alert">
            <span className="pwarn-i" aria-hidden="true">!</span>
            <div className="pwarn-b">
              <strong>Widget belum akan tampil karena belum ada domain terdaftar.</strong>
              <p className="hint">Kodenya tidak rusak. Browser hanya menampilkan chat di situs yang terdaftar, dan daftarnya masih kosong. Tambahkan alamat situs tempat kode ini ditempel.</p>
              <form className="pwarn-f" onSubmit={quickAdd}>
                <label className="sr" htmlFor="pq">Domain yang ditambahkan</label>
                <input id="pq" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="tokoayu.com" value={quick} onChange={(e) => { setQuick(e.target.value); setQuickErr(''); }} />
                <button className="btn" type="submit" disabled={quickBusy || busy}><Busy on={quickBusy} label="Menambah...">Tambah domain</Busy></button>
              </form>
              <div className="err" role="alert">{quickErr}</div>
            </div>
          </div>
        ) : null}

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
            <h2 id="ps3">Halaman tampil</h2>
            <p className="hint">Atur di halaman mana tombol chat boleh muncul. Berlaku di website paling lambat sekitar 1 menit, lalu bisa diuji di pratinjau pada langkah 4.</p>
          </div>
        </header>
        {pathsReady ? null : <p className="hint pstep-note">Belum aktif di database. Jalankan supabase/migrations/widget_halaman.sql di Supabase dulu.</p>}
        <label htmlFor="p0" className="swrow">
          <span className="swrow-t">
            <b>Sembunyikan di checkout dan pembayaran</b>
            <small>Tombol chat tidak menutupi tombol bayar. Dikenali otomatis dari alamat seperti /checkout, /cart, /keranjang, /pembayaran.</small>
          </span>
          <input id="p0" type="checkbox" disabled={!pathsReady} checked={hideCo} onChange={(e) => setHideCo(e.target.checked)} />
        </label>
        <div className="fgrid one" style={{ marginTop: 12 }}>
          <div>
            <label htmlFor="p1">Aturan tambahan</label>
            <select id="p1" disabled={!pathsReady} value={pmode} onChange={(e) => { setPmode(e.target.value); setPerr(''); }}>
              <option value="all">Tampil di semua halaman</option>
              <option value="hide">Sembunyikan di halaman tertentu</option>
              <option value="only">Tampil hanya di halaman tertentu</option>
            </select>
          </div>
          {pathsReady && pmode !== 'all' ? (
            <div>
              <label htmlFor="p2">Alamat halaman (satu per baris)</label>
              <textarea id="p2" className="mono" rows={4} spellCheck={false} value={ptext} onChange={(e) => { setPtext(e.target.value); setPerr(''); }} placeholder={'/akun/*\n/promo'} />
              <p className="hint field-hint">Tulis alamat setelah nama domain. Tanda * berarti "apa saja di bawahnya": /akun/* mencakup /akun dan semua halaman di dalamnya. Tanpa * hanya cocok persis. Maksimal 20 baris. Aturan checkout di atas tetap berlaku.</p>
            </div>
          ) : null}
        </div>
        <div className="err" role="alert">{perr}</div>
        <div className="row"><button className="btn" type="button" disabled={pbusy || !pdirty || !pathsReady} onClick={savePaths}><Busy on={pbusy} label="Menyimpan...">Simpan aturan</Busy></button></div>
      </section>

      <section className="card pstep" aria-labelledby="ps4">
        <header className="pstep-h">
          <span className="pstep-no" aria-hidden="true">4</span>
          <div>
            <h2 id="ps4">Cek pemasangan</h2>
            <p className="hint">Masukkan alamat situs tempat kode ditempel. Server akan membuka halamannya lalu memeriksa apakah kode widget sudah ada dan domainnya terdaftar.</p>
          </div>
        </header>
        <form className="chk-form" onSubmit={runCheck}>
          <label className="sr" htmlFor="pc">Alamat situs</label>
          <input id="pc" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="tokoayu.com" value={site} onChange={(e) => { setSite(e.target.value); setCerr(''); }} />
          <button className="btn" type="submit" disabled={checking}><Busy on={checking} label="Mengecek...">Cek pemasangan</Busy></button>
        </form>
        <div className="err" role="alert">{cerr}</div>

        <div aria-live="polite">
          {res && !res.fetched ? (
            <div className="chkres chk-warn">
              <p className="chk-h">Isi situs belum bisa dibaca</p>
              <p className="hint">{res.reason}</p>
              <p className="hint">{res.blocked
                ? 'Kalau tombol chat sudah muncul saat kamu membuka situsnya di browser, berarti widget sudah beres. Pengecekan otomatis memang tidak bisa menembus proteksi seperti ini.'
                : 'Kalau situsnya bisa kamu buka di browser, coba lihat langsung apakah tombol chat muncul.'}</p>
              {res.domain ? (
                <ul className="chk">
                  <li className={res.domainOk ? 'chk-ok' : 'chk-bad'}>
                    <Ico k={res.domainOk ? 'ok' : 'bad'} />
                    <div>
                      {res.domainOk ? <>Domain {code(res.domain)} sudah terdaftar.</> : <>Domain {code(res.domain)} belum terdaftar, jadi chat tidak akan tampil di sana.</>}
                      {!res.domainOk ? (
                        <div className="row chk-act">
                          <button className="btn sm" type="button" disabled={adding || busy} onClick={addFromCheck}><Busy on={adding} label="Menambah...">{'Daftarkan ' + res.domain}</Busy></button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                </ul>
              ) : null}
            </div>
          ) : null}

          {head ? (
            <div className={'chkres chk-' + head.k}>
              <p className="chk-h">{head.t}</p>
              <ul className="chk">
                <li className={res.match ? 'chk-ok' : 'chk-bad'}>
                  <Ico k={res.match ? 'ok' : 'bad'} />
                  <div>
                    {res.match ? 'Kode widget ketemu di halaman ini.' : null}
                    {!res.match && res.found ? <>Kode widget ketemu, tapi untuk toko lain ({res.others.join(', ') || 'kode berbeda'}). Ganti dengan kode dari langkah 1.</> : null}
                    {!res.found ? 'Kode widget tidak ketemu di halaman ini.' : null}
                  </div>
                </li>
                <li className={res.domainOk ? 'chk-ok' : 'chk-bad'}>
                  <Ico k={res.domainOk ? 'ok' : 'bad'} />
                  <div>
                    {res.domainOk ? <>Domain {code(res.domain)} sudah terdaftar.</> : <>Domain {code(res.domain)} belum terdaftar, jadi chat tidak akan tampil di sana.</>}
                    {!res.domainOk ? (
                      <div className="row chk-act">
                        <button className="btn sm" type="button" disabled={adding || busy} onClick={addFromCheck}><Busy on={adding} label="Menambah...">{'Daftarkan ' + res.domain}</Busy></button>
                      </div>
                    ) : null}
                  </div>
                </li>
              </ul>
              {!res.found ? (
                <ul className="chk-tips hint">
                  <li>{'Pastikan kode ditempel sebelum </body>, dan perubahannya sudah disimpan atau dipublikasikan.'}</li>
                  <li>Kosongkan cache (plugin cache atau CDN), lalu cek lagi.</li>
                  <li>Kalau kode dipasang lewat Google Tag Manager, pengecekan ini tidak bisa melihatnya. Buka situsnya di browser: kalau tombol chat muncul, berarti sudah beres.</li>
                </ul>
              ) : null}
              {res.redirected ? <p className="hint chk-n">{'Alamat dialihkan ke ' + res.redirected + '. Itulah yang dicek.'}</p> : null}
              {res.certWarn ? <p className="hint chk-n">Sertifikat HTTPS situs ini bermasalah (misalnya rantai sertifikat tidak lengkap atau sudah kedaluwarsa). Halamannya tetap terbaca, tapi sebagian browser atau HP bisa menampilkan peringatan keamanan ke pengunjung. Minta penyedia hosting memperbaiki atau memasang ulang SSL-nya.</p> : null}
              {res.truncated ? <p className="hint chk-n">Halamannya sangat besar, jadi hanya sebagian yang dibaca.</p> : null}
              <p className="hint chk-n">Hanya halaman yang kamu masukkan yang diperiksa. Kode di halaman lain bisa dicek dengan alamat halaman itu.</p>
            </div>
          ) : null}
        </div>
        {res && res.url ? <SitePreview base={res.url} noFrame={!!res.noFrame} /> : null}
      </section>

      <section className="card pstep" aria-labelledby="ps5">
        <header className="pstep-h">
          <span className="pstep-no" aria-hidden="true">5</span>
          <div>
            <h2 id="ps5">Link chat</h2>
            <p className="hint">Untuk bio Instagram, Tokopedia, atau Shopee. Marketplace tidak bisa dipasangi widget, jadi taruh link ini di bio atau deskripsi toko.</p>
          </div>
        </header>
        <div className="linkbox">
          <code className="linkbox-url">{link}</code>
          <div className="linkbox-act">
            <CopyBtn id="link" done={done} onCopy={() => copy('link', link)}>Salin link</CopyBtn>
            <a className="btn ghost sm" href={link} target="_blank" rel="noopener">Buka</a>
          </div>
        </div>

        {qr ? (
          <Acc title="QR code" hint="Untuk dicetak di etalase atau kemasan">
          <div className="qrbox">
            <div className="qrimg">
              <svg viewBox={'0 0 ' + qsvg.total + ' ' + qsvg.total} role="img" aria-label="QR code untuk link chat" shapeRendering="crispEdges">
                <path d={qsvg.d} fill="#000" />
              </svg>
            </div>
            <div className="qrinfo">
              <p className="hint">Untuk dicetak di etalase, kemasan, atau kartu nama. Pelanggan cukup memindai dengan kamera HP untuk langsung membuka chat. Cetak minimal sekitar 2,5 cm dan coba pindai dulu sebelum mencetak banyak.</p>
              <div className="row">
                <button className="btn sm" type="button" onClick={downloadPng}>Unduh PNG</button>
                <button className="btn ghost sm" type="button" onClick={downloadSvg}>Unduh SVG</button>
              </div>
            </div>
          </div>
          </Acc>
        ) : null}
      </section>
    </>
  );
}
