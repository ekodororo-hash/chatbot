'use client';
import { useCallback, useEffect, useState } from 'react';
import { Busy } from './helpers';
import { Sk } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';

async function api(sb, method, body) {
  const { data } = await sb.auth.getSession();
  const tok = data && data.session && data.session.access_token;
  const res = await fetch('/api/channels', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Terjadi kesalahan');
  return j;
}

function copy(text, toast) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('Disalin.'), () => toast('Tekan lama pada teks untuk menyalin.'));
  } else toast('Tekan lama pada teks untuk menyalin.');
}

// Dua kartu di halaman Pasang: sambungkan bot Telegram dan nomor WhatsApp Business.
export default function SalurTab({ sb, fail, toast }) {
  const [st, setSt] = useState(null);
  const [ask, confirmNode] = useConfirm();
  const [tgToken, setTgToken] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [waToken, setWaToken] = useState('');
  const [waSecret, setWaSecret] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState({ tg: '', wa: '' });

  const load = useCallback(async () => {
    try { setSt(await api(sb, 'GET')); } catch (e) { fail(e); }
  }, [sb, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (st && st.whatsapp.phoneId) setPhoneId(st.whatsapp.phoneId); }, [st]);

  async function run(key, errKey, body, okMsg) {
    setBusy(key); setErr((p) => ({ ...p, [errKey]: '' }));
    try {
      setSt(await api(sb, 'POST', body));
      toast(okMsg);
      return true;
    } catch (e) {
      setErr((p) => ({ ...p, [errKey]: e.message }));
      return false;
    } finally { setBusy(''); }
  }

  async function tgConnect() {
    if (await run('tg', 'tg', { action: 'telegram_connect', token: tgToken }, 'Telegram terhubung.')) setTgToken('');
  }
  async function tgDisconnect() {
    if (!(await ask({ title: 'Putuskan Telegram?', message: 'Bot Telegram berhenti membalas pelanggan. Riwayat percakapan tetap ada.', okLabel: 'Putuskan' }))) return;
    run('tgx', 'tg', { action: 'telegram_disconnect' }, 'Telegram diputuskan.');
  }
  async function waSave() {
    if (await run('wa', 'wa', { action: 'whatsapp_save', phoneId, token: waToken, appSecret: waSecret }, 'WhatsApp tersimpan.')) { setWaToken(''); setWaSecret(''); }
  }
  async function waDisconnect() {
    if (!(await ask({ title: 'Putuskan WhatsApp?', message: 'Bot berhenti membalas pesan WhatsApp. Riwayat percakapan tetap ada.', okLabel: 'Putuskan' }))) return;
    if (await run('wax', 'wa', { action: 'whatsapp_disconnect' }, 'WhatsApp diputuskan.')) setPhoneId('');
  }

  if (!st) {
    return <div className="card"><Sk w={190} h={20} style={{ marginBottom: 14 }} /><Sk h={42} r={10} /></div>;
  }
  const tg = st.telegram, wa = st.whatsapp;

  return (
    <>
      {confirmNode}
      <div className="card">
        <h2>4. Telegram</h2>
        {tg.connected ? (
          <>
            <p className="hint">{'Terhubung ke '}<b>{'@' + tg.username}</b>{'. Pelanggan yang chat ke bot itu dibalas otomatis. Kalau bot tidak tahu jawabannya, percakapan masuk ke tab Percakapan dan kamu bisa membalas dari sana.'}</p>
            <div className="row">
              <a className="btn ghost sm" href={'https://t.me/' + tg.username} target="_blank" rel="noopener">Buka bot</a>
              <button className="btn danger sm" type="button" disabled={busy === 'tgx'} onClick={tgDisconnect}><Busy on={busy === 'tgx'} label="Memutuskan...">Putuskan</Busy></button>
            </div>
          </>
        ) : (
          <>
            <p className="hint">{'Buka Telegram, chat dengan @BotFather, kirim /newbot, ikuti langkahnya, lalu tempel token yang diberikan di sini.'}</p>
            <input id="tgt" autoComplete="off" spellCheck={false} placeholder="Token bot, contoh 123456789:AAH..." value={tgToken} onChange={(e) => setTgToken(e.target.value)} />
            <div className="err" role="alert">{err.tg}</div>
            <div className="row"><button className="btn" type="button" disabled={busy === 'tg' || !tgToken.trim()} onClick={tgConnect}><Busy on={busy === 'tg'} label="Menghubungkan...">Hubungkan</Busy></button></div>
          </>
        )}
      </div>

      <div className="card">
        <h2>5. WhatsApp</h2>
        <p className="hint">{'Memakai WhatsApp Business Platform (Cloud API) dari Meta. Buat app di developers.facebook.com, tambahkan produk WhatsApp, lalu salin tiga data di bawah.'}</p>
        <label htmlFor="wpi">Phone number ID</label>
        <input id="wpi" inputMode="numeric" autoComplete="off" placeholder="Contoh 109876543210987" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} />
        <label htmlFor="wat">Access token (permanen)</label>
        <input id="wat" autoComplete="off" spellCheck={false} placeholder={wa.connected ? 'Tersimpan. Kosongkan kalau tidak diubah.' : 'Token dari System User'} value={waToken} onChange={(e) => setWaToken(e.target.value)} />
        <label htmlFor="was">App Secret</label>
        <input id="was" autoComplete="off" spellCheck={false} placeholder={wa.connected ? 'Tersimpan. Kosongkan kalau tidak diubah.' : 'App settings > Basic > App secret'} value={waSecret} onChange={(e) => setWaSecret(e.target.value)} />
        <div className="err" role="alert">{err.wa}</div>
        <div className="row">
          <button className="btn" type="button" disabled={busy === 'wa'} onClick={waSave}><Busy on={busy === 'wa'} label="Menyimpan...">{wa.connected ? 'Simpan perubahan' : 'Simpan'}</Busy></button>
          {wa.connected ? (
            <button className="btn danger sm" type="button" disabled={busy === 'wax'} onClick={waDisconnect}><Busy on={busy === 'wax'} label="Memutuskan...">Putuskan</Busy></button>
          ) : null}
        </div>

        {wa.connected ? (
          <div style={{ marginTop: 16 }}>
            <p className="hint">{'Terakhir, di dashboard Meta buka WhatsApp > Configuration > Webhook, tempel dua data ini, klik Verify and save, lalu subscribe ke field '}<b>messages</b>{'.'}</p>
            <label>Callback URL</label>
            <pre>{wa.webhookUrl}</pre>
            <div className="row"><button className="btn sm" type="button" onClick={() => copy(wa.webhookUrl, toast)}>Salin URL</button></div>
            <label>Verify token</label>
            <pre>{wa.verifyToken}</pre>
            <div className="row"><button className="btn sm" type="button" onClick={() => copy(wa.verifyToken, toast)}>Salin token</button></div>
            <p className="hint" style={{ marginTop: 12 }}>{'Nomor terhubung: '}<b>{wa.number || wa.phoneId}</b>{'. Balasan bebas hanya bisa dikirim dalam 24 jam setelah pelanggan terakhir menulis (aturan WhatsApp).'}</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
