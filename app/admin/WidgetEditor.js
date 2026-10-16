'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Busy, toInt } from '../dashboard/helpers';
import { SVG_ICONS, iconPaths } from '@/lib/widgetIcons';

// Ikon di tombol: SVG bawaan ("svg:nama") atau emoji/huruf biasa. Warna SVG mengikuti warna teks.
function IconView({ icon, size }) {
  const paths = iconPaths(icon);
  if (!paths) return <>{icon}</>;
  return (
    <svg width={size || '1em'} height={size || '1em'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

const DEFAULT_ICON = '\uD83D\uDCAC';
const SIZE_PX = { kecil: 48, sedang: 58, besar: 70 };
const ICONS = [DEFAULT_ICON, '\uD83D\uDECD\uFE0F', '\uD83D\uDED2', '\uD83E\uDD16', '\uD83D\uDC4B', '\u2753', '\uD83D\uDCDE'];
const WIDGET_DEFAULTS = {
  accent: '#0b7a75', widget_pos: 'right', widget_icon: DEFAULT_ICON, widget_label: '',
  widget_teaser: '', widget_size: 'sedang', widget_shape: 'bulat', widget_bubble: 'bulat', widget_logo: '', widget_ox: '20', widget_oy: '20',
  widget_delay: '0', widget_animate: true
};
const DAYS = [['1', 'Sen'], ['2', 'Sel'], ['3', 'Rab'], ['4', 'Kam'], ['5', 'Jum'], ['6', 'Sab'], ['0', 'Min']];
const LOGO_MAX = 55000;
const QUICK_DEFAULT = ['Tanya produk', 'Cek status pesanan', 'Bicara dengan admin'];
const QUICK_MAX = 5;
const QUICK_LEN = 40;

// Isi kolom pilihan cepat: selalu 5 kotak (yang kosong tidak ditampilkan di chat).
function quickSlots(v) {
  const base = Array.isArray(v) ? v.slice(0, QUICK_MAX) : QUICK_DEFAULT.slice();
  while (base.length < QUICK_MAX) base.push('');
  return base;
}

// Bersihkan isian: buang yang kosong dan kembar, maksimal 5.
function quickClean(list) {
  const out = [];
  list.forEach((x) => {
    const t = String(x || '').replace(/\s+/g, ' ').trim().slice(0, QUICK_LEN);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase()) && out.length < QUICK_MAX) out.push(t);
  });
  return out;
}


function fileToLogo(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error('Pakai gambar PNG, JPG, WEBP, atau GIF.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const m = Math.min(img.width, img.height);
      if (!m) return reject(new Error('Gambar tidak bisa dibaca.'));
      for (const size of [128, 96, 64]) {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
        let out = c.toDataURL('image/webp', 0.85);
        if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/png');
        if (out.length <= LOGO_MAX) return resolve(out);
      }
      reject(new Error('Gambar terlalu rumit. Coba logo yang lebih sederhana.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak bisa dibaca.')); };
    img.src = url;
  });
}

function daysOf(v) {
  return String(v == null ? '1,2,3,4,5,6' : v).split(',').filter((d) => /^[0-6]$/.test(d));
}

function fromShop(shop) {
  return {
    accent: shop.accent,
    widget_pos: shop.widget_pos || 'right', widget_icon: shop.widget_icon || DEFAULT_ICON,
    widget_label: shop.widget_label || '', widget_teaser: shop.widget_teaser || '',
    widget_size: shop.widget_size || 'sedang', widget_shape: shop.widget_shape || 'bulat',
    widget_logo: shop.widget_logo || '', widget_bubble: shop.widget_bubble || 'bulat',
    widget_ox: String(shop.widget_ox == null ? 20 : shop.widget_ox), widget_oy: String(shop.widget_oy == null ? 20 : shop.widget_oy),
    widget_delay: String(shop.widget_delay == null ? 0 : shop.widget_delay), widget_animate: shop.widget_animate !== false,
    hours_on: shop.hours_on === true, hours_open: shop.hours_open || '09:00', hours_close: shop.hours_close || '17:00',
    hours_days: daysOf(shop.hours_days), hours_tz: shop.hours_tz || 'Asia/Jakarta',
    reply_eta: String(shop.reply_eta || 0)
  };
}

// Pratinjau jendela chat: halaman chat asli (mode pratinjau) yang menerima pengaturan yang belum disimpan.
function ChatWindowPreview({ f, shop }) {
  const slug = shop.slug;
  const quickOn = shop.quick_on !== false;
  const quickItems = quickClean(quickSlots(shop.quick_replies));
  const ref = useRef(null);
  const loaded = useRef(false);
  const cfg = JSON.stringify({
    botName: String(shop.bot_name || '').trim() || 'Asisten',
    greeting: String(shop.greeting || '').trim() || 'Halo {k}, ada yang bisa dibantu?',
    tone: shop.tone,
    accent: /^#[0-9a-fA-F]{6}$/.test(f.accent) ? f.accent : WIDGET_DEFAULTS.accent,
    icon: f.widget_icon.trim() || DEFAULT_ICON,
    svg: iconPaths(f.widget_icon.trim()),
    logo: f.widget_logo,
    bubble: f.widget_bubble,
    hours: { on: f.hours_on, open: f.hours_open, close: f.hours_close, days: f.hours_days.map(Number), tz: f.hours_tz },
    eta: toInt(f.reply_eta) || 0,
    quick: { on: quickOn, items: quickItems }
  });
  const send = useCallback(() => {
    const w = ref.current && ref.current.contentWindow;
    if (w && loaded.current) w.postMessage({ type: 'isengin-preview', cfg: JSON.parse(cfg) }, window.location.origin);
  }, [cfg]);
  useEffect(() => { send(); }, [send]);
  return (
    <iframe
      ref={ref} className="preview" title="Pratinjau jendela chat" src={'/chat/' + slug + '?preview=1'}
      style={{ height: 520, display: 'block' }}
      onLoad={() => { loaded.current = true; send(); }}
    />
  );
}

// Pratinjau tombol chat seperti yang tampil di website klien.
function WidgetPreview({ f }) {
  const px = SIZE_PX[f.widget_size] || 58;
  const hex = /^#[0-9a-fA-F]{6}$/.test(f.accent) ? f.accent : WIDGET_DEFAULTS.accent;
  const lum = (0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16)) / 255;
  const side = f.widget_pos === 'left' ? 'left' : 'right';
  const label = f.widget_label.trim();
  const teaser = f.widget_teaser.trim();
  const ox = Math.min(Math.max(toInt(f.widget_ox) || 0, 0), 200), oy = Math.min(Math.max(toInt(f.widget_oy) || 0, 0), 200);
  return (
    <div aria-hidden="true" style={{ position: 'relative', height: Math.max(120, Math.min(oy, 80) + px + 40 + (teaser ? 52 : 0)), border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg)', overflow: 'hidden' }}>
      <small style={{ position: 'absolute', top: 8, left: 12, color: 'var(--mute)' }}>Pratinjau di website</small>
      {teaser ? (
        <div style={{ position: 'absolute', [side]: Math.min(ox, 120), bottom: Math.min(oy, 80) + px + 12, maxWidth: '70%', background: '#fff', color: '#12262b', borderRadius: 14, padding: '8px 12px', fontSize: 13, boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}>{teaser}</div>
      ) : null}
      <div style={{
        position: 'absolute', [side]: Math.min(ox, 120), bottom: Math.min(oy, 80), height: px, minWidth: px, padding: label ? '0 18px' : 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: hex,
        color: lum > 0.62 ? '#111' : '#fff', fontSize: Math.round(px * 0.45),
        borderRadius: f.widget_shape === 'kotak' ? 16 : (f.widget_shape === 'lancip' ? 0 : (label ? 999 : '50%')), boxShadow: '0 4px 14px rgba(0,0,0,.25)'
      }}>
        <span style={{ display: 'flex' }}><IconView icon={f.widget_icon || DEFAULT_ICON} /></span>
        {label ? <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span> : null}
      </div>
    </div>
  );
}


/* Editor tampilan widget untuk admin layanan (/admin/widget). `shop` = pengaturan toko dari server,
   `onSave(patch)` mengembalikan pesan galat (string) atau '' kalau berhasil. */
export default function WidgetEditor({ shop, onSave, toast }) {
  const [f, setF] = useState(() => fromShop(shop));
  const [saved, setSaved] = useState(() => fromShop(shop));
  const [busy, setBusy] = useState(false);
  const [iconPicker, setIconPicker] = useState(false);
  const iconPickRef = useRef(null);
  useEffect(() => {
    if (!iconPicker) return undefined;
    const close = (ev) => { if (iconPickRef.current && !iconPickRef.current.contains(ev.target)) setIconPicker(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [iconPicker]);
  const [previewTab, setPreviewTab] = useState('chat');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function pickLogo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const logo = await fileToLogo(file);
      setF((p) => ({ ...p, widget_logo: logo }));
    } catch (err) {
      toast(err.message || 'Logo gagal dibaca.');
    }
  }
  const toggleDay = (d) => setF((p) => ({ ...p, hours_days: p.hours_days.includes(d) ? p.hours_days.filter((x) => x !== d) : p.hours_days.concat(d) }));
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  async function save() {
    const icon = f.widget_icon.trim();
    if (!icon || (!iconPaths(icon) && Array.from(icon).length > 8)) return toast('Ikon tombol: pilih ikon dari daftar, atau 1 sampai 8 karakter (boleh emoji).');
    const ox = toInt(f.widget_ox), oy = toInt(f.widget_oy), eta = toInt(f.reply_eta), delay = toInt(f.widget_delay);
    if (!(ox >= 0 && ox <= 200 && oy >= 0 && oy <= 200)) return toast('Jarak tombol dari tepi: 0 sampai 200 px.');
    if (!(eta >= 0 && eta <= 1440)) return toast('Estimasi balasan admin: 0 sampai 1440 menit.');
    if (!(delay >= 0 && delay <= 30)) return toast('Tunda tampil tombol: 0 sampai 30 detik.');
    if (f.hours_on && !f.hours_days.length) return toast('Pilih minimal satu hari operasional.');
    if (f.hours_on && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(f.hours_open + '')) return toast('Isi jam buka.');
    if (f.hours_on && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(f.hours_close + '')) return toast('Isi jam tutup.');
    setBusy(true);
    const patch = {
      accent: f.accent,
      widget_pos: f.widget_pos, widget_icon: icon, widget_label: f.widget_label.trim(),
      widget_teaser: f.widget_teaser.trim(), widget_size: f.widget_size, widget_shape: f.widget_shape,
      widget_logo: f.widget_logo, widget_bubble: f.widget_bubble, widget_ox: ox, widget_oy: oy,
      widget_delay: delay, widget_animate: !!f.widget_animate,
      hours_on: f.hours_on, hours_open: f.hours_open || '09:00', hours_close: f.hours_close || '17:00',
      hours_days: f.hours_days.slice().sort().join(','), hours_tz: f.hours_tz, reply_eta: eta
    };
    const err = await onSave(patch);
    setBusy(false);
    if (err) return toast(err);
    const next = fromShop(patch);
    setF(next);
    setSaved(next);
    toast('Tampilan widget disimpan. Berlaku di situs dalam sekitar 1 menit.');
  }

  return (
    <>
      <section className="card wsec" aria-labelledby="bw">
        <div className="chead">
          <div>
            <h2 id="bw">Tampilan widget</h2>
            <p className="hint">Berlaku di website klien tanpa perlu menempel ulang kode, paling lambat sekitar 1 menit. Pratinjau di kanan ikut berubah sebelum kamu menyimpan.</p>
          </div>
          <button className="btn ghost sm" type="button" onClick={() => setF((p) => ({ ...p, ...WIDGET_DEFAULTS }))}>Kembalikan bawaan</button>
        </div>
        <div className="wcols">
          <div className="wform">
            <h3 className="subh">Tombol chat</h3>
            <div className="fgrid">
              <div>
                <label htmlFor="b6">Warna</label>
                <div className="colorrow">
                  <input id="b6" type="color" value={f.accent} onChange={set('accent')} />
                  <code className="code">{f.accent}</code>
                </div>
              </div>
              <div>
                <label htmlFor="w1">Posisi</label>
                <select id="w1" value={f.widget_pos} onChange={set('widget_pos')}>
                  <option value="right">Kanan bawah</option>
                  <option value="left">Kiri bawah</option>
                </select>
              </div>
              <div>
                <label htmlFor="w2">Ukuran</label>
                <select id="w2" value={f.widget_size} onChange={set('widget_size')}>
                  <option value="kecil">Kecil</option>
                  <option value="sedang">Sedang</option>
                  <option value="besar">Besar</option>
                </select>
              </div>
              <div>
                <label htmlFor="w3">Bentuk</label>
                <select id="w3" value={f.widget_shape} onChange={set('widget_shape')}>
                  <option value="bulat">Bulat</option>
                  <option value="kotak">Kotak membulat</option>
                  <option value="lancip">Lancip kotak (semua sudut siku)</option>
                </select>
              </div>
              <div>
                <label htmlFor="w7">Jarak dari tepi samping (px)</label>
                <input id="w7" type="number" inputMode="numeric" min="0" max="200" value={f.widget_ox} onChange={set('widget_ox')} />
              </div>
              <div>
                <label htmlFor="w8">Jarak dari tepi bawah (px)</label>
                <input id="w8" type="number" inputMode="numeric" min="0" max="200" value={f.widget_oy} onChange={set('widget_oy')} />
              </div>
            </div>
            <p className="hint field-hint">Naikkan jarak kalau di pojok yang sama sudah ada tombol WhatsApp, banner cookie, atau widget lain.</p>

            <div className="fgrid" style={{ marginTop: 12 }}>
              <div>
                <label htmlFor="w11">Tunda tampil (detik)</label>
                <input id="w11" type="number" inputMode="numeric" min="0" max="30" value={f.widget_delay} onChange={set('widget_delay')} />
                <p className="hint field-hint">0 = langsung muncul begitu halaman terbuka. Isi 3–5 detik supaya tombol baru muncul setelah pengunjung sempat melihat halaman dulu.</p>
              </div>
              <div>
                <label htmlFor="w12" className="swrow" style={{ padding: 0, border: 0 }}>
                  <span className="swrow-t">
                    <b>Animasi saat muncul</b>
                    <small>Tombol sedikit membesar lalu kembali normal sekali saat pertama tampil, untuk menarik perhatian.</small>
                  </span>
                  <input id="w12" type="checkbox" checked={f.widget_animate} onChange={(e) => setF((p) => ({ ...p, widget_animate: e.target.checked }))} />
                </label>
              </div>
            </div>

            <h3 className="subh">Isi tombol</h3>
            <div className="fgrid">
              <div className="iconpick" ref={iconPickRef}>
                <label htmlFor="w4">Ikon tombol</label>
                <button
                  id="w4" type="button" className="iconpick-btn" aria-haspopup="listbox" aria-expanded={iconPicker} aria-controls="w4pop"
                  aria-label="Pilih ikon tombol" onClick={() => setIconPicker((v) => !v)}
                >
                  <IconView icon={f.widget_icon.trim() || DEFAULT_ICON} size={24} />
                  <span className="iconpick-chev" aria-hidden="true">{'\u25BE'}</span>
                </button>
                {iconPicker ? (
                  <div className="iconpick-pop" id="w4pop" role="listbox" aria-label="Pilihan ikon">
                    {ICONS.map((e) => (
                      <button
                        key={e} type="button" role="option" aria-selected={f.widget_icon === e}
                        className={'iconpick-i' + (f.widget_icon === e ? ' on' : '')}
                        onClick={() => { setF((p) => ({ ...p, widget_icon: e })); setIconPicker(false); }}
                      >
                        {e}
                      </button>
                    ))}
                    {Object.keys(SVG_ICONS).map((k) => {
                      const v = 'svg:' + k;
                      return (
                        <button
                          key={v} type="button" role="option" aria-selected={f.widget_icon === v} aria-label={SVG_ICONS[k].label} title={SVG_ICONS[k].label}
                          className={'iconpick-i' + (f.widget_icon === v ? ' on' : '')}
                          onClick={() => { setF((p) => ({ ...p, widget_icon: v })); setIconPicker(false); }}
                        >
                          <IconView icon={v} size={20} />
                        </button>
                      );
                    })}
                    <input
                      className="iconpick-own" maxLength={16} autoComplete="off" placeholder="Atau ketik emoji/huruf"
                      aria-label="Ketik emoji atau huruf sendiri"
                      value={iconPaths(f.widget_icon.trim()) ? '' : f.widget_icon}
                      onChange={set('widget_icon')}
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <label htmlFor="w5">Teks di samping ikon (opsional)</label>
                <input id="w5" maxLength={30} placeholder="Tanya kami" value={f.widget_label} onChange={set('widget_label')} />
              </div>
            </div>
            <div className="fgrid one" style={{ marginTop: 12 }}>
              <div>
                <label htmlFor="w6">Pesan pop-up (opsional)</label>
                <input id="w6" maxLength={100} placeholder="Halo, ada yang bisa dibantu?" value={f.widget_teaser} onChange={set('widget_teaser')} />
                <p className="hint field-hint">Muncul sekali di atas tombol setelah beberapa detik, dan tidak muncul lagi setelah ditutup.</p>
              </div>
            </div>

            <h3 className="subh">Bubble pesan</h3>
            <div className="fgrid one">
              <div>
                <label htmlFor="w10">Bentuk bubble</label>
                <select id="w10" value={f.widget_bubble} onChange={set('widget_bubble')}>
                  <option value="bulat">Bulat</option>
                  <option value="kotak">Kotak</option>
                  <option value="lancip">Lancip (ekor runcing seperti WhatsApp)</option>
                </select>
              </div>
            </div>

            <h3 className="subh">Logo di header chat</h3>
            <div className="logorow">
              {f.widget_logo
                ? <img src={f.widget_logo} alt="Logo saat ini" width={48} height={48} className="logoimg" />
                : <span className="logoimg ph" aria-hidden="true"><IconView icon={f.widget_icon || DEFAULT_ICON} /></span>}
              <input id="w9" className="vh" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickLogo} />
              <label htmlFor="w9" className="btn ghost sm">{f.widget_logo ? 'Ganti logo' : 'Unggah logo'}</label>
              {f.widget_logo ? <button className="btn ghost sm" type="button" onClick={() => setF((p) => ({ ...p, widget_logo: '' }))}>Hapus</button> : null}
            </div>
            <p className="hint field-hint">Hanya tampil sebagai avatar di header jendela chat. Tombol widget tetap memakai ikon di atas. Gambar otomatis dipotong persegi dan dikecilkan.</p>

            <h3 className="subh">Status admin di header chat</h3>
            <label htmlFor="h0" className="swrow">
              <span className="swrow-t">
                <b>Pakai jam operasional</b>
                <small>Pelanggan melihat "Admin online" atau "Admin offline, buka ...". Asisten tetap membalas otomatis di luar jam.</small>
              </span>
              <input id="h0" type="checkbox" checked={f.hours_on} onChange={(e) => setF((p) => ({ ...p, hours_on: e.target.checked }))} />
            </label>
            {f.hours_on ? (
              <>
                <div className="fgrid" style={{ marginTop: 12 }}>
                  <div>
                    <label htmlFor="h1">Buka</label>
                    <input id="h1" type="time" value={f.hours_open} onChange={set('hours_open')} />
                  </div>
                  <div>
                    <label htmlFor="h2">Tutup</label>
                    <input id="h2" type="time" value={f.hours_close} onChange={set('hours_close')} />
                  </div>
                </div>
                <div className="daychips" role="group" aria-label="Hari operasional">
                  {DAYS.map(([d, n]) => (
                    <label key={d} className={'daychip' + (f.hours_days.includes(d) ? ' on' : '')}>
                      <input className="vh" type="checkbox" checked={f.hours_days.includes(d)} onChange={() => toggleDay(d)} />{n}
                    </label>
                  ))}
                </div>
              </>
            ) : null}
            <div className="fgrid" style={{ marginTop: 12 }}>
              {f.hours_on ? (
                <div>
                  <label htmlFor="h3">Zona waktu</label>
                  <select id="h3" value={f.hours_tz} onChange={set('hours_tz')}>
                    <option value="Asia/Jakarta">WIB</option>
                    <option value="Asia/Makassar">WITA</option>
                    <option value="Asia/Jayapura">WIT</option>
                  </select>
                </div>
              ) : null}
              <div>
                <label htmlFor="h4">Admin balas dalam (menit)</label>
                <input id="h4" type="number" inputMode="numeric" min="0" max="1440" value={f.reply_eta} onChange={set('reply_eta')} />
                <p className="hint field-hint">0 = tidak ditampilkan.</p>
              </div>
            </div>
          </div>

          <div className="wprev">
            <div className="seg" role="group" aria-label="Pilih pratinjau">
              <button type="button" aria-pressed={previewTab === 'chat'} onClick={() => setPreviewTab('chat')}>Jendela chat</button>
              <button type="button" aria-pressed={previewTab === 'tombol'} onClick={() => setPreviewTab('tombol')}>Tombol</button>
            </div>
            {previewTab === 'tombol' ? <WidgetPreview f={f} /> : <ChatWindowPreview f={f} shop={shop} />}
          </div>
        </div>
      </section>

      <div className="row savebar">
        <span className="hint" style={{ margin: 0, flex: 1 }} role="status">{dirty ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan sudah tersimpan.'}</span>
        <button className="btn" type="button" disabled={busy || !dirty} onClick={save}><Busy on={busy} label="Menyimpan...">Simpan</Busy></button>
      </div>
    </>
  );
}
