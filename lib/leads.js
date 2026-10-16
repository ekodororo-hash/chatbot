'use strict';
// Kontak pengunjung yang bersedia dikabari soal promo (lead). Hanya logika murni, tanpa akses database.

const EMAIL = /^[a-z0-9][a-z0-9._%+'-]{0,63}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const MIN_CUSTOMER_MSGS = 4;   // kartu tawaran baru muncul setelah pelanggan mengirim sekian pesan
const MIN_INTEREST_MSGS = 2;   // ...dan sekian di antaranya benar-benar soal belanja (harga, stok, promo, produk)

// Pesan yang menunjukkan minat belanja. Pertanyaan seperti "ini web apa?", sapaan, atau terima kasih tidak dihitung.
const INTEREST = /\b(harga|harganya|hrg|brp|berapa|stok|stock|ready|tersedia|promo|diskon|voucher|kupon|potongan|murah|beli|membeli|order|pesan|memesan|checkout|ongkir|ongkos|kirim|pengiriman|warna|ukuran|size|katalog|produk|price|prices|cost|buy|discount|coupon|available|availability|shipping)\b/i;
function isShoppingInterest(text) { return INTEREST.test(String(text || '')); }

// Putusan murni: tawarkan kartu kontak sekarang? customerTexts = semua pesan pelanggan di percakapan ini (lama ke baru),
// pesan terakhir = pesan yang barusan dibalas. Syaratnya: cukup banyak pesan, minimal beberapa soal belanja, dan pesan
// yang barusan juga soal belanja, supaya kartu tidak muncul di tengah pertanyaan yang tidak nyambung.
function shouldOfferLead(customerTexts) {
  const t = (customerTexts || []).map(x => String(x || ''));
  if (t.length < MIN_CUSTOMER_MSGS) return false;
  if (!isShoppingInterest(t[t.length - 1])) return false;
  return t.filter(isShoppingInterest).length >= MIN_INTEREST_MSGS;
}

// Mengubah isian pengunjung jadi { kind, value } yang sudah rapi, atau null kalau bukan email/nomor yang masuk akal.
// Nomor Indonesia disatukan ke format 62812...; nomor negara lain harus diawali "+".
function normalizeContact(raw) {
  const s = String(raw || '').trim();
  if (!s || s.length > 120) return null;
  if (s.includes('@')) {
    const v = s.toLowerCase();
    return EMAIL.test(v) ? { kind: 'email', value: v } : null;
  }
  const plus = s.startsWith('+');
  const d = s.replace(/[\s().-]/g, '').replace(/^\+/, '');
  if (!/^\d{8,16}$/.test(d)) return null;
  let v;
  if (plus) v = d;
  else if (d.startsWith('0')) v = '62' + d.slice(1);
  else if (d.startsWith('62') || d.startsWith('8')) v = d.startsWith('8') ? '62' + d : d;
  else return null;
  if (v.startsWith('62') ? !/^62[1-9]\d{7,11}$/.test(v) : !/^[1-9]\d{7,14}$/.test(v)) return null;
  return { kind: 'phone', value: v };
}

// Tampilan nomor di dashboard: 6281234567890 -> +62 8123 4567 890
function formatContact(kind, value) {
  if (kind !== 'phone') return value;
  const d = String(value || '');
  return '+' + d.replace(/^(62)(\d{3,4})(\d{3,4})(\d*)$/, (m, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '));
}

// Tautan chat WhatsApp untuk nomor telepon; kosong untuk email.
function waLink(kind, value) {
  return kind === 'phone' && /^\d{8,16}$/.test(String(value)) ? 'https://wa.me/' + value : '';
}

// Sel CSV yang aman: dibungkus kutip, dan awalan = + - @ diberi tanda kutip tunggal supaya tidak dijalankan sebagai rumus Excel.
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

// rows: [{ kind, contact, created_at, topic? }]
function toCsv(rows) {
  const head = ['Jenis', 'Kontak', 'Tanggal', 'Yang ditanyakan'];
  const lines = [head.map(csvCell).join(',')];
  (rows || []).forEach(r => lines.push([r.kind === 'email' ? 'Email' : 'Telepon', r.contact, r.created_at, r.topic].map(csvCell).join(',')));
  return lines.join('\r\n');
}

module.exports = { normalizeContact, formatContact, waLink, toCsv, csvCell, MIN_CUSTOMER_MSGS, MIN_INTEREST_MSGS, isShoppingInterest, shouldOfferLead };
