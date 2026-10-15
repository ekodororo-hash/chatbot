'use client';
import { useCallback, useEffect, useState } from 'react';
import { Busy, Field } from './helpers';
import { Sk } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import { Panduan } from '../components/Panduan';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

// Halaman Tim: pemilik mengundang dan mengeluarkan admin tambahan. Akses data lewat RLS (lihat supabase/schema.sql).
export default function TimTab({ sb, shop, user, fail, toast }) {
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [ask, confirmNode] = useConfirm();

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      sb.from('shop_members').select('user_id,role,email,created_at').eq('shop_id', shop.id).order('created_at', { ascending: true }),
      sb.from('shop_invites').select('id,email,created_at').eq('shop_id', shop.id).order('created_at', { ascending: true })
    ]);
    if (m.error) { fail(m.error); return; }
    if (i.error) { fail(i.error); return; }
    setMembers(m.data || []);
    setInvites(i.data || []);
  }, [sb, shop.id, fail]);
  useEffect(() => { load(); }, [load]);

  async function invite() {
    setErr('');
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) { setErr('Email tidak valid.'); return; }
    if ((members || []).some((m) => m.email === e)) { setErr('Orang ini sudah jadi anggota tim.'); return; }
    setBusy('inv');
    const { error } = await sb.from('shop_invites').insert({ shop_id: shop.id, email: e });
    setBusy('');
    if (error) { setErr(error.code === '23505' ? 'Email ini sudah diundang.' : error.message); return; }
    setEmail('');
    toast('Undangan dibuat.');
    load();
  }

  async function cancelInvite(inv) {
    setBusy('i' + inv.id);
    const { error } = await sb.from('shop_invites').delete().eq('id', inv.id);
    setBusy('');
    if (error) { fail(error); return; }
    setInvites((l) => l.filter((x) => x.id !== inv.id));
    toast('Undangan dibatalkan.');
  }

  async function removeMember(m) {
    const ok = await ask({ title: 'Keluarkan admin?', message: (m.email || 'Admin ini') + ' tidak bisa lagi membuka toko ini. Percakapan yang pernah ia balas tetap tersimpan.', okLabel: 'Keluarkan' });
    if (!ok) return;
    setBusy('m' + m.user_id);
    const { data, error } = await sb.from('shop_members').delete().eq('shop_id', shop.id).eq('user_id', m.user_id).select('user_id');
    setBusy('');
    if (error) { fail(error); return; }
    if (!data || !data.length) { toast('Gagal mengeluarkan. Pastikan migrasi SQL tim sudah dijalankan.'); return; }
    setMembers((l) => l.filter((x) => x.user_id !== m.user_id));
    toast('Admin dikeluarkan.');
  }

  return (
    <>
      {confirmNode}
      <div className="card">
        <h2>Anggota tim</h2>
        {!members ? <Sk h={44} r={10} /> : members.map((m) => (
          <div key={m.user_id} className="mem">
            <div className="t">
              <b>{m.email || '(email tidak tercatat)'}{m.user_id === user.id ? ' (kamu)' : ''}</b>
              <small>{m.role === 'owner' ? 'Pemilik' : 'Admin'}</small>
            </div>
            {m.role !== 'owner' ? (
              <button className="btn danger sm" type="button" disabled={busy === 'm' + m.user_id} onClick={() => removeMember(m)}>
                <Busy on={busy === 'm' + m.user_id} label="Mengeluarkan...">Keluarkan</Busy>
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {invites.length ? (
        <div className="card">
          <h2>Undangan menunggu</h2>
          <p className="hint">Belum diterima. Orang itu perlu masuk (atau daftar) dengan email ini.</p>
          {invites.map((inv) => (
            <div key={inv.id} className="mem">
              <div className="t"><b>{inv.email}</b><small>Admin</small></div>
              <button className="btn ghost sm" type="button" disabled={busy === 'i' + inv.id} onClick={() => cancelInvite(inv)}>
                <Busy on={busy === 'i' + inv.id} label="Membatalkan...">Batalkan</Busy>
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card">
        <h2>Undang admin</h2>
        <Panduan title="Apa yang bisa dilakukan admin tambahan?">
          <ol>
            <li>Admin bisa membuka dan membalas percakapan, mengubah status percakapan, serta mengelola produk dan FAQ.</li>
            <li>Admin tidak bisa mengubah info toko, pengaturan asisten AI, pemasangan, saluran Telegram dan WhatsApp, notifikasi, atau tim. Itu khusus pemilik.</li>
            <li>Untuk mengundang: tulis email admin di bawah lalu klik Undang. Orang itu mendaftar atau masuk di halaman login dengan email yang sama, dan toko ini langsung muncul di dashboard-nya.</li>
            <li>Satu akun bisa jadi pemilik di satu toko dan admin di toko lain. Pindah toko lewat pilihan di sidebar.</li>
          </ol>
        </Panduan>
        <Field id="te" label="Email admin">
          <input id="te" type="email" autoComplete="off" placeholder="admin@contoh.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="err" role="alert">{err}</div>
        <div className="row"><button className="btn" type="button" disabled={busy === 'inv' || !email.trim()} onClick={invite}><Busy on={busy === 'inv'} label="Mengundang...">Undang</Busy></button></div>
      </div>
    </>
  );
}
