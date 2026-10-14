'use strict';
// Langganan lewat Midtrans Snap dan/atau DOKU Checkout. Hanya dipanggil dari server (kunci tidak pernah ke browser).
// Alur: pemilik klik beli -> checkout() membuat pembayaran 'pending' + transaksi di penyedia -> pelanggan bayar di halaman penyedia
// -> penyedia memanggil webhook (/api/midtrans atau /api/doku) -> notifikasi diverifikasi, dinormalkan jadi "event",
// lalu applyEvent() memperpanjang paket (sekali saja per pembayaran).
const crypto = require('crypto');
const { getAdmin } = require('./supabase');
const plans = require('./plans');
const settings = require('./settings');

// Key pembayaran: isian dari halaman admin (tabel app_settings) lebih dulu, lalu environment variable.
// Dimuat ulang (cache singkat) di awal setiap fungsi publik, supaya getter di bawah tetap sinkron.
let cfg = {};
async function refresh() { cfg = await settings.getAll(); }
const isTrue = (v) => String(v || '').toLowerCase() === 'true';

const TIMEOUT_MS = 10000;
const REUSE_MS = 23 * 3600000;   // tautan bayar yang masih berlaku dipakai ulang, supaya klik berulang tidak menumpuk tagihan
const DUE_MINUTES = 24 * 60;

function httpError(status, message) {
  const e = new Error(message);
  e.httpStatus = status;
  return e;
}

function appUrl() {
  const u = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
  return String(u || '').replace(/\/+$/, '');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  if (!x.length || x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

async function must(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function http(url, init) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, Object.assign({}, init, { signal: ctl.signal }));
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally { clearTimeout(timer); }
}

/* ============================ MIDTRANS ============================ */
const mt = {
  id: 'midtrans', name: 'Midtrans',
  key: () => cfg.MIDTRANS_SERVER_KEY || '',
  ready() { return !!this.key(); },
  production: () => isTrue(cfg.MIDTRANS_IS_PRODUCTION),
  snapBase() { return this.production() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com'; },
  apiBase() { return this.production() ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'; },
  call(url, init) {
    return http(url, Object.assign({}, init, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(this.key() + ':').toString('base64') }
    }));
  },
  async charge({ orderId, amount, planId, months, user }) {
    const p = plans.PLANS[planId];
    const body = {
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [{ id: planId + '-' + months, price: amount, quantity: 1, name: ('Langganan ' + p.name + ' ' + months + ' bulan').slice(0, 50) }],
      customer_details: { email: user && user.email ? user.email : undefined },
      expiry: { unit: 'hours', duration: 24 }
    };
    if (appUrl()) body.callbacks = { finish: appUrl() + '/dashboard/langganan?order=' + encodeURIComponent(orderId) };
    const r = await this.call(this.snapBase() + '/snap/v1/transactions', { method: 'POST', body: JSON.stringify(body) });
    if (!r.ok || !r.body.redirect_url) {
      console.error('Midtrans menolak transaksi:', r.status, JSON.stringify(r.body).slice(0, 300));
      throw httpError(502, 'Midtrans tidak bisa membuat tagihan. Coba lagi sebentar.');
    }
    return { url: r.body.redirect_url, token: r.body.token || null };
  },
  // Tanda tangan notifikasi: sha512(order_id + status_code + gross_amount + serverKey).
  signatureOk(n) {
    if (!this.key() || !n || !n.signature_key) return false;
    const expect = crypto.createHash('sha512').update(String(n.order_id) + String(n.status_code) + String(n.gross_amount) + this.key()).digest('hex');
    return safeEqual(expect, n.signature_key);
  },
  status(n) {
    const s = n.transaction_status;
    if (s === 'settlement' || (s === 'capture' && (!n.fraud_status || n.fraud_status === 'accept'))) return 'paid';
    if (s === 'expire') return 'expired';
    if (s === 'deny' || s === 'cancel' || s === 'failure') return 'failed';
    return 'pending';   // pending, capture yang masih ditinjau (challenge), refund, dan lainnya: tidak mengubah apa pun
  },
  event(n) { return { orderId: String(n.order_id || ''), amount: Number(n.gross_amount), status: this.status(n), paymentType: n.payment_type || null }; },
  async fetchEvent(orderId) {
    const r = await this.call(this.apiBase() + '/v2/' + encodeURIComponent(orderId) + '/status', { method: 'GET' });
    if (r.status === 404) return null;   // pelanggan belum memilih metode bayar
    if (!r.ok) throw httpError(502, 'Midtrans belum bisa dihubungi. Coba lagi sebentar.');
    return this.event(r.body);
  }
};

/* ============================ DOKU ============================ */
// DOKU Checkout (non-SNAP). Tanda tangan: HMAC-SHA256 (Secret Key) atas baris
//   Client-Id:..\nRequest-Id:..\nRequest-Timestamp:..\nRequest-Target:<path>\nDigest:<base64 sha256 body>   (Digest hanya untuk POST)
// lalu base64, dikirim sebagai "HMACSHA256=<hasil>". Notifikasi dari DOKU memakai rumus yang sama (Request-Target = path Notification URL).
function dokuSignature({ clientId, requestId, timestamp, target, body, secret }) {
  const lines = ['Client-Id:' + clientId, 'Request-Id:' + requestId, 'Request-Timestamp:' + timestamp, 'Request-Target:' + target];
  if (body !== undefined && body !== null) lines.push('Digest:' + crypto.createHash('sha256').update(body, 'utf8').digest('base64'));
  return 'HMACSHA256=' + crypto.createHmac('sha256', secret).update(lines.join('\n'), 'utf8').digest('base64');
}

const doku = {
  id: 'doku', name: 'DOKU',
  clientId: () => cfg.DOKU_CLIENT_ID || '',
  secret: () => cfg.DOKU_SECRET_KEY || '',
  ready() { return !!(this.clientId() && this.secret()); },
  production: () => isTrue(cfg.DOKU_IS_PRODUCTION),
  base() { return this.production() ? 'https://api.doku.com' : 'https://api-sandbox.doku.com'; },
  headers(target, body) {
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');   // UTC, tanpa milidetik
    return {
      Accept: 'application/json', 'Content-Type': 'application/json',
      'Client-Id': this.clientId(), 'Request-Id': requestId, 'Request-Timestamp': timestamp,
      Signature: dokuSignature({ clientId: this.clientId(), requestId, timestamp, target, body, secret: this.secret() })
    };
  },
  async charge({ orderId, amount, user }) {
    const target = '/checkout/v1/payment';
    // Satu kali serialisasi: byte yang di-hash untuk Digest harus sama persis dengan yang dikirim.
    const body = JSON.stringify({
      order: Object.assign({ amount, invoice_number: orderId }, appUrl() ? { callback_url: appUrl() + '/dashboard/langganan?order=' + encodeURIComponent(orderId) } : {}),
      payment: { payment_due_date: DUE_MINUTES },
      customer: user && user.email ? { email: user.email } : undefined
    });
    const r = await http(this.base() + target, { method: 'POST', headers: this.headers(target, body), body });
    const url = r.body && r.body.response && r.body.response.payment && r.body.response.payment.url;
    if (!r.ok || !url) {
      console.error('DOKU menolak transaksi:', r.status, JSON.stringify(r.body).slice(0, 300));
      throw httpError(502, 'DOKU tidak bisa membuat tagihan. Coba lagi sebentar.');
    }
    return { url, token: r.body.response.payment.token_id || null };
  },
  // Verifikasi notifikasi: header Client-Id harus milik kita dan Signature cocok dengan hitungan ulang dari body mentah.
  signatureOk({ headers, raw, target }) {
    if (!this.ready() || !headers || !headers.signature || !raw) return false;
    if (!safeEqual(this.clientId(), headers.clientId)) return false;
    const expect = dokuSignature({ clientId: headers.clientId, requestId: headers.requestId, timestamp: headers.timestamp, target, body: raw, secret: this.secret() });
    return safeEqual(expect, headers.signature);
  },
  // DOKU hanya berarti SUCCESS atau FAILED. FAILED diabaikan: pelanggan boleh mencoba metode bayar lain di halaman yang sama.
  event(n) {
    const ok = n && n.transaction && n.transaction.status === 'SUCCESS';
    return {
      orderId: String((n && n.order && n.order.invoice_number) || ''), amount: Number(n && n.order && n.order.amount),
      status: ok ? 'paid' : 'pending', paymentType: (n && n.channel && n.channel.id) || (n && n.service && n.service.id) || null
    };
  },
  async fetchEvent(orderId) {
    const target = '/orders/v1/status/' + encodeURIComponent(orderId);
    const r = await http(this.base() + target, { method: 'GET', headers: this.headers(target) });
    if (r.status === 404) return null;
    if (!r.ok) throw httpError(502, 'DOKU belum bisa dihubungi. Coba lagi sebentar.');
    const ev = this.event(r.body);
    // Status order (ORDER_GENERATED dst.) tidak memuat transaksi: itu berarti belum dibayar.
    if (!ev.orderId) ev.orderId = orderId;
    return ev;
  }
};

const PROVIDERS = { midtrans: mt, doku };
const providerList = () => Object.values(PROVIDERS).filter((p) => p.ready());
const ready = () => providerList().length > 0;

async function getBilling(sb, shopId) {
  return must(sb.from('shop_billing').select('plan,expires_at').eq('shop_id', shopId).maybeSingle());
}

// Paket yang berlaku untuk sebuah toko (dipakai bot.js untuk kuota bulanan).
async function currentPlan(sb, shopId, now) {
  return plans.effectivePlan(await getBilling(sb, shopId), now);
}

// Data untuk halaman Langganan.
async function status(sb, shop, now) {
  await refresh();
  now = now || new Date();
  const row = await getBilling(sb, shop.id);
  const plan = plans.effectivePlan(row, now);
  const { count, error } = await sb.from('messages').select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id).eq('role', 'bot').gte('created_at', plans.startOfMonthWIB(now).toISOString());
  if (error) throw error;
  const pays = await must(sb.from('payments').select('order_id,plan,months,amount,status,provider,created_at,paid_at')
    .eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(10));
  return {
    ready: ready(),
    providers: providerList().map((p) => ({ id: p.id, name: p.name, sandbox: !p.production() })),
    plan: plan.id, expiresAt: plan.id === 'free' ? null : row.expires_at,
    used: count || 0, quota: plan.quota,
    plans: Object.values(plans.PLANS).map((p) => ({ id: p.id, name: p.name, price: p.price, quota: p.quota })),
    terms: Object.keys(plans.TERMS).map((m) => ({
      months: Number(m), discount: plans.TERMS[m],
      prices: { starter: plans.priceFor('starter', Number(m)), bisnis: plans.priceFor('bisnis', Number(m)) }
    })),
    payments: pays || []
  };
}

// Membuat (atau memakai ulang) tagihan. Mengembalikan alamat halaman bayar penyedia.
async function checkout({ shop, user, planId, months, provider, now }) {
  await refresh();
  if (!ready()) throw httpError(503, 'Pembayaran belum diaktifkan oleh pengelola layanan.');
  // Tanpa pilihan: pakai penyedia pertama yang aktif. Pilihan yang belum diaktifkan ditolak.
  const prov = provider ? PROVIDERS[Object.prototype.hasOwnProperty.call(PROVIDERS, provider) ? provider : ''] : providerList()[0];
  if (!prov || !prov.ready()) throw httpError(400, 'Metode pembayaran tidak tersedia.');
  months = Number(months);
  const amount = plans.priceFor(planId, months);
  if (amount === null) throw httpError(400, 'Paket atau lama langganan tidak valid.');
  now = now || new Date();
  const sb = getAdmin();

  const cur = plans.effectivePlan(await getBilling(sb, shop.id), now);
  if (cur.rank > plans.PLANS[planId].rank) {
    throw httpError(409, 'Paket ' + cur.name + ' masih aktif. Pilih paket yang sama atau lebih tinggi.');
  }

  const since = new Date(now.getTime() - REUSE_MS).toISOString();
  const open = await must(sb.from('payments').select('redirect_url,amount')
    .eq('shop_id', shop.id).eq('plan', planId).eq('months', months).eq('provider', prov.id).eq('status', 'pending').gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1));
  if (open && open[0] && open[0].redirect_url && Number(open[0].amount) === amount) return { url: open[0].redirect_url, reused: true };

  // Maksimal 30 karakter (batas DOKU untuk kartu kredit; Midtrans 50).
  const orderId = 'AT-' + shop.id.slice(0, 8) + '-' + now.getTime().toString(36) + '-' + crypto.randomBytes(2).toString('hex');
  const r = await prov.charge({ orderId, amount, planId, months, user });
  await must(sb.from('payments').insert({
    order_id: orderId, shop_id: shop.id, plan: planId, months, amount, status: 'pending', provider: prov.id,
    snap_token: r.token, redirect_url: r.url
  }));
  return { url: r.url, reused: false };
}

// Memproses event pembayaran (sudah diverifikasi). Aman dipanggil berulang: perpanjangan hanya terjadi sekali per pembayaran.
async function applyEvent(ev, now) {
  now = now || new Date();
  const sb = getAdmin();
  const pay = await must(sb.from('payments').select('order_id,shop_id,plan,months,amount,status').eq('order_id', String(ev.orderId || '')).maybeSingle());
  if (!pay) return { handled: false, reason: 'order tidak dikenal' };
  if (ev.status === 'paid' && ev.amount !== Number(pay.amount)) {
    console.error('Jumlah notifikasi tidak cocok:', pay.order_id, ev.amount, pay.amount);
    return { handled: false, reason: 'jumlah tidak cocok' };
  }
  if (pay.status === 'paid') return { handled: true, status: 'paid', already: true };
  if (ev.status === 'pending') return { handled: true, status: pay.status };
  const extra = { payment_type: ev.paymentType };

  if (ev.status !== 'paid') {
    // Gagal/kedaluwarsa tidak boleh menimpa pembayaran yang sudah berhasil (filter status <> paid).
    await must(sb.from('payments').update(Object.assign({ status: ev.status }, extra)).eq('order_id', pay.order_id).neq('status', 'paid'));
    return { handled: true, status: ev.status };
  }

  // Klaim atomik: hanya satu pemanggil yang mengubah baris ini menjadi 'paid' dan mendapat hasilnya kembali.
  const claimed = await must(sb.from('payments').update(Object.assign({ status: 'paid', paid_at: now.toISOString() }, extra))
    .eq('order_id', pay.order_id).neq('status', 'paid').select('order_id'));
  if (!claimed || !claimed.length) return { handled: true, status: 'paid', already: true };

  try {
    const row = await getBilling(sb, pay.shop_id);
    const expires = plans.nextExpiry(row, pay.plan, pay.months, now);
    await must(sb.from('shop_billing').upsert({ shop_id: pay.shop_id, plan: pay.plan, expires_at: expires.toISOString(), updated_at: now.toISOString() }, { onConflict: 'shop_id' }));
    return { handled: true, status: 'paid', expiresAt: expires.toISOString() };
  } catch (e) {
    // Perpanjangan gagal: kembalikan ke pending dan lempar error supaya penyedia mengirim ulang notifikasi.
    await sb.from('payments').update({ status: 'pending', paid_at: null }).eq('order_id', pay.order_id);
    throw e;
  }
}

// Menanyakan status ke penyedia langsung (tombol "Periksa" bila webhook belum sampai).
async function syncOrder(shop, orderId, now) {
  await refresh();
  const sb = getAdmin();
  const pay = await must(sb.from('payments').select('order_id,shop_id,provider').eq('order_id', String(orderId || '')).maybeSingle());
  if (!pay || pay.shop_id !== shop.id) throw httpError(404, 'Pembayaran tidak ditemukan.');
  const prov = PROVIDERS[pay.provider || 'midtrans'];
  if (!prov || !prov.ready()) throw httpError(503, 'Pembayaran belum diaktifkan oleh pengelola layanan.');
  const ev = await prov.fetchEvent(pay.order_id);
  if (!ev) return { handled: true, status: 'pending' };
  ev.orderId = pay.order_id;
  return applyEvent(ev, now);
}

async function handleNotification(n, now) {
  await refresh();
  if (!mt.signatureOk(n)) throw httpError(401, 'Tanda tangan tidak valid');
  return applyEvent(mt.event(n), now);
}

// input: { headers: { clientId, requestId, timestamp, signature }, raw: body mentah (string), target: path Notification URL }
async function handleDokuNotification(input, now) {
  await refresh();
  if (!doku.signatureOk(input)) throw httpError(401, 'Tanda tangan tidak valid');
  let n;
  try { n = JSON.parse(input.raw); } catch (e) { throw httpError(400, 'Format salah'); }
  return applyEvent(doku.event(n), now);
}

module.exports = {
  ready, status, checkout, syncOrder, currentPlan, httpError,
  handleNotification, handleDokuNotification,
  signatureOk: (n) => mt.signatureOk(n), mapStatus: (n) => mt.status(n), dokuSignature
};
