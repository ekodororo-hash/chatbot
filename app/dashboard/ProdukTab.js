'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import productImport from '@/lib/productImport';
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
      <div className="t stack">
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
  const [open, setOpen] = useState(false);
  // Impor dari CSV / tempel dari Excel atau Google Sheets.
  const [impOpen, setImpOpen] = useState(false);
  const [impText, setImpText] = useState('');
  const [impMode, setImpMode] = useState('update');
  const [impBusy, setImpBusy] = useState(false);
  const fileRef = useRef(null);
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
    setOpen(false);
    load();
  }

  const parsed = useMemo(() => (impText.trim() ? productImport.parseProducts(impText) : null), [impText]);
  const good = useMemo(() => (parsed ? parsed.rows.filter((r) => !r.error) : []), [parsed]);
  const bad = useMemo(() => (parsed ? parsed.rows.filter((r) => r.error) : []), [parsed]);

  function closeImport() {
    setImpOpen(false); setImpText(''); setImpMode('update');
  }

  async function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 1500000) { toast('File terlalu besar (maksimal 1,5 MB). Pecah jadi beberapa file.'); return; }
    try { setImpText(await f.text()); } catch (err) { toast('File tidak bisa dibaca.'); }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([productImport.templateCsv()], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'template-produk.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Semua produk toko (id dan nama), per 1.000 baris karena itu batas satu permintaan Supabase.
  async function allExisting() {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('products').select('id,name').eq('shop_id', shop.id).order('created_at').range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  async function runImport() {
    if (!good.length) return;
    setImpBusy(true);
    let added = 0, updated = 0, skipped = 0;
    try {
      const plan = productImport.planImport(good, await allExisting(), impMode);
      skipped = plan.skipped;
      for (let i = 0; i < plan.insert.length; i += 100) {
        const batch = plan.insert.slice(i, i + 100).map((r) => ({ shop_id: shop.id, ...r }));
        const { error } = await sb.from('products').insert(batch);
        if (error) throw error;
        added += batch.length;
      }
      for (let i = 0; i < plan.update.length; i += 10) {
        const chunk = plan.update.slice(i, i + 10);
        const res = await Promise.all(chunk.map((u) => sb.from('products').update(u.patch).eq('id', u.id).eq('shop_id', shop.id)));
        const failed = res.find((r) => r.error);
        if (failed) throw failed.error;
        updated += chunk.length;
      }
      toast(added + ' produk ditambah' + (updated ? ', ' + updated + ' diperbarui' : '') + (skipped ? ', ' + skipped + ' dilewati' : '') + '.');
      closeImport();
      load();
    } catch (e) {
      fail(e);
      if (added || updated) { toast('Impor terhenti. Yang sudah masuk: ' + added + ' ditambah, ' + updated + ' diperbarui.'); load(); }
    } finally { setImpBusy(false); }
  }

  function cancel() {
    setN(''); setP(''); setK(''); setD('');
    setOpen(false);
  }

  return (
    <>
      {confirmNode}
      {!open && !impOpen ? (
        <div className="addbar row">
          <button className="btn" type="button" onClick={() => setOpen(true)}>+ Tambah produk</button>
          <button className="btn ghost" type="button" onClick={() => setImpOpen(true)}>Impor dari CSV / Excel</button>
        </div>
      ) : null}

      {impOpen ? (
        <div className="card">
          <h2>Impor produk</h2>
          <p className="hint">Dari Excel atau Google Sheets: salin kolom <b>Nama, Harga, Stok, Deskripsi</b> (baris pertama boleh judul kolom), lalu tempel di bawah. Atau pilih file CSV (simpan sebagai CSV UTF-8). Maksimal {productImport.MAX_ROWS.toLocaleString('id-ID')} produk sekali impor.</p>
          <div className="row">
            <button className="btn sm" type="button" disabled={impBusy} onClick={() => fileRef.current && fileRef.current.click()}>Pilih file CSV</button>
            <button className="btn ghost sm" type="button" disabled={impBusy} onClick={downloadTemplate}>Unduh template</button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={pickFile} hidden />
          </div>
          <textarea aria-label="Data produk" rows={6} style={{ marginTop: 10 }} value={impText} disabled={impBusy}
            placeholder={'Nama\tHarga\tStok\tDeskripsi\nPashmina Ceruti\t45000\t24\tBahan adem'} onChange={(e) => setImpText(e.target.value)} />
          {parsed && parsed.fatal ? <p className="err" role="alert">{parsed.fatal}</p> : null}
          {parsed && !parsed.fatal ? (
            <div role="status">
              <p className="hint note">
                <b>{good.length}</b>{' baris siap diimpor'}{bad.length ? ', ' + bad.length + ' baris bermasalah dan akan dilewati' : ''}{'.'}
                {parsed.tooMany ? ' Hanya ' + productImport.MAX_ROWS.toLocaleString('id-ID') + ' baris pertama yang dibaca.' : ''}
              </p>
              {bad.slice(0, 8).map((r) => <p key={r.line} className="hint" style={{ margin: '2px 0' }}>{'Baris ' + r.line + ': ' + r.error}</p>)}
              {bad.length > 8 ? <p className="hint" style={{ margin: '2px 0' }}>{'...dan ' + (bad.length - 8) + ' baris lain.'}</p> : null}
              {good.slice(0, 5).map((r) => (
                <div key={r.line} className="li">
                  <div className="t stack"><b>{r.name}</b><small>{rp(r.price) + ' · Stok ' + r.stock}</small></div>
                </div>
              ))}
              {good.length > 5 ? <p className="hint" style={{ margin: '4px 0' }}>{'...dan ' + (good.length - 5) + ' produk lain.'}</p> : null}
              <select aria-label="Jika nama produk sudah ada" value={impMode} disabled={impBusy} style={{ marginTop: 10 }} onChange={(e) => setImpMode(e.target.value)}>
                <option value="update">Nama sudah ada: perbarui harga, stok, dan deskripsi</option>
                <option value="skip">Nama sudah ada: lewati saja</option>
              </select>
            </div>
          ) : null}
          <div className="row">
            <button className="btn" type="button" disabled={impBusy || !good.length} onClick={runImport}>
              <Busy on={impBusy} label="Mengimpor...">{good.length ? 'Impor ' + good.length + ' produk' : 'Impor'}</Busy>
            </button>
            <button className="btn ghost" type="button" disabled={impBusy} onClick={closeImport}>Batal</button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="card">
          <h2>Tambah produk</h2>
          <div className="item">
            <div className="grid3">
              <input id="pn" autoFocus maxLength={100} placeholder="Nama produk" value={n} onChange={(e) => setN(e.target.value)} />
              <input id="pp" type="number" inputMode="numeric" min="0" placeholder="Harga (Rp)" value={p} onChange={(e) => setP(e.target.value)} />
              <input id="pk" type="number" inputMode="numeric" min="0" placeholder="Stok" value={k} onChange={(e) => setK(e.target.value)} />
            </div>
            <div style={{ marginTop: 8 }}>
              <input id="pd" maxLength={300} placeholder="Deskripsi singkat (boleh kosong)" value={d} onChange={(e) => setD(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <button className="btn" type="button" disabled={busy} onClick={add}><Busy on={busy} label="Menambah...">Simpan produk</Busy></button>
            <button className="btn ghost" type="button" disabled={busy} onClick={cancel}>Batal</button>
          </div>
        </div>
      ) : null}

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
            <p className="hint">Belum ada produk. Asisten hanya bisa menjawab dari data yang kamu isi di sini.</p>
          )}
          {items.map((pr, i) => (
            <ProductRow key={pr.id} sb={sb} pr={pr} no={i + 1} ask={ask} fail={fail} toast={toast} onDeleted={load} />
          ))}
        </div>
      )}
      <p className="hint">Klik Edit untuk mengubah produk, lalu Simpan. Asisten memakai data terbaru pada pesan berikutnya.</p>
    </>
  );
}
