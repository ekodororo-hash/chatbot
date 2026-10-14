'use client';
import { useCallback, useEffect, useState } from 'react';
import { Busy, authFetch } from './helpers';
import { Sk } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import { Panduan } from '../components/Panduan';

function copy(text, toast) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('Disalin.'), () => toast('Tekan lama pada teks untuk menyalin.'));
  } else toast('Tekan lama pada teks untuk menyalin.');
}

const PanduanNotif = () => (
  <Panduan title="Kapan notifikasi dikirim dan cara mengaktifkannya">
    <p className="hint" style={{ marginTop: 0 }}>Notifikasi dikirim lewat Telegram saat asisten meneruskan percakapan ke admin (tidak tahu jawabannya, pelanggan komplain atau minta admin, asisten nonaktif, atau kuota harian habis), saat ada pesanan, dan saat pelanggan menulis lagi di percakapan yang sudah dipegang admin. Satu percakapan paling sering dikabari sekali tiap 15 menit, jadi tidak membanjiri.</p>
    <h3>Telegram</h3>
    <ol>
      <li>Hubungkan bot Telegram tokomu di kartu <b>Telegram</b> di bawah halaman ini.</li>
      <li>Dari akun Telegram admin, buka bot tokomu lalu kirim pesan <b>/admin</b> diikuti kode di kartu ini. Bot membalas konfirmasi.</li>
      <li>Setiap admin yang mau dikabari melakukan langkah 2 dari akun Telegram masing-masing (maksimal 10 chat).</li>
      <li>Untuk berhenti, kirim <b>/admin stop</b> dari chat itu. Kalau kode bocor, klik <b>Ganti kode</b>. Semua chat lama dicabut dan perlu mendaftar lagi.</li>
    </ol>
    <p className="hint">Kode Telegram bersifat rahasia. Jangan dibagikan ke pelanggan.</p>
  </Panduan>
);

// Kartu pengaturan notifikasi admin (Telegram) di halaman Notifikasi. Khusus pemilik toko.
export default function AdminNotif({ sb, shop, fail, toast }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  const [testRes, setTestRes] = useState(null);
  const [ask, confirmNode] = useConfirm();

  const call = useCallback((method, body) => authFetch(sb, shop.id, '/api/notify', method, body), [sb, shop.id]);
  const load = useCallback(async () => {
    try { setSt(await call('GET')); } catch (e) { fail(e); }
  }, [call, fail]);
  useEffect(() => { load(); }, [load]);

  async function run(key, body, okMsg) {
    setBusy(key);
    try {
      const r = await call('POST', body);
      setSt(r);
      if (okMsg) toast(okMsg);
      return r;
    } catch (e) { fail(e); return null; } finally { setBusy(''); }
  }

  async function test() {
    setTestRes(null);
    const r = await run('test', { action: 'test' });
    if (r && r.test) setTestRes(r.test);
  }
  async function resetCode() {
    if (!(await ask({ title: 'Ganti kode Telegram?', message: 'Kode lama tidak berlaku lagi dan semua chat penerima dicabut. Setiap admin perlu mendaftar ulang dengan kode baru.', okLabel: 'Ganti kode' }))) return;
    run('reset', { action: 'telegram_reset' }, 'Kode diganti.');
  }

  if (!st) {
    return <div className="card"><Sk w={190} h={20} style={{ marginBottom: 14 }} /><Sk h={42} r={10} /></div>;
  }
  const tg = st.telegram;
  const cmd = '/admin ' + tg.code;
  const line = (r) => (r.sent ? 'Telegram: terkirim ke ' + r.sent + ' chat.' : 'Telegram: ' + (r.error || 'tidak ada tujuan (belum diatur atau dimatikan).'));

  return (
    <div className="card">
      {confirmNode}
      <h2>Notifikasi ke admin</h2>
      <p className="hint">Dikabari lewat Telegram saat ada percakapan yang butuh admin, supaya tidak perlu membuka dashboard terus.</p>

      <PanduanNotif />

      <label className="sw" htmlFor="nt">
        <input id="nt" type="checkbox" checked={tg.on} disabled={busy === 'nt'} onChange={(e) => run('nt', { action: 'set', tgOn: e.target.checked })} />
        Telegram
      </label>
      {!tg.botConnected ? (
        <p className="hint">Hubungkan bot Telegram tokomu dulu di kartu Telegram di bawah.</p>
      ) : (
        <>
          <p className="hint">{'Buka bot '}<b>{'@' + tg.botUsername}</b>{' dari akun Telegram admin, lalu kirim pesan ini:'}</p>
          <pre>{cmd}</pre>
          <div className="row">
            <button className="btn sm" type="button" onClick={() => copy(cmd, toast)}>Salin perintah</button>
            <button className="btn ghost sm" type="button" disabled={busy === 'reset'} onClick={resetCode}><Busy on={busy === 'reset'} label="Mengganti...">Ganti kode</Busy></button>
          </div>
          <p className="hint">{tg.chats ? tg.chats + ' dari ' + tg.maxChats + ' chat sudah terdaftar.' : 'Belum ada chat yang terdaftar.'}</p>
        </>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" type="button" disabled={busy === 'test'} onClick={test}><Busy on={busy === 'test'} label="Mengirim...">Kirim tes</Busy></button>
      </div>
      {testRes ? (
        <div className="hint" role="status" style={{ marginTop: 8 }}>
          <div>{line(testRes.telegram)}</div>
        </div>
      ) : null}
    </div>
  );
}
