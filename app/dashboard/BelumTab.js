'use client';
/* Pertanyaan pelanggan yang tidak bisa dijawab asisten (percakapan bertanda "belum terjawab").
   Pertanyaan yang sama dikelompokkan. Dari sini pemilik bisa menjadikannya FAQ supaya asisten
   menjawabnya sendiri lain kali, atau menandainya beres. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SkConvRows } from '../components/Skeleton';
import { Busy, dayTime } from './helpers';
import { useRealtime } from './useRealtime';

const CHANNEL = { web: 'Web', telegram: 'Telegram', whatsapp: 'WhatsApp' };
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[?!.\s]+$/g, '').trim();

export default function BelumTab({ sb, shop, onMakeFaq, refreshBadges, fail, toast }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await sb.from('conversations')
      .select('id,customer_name,channel,status,last_question,updated_at')
      .eq('shop_id', shop.id).eq('unanswered', true)
      .order('updated_at', { ascending: false }).limit(300);
    if (error) { fail(error); return; }
    setRows((data || []).filter((r) => r.last_question && r.last_question.trim()));
  }, [sb, shop.id, fail]);

  useEffect(() => { load(); }, [load]);
  useRealtime(sb, 'conversations', 'shop_id=eq.' + shop.id, load, 60000);

  // Kelompokkan pertanyaan yang sama; yang paling sering ditanyakan di atas.
  const groups = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((r) => {
      const k = norm(r.last_question);
      if (!k) return;
      const g = map.get(k) || { key: k, question: r.last_question.trim(), items: [], latest: r.updated_at };
      g.items.push(r);
      if (r.updated_at > g.latest) { g.latest = r.updated_at; g.question = r.last_question.trim(); }
      map.set(k, g);
    });
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length || (a.latest < b.latest ? 1 : -1));
  }, [rows]);

  async function resolve(g) {
    setBusy(g.key);
    const ids = g.items.map((r) => r.id);
    const { error } = await sb.from('conversations').update({ unanswered: false }).in('id', ids);
    setBusy('');
    if (error) { fail(error); return; }
    setRows((list) => list.filter((r) => !ids.includes(r.id)));
    refreshBadges();
    toast('Ditandai selesai.');
  }

  return (
    <div className="card">
      <h2>Pertanyaan belum terjawab</h2>
      <p className="hint">Pertanyaan pelanggan yang tidak bisa dijawab asisten. Klik <b>Jadikan FAQ</b> supaya asisten bisa menjawabnya sendiri lain kali.</p>
      {!rows && <SkConvRows rows={3} />}
      {rows && !groups.length && <p className="hint note">Tidak ada pertanyaan yang tertunda. Semua sudah terjawab.</p>}
      <div className="rows">
        {groups.map((g) => {
          const latest = g.items[0];
          const via = Array.from(new Set(g.items.map((r) => CHANNEL[r.channel] || r.channel)));
          return (
            <div key={g.key} className="srow">
              <div className="t stack">
                <b style={{ whiteSpace: 'normal' }}>{g.question}</b>
                <small style={{ whiteSpace: 'normal' }}>
                  {(g.items.length > 1 ? 'Ditanyakan ' + g.items.length + ' kali' : 'Ditanyakan sekali') + ' · terakhir ' + dayTime(g.latest) + ' · ' + via.join(', ')}
                </small>
              </div>
              <div className="row">
                <button className="btn sm" type="button" onClick={() => onMakeFaq(g.question.slice(0, 200))}>Jadikan FAQ</button>
                <Link className="btn ghost sm" href={'/dashboard?c=' + latest.id}>Buka chat</Link>
                <button className="btn ghost sm" type="button" disabled={busy === g.key} onClick={() => resolve(g)}>
                  <Busy on={busy === g.key} label="Menyimpan...">Tandai selesai</Busy>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
