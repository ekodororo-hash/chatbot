'use client';
import { useCallback, useEffect, useState } from 'react';
import { Field, startOfTodayWIB, toInt } from './helpers';

export default function BotTab({ sb, shop, onShopChange, fail, toast }) {
  const [used, setUsed] = useState(0);
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

  const pct = Math.min(100, Math.round(used / shop.daily_limit * 100));

  return (
    <>
      <div className="card">
        <h2>Pemakaian hari ini</h2>
        <div className="hint">{'Balasan bot: ' + used + ' dari batas ' + shop.daily_limit}</div>
        <div className={'bar' + (pct > 80 ? ' hot' : '')}><i style={{ width: pct + '%' }} /></div>
        <p className="hint">Setelah batas tercapai, pesan baru diteruskan ke admin. Ini menjaga biaya AI tetap terkendali.</p>
      </div>

      <div className="card">
        <h2>Perilaku bot</h2>
        <label htmlFor="b0" style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--ink)', fontSize: 15, margin: 0 }}>
          <input id="b0" type="checkbox" checked={f.bot_on} onChange={(e) => setF((p) => ({ ...p, bot_on: e.target.checked }))} />
          Bot aktif (kalau mati, semua pesan langsung ke admin)
        </label>
        <Field id="b1" label="Nama asisten"><input id="b1" maxLength={60} value={f.bot_name} onChange={set('bot_name')} /></Field>
        <Field id="b2" label="Gaya bahasa">
          <select id="b2" value={f.tone} onChange={set('tone')}>
            <option value="ramah">Ramah (kak, boleh emoji)</option>
            <option value="santai">Santai (kak)</option>
            <option value="formal">Formal (Bapak/Ibu)</option>
          </select>
        </Field>
        <Field id="b3" label="Sapaan pembuka (tulis {k} untuk panggilan otomatis)">
          <textarea id="b3" maxLength={300} value={f.greeting} onChange={set('greeting')} />
        </Field>
        <Field id="b4" label="Kalimat saat bot tidak tahu">
          <textarea id="b4" maxLength={300} value={f.fallback} onChange={set('fallback')} />
        </Field>
        <Field id="b5" label="Batas balasan otomatis per hari">
          <input id="b5" type="number" inputMode="numeric" min="1" max="5000" value={f.daily_limit} onChange={set('daily_limit')} />
        </Field>
        <Field id="b6" label="Warna widget dan halaman chat">
          <input id="b6" type="color" value={f.accent} onChange={set('accent')} />
        </Field>
        <div className="row"><button className="btn" type="button" disabled={busy} onClick={save}>Simpan</button></div>
      </div>
    </>
  );
}
