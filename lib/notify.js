'use strict';
// Notifikasi ke admin saat percakapan butuh ditangani, lewat Telegram.
// Semua fungsi publik tidak pernah melempar error: gagal kirim notifikasi tidak boleh mengganggu balasan ke pelanggan.
const crypto = require('crypto');
const { getAdmin } = require('./supabase');

const THROTTLE_MS = 15 * 60 * 1000;   // satu percakapan paling sering memicu satu notifikasi per 15 menit
const TIMEOUT_MS = 6000;
const MAX_CHATS = 10;

const REASON = {
  handoff: 'Butuh admin',
  order: 'Ada pesanan baru',
  waiting: 'Pelanggan menunggu balasan',
  test: 'Tes notifikasi'
};
const CHANNEL = { web: 'Web', telegram: 'Telegram', whatsapp: 'WhatsApp' };

function appUrl() {
  const u = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
  return String(u || '').replace(/\/+$/, '');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  if (!x.length || x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

async function timedFetch(url, opt) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try { return await fetch(url, Object.assign({}, opt, { signal: ctl.signal })); } finally { clearTimeout(t); }
}

// Isi notifikasi. info: { customerName, channel, text, convId }
function buildNotice(shop, reason, info) {
  const title = REASON[reason] || REASON.handoff;
  const who = (info.customerName || 'Pelanggan') + (CHANNEL[info.channel] ? ' (' + CHANNEL[info.channel] + ')' : '');
  const quote = String(info.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const base = appUrl();
  const link = base ? base + '/dashboard' + (info.convId ? '?s=' + shop.id + '&c=' + info.convId : '') : '';
  const lines = ['[' + shop.name + '] ' + title, 'Dari: ' + who];
  if (quote) lines.push('Pesan: ' + quote);
  if (link) lines.push('Buka: ' + link);
  return { subject: '[' + shop.name + '] ' + title, text: lines.join('\n') };
}

async function loadSettings(sb, shopId) {
  const r = await sb.from('shop_notify').select('*').eq('shop_id', shopId).maybeSingle();
  if (r.error) throw r.error;
  return r.data || { shop_id: shopId, tg_on: true, tg_code: '', tg_chat_ids: [] };
}

// Baris pengaturan dibuat saat pertama dibutuhkan (kode Telegram dibuat database).
async function ensureSettings(sb, shopId) {
  const cur = await sb.from('shop_notify').select('*').eq('shop_id', shopId).maybeSingle();
  if (cur.error) throw cur.error;
  if (cur.data) return cur.data;
  const ins = await sb.from('shop_notify').insert({ shop_id: shopId }).select('*').single();
  if (ins.error) {
    if (ins.error.code === '23505') {
      const again = await sb.from('shop_notify').select('*').eq('shop_id', shopId).maybeSingle();
      if (again.error || !again.data) throw (again.error || ins.error);
      return again.data;
    }
    throw ins.error;
  }
  return ins.data;
}

async function sendTelegramText(token, chatId, text) {
  const res = await timedFetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error('Telegram: ' + (j.description || ('HTTP ' + res.status)));
}

// Kirim ke semua tujuan yang aktif. Mengembalikan ringkasan: { telegram: {sent, error} }.
async function deliver(sb, shop, notice) {
  const out = { telegram: { sent: 0, error: '' } };
  let st;
  try { st = await loadSettings(sb, shop.id); } catch (e) { console.error('Notifikasi: gagal baca pengaturan', e && e.message); return out; }

  const jobs = [];
  if (st.tg_on && (st.tg_chat_ids || []).length) {
    jobs.push((async () => {
      const c = await sb.from('shop_channels').select('telegram_token').eq('shop_id', shop.id).maybeSingle();
      if (c.error) throw c.error;
      const token = c.data && c.data.telegram_token;
      if (!token) { out.telegram.error = 'Bot Telegram toko belum terhubung.'; return; }
      for (const id of st.tg_chat_ids) {
        try { await sendTelegramText(token, id, notice.text); out.telegram.sent++; }
        catch (e) { out.telegram.error = e.message; console.error('Notifikasi Telegram gagal:', e.message); }
      }
    })().catch((e) => { out.telegram.error = e.message; console.error('Notifikasi Telegram gagal:', e.message); }));
  }
  await Promise.all(jobs);
  return out;
}

// Mengklaim "jatah notifikasi" percakapan. Update bersyarat, jadi dua pesan bersamaan hanya satu yang lolos.
async function claim(sb, convId) {
  const cutoff = new Date(Date.now() - THROTTLE_MS).toISOString();
  const r = await sb.from('conversations').update({ notified_at: new Date().toISOString() })
    .eq('id', convId).or('notified_at.is.null,notified_at.lt.' + cutoff)
    .select('customer_name,channel');
  if (r.error) throw r.error;
  return r.data && r.data[0] ? r.data[0] : null;
}

// reason: 'handoff' | 'order' | 'waiting'
async function notifyAdmin({ shop, convId, reason, text }) {
  try {
    const sb = getAdmin();
    const row = await claim(sb, convId);
    if (!row) return { skipped: true };
    const notice = buildNotice(shop, reason, { customerName: row.customer_name, channel: row.channel, text, convId });
    return await deliver(sb, shop, notice);
  } catch (e) {
    console.error('Notifikasi gagal:', e && e.message);
    return { error: true };
  }
}

async function sendTest(shop) {
  try {
    const notice = buildNotice(shop, 'test', { customerName: 'Pelanggan contoh', channel: 'web', text: 'Ini pesan percobaan dari dashboard.' });
    return await deliver(getAdmin(), shop, notice);
  } catch (e) {
    console.error('Tes notifikasi gagal:', e && e.message);
    return { telegram: { sent: 0, error: 'Gagal.' } };
  }
}

// Perintah "/admin KODE" dari chat Telegram ke bot toko: mendaftarkan chat itu sebagai penerima notifikasi.
// "/admin stop" mencabut chat itu. Mengembalikan teks balasan, atau null kalau pesan ini bukan perintah yang sah
// (pesan lain, atau kode salah: diproses seperti pesan pelanggan biasa).
async function handleTelegramAdminCommand(shop, text, chatId) {
  const m = String(text || '').trim().match(/^\/admin(?:@\w+)?\s+(\S+)$/i);
  if (!m) return null;
  try {
    const sb = getAdmin();
    const st = await ensureSettings(sb, shop.id);
    const ids = st.tg_chat_ids || [];
    const id = String(chatId);
    const save = async (list) => {
      const u = await sb.from('shop_notify').update({ tg_chat_ids: list, updated_at: new Date().toISOString() }).eq('shop_id', shop.id);
      if (u.error) throw u.error;
    };
    if (m[1].toLowerCase() === 'stop') {
      if (!ids.includes(id)) return null;
      await save(ids.filter((x) => x !== id));
      return 'Notifikasi admin dimatikan untuk chat ini.';
    }
    if (!safeEqual(m[1], st.tg_code)) return null;
    if (ids.includes(id)) return 'Chat ini sudah menerima notifikasi admin toko "' + shop.name + '".';
    if (ids.length >= MAX_CHATS) return 'Penerima notifikasi sudah penuh (maksimal ' + MAX_CHATS + ' chat). Hapus salah satu lewat dashboard dulu.';
    await save(ids.concat(id));
    return 'Notifikasi admin aktif untuk toko "' + shop.name + '". Kamu akan dikabari di sini saat ada percakapan yang butuh admin. Kirim /admin stop untuk berhenti.';
  } catch (e) {
    console.error('Perintah /admin gagal:', e && e.message);
    return null;
  }
}

module.exports = {
  notifyAdmin, sendTest, handleTelegramAdminCommand, ensureSettings, loadSettings, deliver,
  buildNotice, appUrl, THROTTLE_MS, MAX_CHATS
};
