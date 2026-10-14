'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { dayTime, hhmm } from './helpers';
import { SkConvRows, SkMsgs } from '../components/Skeleton';

const STATUS = { bot: ['Dijawab bot', ''], human: ['Butuh admin', 'w'], selesai: ['Selesai', ''] };

function ConvList({ sb, shop, onOpen, onHumanCount, fail }) {
  const [convs, setConvs] = useState(null);
  const [prev, setPrev] = useState({});

  const load = useCallback(async () => {
    const { data, error } = await sb.from('conversations')
      .select('id,customer_name,status,flag,unanswered,last_question,updated_at')
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
    onHumanCount(data.filter((c) => c.status === 'human').length);
  }, [sb, shop.id, fail, onHumanCount]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="card">
      <h2>Percakapan terbaru</h2>
      <div>
        {!convs && <SkConvRows rows={5} />}
        {convs && !convs.length && (
          <p className="hint">Belum ada percakapan. Coba chat lewat tab Pasang untuk melihat hasilnya di sini.</p>
        )}
        {(convs || []).map((c) => (
          <button key={c.id} className="li" type="button" onClick={() => onOpen(c)}>
            <div className="t">
              <b>{c.customer_name + ' - ' + dayTime(c.updated_at)}</b>
              <small>{prev[c.id] || '(belum ada pesan)'}</small>
            </div>
            {c.flag ? <span className="tag a">{c.flag}</span> : null}
            <span className={'tag ' + STATUS[c.status][1]}>{STATUS[c.status][0]}</span>
          </button>
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
    const { error } = await sb.from('conversations').update(patch).eq('id', c.id);
    if (error) { fail(error); return; }
    setC((p) => ({ ...p, status: s }));
    if (!silent) toast('Status diubah.');
    refreshHumanCount();
  }

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    const { error } = await sb.from('messages').insert({ conversation_id: c.id, shop_id: shop.id, role: 'admin', content: t });
    if (error) { fail(error); setText(t); return; }
    if (c.status !== 'human') await setStatus('human', true);
    await pull();
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
          <button className="btn" type="submit">Kirim</button>
        </form>
        <div className="row">
          <span className={'tag ' + STATUS[c.status][1]}>{STATUS[c.status][0]}</span>
          {c.status !== 'selesai' && (
            <button className="btn ghost sm" type="button" onClick={() => setStatus('selesai')}>Tandai selesai</button>
          )}
          {c.status !== 'bot' && (
            <button className="btn ghost sm" type="button" onClick={() => setStatus('bot')}>Kembalikan ke bot</button>
          )}
          {c.unanswered && c.last_question && (
            <button className="btn ghost sm" type="button" onClick={() => onMakeFaq(c.last_question)}>Jadikan FAQ</button>
          )}
        </div>
      </div>
    </>
  );
}

export default function ChatTab({ sb, shop, openConv, setOpenConv, onHumanCount, refreshHumanCount, onMakeFaq, fail, toast }) {
  if (openConv) {
    return (
      <ConvView
        key={openConv.id}
        sb={sb} shop={shop} conv={openConv}
        onBack={() => setOpenConv(null)}
        onMakeFaq={onMakeFaq} fail={fail} toast={toast} refreshHumanCount={refreshHumanCount}
      />
    );
  }
  return <ConvList sb={sb} shop={shop} onOpen={setOpenConv} onHumanCount={onHumanCount} fail={fail} />;
}
