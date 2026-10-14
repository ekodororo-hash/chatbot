'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { rp, toInt } from './helpers';

function ProductRow({ sb, pr, fail, toast, onDeleted }) {
  const [name, setName] = useState(pr.name);
  const [price, setPrice] = useState(String(pr.price));
  const [stock, setStock] = useState(String(pr.stock));
  const [desc, setDesc] = useState(pr.description || '');
  const [shownPrice, setShownPrice] = useState(pr.price);
  const saved = useRef(JSON.stringify([pr.name, String(pr.price), String(pr.stock), pr.description || '']));

  // Disimpan otomatis saat kolom ditinggalkan (blur), hanya kalau isinya berubah.
  async function save() {
    const snap = JSON.stringify([name, price, stock, desc]);
    if (snap === saved.current) return;
    const pv = toInt(price), sv = toInt(stock);
    if (!name.trim() || !(pv >= 0) || !(sv >= 0)) { toast('Nama, harga, dan stok harus valid.'); return; }
    const { error } = await sb.from('products')
      .update({ name: name.trim(), price: pv, stock: sv, description: desc.trim() }).eq('id', pr.id);
    if (error) { fail(error); return; }
    saved.current = snap;
    setShownPrice(pv);
    toast('Tersimpan.');
  }

  async function remove() {
    if (!confirm('Hapus produk "' + pr.name + '"?')) return;
    const { error } = await sb.from('products').delete().eq('id', pr.id);
    if (error) { fail(error); return; }
    toast('Produk dihapus.');
    onDeleted();
  }

  return (
    <div className="item">
      <div className="grid3">
        <input value={name} maxLength={100} aria-label="Nama produk" onChange={(e) => setName(e.target.value)} onBlur={save} />
        <input value={price} type="number" inputMode="numeric" min="0" aria-label="Harga" onChange={(e) => setPrice(e.target.value)} onBlur={save} />
        <input value={stock} type="number" inputMode="numeric" min="0" aria-label="Stok" onChange={(e) => setStock(e.target.value)} onBlur={save} />
      </div>
      <div style={{ marginTop: 8 }}>
        <input value={desc} maxLength={300} placeholder="Deskripsi" aria-label="Deskripsi" onChange={(e) => setDesc(e.target.value)} onBlur={save} />
      </div>
      <div className="row">
        <span className="hint">{rp(shownPrice)}</span>
        <button className="btn danger sm" type="button" onClick={remove}>Hapus</button>
      </div>
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

  const load = useCallback(async () => {
    const { data, error } = await sb.from('products').select('*').eq('shop_id', shop.id).order('created_at');
    if (error) { fail(error); return; }
    setItems(data);
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
        <div className="row"><button className="btn" type="button" disabled={busy} onClick={add}>Tambah produk</button></div>
      </div>

      {items && (
        <div className="card">
          <h2>{'Daftar produk (' + items.length + ')'}</h2>
          {!items.length && (
            <p className="hint">Belum ada produk. Bot hanya bisa menjawab dari data yang kamu isi di sini.</p>
          )}
          {items.map((pr) => (
            <ProductRow key={pr.id} sb={sb} pr={pr} fail={fail} toast={toast} onDeleted={load} />
          ))}
        </div>
      )}
      <p className="hint">Perubahan tersimpan otomatis. Bot memakai data terbaru pada pesan berikutnya.</p>
    </>
  );
}
