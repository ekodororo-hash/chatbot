'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Busy, dayTime, hhmm, readCount, saveCount } from './helpers';
import { SkConvRows, SkMsgs } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';

const STATUS = { bot: ['Dijawab bot', ''], human: ['Butuh admin', 'w'], selesai: ['Selesai', ''] };
const CONV_COLS = 'id,customer_name,status,flag,unanswered,last_question,updated_at';

function ConvList({ sb, shop, onOpen, onHumanCount, fail, toast }) {
  const [convs, setConvs] = useState(null);
  const [prev, setPrev] = useState({});
  const [deleting, setDeleting] = useState('');
  const [ask, confirmNode] = useConfirm();
  // Jumlah terakhir yang dilihat, supaya skeleton sepanjang isi aslinya.
  const [guess] = useState(() => readCount('conv:' + shop.id));

  const load = useCallback(async () => {
    const { data, error } = await sb.from('conversations')
      .select(CONV_COLS)
      .eq('shop_id', shop.id).order('updated_at', { ascending: false }).limit(50);
    if (error) { fail(error); return; }
    const p = {};
    if (data.length) {
      const { data: ms } = await sb.from('messages').select('conversation_id,content').eq('role', 'customer')
        .in('conversation_id', data.map((c) => c.id)).order('id', { ascending: false }).limit(300);
      (ms || []).forEach((m) => { if (!p[m.conversation_id]) p[m.conversation_id] = m.content; });
    }
    setPrev(p);
    setConvs(data);
    saveCount('conv:' + shop.id, data.length);
    onHumanCount(data.filter((c) => c.status === 'human').length);
  }, [sb, shop.id, fail, onHumanCount]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function remove(c) {
    const ok = await ask({ title: 'Hapus percakapan?', message: 'Percakapan dengan "' + c.customer_name + '" beserta semua pesannya akan dihapus permanen.' });
    if (!ok) return;
    setDeleting(c.id);
    const { data, error } = await sb.from('conversations').delete().eq('id', c.id).select('id');
    setDeleting('');
    if (error) { fail(error); return; }
    // Tanpa policy delete di database, Supabase tidak error tapi tidak menghapus apa pun.
    if (!data || !data.length) { toast('Gagal menghapus. Jalankan supabase/migrations/hapus_percakapan.sql dulu.'); return; }
    const rest = convs.filter((x) => x.id !== c.id);
    setConvs(rest);
    saveCount('conv:' + shop.id, rest.length);
    onHumanCount(rest.filter((x) => x.status === 'human').length);
    toast('Percakapan dihapus.');
  }

  return (
    <div className="card">
      {confirmNode}
      <h2>Percakapan terbaru</h2>
      <div>
        {!convs && <SkConvRows rows={guess === null ? 4 : Math.min(guess, 6)} />}
        {convs && !convs.length && (
          <p className="hint">Belum ada percakapan. Coba chat lewat halaman Coba bot untuk melihat hasilnya di sini.</p>
        )}
        {(convs || []).map((c, i) => (
          <div key={c.id} className="li">
            <span className="no" aria-label={'Nomor ' + (i + 1)}>{i + 1}</span>
            <button className="open" type="button" onClick={() => onOpen(c)}>
              <div className="t">
                <b>{c.customer_name + ' - ' + dayTime(c.updated_at)}</b>
                <small>{prev[c.id] || '(belum ada pesan)'}</small>
              </div>
              {c.flag ? <span className="tag a">{c.flag}</span> : null}
              <span className={'tag ' + STATUS[c.status][1]}>{STATUS[c.status][0]}</span>
            </button>
            <button className="btn danger sm" type="button" disabled={deleting === c.id} onClick={() => remove(c)}>
              <Busy on={deleting === c.id} label="Menghapus...">Hapus</Busy>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConvView({ sb, shop, conv, onBack, onMakeFaq, fail, toast, refreshHumanCount }) {
  const [c, setC] = useState(conv);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState('');
  const lastId = useRef(0);
  const listRef = useRef(null);

  const pull = useCallback(async () => {
    const { data, error } = await sb.from('messages').select('id,role,content,created_at')
      .eq('conversation_id', conv.id).gt('id', lastId.current).order('id', { ascending: true }).limit(200);
    if (error) { fail(error); setLoaded(true); return; }
    setLoaded(true);
    if (data && data.length) {
      lastId.current = Math.max(lastId.current, ...data.map((m) => m.id));
      setMsgs((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...data.filter((m) => !seen.has(m.id))];
      });
    }
  }, [sb, conv.id, fail]);

  useEffect(() => {
    pull();
    const t = setInterval(() => { if (!document.hidden) pull(); }, 8000);
    return () => clearInterval(t);
  }, [pull]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  async function setStatus(s, silent) {
    const patch = { status: s };
    if (s !== 'human') patch.unanswered = false;
    setPending(s);
    const { error } = await sb.from('conversations').update(patch).eq('id', c.id);
    setPending('');
    if (error) { fail(error); return; }
    setC((p) => ({ ...p, status: s }));
    if (!silent) toast('Status diubah.');
    refreshHumanCount();
  }

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setText('');
    setSending(true);
    const { error } = await sb.from('messages').insert({ conversation_id: c.id, shop_id: shop.id, role: 'admin', content: t });
    if (error) { setSending(false); fail(error); setText(t); return; }
    if (c.status !== 'human') await setStatus('human', true);
    await pull();
    setSending(false);
  }

  return (
    <>
      <button className="btn ghost sm" type="button" onClick={onBack}>← Semua percakapan</button>
      <div className="card" style={{ marginTop: 12 }}>
        <h2>{c.customer_name}</h2>
        {!loaded && <SkMsgs />}
        <div className="msgs" aria-live="polite" ref={listRef} hidden={!loaded}>
          {msgs.map((m) => (
            <div key={m.id} className={'m ' + m.role}>
              {m.role === 'admin' ? <em>Kamu (admin)</em> : (m.role === 'bot' ? <em>Bot</em> : null)}
              {m.content}
              <small>{hhmm(m.created_at)}</small>
            </div>
          ))}
        </div>
        <form className="row" onSubmit={send}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <input maxLength={1000} placeholder="Balas sebagai admin..." aria-label="Balasan admin" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={sending}><Busy on={sending} label="Mengirim...">Kirim</Busy></button>
        </form>
        <div className="row">
          <span className={'tag ' + STATUS[c.status][1]}>{STATUS[c.status][0]}</span>
          {c.status !== 'selesai' && (
            <button className="btn ghost sm" type="button" disabled={!!pending} onClick={() => setStatus('selesai')}>
              <Busy on={pending === 'selesai'} label="Menyimpan...">Tandai selesai</Busy>
            </button>
          )}
          {c.status !== 'bot' && (
            <button className="btn ghost sm" type="button" disabled={!!pending} onClick={() => setStatus('bot')}>
              <Busy on={pending === 'bot'} label="Menyimpan...">Kembalikan ke bot</Busy>
            </button>
          )}
          {c.unanswered && c.last_question && (
            <button className="btn ghost sm" type="button" onClick={() => onMakeFaq(c.last_question)}>Jadikan FAQ</button>
          )}
        </div>
      </div>
    </>
  );
}

// Percakapan yang dibuka disimpan di alamat (?c=id), jadi reload tetap di percakapan yang sama.
export default function ChatTab({ sb, shop, onHumanCount, refreshHumanCount, onMakeFaq, fail, toast }) {
  const router = useRouter();
  const id = useSearchParams().get('c');
  const [conv, setConv] = useState(null);

  useEffect(() => {
    if (!id || (conv && conv.id === id)) return;
    let alive = true;
    (async () => {
      const { data, error } = await sb.from('conversations').select(CONV_COLS)
        .eq('id', id).eq('shop_id', shop.id).maybeSingle();
      if (!alive) return;
      if (error || !data) {
        if (error) fail(error); else toast('Percakapan tidak ditemukan.');
        router.replace('/dashboard');
        return;
      }
      setConv(data);
    })();
    return () => { alive = false; };
  }, [id, conv, sb, shop.id, fail, toast, router]);

  if (id) {
    if (!conv || conv.id !== id) {
      return <div className="card"><SkMsgs /></div>;
    }
    return (
      <ConvView
        key={conv.id}
        sb={sb} shop={shop} conv={conv}
        onBack={() => router.push('/dashboard')}
        onMakeFaq={onMakeFaq} fail={fail} toast={toast} refreshHumanCount={refreshHumanCount}
      />
    );
  }
  return (
    <ConvList sb={sb} shop={shop} onHumanCount={onHumanCount} fail={fail} toast={toast}
      onOpen={(c) => { setConv(c); router.push('/dashboard?c=' + c.id); }} />
  );
}
