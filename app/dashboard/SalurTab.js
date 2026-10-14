'use client';
import { useCallback, useEffect, useState } from 'react';
import { Busy } from './helpers';
import { Sk } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import { Panduan } from '../components/Panduan';

async function api(sb, shopId, method, body) {
  const { data } = await sb.auth.getSession();
  const tok = data && data.session && data.session.access_token;
  const res = await fetch('/api/channels', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, 'X-Shop-Id': shopId },
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

const PanduanTelegram = () => (
  <Panduan title="Cara membuat bot Telegram">
    <ol>
      <li>Buka Telegram, cari <b>@BotFather</b> (yang ada centang biru), lalu tekan <b>Start</b>.</li>
      <li>Kirim perintah <b>/newbot</b>.</li>
      <li>Tulis nama bot. Bebas, ini yang terlihat pelanggan di chat, misalnya <i>Toko Ayu</i>.</li>
      <li>Tulis username bot. Harus unik dan berakhiran <b>bot</b>, misalnya <i>tokoayu_bot</i>.</li>
      <li>BotFather membalas dengan token, bentuknya seperti <i>123456789:AAH...</i>. Salin seluruhnya.</li>
      <li>Tempel token di kolom di bawah, lalu klik <b>Hubungkan</b>. Webhook dipasang otomatis.</li>
      <li>Coba: klik <b>Buka bot</b>, kirim pesan, dan bot akan membalas.</li>
    </ol>
    <p className="hint">Token adalah kunci bot, jangan dibagikan. Kalau bocor, kirim /revoke ke BotFather, lalu hubungkan lagi dengan token baru.</p>
  </Panduan>
);

const PanduanWhatsApp = () => (
  <Panduan title="Cara menyiapkan WhatsApp Business">
    <p className="hint" style={{ marginTop: 0 }}>Yang dibutuhkan: akun Facebook, dan satu nomor telepon yang bisa menerima SMS atau telepon verifikasi. Nomor itu tidak boleh sedang terdaftar di aplikasi WhatsApp biasa atau WhatsApp Business. Kalau sudah terdaftar, hapus akunnya di aplikasi dulu.</p>
    <ol>
      <li>Buka <b>developers.facebook.com</b>, login, klik <b>My Apps</b> lalu <b>Create App</b>. Pilih opsi WhatsApp (Connect with customers through WhatsApp) dan hubungkan ke Meta Business portfolio. Buat baru kalau belum punya.</li>
      <li>Di dashboard app, buka <b>WhatsApp</b> lalu <b>API Setup</b>. Di situ ada nomor uji coba dari Meta. Untuk memakai nomor tokomu sendiri, klik <b>Add phone number</b> dan masukkan kode verifikasinya.</li>
      <li>Salin <b>Phone number ID</b> dari halaman API Setup. Ini bukan nomor teleponnya, tapi deretan angka panjang di bawahnya.</li>
      <li>Salin <b>App Secret</b>: buka <b>App settings</b>, lalu <b>Basic</b>, klik <b>Show</b> di samping App secret.</li>
      <li>Buat <b>Access token permanen</b>. Token di API Setup hanya berlaku sekitar 24 jam, jadi jangan dipakai. Buka <b>business.facebook.com</b>, lalu <b>Business Settings</b>, <b>Users</b>, <b>System users</b>, klik <b>Add</b> dengan peran Admin. Klik <b>Add Assets</b>, pilih app-mu dan beri <b>Full control</b>. Klik <b>Generate token</b>, pilih app, masa berlaku <b>Never</b>, lalu centang <b>whatsapp_business_messaging</b> dan <b>whatsapp_business_management</b>. Salin tokennya.</li>
      <li>Isi Phone number ID, Access token, dan App Secret di form di bawah, lalu klik <b>Simpan</b>.</li>
      <li>Setelah tersimpan, <b>Callback URL</b> dan <b>Verify token</b> muncul di bawah form. Di Meta buka <b>WhatsApp</b>, <b>Configuration</b>, <b>Webhook</b>, klik <b>Edit</b>, tempel keduanya, lalu <b>Verify and save</b>. Setelah itu subscribe ke field <b>messages</b>.</li>
      <li>Coba kirim pesan WhatsApp ke nomor itu dan bot akan membalas.</li>
    </ol>
    <p className="hint">Selama app Meta masih berstatus Development, bot hanya membalas nomor yang terdaftar sebagai admin atau tester di app. Supaya semua pelanggan bisa chat, ubah app ke mode Live. Meta biasanya meminta URL kebijakan privasi. Tampilan Meta sering berubah, jadi nama menunya bisa sedikit berbeda.</p>
  </Panduan>
);

// Dua kartu di halaman Notifikasi: sambungkan bot Telegram dan nomor WhatsApp Business.
export default function SalurTab({ sb, shop, fail, toast }) {
  const [st, setSt] = useState(null);
  const [ask, confirmNode] = useConfirm();
  const [tgToken, setTgToken] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [waToken, setWaToken] = useState('');
  const [waSecret, setWaSecret] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState({ tg: '', wa: '' });

  const load = useCallback(async () => {
    try { setSt(await api(sb, shop.id, 'GET')); } catch (e) { fail(e); }
  }, [sb, shop.id, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (st && st.whatsapp.phoneId) setPhoneId(st.whatsapp.phoneId); }, [st]);

  async function run(key, errKey, body, okMsg) {
    setBusy(key); setErr((p) => ({ ...p, [errKey]: '' }));
    try {
      setSt(await api(sb, shop.id, 'POST', body));
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
        <h2>Telegram</h2>
        <PanduanTelegram />
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
        <h2>WhatsApp</h2>
        <PanduanWhatsApp />
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
