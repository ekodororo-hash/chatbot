'use client';
import { useState } from 'react';
import { Busy, Field } from './helpers';

export default function TokoTab({ sb, shop, onShopChange, fail, toast }) {
  const [f, setF] = useState({
    name: shop.name, hours: shop.hours, address: shop.address, shipping: shop.shipping, payment: shop.payment
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!f.name.trim()) return toast('Nama toko tidak boleh kosong.');
    setBusy(true);
    const patch = {
      name: f.name.trim(), hours: f.hours.trim(), address: f.address.trim(),
      shipping: f.shipping.trim(), payment: f.payment.trim()
    };
    const { error } = await sb.from('shops').update(patch).eq('id', shop.id);
    setBusy(false);
    if (error) return fail(error);
    onShopChange(patch);
    toast('Info toko disimpan.');
  }

  return (
    <div className="card">
      <h2>Info toko</h2>
      <p className="hint">Bot hanya menjawab dari data toko, produk, dan FAQ. Semakin lengkap, semakin jarang bot meneruskan ke admin.</p>
      <Field id="t1" label="Nama toko"><input id="t1" maxLength={100} value={f.name} onChange={set('name')} /></Field>
      <Field id="t2" label="Jam buka"><input id="t2" maxLength={200} value={f.hours} onChange={set('hours')} /></Field>
      <Field id="t3" label="Alamat"><textarea id="t3" maxLength={500} value={f.address} onChange={set('address')} /></Field>
      <Field id="t4" label="Pengiriman (ekspedisi, estimasi, gratis ongkir)"><textarea id="t4" maxLength={1000} value={f.shipping} onChange={set('shipping')} /></Field>
      <Field id="t5" label="Pembayaran"><textarea id="t5" maxLength={500} value={f.payment} onChange={set('payment')} /></Field>
      <div className="row"><button className="btn" type="button" disabled={busy} onClick={save}><Busy on={busy} label="Menyimpan...">Simpan</Busy></button></div>
    </div>
  );
}
