'use client';
import { useCallback, useEffect, useState } from 'react';
import { Busy, Field, startOfTodayWIB, toInt } from '../helpers';
import { useDash } from '../context';
import { SkUsage } from '../../components/Skeleton';

/* Halaman Bot: /dashboard/bot. Judul tab browser diatur di bot/layout.js. */
export default function BotPage() {
  const { sb, shop, onShopChange, fail, toast } = useDash();
  const [used, setUsed] = useState(null);
  const [f, setF] = useState({
    bot_on: shop.bot_on, bot_name: shop.bot_name, tone: shop.tone, greeting: shop.greeting,
    fallback: shop.fallback, daily_limit: String(shop.daily_limit), accent: shop.accent
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const loadUsed = useCallback(async () => {
    const { count } = await sb.from('messages').select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id).eq('role', 'bot').gte('created_at', startOfTodayWIB().toISOString());
    setUsed(count || 0);
  }, [sb, shop.id]);

  useEffect(() => { loadUsed(); }, [loadUsed]);

  async function save() {
    const limit = toInt(f.daily_limit);
    if (!f.bot_name.trim()) return toast('Isi nama asisten.');
    if (!(limit >= 1 && limit <= 5000)) return toast('Batas harian: 1 sampai 5000.');
    setBusy(true);
    const patch = {
      bot_on: f.bot_on, bot_name: f.bot_name.trim(), tone: f.tone, greeting: f.greeting.trim(),
      fallback: f.fallback.trim(), daily_limit: limit, accent: f.accent
    };
    const { error } = await sb.from('shops').update(patch).eq('id', shop.id);
    setBusy(false);
    if (error) return fail(error);
    onShopChange(patch);
    toast('Pengaturan bot disimpan.');
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
          <span className={'tag' + (f.bot_on ? ' a' : '')}>{f.bot_on ? 'Bot aktif' : 'Bot mati'}</span>
        </div>
        {used === null ? <SkUsage /> : (
          <>
            <div className="usage">
              <b>{used}</b>
              <span>{'dari ' + shop.daily_limit + ' balasan'}</span>
              <small>{pct + '%'}</small>
            </div>
            <div className={'bar' + (pct > 80 ? ' hot' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Pemakaian balasan bot hari ini"><i style={{ width: pct + '%' }} /></div>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="bp">
        <div className="chead">
          <div>
            <h2 id="bp">Perilaku bot</h2>
            <p className="hint">Atur nama, gaya bahasa, dan kalimat yang dipakai bot saat membalas pelanggan.</p>
          </div>
        </div>

        <label htmlFor="b0" className="swrow">
          <span className="swrow-t">
            <b>Bot aktif</b>
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
            <label htmlFor="b4">Kalimat saat bot tidak tahu</label>
            <textarea id="b4" maxLength={300} value={f.fallback} onChange={set('fallback')} />
          </div>
        </div>

        <h3 className="fsec">Batas dan tampilan</h3>
        <div className="fgrid">
          <div>
            <label htmlFor="b5">Batas balasan otomatis per hari</label>
            <input id="b5" type="number" inputMode="numeric" min="1" max="5000" value={f.daily_limit} onChange={set('daily_limit')} />
          </div>
          <div>
            <label htmlFor="b6">Warna widget dan halaman chat</label>
            <div className="colorrow">
              <input id="b6" type="color" value={f.accent} onChange={set('accent')} />
              <code className="code">{f.accent}</code>
            </div>
          </div>
        </div>

        <div className="row bot-save"><button className="btn" type="button" disabled={busy} onClick={save}><Busy on={busy} label="Menyimpan...">Simpan</Busy></button></div>
      </section>
    </>
  );
}
