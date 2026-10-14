'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sk, SkItems } from '../components/Skeleton';
import { Busy, readCount, saveCount } from './helpers';

function FaqRow({ sb, f, fail, toast, onDeleted }) {
  const [q, setQ] = useState(f.question);
  const [a, setA] = useState(f.answer);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const saved = useRef(JSON.stringify([f.question, f.answer]));

  async function save() {
    const snap = JSON.stringify([q, a]);
    if (snap === saved.current) return;
    if (!q.trim() || !a.trim()) return toast('Pertanyaan dan jawaban tidak boleh kosong.');
    setSaving(true);
    const { error } = await sb.from('faqs').update({ question: q.trim(), answer: a.trim() }).eq('id', f.id);
    setSaving(false);
    if (error) { fail(error); return; }
    saved.current = snap;
    toast('Tersimpan.');
  }

  async function remove() {
    if (!confirm('Hapus FAQ ini?')) return;
    setRemoving(true);
    const { error } = await sb.from('faqs').delete().eq('id', f.id);
    if (error) { setRemoving(false); fail(error); return; }
    toast('FAQ dihapus.');
    onDeleted();
  }

  return (
    <div className="item">
      <input value={q} maxLength={200} aria-label="Pertanyaan" onChange={(e) => setQ(e.target.value)} onBlur={save} />
      <div style={{ marginTop: 8 }}>
        <textarea value={a} maxLength={1000} aria-label="Jawaban" onChange={(e) => setA(e.target.value)} onBlur={save} />
      </div>
      <div className="row">
        <button className="btn danger sm" type="button" disabled={removing} onClick={remove}>
          <Busy on={removing} label="Menghapus...">Hapus</Busy>
        </button>
        {saving ? <span className="hint" role="status"><span className="spin" aria-hidden="true" />Menyimpan...</span> : null}
      </div>
    </div>
  );
}

export default function FaqTab({ sb, shop, prefillQ, onPrefillUsed, fail, toast }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState(prefillQ || '');
  const [a, setA] = useState('');
  const [busy, setBusy] = useState(false);
  const answerRef = useRef(null);
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
    toast('FAQ ditambahkan.');
    setQ(''); setA('');
    load();
  }

  return (
    <>
      <div className="card">
        <h2>Tambah FAQ</h2>
        <input id="fq" maxLength={200} placeholder="Pertanyaan pelanggan" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ marginTop: 8 }}>
          <textarea id="fa" ref={answerRef} maxLength={1000} placeholder="Jawaban" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div className="row"><button className="btn" type="button" disabled={busy} onClick={add}><Busy on={busy} label="Menambah...">Tambah FAQ</Busy></button></div>
      </div>

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
          {items.map((f) => (
            <FaqRow key={f.id} sb={sb} f={f} fail={fail} toast={toast} onDeleted={load} />
          ))}
        </div>
      )}
    </>
  );
}
