'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Busy, dayTime, hhmm, readCount, saveCount } from './helpers';
import { SkConvRows, SkMsgs } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import { useRealtime } from './useRealtime';

const STATUS = { bot: ['Dijawab AI', ''], human: ['Butuh admin', 'w'], selesai: ['Selesai', ''] };
const CONV_COLS = 'id,customer_name,status,flag,unanswered,last_question,updated_at,channel';
// Kolom closed_by_customer berasal dari migrasi ditutup_pelanggan.sql, kolom visitor_country/visitor_city dari lokasi_pengunjung.sql.
// Belum dijalankan (kode 42703) = ulangi tanpa kolom itu, supaya daftar percakapan tidak ikut gagal.
const GEO_COLS = ',visitor_country,visitor_city';
async function selConv(make) {
  let r;
  for (const extra of [',closed_by_customer' + GEO_COLS, ',closed_by_customer', '']) {
    r = await make(CONV_COLS + extra);
    if (!(r.error && r.error.code === '42703')) break;
  }
  return r;
}
// "Surabaya, Indonesia" untuk semua anggota toko; " · IP 103.45.12.34" hanya muncul untuk admin layanan (lihat ConvView).
// Kosong untuk Telegram/WhatsApp atau percakapan lama.
function visitorInfo(c, ip) {
  const place = [c.visitor_city, c.visitor_country].filter(Boolean).join(', ');
  return [place, ip ? 'IP ' + ip : ''].filter(Boolean).join(' · ');
}
// null = belum dicek, false = akun ini bukan admin layanan (tidak perlu minta lagi tiap membuka percakapan).
let ipAllowed = null;
const statusLabel = (c) => (c.status === 'selesai' && c.closed_by_customer ? 'Ditutup pelanggan' : STATUS[c.status][0]);
const CHANNEL = { telegram: 'Telegram', whatsapp: 'WhatsApp' };

// Label pemisah hari di dalam percakapan: "Hari ini", "Kemarin", atau "16 Okt".
function dayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hari ini';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

// Tautan di dalam pesan (mis. wa.me dari bot) jadi bisa diklik. Dibuat sebagai elemen React, bukan HTML mentah, jadi aman dari XSS.
function linkify(text) {
  return String(text).split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
    if (i % 2 === 0) return part;
    const m = part.match(/^(.*?)([.,;:!?)\]]*)$/);
    return <span key={i}><a href={m[1]} target="_blank" rel="noopener noreferrer">{m[1]}</a>{m[2]}</span>;
  });
}

function ConvList({ sb, shop, onOpen, onHumanCount, fail, toast }) {
  const [convs, setConvs] = useState(null);
  const [prev, setPrev] = useState({});
  const [deleting, setDeleting] = useState('');
  const [ask, confirmNode] = useConfirm();
  // Jumlah terakhir yang dilihat, supaya skeleton sepanjang isi aslinya.
  const [guess] = useState(() => readCount('conv:' + shop.id));

  const load = useCallback(async () => {
    const { data, error } = await selConv((cols) => sb.from('conversations')
      .select(cols)
      .eq('shop_id', shop.id).order('updated_at', { ascending: false }).limit(50));
    if (error) { fail(error); return; }
    const p = {};
    if (data.length) {
      const { data: ms } = await sb.from('messages').select('conversation_id,content').eq('role', 'customer')
        .in('conversation_id', data.map((c) => c.id)).order('id', { ascending: false }).limit(300);
      (ms || []).forEach((m) => { if (!p[m.conversation_id]) p[m.conversation_id] = m.content; });
    }
    setPrev(p);
    // Percakapan "butuh admin" naik ke atas dulu, sisanya tetap urut dari yang terbaru (sort stabil).
    const sorted = [...data].sort((a, b) => (b.status === 'human') - (a.status === 'human'));
    setConvs(sorted);
    saveCount('conv:' + shop.id, data.length);
    onHumanCount(data.filter((c) => c.status === 'human').length);
  }, [sb, shop.id, fail, onHumanCount]);

  useEffect(() => { load(); }, [load]);
  // Realtime: daftar diperbarui begitu ada percakapan atau pesan baru. Jaring pengaman tiap 60 detik.
  useRealtime(sb, 'conversations', 'shop_id=eq.' + shop.id, load, 60000);
  useRealtime(sb, 'messages', 'shop_id=eq.' + shop.id, load, 60000);

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
          <p className="hint">Belum ada percakapan. Coba chat lewat halaman Coba asisten untuk melihat hasilnya di sini.</p>
        )}
        {(convs || []).map((c, i) => (
          <div key={c.id} className={'li conv' + (c.status === 'human' ? ' alert' : '')}>
            {c.status === 'human' ? <i className="dot" aria-hidden="true" /> : null}
            <span className="no" aria-label={'Nomor ' + (i + 1) + (c.status === 'human' ? ', butuh admin' : '')}>{i + 1}</span>
            <button className="open" type="button" onClick={() => onOpen(c)}>
              <div className="t">
                <div className="nm"><b>{c.customer_name}</b><time dateTime={c.updated_at}>{dayTime(c.updated_at)}</time></div>
                <small>{prev[c.id] || '(belum ada pesan)'}</small>
              </div>
              <span className="tags">
                {CHANNEL[c.channel] ? <span className="tag">{CHANNEL[c.channel]}</span> : null}
                {c.flag ? <span className="tag a">{c.flag}</span> : null}
                <span className={'tag ' + STATUS[c.status][1]}>{statusLabel(c)}</span>
              </span>
            </button>
            <button className="btn danger sm del" type="button" disabled={deleting === c.id} onClick={() => remove(c)}>
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
  const [ip, setIp] = useState('');
  const lastId = useRef(0);
  const listRef = useRef(null);

  // IP pengunjung tidak ikut dimuat bersama percakapan: diminta terpisah ke server, dan hanya dijawab untuk email admin layanan.
  useEffect(() => {
    if (ipAllowed === false || conv.channel !== 'web') return undefined;
    let off = false;
    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        const tok = data && data.session && data.session.access_token;
        if (!tok) return;
        const res = await fetch('/api/admin/visitor?conversationId=' + encodeURIComponent(conv.id), { headers: { Authorization: 'Bearer ' + tok } });
        if (res.status === 403) { ipAllowed = false; return; }
        if (!res.ok) return;
        ipAllowed = true;
        const j = await res.json();
        if (!off && j && j.ip) setIp(j.ip);
      } catch (e) { /* IP hanya pelengkap: gagal = tidak tampil */ }
    })();
    return () => { off = true; };
  }, [sb, conv.id, conv.channel]);

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

  useEffect(() => { pull(); }, [pull]);
  // Realtime: pesan baru muncul langsung. Jaring pengaman tiap 60 detik.
  useRealtime(sb, 'messages', 'conversation_id=eq.' + conv.id, pull, 60000);

  // Status percakapan bisa diubah admin lain; ikuti perubahannya.
  const reloadConv = useCallback(async () => {
    const { data } = await selConv((cols) => sb.from('conversations').select(cols).eq('id', conv.id).maybeSingle());
    if (data) setC(data);
  }, [sb, conv.id]);
  useRealtime(sb, 'conversations', 'id=eq.' + conv.id, reloadConv, 60000);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  async function setStatus(s, silent) {
    const patch = { status: s };
    if (s !== 'human') patch.unanswered = false;
    setPending(s);
    // Status diubah admin = bukan lagi "ditutup pelanggan". Kolom belum ada (migrasi belum jalan) = ulangi tanpa kolom itu.
    let { error } = await sb.from('conversations').update({ ...patch, closed_by_customer: false }).eq('id', c.id);
    if (error && error.code === '42703') ({ error } = await sb.from('conversations').update(patch).eq('id', c.id));
    setPending('');
    if (error) { fail(error); return; }
    setC((p) => ({ ...p, status: s, closed_by_customer: false }));
    if (!silent) toast('Status diubah.');
    refreshHumanCount();
  }

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setText('');
    setSending(true);
    let error = null;
    if (CHANNEL[c.channel]) {
      // Telegram/WhatsApp: dikirim lewat server ke pelanggan, baru disimpan.
      try {
        const { data } = await sb.auth.getSession();
        const res = await fetch('/api/channels/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shop-Id': shop.id, Authorization: 'Bearer ' + (data && data.session && data.session.access_token) },
          body: JSON.stringify({ conversationId: c.id, text: t })
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); error = new Error(j.error || 'Gagal mengirim pesan.'); }
      } catch (e) { error = new Error('Gagal mengirim pesan. Cek koneksi internetmu.'); }
    } else {
      ({ error } = await sb.from('messages').insert({ conversation_id: c.id, shop_id: shop.id, role: 'admin', content: t }));
    }
    if (error) { setSending(false); fail(error); setText(t); return; }
    if (c.status !== 'human') await setStatus('human', true);
    await pull();
    setSending(false);
  }

  const info = visitorInfo(c, ip);
  const canFaq = c.unanswered && c.last_question;
  // Pelanggan sudah mengakhiri percakapan: admin tidak bisa membalas sampai pelanggan mengirim pesan lagi (status otomatis terbuka lagi lewat realtime).
  const closedByCustomer = c.status === 'selesai' && !!c.closed_by_customer;

  return (
    <>
      <button className="btn ghost sm" type="button" onClick={onBack}>← Semua percakapan</button>
      <div className="card cv" style={{ marginTop: 12 }}>
        <div className="cv-head">
          <div>
            <h2>{c.customer_name}{CHANNEL[c.channel] ? <span className="tag">{CHANNEL[c.channel]}</span> : null}</h2>
            {info ? <p className="hint" title="Lokasi perkiraan dari alamat IP">{info}</p> : null}
          </div>
          <span className={'tag ' + STATUS[c.status][1]}>{statusLabel(c)}</span>
        </div>
        <div className="cv-acts">
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
          {canFaq && (
            <button className="btn ghost sm" type="button" onClick={() => onMakeFaq(c.last_question)}>Jadikan FAQ</button>
          )}
        </div>
        {!loaded && <SkMsgs />}
        <div className="msgs" aria-live="polite" ref={listRef} hidden={!loaded}>
          {loaded && !msgs.length && <p className="cv-empty">Belum ada pesan di percakapan ini.</p>}
          {msgs.map((m, i) => {
            const prev = msgs[i - 1];
            const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
            const first = newDay || prev.role !== m.role;
            return (
              <Fragment key={m.id}>
                {newDay ? <div className="cv-day"><span>{dayLabel(m.created_at)}</span></div> : null}
                <div className={'m ' + m.role + (first ? ' first' : '')}>
                  {first && m.role === 'admin' ? <em>Kamu (admin)</em> : (first && m.role === 'bot' ? <em>Bot</em> : null)}
                  {linkify(m.content)}
                  <small>{hhmm(m.created_at)}</small>
                </div>
              </Fragment>
            );
          })}
        </div>
        {closedByCustomer ? (
          <p className="hint cv-note">Pelanggan sudah mengakhiri percakapan ini. Kamu bisa membalas lagi setelah pelanggan mengirim pesan baru.</p>
        ) : (
          <>
            <form className="cv-compose" onSubmit={send}>
              <input maxLength={1000} placeholder="Balas sebagai admin..." aria-label="Balasan admin" value={text} onChange={(e) => setText(e.target.value)} />
              <button className={'btn cv-send' + (text.trim() ? '' : ' e0')} type="submit" aria-label="Kirim" title="Kirim" disabled={sending}>
                {sending ? <span className="spin" style={{ margin: 0 }} aria-hidden="true" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}
              </button>
            </form>
            {c.status === 'bot' ? <p className="hint cv-note">Membalas dari sini akan mengambil alih percakapan dari bot.</p> : null}
          </>
        )}
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
      const { data, error } = await selConv((cols) => sb.from('conversations').select(cols)
        .eq('id', id).eq('shop_id', shop.id).maybeSingle());
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
