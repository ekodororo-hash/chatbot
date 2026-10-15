'use strict';
// Impor produk dari CSV / hasil tempel dari Excel atau Google Sheets. Murni fungsi (tanpa jaringan),
// dipakai dashboard Produk dan dites di tests/orders.test.js.

const MAX_ROWS = 1000;
const MAX_NAME = 100;
const MAX_DESC = 300;
const MAX_PRICE = 100000000000;   // 100 miliar rupiah
const MAX_STOCK = 1000000000;

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const ALIASES = {
  name: ['nama', 'nama produk', 'produk', 'barang', 'nama barang', 'name', 'product', 'product name', 'item'],
  price: ['harga', 'harga jual', 'price'],
  stock: ['stok', 'stock', 'jumlah', 'qty', 'quantity'],
  description: ['deskripsi', 'keterangan', 'ket', 'description', 'desc']
};

// Memecah teks tabel menjadi baris-baris sel. Mengenal petik ganda (termasuk "" dan baris baru di dalam petik).
function splitRows(text, delim) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text == null ? '' : text).replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Pemisah dipilih dari baris pertama yang berisi: titik koma (Excel Indonesia), tab (tempel dari sheet), atau koma.
function detectDelimiter(text) {
  const first = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).find((l) => l.trim()) || '';
  let best = ',', bestN = 0;
  for (const d of ['\t', ';', ',']) {
    let n = 0, q = false;
    for (const c of first) { if (c === '"') q = !q; else if (c === d && !q) n++; }
    if (n > bestN) { best = d; bestN = n; }
  }
  return best;
}

// "25000", "25.000", "Rp 25.000", "25,000", "25.000,50" -> bilangan bulat rupiah. NaN kalau bukan harga.
function parsePrice(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase().replace(/rp\.?/g, '').replace(/\s+/g, '');
  if (!s) return NaN;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Math.round(Number(s.replace(/\./g, '').replace(',', '.')));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Math.round(Number(s.replace(/,/g, '')));
  if (/^\d+[.,]\d{1,2}$/.test(s)) return Math.round(Number(s.replace(',', '.')));
  return NaN;
}

// Stok kosong dianggap 0. "1.000" dibaca seribu. NaN kalau bukan bilangan bulat tidak negatif.
function parseStock(v) {
  const s = String(v == null ? '' : v).trim().replace(/\s+/g, '');
  if (!s) return 0;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ''), 10);
  return NaN;
}

function mapHeader(cells) {
  const col = {};
  cells.forEach((c, i) => {
    const k = norm(c);
    for (const field of Object.keys(ALIASES)) if (col[field] === undefined && ALIASES[field].includes(k)) col[field] = i;
  });
  return col;
}

// Hasil: { rows: [{ line, name, price, stock, description, error }], hasHeader, delimiter, tooMany, fatal }
// line = nomor baris di teks asli (mulai 1). Baris kosong dilewati. error kosong = baris sah.
function parseProducts(text) {
  const delimiter = detectDelimiter(text);
  const table = splitRows(text, delimiter);
  const out = { rows: [], hasHeader: false, delimiter, tooMany: false, fatal: '' };
  if (!table.some((r) => r.some((c) => String(c).trim()))) { out.fatal = 'Tidak ada data. Tempel isi tabel atau pilih file CSV.'; return out; }

  let col = { name: 0, price: 1, stock: 2, description: 3 };
  let start = 0;
  const hdr = mapHeader(table[0] || []);
  if (hdr.name !== undefined || hdr.price !== undefined) {
    out.hasHeader = true; start = 1;
    if (hdr.name === undefined) { out.fatal = 'Kolom nama produk tidak ditemukan. Beri judul kolom "Nama".'; return out; }
    if (hdr.price === undefined) { out.fatal = 'Kolom harga tidak ditemukan. Beri judul kolom "Harga".'; return out; }
    col = hdr;
  }
  const seen = new Map();
  for (let i = start; i < table.length; i++) {
    const cells = table[i];
    if (!cells.some((c) => String(c).trim())) continue;
    if (out.rows.length >= MAX_ROWS) { out.tooMany = true; break; }
    const get = (f) => (col[f] === undefined ? '' : String(cells[col[f]] == null ? '' : cells[col[f]]).trim());
    const name = get('name').replace(/\s+/g, ' ');
    const priceRaw = get('price'), stockRaw = get('stock');
    const price = parsePrice(priceRaw), stock = parseStock(stockRaw);
    const description = get('description').replace(/\s+/g, ' ').slice(0, MAX_DESC);
    let error = '';
    if (!name) error = 'Nama produk kosong';
    else if (name.length > MAX_NAME) error = 'Nama lebih dari ' + MAX_NAME + ' huruf';
    else if (!priceRaw) error = 'Harga kosong';
    else if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) error = 'Harga tidak valid: "' + priceRaw.slice(0, 20) + '"';
    else if (!Number.isFinite(stock) || stock < 0 || stock > MAX_STOCK) error = 'Stok tidak valid: "' + stockRaw.slice(0, 20) + '"';
    if (!error) {
      const key = norm(name);
      if (seen.has(key)) error = 'Nama ganda dengan baris ' + seen.get(key);
      else seen.set(key, i + 1);
    }
    out.rows.push({ line: i + 1, name, price: Number.isFinite(price) ? price : 0, stock: Number.isFinite(stock) ? stock : 0, description, error });
  }
  return out;
}

// Pisahkan baris sah menjadi yang ditambah dan yang memperbarui produk lama bernama sama (huruf besar/kecil diabaikan).
// existing: [{ id, name }]. mode: 'update' (bawaan) memperbarui harga, stok, deskripsi; 'skip' melewati yang sudah ada.
function planImport(validRows, existing, mode) {
  const byName = new Map();
  for (const p of existing || []) byName.set(norm(p.name), p);
  const plan = { insert: [], update: [], skipped: 0 };
  for (const r of validRows) {
    const cur = byName.get(norm(r.name));
    if (!cur) plan.insert.push({ name: r.name, price: r.price, stock: r.stock, description: r.description });
    else if (mode === 'skip') plan.skipped++;
    else plan.update.push({ id: cur.id, patch: { name: r.name, price: r.price, stock: r.stock, description: r.description } });
  }
  return plan;
}

// Isi file contoh. Titik koma + BOM supaya langsung rapi di Excel Indonesia.
function templateCsv() {
  return '\uFEFF' + [
    'Nama;Harga;Stok;Deskripsi',
    'Pashmina Ceruti;45000;24;Bahan adem dan jatuh',
    'Kerudung Voal Premium;85000;10;Tersedia banyak warna',
    'Paket Hemat 3 Pcs;120000;0;Stok sedang habis'
  ].join('\r\n') + '\r\n';
}

module.exports = { MAX_ROWS, parseProducts, parsePrice, parseStock, planImport, templateCsv, splitRows, detectDelimiter };
