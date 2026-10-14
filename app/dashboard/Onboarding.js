'use client';
import { useState } from 'react';
import { Busy, Field, useOrigin } from './helpers';

export default function Onboarding({ sb, user, onCreated }) {
  const origin = useOrigin();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function onName(v) {
    setName(v);
    if (!touched) setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30));
  }
  function onSlug(v) {
    setTouched(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  async function create() {
    setErr('');
    const n = name.trim(), s = slug.trim();
    if (!n) { setErr('Isi nama toko.'); return; }
    if (!/^[a-z0-9-]{3,30}$/.test(s)) { setErr('Alamat chat: 3-30 karakter, huruf kecil, angka, atau tanda hubung.'); return; }
    setBusy(true);
    const { data, error } = await sb.from('shops').insert({ owner_id: user.id, name: n, slug: s }).select('*').single();
    setBusy(false);
    if (error) { setErr(error.code === '23505' ? 'Alamat chat ini sudah dipakai. Coba yang lain.' : error.message); return; }
    onCreated(data);
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontSize: 30, marginTop: 12 }}>Buat toko pertamamu</h1>
      <div className="card">
        <Field id="on" label="Nama toko">
          <input id="on" maxLength={100} placeholder="Contoh: Toko Ayu Hijab" value={name} onChange={(e) => onName(e.target.value)} />
        </Field>
        <Field id="os" label="Alamat chat (dipakai di link dan widget)">
          <input id="os" maxLength={30} placeholder="toko-ayu" autoCapitalize="off" value={slug} onChange={(e) => onSlug(e.target.value)} />
        </Field>
        <p className="hint">Link chat tokomu: {origin}/chat/alamat-ini</p>
        <div className="err" role="alert">{err}</div>
        <button className="btn" type="button" disabled={busy} style={{ width: '100%', marginTop: 12 }} onClick={create}><Busy on={busy} label="Membuat toko...">Buat toko</Busy></button>
      </div>
    </div>
  );
}
