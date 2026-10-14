'use client';
import { useCallback, useEffect, useState } from 'react';
import { Busy, readCount, rp, saveCount, toInt } from './helpers';
import { Sk, SkItems } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';

function ProductRow({ sb, pr, no, ask, fail, toast, onDeleted }) {
  const [cur, setCur] = useState(pr);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pr.name);
  const [price, setPrice] = useState(String(pr.price));
  const [stock, setStock] = useState(String(pr.stock));
  const [desc, setDesc] = useState(pr.description || '');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  function startEdit() {
    setName(cur.name); setPrice(String(cur.price)); setStock(String(cur.stock)); setDesc(cur.description || '');
    setEditing(true);
  }

  async function save() {
    const pv = toInt(price), sv = toInt(stock);
    if (!name.trim() || !(pv >= 0) || !(sv >= 0)) { toast('Nama, harga, dan stok harus valid.'); return; }
    setSaving(true);
    const patch = { name: name.trim(), price: pv, stock: sv, description: desc.trim() };
    const { error } = await sb.from('products').update(patch).eq('id', cur.id);
    setSaving(false);
    if (error) { fail(error); return; }
    setCur((p) => ({ ...p, ...patch }));
    setEditing(false);
    toast('Tersimpan.');
  }

  async function remove() {
    const ok = await ask({ title: 'Hapus produk?', message: '"' + cur.name + '" akan dihapus permanen.' });
    if (!ok) return;
    setRemoving(true);
    const { error } = await sb.from('products').delete().eq('id', cur.id);
    if (error) { setRemoving(false); fail(error); return; }
    toast('Produk dihapus.');
    onDeleted();
  }

  if (editing) {
    return (
      <div className="li edit">
        <span className="no" aria-label={'Nomor ' + no}>{no}</span>
        <div className="t">
          <div className="grid3">
            <input value={name} maxLength={100} placeholder="Nama produk" aria-label="Nama produk" onChange={(e) => setName(e.target.value)} />
            <input value={price} type="number" inputMode="numeric" min="0" placeholder="Harga (Rp)" aria-label="Harga" onChange={(e) => setPrice(e.target.value)} />
            <input value={stock} type="number" inputMode="numeric" min="0" placeholder="Stok" aria-label="Stok" onChange={(e) => setStock(e.target.value)} />
          </div>
          <div style={{ marginTop: 8 }}>
            <input value={desc} maxLength={300} placeholder="Deskripsi" aria-label="Deskripsi" onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn sm" type="button" disabled={saving} onClick={save}><Busy on={saving} label="Menyimpan...">Simpan</Busy></button>
            <button className="btn ghost sm" type="button" disabled={saving} onClick={() => setEditing(false)}>Batal</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="li">
      <span className="no" aria-label={'Nomor ' + no}>{no}</span>
      <div className="t wrap">
        <b>{cur.name}</b>
        <small>{rp(cur.price) + ' · Stok ' + cur.stock}</small>
        {cur.description ? <small>{cur.description}</small> : null}
      </div>
      <button className="btn ghost sm" type="button" onClick={startEdit}>Edit</button>
      <button className="btn danger sm" type="button" disabled={removing} onClick={remove}>
        <Busy on={removing} label="Menghapus...">Hapus</Busy>
      </button>
    </div>
  );
}

export default function ProdukTab({ sb, shop, fail, toast }) {
  const [items, setItems] = useState(null);
  const [n, setN] = useState('');
  const [p, setP] = useState('');
  const [k, setK] = useState('');
  const [d, setD] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, confirmNode] = useConfirm();
  // Jumlah terakhir yang dilihat, supaya skeleton sepanjang isi aslinya.
  const [guess] = useState(() => readCount('produk:' + shop.id));

  const load = useCallback(async () => {
    const { data, error } = await sb.from('products').select('*').eq('shop_id', shop.id).order('created_at');
    if (error) { fail(error); return; }
    setItems(data);
    saveCount('produk:' + shop.id, data.length);
  }, [sb, shop.id, fail]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    const price = toInt(p), stock = k === '' ? 0 : toInt(k);
    if (!n.trim()) return toast('Isi nama produk.');
    if (!(price >= 0)) return toast('Isi harga dengan angka.');
    if (!(stock >= 0)) return toast('Stok harus angka 0 atau lebih.');
    setBusy(true);
    const { error } = await sb.from('products')
      .insert({ shop_id: shop.id, name: n.trim(), price, stock, description: d.trim() });
    setBusy(false);
    if (error) return fail(error);
    toast('Produk ditambahkan.');
    setN(''); setP(''); setK(''); setD('');
    load();
  }

  return (
    <>
      {confirmNode}
      <div className="card">
        <h2>Tambah produk</h2>
        <div className="item">
          <div className="grid3">
            <input id="pn" maxLength={100} placeholder="Nama produk" value={n} onChange={(e) => setN(e.target.value)} />
            <input id="pp" type="number" inputMode="numeric" min="0" placeholder="Harga (Rp)" value={p} onChange={(e) => setP(e.target.value)} />
            <input id="pk" type="number" inputMode="numeric" min="0" placeholder="Stok" value={k} onChange={(e) => setK(e.target.value)} />
          </div>
          <div style={{ marginTop: 8 }}>
            <input id="pd" maxLength={300} placeholder="Deskripsi singkat (boleh kosong)" value={d} onChange={(e) => setD(e.target.value)} />
          </div>
        </div>
        <div className="row"><button className="btn" type="button" disabled={busy} onClick={add}><Busy on={busy} label="Menambah...">Tambah produk</Busy></button></div>
      </div>

      {!items && (
        <div className="card">
          <Sk w={150} h={20} style={{ marginBottom: 14 }} />
          <SkItems rows={guess === null ? 2 : Math.min(guess, 4)} variant="produk" />
        </div>
      )}
      {items && (
        <div className="card">
          <h2>{'Daftar produk (' + items.length + ')'}</h2>
          {!items.length && (
            <p className="hint">Belum ada produk. Bot hanya bisa menjawab dari data yang kamu isi di sini.</p>
          )}
          {items.map((pr, i) => (
            <ProductRow key={pr.id} sb={sb} pr={pr} no={i + 1} ask={ask} fail={fail} toast={toast} onDeleted={load} />
          ))}
        </div>
      )}
      <p className="hint">Klik Edit untuk mengubah produk, lalu Simpan. Bot memakai data terbaru pada pesan berikutnya.</p>
    </>
  );
}
