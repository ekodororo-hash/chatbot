'use strict';
// Pesanan terstruktur: merapikan rincian pesanan dari bot, menyimpannya, ekspor CSV, ringkasan omzet,
// dan teks kabar status untuk pelanggan. Tanpa dependensi, jadi dipakai server dan dashboard.

const STATUS = ['baru', 'diproses', 'selesai', 'batal'];
const OPEN = ['baru', 'diproses'];
const MAX_ITEMS = 30;
const MAX_QTY = 999;

const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Nomor telepon: hanya angka dan "+" di depan (spasi dan tanda hubung dibuang).
function cleanPhone(v) {
  const s = String(v == null ? '' : v).trim();
  const plus = s.startsWith('+') ? '+' : '';
  const digits = s.replace(/\D+/g, '');
  if (digits.length < 6 || digits.length > 20) return '';
  return plus + digits;
}

// Cari produk katalog dari nama yang disebut AI: persis dulu, lalu satu-satunya yang mengandung / terkandung.
function findProduct(name, products) {
  const n = norm(name);
  if (!n) return null;
  const list = products || [];
  const exact = list.find((p) => norm(p.name) === n);
  if (exact) return exact;
  const near = list.filter((p) => { const pn = norm(p.name); return pn && (pn.includes(n) || n.includes(pn)); });
  return near.length === 1 ? near[0] : null;
}

// raw = objek "pesanan" dari AI. Harga SELALU dari katalog (products), tidak pernah dari AI.
// Mengembalikan null kalau tidak ada item sama sekali.
function normalizeDetails(raw, products) {
  if (!raw || typeof raw !== 'object') return null;
  const src = Array.isArray(raw.item) ? raw.item : Array.isArray(raw.items) ? raw.items : [];
  const items = [];
  for (const it of src.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') continue;
    const nm = clip(it.produk || it.nama || it.name, 100);
    if (!nm) continue;
    let qty = parseInt(it.jumlah != null ? it.jumlah : (it.qty != null ? it.qty : 1), 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > MAX_QTY) qty = MAX_QTY;
    const p = findProduct(nm, products);
    if (p) {
      const price = Math.max(0, Math.round(Number(p.price) || 0));
      items.push({ name: String(p.name), qty, price, subtotal: price * qty, matched: true });
    } else {
      items.push({ name: nm, qty, price: null, subtotal: 0, matched: false });
    }
  }
  if (!items.length) return null;
  return {
    name: clip(raw.nama, 100),
    phone: cleanPhone(raw.telepon),
    address: clip(raw.alamat, 500),
    note: clip(raw.catatan, 500),
    items,
    subtotal: items.reduce((s, x) => s + x.subtotal, 0)
  };
}

// Simpan pesanan. Kalau percakapan ini masih punya pesanan terbuka (baru/diproses), baris itu diperbarui
// (pelanggan melengkapi data atau menambah barang) alih-alih membuat pesanan ganda.
// opts: { shop, conv, details, products, phone }. Mengembalikan baris pesanan, atau null kalau tidak ada rincian.
async function saveOrder(sb, opts) {
  const d = normalizeDetails(opts.details, opts.products);
  if (!d) return null;
  if (!d.phone) d.phone = cleanPhone(opts.phone);
  const cur = await sb.from('orders').select('*').eq('conversation_id', opts.conv.id).in('status', OPEN)
    .order('created_at', { ascending: false }).limit(1);
  if (cur.error) throw cur.error;
  const old = cur.data && cur.data[0];
  const now = new Date().toISOString();
  if (old) {
    const patch = { items: d.items, subtotal: d.subtotal, updated_at: now };
    ['name', 'phone', 'address', 'note'].forEach((k) => {
      const col = k === 'name' ? 'customer_name' : k;
      if (d[k]) patch[col] = d[k];
    });
    const u = await sb.from('orders').update(patch).eq('id', old.id);
    if (u.error) throw u.error;
    return Object.assign({}, old, patch);
  }
  const row = {
    shop_id: opts.shop.id, conversation_id: opts.conv.id, status: 'baru',
    customer_name: d.name, phone: d.phone, address: d.address, note: d.note,
    items: d.items, subtotal: d.subtotal
  };
  const ins = await sb.from('orders').insert(row).select('*').single();
  if (ins.error) throw ins.error;
  // Statistik widget: pesanan baru dari chat web. Gagal mencatat tidak boleh menggagalkan pesanan.
  if (!opts.conv.channel || opts.conv.channel === 'web') {
    try { await sb.rpc('widget_stat_add', { sid: opts.shop.id, kind: 'order' }); } catch (e) { /* migrasi belum dijalankan */ }
  }
  return ins.data;
}

/* ---------- Ekspor CSV ---------- */

const CHANNEL = { web: 'Web', telegram: 'Telegram', whatsapp: 'WhatsApp' };
const STATUS_LABEL = { baru: 'Baru', diproses: 'Diproses', selesai: 'Selesai', batal: 'Dibatalkan' };

// Titik koma sebagai pemisah: Excel berbahasa Indonesia membuka CSV bertitik koma langsung per kolom.
// Sel yang diawali = atau @ (atau + / - yang bukan angka) diberi petik di depan agar tidak dibaca sebagai rumus.
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=@\t\r]/.test(s) || /^[+-](?!\d+$)/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function wibStamp(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t + 7 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
}

function itemsText(items) {
  return (Array.isArray(items) ? items : []).map((x) => x.qty + 'x ' + x.name + (x.price != null ? ' @' + x.price : '')).join(', ');
}

// rows: baris tabel orders (opsional dengan field channel dari percakapan).
function toCsv(rows) {
  const head = ['Tanggal (WIB)', 'Pelanggan', 'Telepon', 'Alamat', 'Pesanan', 'Subtotal (Rp)', 'Status', 'Saluran', 'Catatan'];
  const lines = [head.map(csvCell).join(';')];
  for (const r of rows || []) {
    lines.push([
      wibStamp(r.created_at), r.customer_name, r.phone, r.address, itemsText(r.items),
      r.subtotal, STATUS_LABEL[r.status] || r.status, CHANNEL[r.channel] || r.channel || '', r.note
    ].map(csvCell).join(';'));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/* ---------- Ringkasan omzet ---------- */

// Omzet = subtotal pesanan berstatus selesai. Ongkir tidak termasuk (admin yang mengonfirmasinya).
// "berjalan" = nilai pesanan baru dan diproses. Pesanan batal tidak dihitung.
function summarize(rows, topN) {
  const out = { count: 0, done: 0, open: 0, canceled: 0, revenue: 0, pending: 0, top: [] };
  const qty = {};
  for (const r of rows || []) {
    if (r.status === 'batal') { out.canceled++; continue; }
    out.count++;
    if (r.status === 'selesai') { out.done++; out.revenue += Number(r.subtotal) || 0; }
    else { out.open++; out.pending += Number(r.subtotal) || 0; }
    for (const it of Array.isArray(r.items) ? r.items : []) {
      if (!it || !it.name) continue;
      qty[it.name] = (qty[it.name] || 0) + (parseInt(it.qty, 10) || 0);
    }
  }
  out.top = Object.keys(qty).map((name) => ({ name, qty: qty[name] })).sort((a, b) => b.qty - a.qty || (a.name > b.name ? 1 : -1)).slice(0, topN || 5);
  return out;
}

module.exports = {
  STATUS, OPEN, normalizeDetails, findProduct, cleanPhone, saveOrder,
  csvCell, toCsv, itemsText, wibStamp, summarize
};
