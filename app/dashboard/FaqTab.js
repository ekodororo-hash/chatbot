'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sk, SkItems } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import { Busy, readCount, saveCount } from './helpers';

function FaqRow({ sb, f, no, ask, fail, toast, onDeleted }) {
  const [cur, setCur] = useState(f);
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState(f.question);
  const [a, setA] = useState(f.answer);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  function startEdit() {
    setQ(cur.question); setA(cur.answer);
    setEditing(true);
  }

  async function save() {
    if (!q.trim() || !a.trim()) return toast('Pertanyaan dan jawaban tidak boleh kosong.');
    setSaving(true);
    const patch = { question: q.trim(), answer: a.trim() };
    const { error } = await sb.from('faqs').update(patch).eq('id', cur.id);
    setSaving(false);
    if (error) { fail(error); return; }
    setCur((p) => ({ ...p, ...patch }));
    setEditing(false);
    toast('Tersimpan.');
  }

  async function remove() {
    const ok = await ask({ title: 'Hapus FAQ?', message: '"' + cur.question + '" akan dihapus permanen.' });
    if (!ok) return;
    setRemoving(true);
    const { error } = await sb.from('faqs').delete().eq('id', cur.id);
    if (error) { setRemoving(false); fail(error); return; }
    toast('FAQ dihapus.');
    onDeleted();
  }

  if (editing) {
    return (
      <div className="li edit">
        <span className="no" aria-label={'Nomor ' + no}>{no}</span>
        <div className="t">
          <input value={q} maxLength={200} placeholder="Pertanyaan" aria-label="Pertanyaan" onChange={(e) => setQ(e.target.value)} />
          <div style={{ marginTop: 8 }}>
            <textarea value={a} maxLength={1000} placeholder="Jawaban" aria-label="Jawaban" onChange={(e) => setA(e.target.value)} />
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
        <b>{cur.question}</b>
        <small style={{ whiteSpace: 'pre-wrap' }}>{cur.answer}</small>
      </div>
      <button className="btn ghost sm" type="button" onClick={startEdit}>Edit</button>
      <button className="btn danger sm" type="button" disabled={removing} onClick={remove}>
        <Busy on={removing} label="Menghapus...">Hapus</Busy>
      </button>
    </div>
  );
}

export default function FaqTab({ sb, shop, prefillQ, onPrefillUsed, fail, toast }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState(prefillQ || '');
  // Pertanyaan asal dari "Jadikan FAQ" (daftar Belum terjawab / percakapan), dipakai untuk menandainya beres setelah FAQ tersimpan.
  const [origQ] = useState(prefillQ || '');
  const [a, setA] = useState('');
  const [busy, setBusy] = useState(false);
  // Form tertutup sampai tombol ditekan; terbuka langsung kalau datang dari "Jadikan FAQ".
  const [open, setOpen] = useState(!!prefillQ);
  const answerRef = useRef(null);
  const [ask, confirmNode] = useConfirm();
  // Jumlah terakhir yang dilihat, supaya skeleton sepanjang isi aslinya.
  const [guess] = useState(() => readCount('faq:' + shop.id));

  const load = useCallback(async () => {
    const { data, error } = await sb.from('faqs').select('*').eq('shop_id', shop.id).order('created_at');
    if (error) { fail(error); return; }
    setItems(data);
    saveCount('faq:' + shop.id, data.length);
  }, [sb, shop.id, fail]);

  useEffect(() => { load(); }, [load]);

  // Datang dari "Jadikan FAQ": pertanyaan sudah terisi, langsung arahkan kursor ke jawaban.
  useEffect(() => {
    if (!prefillQ) return;
    onPrefillUsed();
    const t = setTimeout(() => { if (answerRef.current) answerRef.current.focus(); }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    if (!q.trim() || !a.trim()) return toast('Isi pertanyaan dan jawaban.');
    setBusy(true);
    const { error } = await sb.from('faqs').insert({ shop_id: shop.id, question: q.trim(), answer: a.trim() });
    setBusy(false);
    if (error) return fail(error);
    if (origQ) {
      // Awalan yang sama (pertanyaan dipotong 200 huruf untuk FAQ). Tanda % dan _ di-escape supaya tidak jadi wildcard.
      const like = origQ.replace(/[\\%_]/g, '\\$&') + '%';
      const r = await sb.from('conversations').update({ unanswered: false }).eq('shop_id', shop.id).eq('unanswered', true).ilike('last_question', like);
      if (r.error) console.error(r.error);
      // Pertanyaan yang sama dari daftar "Dinilai kurang baik" di Ringkasan ikut ditandai beres. Gagal (kolom belum ada) diabaikan.
      await sb.from('conversations').update({ rating_done: true }).eq('shop_id', shop.id).eq('rating', -1).eq('rating_done', false).ilike('rating_q', like);
    }
    toast('FAQ ditambahkan.');
    setQ(''); setA('');
    setOpen(false);
    load();
  }

  function cancel() {
    setQ(''); setA('');
    setOpen(false);
  }

  return (
    <>
      {confirmNode}
      {!open ? (
        <div className="addbar">
          <button className="btn" type="button" onClick={() => setOpen(true)}>+ Tambah FAQ</button>
        </div>
      ) : (
        <div className="card">
          <h2>Tambah FAQ</h2>
          <input id="fq" autoFocus={!prefillQ} maxLength={200} placeholder="Pertanyaan pelanggan" value={q} onChange={(e) => setQ(e.target.value)} />
          <div style={{ marginTop: 8 }}>
            <textarea id="fa" ref={answerRef} maxLength={1000} placeholder="Jawaban" value={a} onChange={(e) => setA(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn" type="button" disabled={busy} onClick={add}><Busy on={busy} label="Menambah...">Simpan FAQ</Busy></button>
            <button className="btn ghost" type="button" disabled={busy} onClick={cancel}>Batal</button>
          </div>
        </div>
      )}

      {!items && (
        <div className="card">
          <Sk w={130} h={20} style={{ marginBottom: 14 }} />
          <SkItems rows={guess === null ? 2 : Math.min(guess, 4)} variant="faq" />
        </div>
      )}
      {items && (
        <div className="card">
          <h2>{'Daftar FAQ (' + items.length + ')'}</h2>
          {!items.length && (
            <p className="hint">Belum ada FAQ. Contoh: kebijakan retur, cara reseller, lama pengemasan.</p>
          )}
          {items.map((f, i) => (
            <FaqRow key={f.id} sb={sb} f={f} no={i + 1} ask={ask} fail={fail} toast={toast} onDeleted={load} />
          ))}
        </div>
      )}
    </>
  );
}
