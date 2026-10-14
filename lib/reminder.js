'use strict';
// Pengingat masa langganan habis lewat Telegram admin toko. Dipanggil terjadwal (cron-job.org, sehari sekali)
// lewat /api/cron/langganan. Tiap tahap dikirim sekali per masa berlaku; setelah perpanjangan, hitungan mulai lagi.
const crypto = require('crypto');
const notify = require('./notify');
const plans = require('./plans');

const DAY = 86400000;
const EXPIRED_WINDOW_DAYS = 3;   // yang sudah habis lebih dari ini tidak diingatkan lagi

// Tahap: 1 = 7 hari lagi, 2 = 3 hari lagi, 3 = 1 hari lagi, 4 = sudah habis.
function stageFor(msLeft) {
  if (msLeft <= 0) return 4;
  if (msLeft <= DAY) return 3;
  if (msLeft <= 3 * DAY) return 2;
  if (msLeft <= 7 * DAY) return 1;
  return 0;
}

function dateWIB(d) {
  return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
}

function buildReminder(shop, row, stage, now) {
  const exp = new Date(row.expires_at);
  const plan = (plans.PLANS[row.plan] || {}).name || row.plan;
  const free = plans.PLANS.free || { name: 'Gratis', quota: 100 };
  const base = notify.appUrl();
  const link = base ? 'Perpanjang: ' + base + '/dashboard/langganan' : 'Perpanjang lewat menu Langganan di dashboard.';
  const days = Math.max(1, Math.ceil((exp - now) / DAY));
  const head = stage === 4
    ? 'Paket ' + plan + ' sudah berakhir pada ' + dateWIB(exp) + '. Toko sekarang memakai paket ' + free.name + ' (' + free.quota + ' balasan per bulan); kalau kuota habis, pesan pelanggan langsung masuk ke admin.'
    : 'Paket ' + plan + ' berakhir ' + (stage === 3 && days <= 1 ? 'dalam 1 hari' : days + ' hari lagi') + ' (' + dateWIB(exp) + '). Setelah itu toko memakai paket ' + free.name + ' (' + free.quota + ' balasan per bulan).';
  const title = stage === 4 ? 'Langganan berakhir' : 'Langganan segera berakhir';
  return { subject: '[' + shop.name + '] ' + title, text: '[' + shop.name + '] ' + title + '\n' + head + '\n' + link };
}

// Cek semua toko berbayar dan kirim pengingat yang jatuh tempo. Mengembalikan ringkasan.
async function run(sb, now) {
  now = now || new Date();
  const r = await sb.from('shop_billing').select('shop_id,plan,expires_at,reminded_stage,reminded_for').neq('plan', 'free').limit(5000);
  if (r.error) throw r.error;
  const out = { checked: 0, sent: 0, noChannel: 0, failed: 0 };
  for (const row of r.data || []) {
    if (!row.expires_at) continue;
    const exp = new Date(row.expires_at);
    if (isNaN(exp.getTime())) continue;
    const msLeft = exp.getTime() - now.getTime();
    if (msLeft < -EXPIRED_WINDOW_DAYS * DAY) continue;
    const stage = stageFor(msLeft);
    if (!stage) continue;
    out.checked++;
    const sameExpiry = row.reminded_for && new Date(row.reminded_for).getTime() === exp.getTime();
    if (stage <= (sameExpiry ? (row.reminded_stage || 0) : 0)) continue;
    try {
      const s = await sb.from('shops').select('id,name').eq('id', row.shop_id).maybeSingle();
      if (s.error || !s.data) continue;
      const res = await notify.deliver(sb, s.data, buildReminder(s.data, row, stage, now));
      if (res.telegram.sent > 0) {
        const u = await sb.from('shop_billing').update({ reminded_stage: stage, reminded_for: exp.toISOString() }).eq('shop_id', row.shop_id);
        if (u.error) throw u.error;
        out.sent++;
      } else if (res.telegram.error) out.failed++;
      else out.noChannel++;   // Telegram admin belum terhubung: dicoba lagi pada jadwal berikutnya
    } catch (e) {
      out.failed++;
      console.error('Pengingat langganan gagal:', e && e.message);
    }
  }
  return out;
}

// Rahasia dari header "Authorization: Bearer ..." atau parameter ?key=. Kosong di server = nonaktif.
function authorized(secret, authHeader, queryKey) {
  const want = Buffer.from(String(secret || ''));
  if (!want.length) return false;
  const m = String(authHeader || '').match(/^Bearer\s+(.+)$/i);
  const got = Buffer.from(String(m ? m[1].trim() : (queryKey || '')));
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

module.exports = { run, stageFor, buildReminder, authorized, EXPIRED_WINDOW_DAYS };
