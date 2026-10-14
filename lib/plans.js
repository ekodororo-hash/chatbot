'use strict';
// Paket langganan. Ubah harga dan kuota di sini; tidak ada angka paket di tempat lain.
// quota = jumlah balasan bot per bulan kalender (WIB) per toko. Setelah habis, pesan masuk ke admin
// tanpa memanggil AI (sama seperti batas harian). rank dipakai untuk melarang turun paket saat paket lebih tinggi masih aktif.
// promo = diskon paket (persen, 0 sampai 90) yang berlaku untuk semua lama langganan, ditumpuk dengan diskon lama langganan.
// Nilai di bawah adalah bawaan; admin bisa menimpanya dari halaman /admin/paket (lihat configure()).
const DEFAULTS = {
  free:    { id: 'free',    name: 'Gratis',  price: 0,      quota: 100,  promo: 0, rank: 0 },
  starter: { id: 'starter', name: 'Starter', price: 49000,  quota: 1500, promo: 0, rank: 1 },
  bisnis:  { id: 'bisnis',  name: 'Bisnis',  price: 149000, quota: 6000, promo: 0, rank: 2 }
};
const PLANS = JSON.parse(JSON.stringify(DEFAULTS));

// Lama langganan dan potongan harga (persen). Satu "bulan" = 30 hari.
const DEFAULT_TERMS = { 1: 0, 3: 5, 12: 15 };
const TERMS = Object.assign({}, DEFAULT_TERMS);
const DAYS_PER_MONTH = 30;
const DAY_MS = 86400000;

// Harga total untuk paket berbayar dan lama tertentu, dalam rupiah bulat. null bila tidak valid.
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function priceFor(planId, months) {
  const p = has(PLANS, planId) ? PLANS[planId] : null;
  if (!p || p.price <= 0 || !has(TERMS, months)) return null;
  return Math.round(p.price * (100 - (p.promo || 0)) / 100 * months * (100 - TERMS[months]) / 100);
}

// Harga sebelum diskon apa pun (harga normal x bulan), untuk dicoret di tampilan. null bila tidak valid.
function listPriceFor(planId, months) {
  const p = has(PLANS, planId) ? PLANS[planId] : null;
  if (!p || p.price <= 0 || !has(TERMS, months)) return null;
  return p.price * months;
}

/* ---- Pengaturan dari admin ----
   cfg = { plans: { starter: { name, price, quota, promo }, ... }, terms: { 1: 0, 3: 5, 12: 15 } }
   sanitize() memeriksa dan membersihkan isian (melempar Error bila tidak masuk akal), configure() menerapkannya ke PLANS/TERMS. */
const bad = (m) => Object.assign(new Error(m), { httpStatus: 400 });
const whole = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isInteger(Number(v)) ? Number(v) : NaN;

function sanitize(cfg) {
  cfg = cfg || {};
  const out = { plans: {}, terms: {} };
  Object.keys(DEFAULTS).forEach((id) => {
    const src = has(cfg.plans || {}, id) ? cfg.plans[id] : {};
    const base = DEFAULTS[id];
    const name = String(src.name == null ? base.name : src.name).trim();
    if (!name || name.length > 30) throw bad('Nama paket wajib diisi (maksimal 30 huruf).');
    const quota = whole(src.quota == null ? base.quota : src.quota);
    if (!(quota >= 1 && quota <= 10000000)) throw bad('Jumlah chat paket ' + name + ' harus 1 sampai 10.000.000.');
    if (id === 'free') { out.plans[id] = { name, price: 0, quota, promo: 0 }; return; }
    const price = whole(src.price == null ? base.price : src.price);
    if (!(price >= 1000 && price <= 100000000)) throw bad('Harga paket ' + name + ' per bulan harus Rp1.000 sampai Rp100.000.000.');
    const promo = whole(src.promo == null ? 0 : src.promo);
    if (!(promo >= 0 && promo <= 90)) throw bad('Diskon paket ' + name + ' harus 0 sampai 90 persen.');
    out.plans[id] = { name, price, quota, promo };
  });
  Object.keys(DEFAULT_TERMS).forEach((m) => {
    const src = has(cfg.terms || {}, m) ? cfg.terms[m] : DEFAULT_TERMS[m];
    const d = whole(src);
    if (!(d >= 0 && d <= 90)) throw bad('Diskon lama langganan ' + m + ' bulan harus 0 sampai 90 persen.');
    out.terms[m] = d;
  });
  return out;
}

// Terapkan pengaturan admin. cfg kosong/rusak = kembali ke bawaan. Isian yang tidak lolos pemeriksaan diabaikan seluruhnya.
function configure(cfg) {
  let clean = null;
  if (cfg) { try { clean = sanitize(cfg); } catch (e) { clean = null; } }
  Object.keys(DEFAULTS).forEach((id) => {
    Object.assign(PLANS[id], DEFAULTS[id], clean ? clean.plans[id] : {});
  });
  Object.keys(DEFAULT_TERMS).forEach((m) => { TERMS[m] = clean ? clean.terms[m] : DEFAULT_TERMS[m]; });
}

// Pengaturan yang sedang berlaku, dalam bentuk yang sama dengan masukan sanitize() (dikirim ke halaman admin).
function current() {
  const plans = {};
  Object.keys(PLANS).forEach((id) => { const p = PLANS[id]; plans[id] = { name: p.name, price: p.price, quota: p.quota, promo: p.promo || 0 }; });
  return { plans, terms: Object.assign({}, TERMS), defaults: { plans: DEFAULTS, terms: DEFAULT_TERMS } };
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

module.exports = { PLANS, TERMS, priceFor, listPriceFor, sanitize, configure, current, effectivePlan, nextExpiry, startOfMonthWIB };
