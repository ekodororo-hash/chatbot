'use strict';
// Paket langganan. Ubah harga dan kuota di sini; tidak ada angka paket di tempat lain.
// quota = jumlah balasan bot per bulan kalender (WIB) per toko. Setelah habis, pesan masuk ke admin
// tanpa memanggil AI (sama seperti batas harian). rank dipakai untuk melarang turun paket saat paket lebih tinggi masih aktif.
const PLANS = {
  free:    { id: 'free',    name: 'Gratis',  price: 0,      quota: 100,  rank: 0 },
  starter: { id: 'starter', name: 'Starter', price: 49000,  quota: 1500, rank: 1 },
  bisnis:  { id: 'bisnis',  name: 'Bisnis',  price: 149000, quota: 6000, rank: 2 }
};

// Lama langganan dan potongan harga (persen). Satu "bulan" = 30 hari.
const TERMS = { 1: 0, 3: 5, 12: 15 };
const DAYS_PER_MONTH = 30;
const DAY_MS = 86400000;

// Harga total untuk paket berbayar dan lama tertentu, dalam rupiah bulat. null bila tidak valid.
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function priceFor(planId, months) {
  const p = has(PLANS, planId) ? PLANS[planId] : null;
  if (!p || p.price <= 0 || !has(TERMS, months)) return null;
  return Math.round(p.price * months * (100 - TERMS[months]) / 100);
}

// Paket yang berlaku sekarang. Baris belum ada, paket gratis, atau sudah lewat masa: gratis.
function effectivePlan(row, now) {
  now = now || new Date();
  if (row && has(PLANS, row.plan) && row.plan !== 'free' && row.expires_at && new Date(row.expires_at) > now) return PLANS[row.plan];
  return PLANS.free;
}

// Tanggal berakhir setelah pembayaran. Paket yang sama dan masih aktif: diperpanjang dari tanggal berakhir.
// Paket lain atau sudah habis: dihitung mulai sekarang.
function nextExpiry(row, planId, months, now) {
  now = now || new Date();
  const sameActive = row && row.plan === planId && row.expires_at && new Date(row.expires_at) > now;
  const base = sameActive ? new Date(row.expires_at) : now;
  return new Date(base.getTime() + months * DAYS_PER_MONTH * DAY_MS);
}

// Awal bulan kalender menurut WIB (UTC+7), dipakai untuk menghitung kuota bulanan.
function startOfMonthWIB(now) {
  now = now || new Date();
  const wib = new Date(now.getTime() + 7 * 3600000);
  wib.setUTCDate(1);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - 7 * 3600000);
}

module.exports = { PLANS, TERMS, priceFor, effectivePlan, nextExpiry, startOfMonthWIB };
