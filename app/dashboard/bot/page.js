'use client';
import { useCallback, useEffect, useState } from 'react';
import { Busy, startOfTodayWIB, toInt } from '../helpers';
import { useDash } from '../context';
import { SkUsage } from '../../components/Skeleton';

const DEFAULT_ICON = '\uD83D\uDCAC';
const SIZE_PX = { kecil: 48, sedang: 58, besar: 70 };
const ICONS = [DEFAULT_ICON, '\uD83D\uDECD\uFE0F', '\uD83D\uDED2', '\uD83E\uDD16', '\uD83D\uDC4B', '\u2753', '\uD83D\uDCDE'];
const WIDGET_DEFAULTS = {
  accent: '#0b7a75', widget_pos: 'right', widget_icon: DEFAULT_ICON, widget_label: '',
  widget_teaser: '', widget_size: 'sedang', widget_shape: 'bulat'
};

function fromShop(shop) {
  return {
    bot_on: shop.bot_on, bot_name: shop.bot_name, tone: shop.tone, greeting: shop.greeting,
    fallback: shop.fallback, daily_limit: String(shop.daily_limit), accent: shop.accent,
    widget_pos: shop.widget_pos || 'right', widget_icon: shop.widget_icon || DEFAULT_ICON,
    widget_label: shop.widget_label || '', widget_teaser: shop.widget_teaser || '',
    widget_size: shop.widget_size || 'sedang', widget_shape: shop.widget_shape || 'bulat'
  };
}

// Pratinjau tombol chat seperti yang tampil di website klien.
function WidgetPreview({ f }) {
  const px = SIZE_PX[f.widget_size] || 58;
  const hex = /^#[0-9a-fA-F]{6}$/.test(f.accent) ? f.accent : WIDGET_DEFAULTS.accent;
  const lum = (0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16)) / 255;
  const side = f.widget_pos === 'left' ? 'left' : 'right';
  const label = f.widget_label.trim();
  const teaser = f.widget_teaser.trim();
  return (
    <div aria-hidden="true" style={{ position: 'relative', height: teaser ? 160 : 120, marginTop: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg)', overflow: 'hidden' }}>
      <small style={{ position: 'absolute', top: 8, left: 12, color: 'var(--mute)' }}>Pratinjau di website</small>
      {teaser ? (
        <div style={{ position: 'absolute', [side]: 14, bottom: px + 26, maxWidth: '70%', background: '#fff', color: '#12262b', borderRadius: 14, padding: '8px 12px', fontSize: 13, boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}>{teaser}</div>
      ) : null}
      <div style={{
        position: 'absolute', [side]: 14, bottom: 14, height: px, minWidth: px, padding: label ? '0 18px' : 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: hex,
        color: lum > 0.62 ? '#111' : '#fff', fontSize: Math.round(px * 0.45),
        borderRadius: f.widget_shape === 'kotak' ? 16 : (label ? 999 : '50%'), boxShadow: '0 4px 14px rgba(0,0,0,.25)'
      }}>
        <span>{f.widget_icon || DEFAULT_ICON}</span>
        {label ? <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span> : null}
      </div>
    </div>
  );
}

/* Halaman Asisten AI: /dashboard/bot (alamat tetap, hanya namanya yang berubah). Judul tab diatur di bot/layout.js. */
export default function BotPage() {
  const { sb, shop, onShopChange, fail, toast } = useDash();
  const [used, setUsed] = useState(null);
  const [f, setF] = useState(() => fromShop(shop));
  const [saved, setSaved] = useState(() => fromShop(shop));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  const loadUsed = useCallback(async () => {
    const { count } = await sb.from('messages').select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id).eq('role', 'bot').gte('created_at', startOfTodayWIB().toISOString());
    setUsed(count || 0);
  }, [sb, shop.id]);

  useEffect(() => { loadUsed(); }, [loadUsed]);

  async function save() {
    const limit = toInt(f.daily_limit);
    const icon = f.widget_icon.trim();
    if (!f.bot_name.trim()) return toast('Isi nama asisten.');
    if (!(limit >= 1 && limit <= 5000)) return toast('Batas harian: 1 sampai 5000.');
    if (!icon || Array.from(icon).length > 8) return toast('Ikon tombol: 1 sampai 8 karakter (boleh emoji).');
    setBusy(true);
    const patch = {
      bot_on: f.bot_on, bot_name: f.bot_name.trim(), tone: f.tone, greeting: f.greeting.trim(),
      fallback: f.fallback.trim(), daily_limit: limit, accent: f.accent,
      widget_pos: f.widget_pos, widget_icon: icon, widget_label: f.widget_label.trim(),
      widget_teaser: f.widget_teaser.trim(), widget_size: f.widget_size, widget_shape: f.widget_shape
    };
    const { error } = await sb.from('shops').update(patch).eq('id', shop.id);
    setBusy(false);
    if (error) return fail(error);
    onShopChange(patch);
    const next = fromShop(patch);
    setF(next);
    setSaved(next);
    toast('Pengaturan asisten disimpan.');
  }

  const pct = Math.min(100, Math.round((used || 0) / shop.daily_limit * 100));

  return (
    <>
      <section className="card" aria-labelledby="bu">
        <div className="chead">
          <div>
            <h2 id="bu">Pemakaian hari ini</h2>
            <p className="hint">Setelah batas tercapai, pesan baru diteruskan ke admin. Ini menjaga biaya AI tetap terkendali.</p>
          </div>
          <span className={'tag' + (f.bot_on ? ' a' : '')}>{f.bot_on ? 'Asisten aktif' : 'Asisten mati'}</span>
        </div>
        {used === null ? <SkUsage /> : (
          <>
            <div className="usage">
              <b>{used}</b>
              <span>{'dari ' + shop.daily_limit + ' balasan'}</span>
              <small>{pct + '%'}</small>
            </div>
            <div className={'bar' + (pct > 80 ? ' hot' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Pemakaian balasan asisten hari ini"><i style={{ width: pct + '%' }} /></div>
          </>
        )}
        <div className="fgrid one" style={{ marginTop: 14 }}>
          <div>
            <label htmlFor="b5">Batas balasan otomatis per hari</label>
            <input id="b5" type="number" inputMode="numeric" min="1" max="5000" value={f.daily_limit} onChange={set('daily_limit')} />
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="bp">
        <div className="chead">
          <div>
            <h2 id="bp">Perilaku asisten</h2>
            <p className="hint">Atur nama, gaya bahasa, dan kalimat yang dipakai asisten saat membalas pelanggan.</p>
          </div>
        </div>

        <label htmlFor="b0" className="swrow">
          <span className="swrow-t">
            <b>Asisten aktif</b>
            <small>Kalau mati, semua pesan langsung ke admin.</small>
          </span>
          <input id="b0" type="checkbox" checked={f.bot_on} onChange={(e) => setF((p) => ({ ...p, bot_on: e.target.checked }))} />
        </label>

        <h3 className="fsec">Identitas</h3>
        <div className="fgrid">
          <div>
            <label htmlFor="b1">Nama asisten</label>
            <input id="b1" maxLength={60} value={f.bot_name} onChange={set('bot_name')} />
          </div>
          <div>
            <label htmlFor="b2">Gaya bahasa</label>
            <select id="b2" value={f.tone} onChange={set('tone')}>
              <option value="ramah">Ramah (kak, boleh emoji)</option>
              <option value="santai">Santai (kak)</option>
              <option value="formal">Formal (Bapak/Ibu)</option>
            </select>
          </div>
        </div>

        <h3 className="fsec">Pesan otomatis</h3>
        <div className="fgrid one">
          <div>
            <label htmlFor="b3">Sapaan pembuka</label>
            <textarea id="b3" maxLength={300} value={f.greeting} onChange={set('greeting')} />
            <p className="hint field-hint">{'Tulis {k} untuk panggilan otomatis.'}</p>
          </div>
          <div>
            <label htmlFor="b4">Kalimat saat asisten tidak tahu</label>
            <textarea id="b4" maxLength={300} value={f.fallback} onChange={set('fallback')} />
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="bw">
        <div className="chead">
          <div>
            <h2 id="bw">Tampilan chat di website</h2>
            <p className="hint">Berlaku di website klien tanpa perlu menempel ulang kode, paling lambat sekitar 1 menit.</p>
          </div>
          <button className="btn ghost sm" type="button" onClick={() => setF((p) => ({ ...p, ...WIDGET_DEFAULTS }))}>Kembalikan bawaan</button>
        </div>
        <div className="fgrid">
          <div>
            <label htmlFor="b6">Warna widget dan halaman chat</label>
            <div className="colorrow">
              <input id="b6" type="color" value={f.accent} onChange={set('accent')} />
              <code className="code">{f.accent}</code>
            </div>
          </div>
          <div>
            <label htmlFor="w1">Posisi tombol</label>
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
            </select>
          </div>
          <div>
            <label htmlFor="w4">Ikon (emoji atau huruf)</label>
            <input id="w4" maxLength={16} list="w4l" value={f.widget_icon} onChange={set('widget_icon')} />
            <datalist id="w4l">{ICONS.map((e) => <option key={e} value={e} />)}</datalist>
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
        <WidgetPreview f={f} />
      </section>

      <div className="row savebar">
        <span className="hint" style={{ margin: 0, flex: 1 }} role="status">{dirty ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan sudah tersimpan.'}</span>
        <button className="btn" type="button" disabled={busy || !dirty} onClick={save}><Busy on={busy} label="Menyimpan...">Simpan</Busy></button>
      </div>
    </>
  );
}
