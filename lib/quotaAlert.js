'use strict';
// Notifikasi kuota balasan bulanan lewat Telegram admin toko.
// Tahap 1: kuota terpakai 80%. Tahap 2: kuota habis. Tiap tahap dikirim sekali per bulan kalender (WIB).
// Dipanggil dari bot setelah membalas. Tidak pernah melempar error: gagal kirim tidak boleh mengganggu pelanggan.
const notify = require('./notify');
const { getAdmin } = require('./supabase');

const WARN_AT = 0.8;

function monthKey(now) {
  const w = new Date((now || new Date()).getTime() + 7 * 3600000);
  return w.getUTCFullYear() + '-' + String(w.getUTCMonth() + 1).padStart(2, '0');
}

function stageFor(used, quota) {
  if (!(quota > 0)) return 0;
  if (used >= quota) return 2;
  if (used >= Math.ceil(quota * WARN_AT)) return 1;
  return 0;
}

const fmt = (n) => Number(n || 0).toLocaleString('id-ID');

function buildNotice(shop, stage, used, quota, planName) {
  const base = notify.appUrl();
  const link = base ? 'Tambah kuota: ' + base + '/dashboard/langganan' : 'Tambah kuota lewat menu Langganan di dashboard.';
  const shown = Math.min(used, quota);
  const title = stage === 2 ? 'Kuota balasan bulan ini habis' : 'Kuota balasan hampir habis';
  const body = stage === 2
    ? 'Kuota balasan otomatis paket ' + planName + ' bulan ini sudah habis (' + fmt(quota) + ' balasan). Sampai awal bulan depan, pesan pelanggan langsung masuk ke admin tanpa dijawab asisten.'
    : 'Kuota balasan otomatis paket ' + planName + ' sudah terpakai ' + fmt(shown) + ' dari ' + fmt(quota) + ' (' + Math.round(shown / quota * 100) + '%). Kalau habis, pesan pelanggan langsung masuk ke admin tanpa dijawab asisten.';
  return { subject: '[' + shop.name + '] ' + title, text: '[' + shop.name + '] ' + title + '\n' + body + '\n' + link };
}

// used = jumlah balasan bot bulan ini (termasuk yang baru dikirim). Mengembalikan ringkasan, tidak pernah melempar.
async function check({ shop, used, quota, planName, sb, now }) {
  try {
    const stage = stageFor(used, quota);
    if (!stage) return { skipped: true };
    sb = sb || getAdmin();
    // Tanpa penerima Telegram tidak ada yang bisa dikabari: jangan "memakai" jatah notifikasi bulan ini.
    const st = await notify.loadSettings(sb, shop.id);
    if (!st.tg_on || !(st.tg_chat_ids || []).length) return { skipped: true, noChannel: true };
    const month = monthKey(now);
    // Klaim atomik: dua pesan bersamaan hanya satu yang lolos.
    const r = await sb.from('shop_notify')
      .update({ quota_alert_month: month, quota_alert_stage: stage, updated_at: new Date().toISOString() })
      .eq('shop_id', shop.id)
      .or('quota_alert_month.is.null,quota_alert_month.neq.' + month + ',quota_alert_stage.lt.' + stage)
      .select('shop_id');
    if (r.error) throw r.error;
    if (!r.data || !r.data.length) return { skipped: true };
    const res = await notify.deliver(sb, shop, buildNotice(shop, stage, used, quota, planName || 'saat ini'));
    return { sent: res.telegram.sent, stage };
  } catch (e) {
    console.error('Notifikasi kuota gagal:', e && e.message);
    return { error: true };
  }
}

module.exports = { check, stageFor, monthKey, buildNotice, WARN_AT };
