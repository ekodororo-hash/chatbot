'use strict';

// Pembuat QR code tanpa dependensi: mode byte (UTF-8), koreksi galat M, versi 1-10.
// Cukup untuk link chat (muat sampai 213 byte). Dipakai di browser dan di Node.
//   const q = encode('https://contoh.com/chat/toko');   // { size, modules: boolean[][] }
//   toSvg(q)  -> string SVG hitam di atas putih, lengkap dengan zona tenang

// [byte koreksi per blok, jumlah blok grup 1, data per blok grup 1, jumlah blok grup 2, data per blok grup 2]
const EC_M = [
  null,
  [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]
];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const MAX_VERSION = 10;

// Aritmetika GF(256) untuk Reed-Solomon (polinomial 0x11D).
const EXP = new Array(512);
const LOG = new Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(deg) {
  let g = [1];
  for (let i = 0; i < deg; i++) {
    const n = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { n[j] ^= g[j]; n[j + 1] ^= gfMul(g[j], EXP[i]); }
    g = n;
  }
  return g;
}

function rsRemainder(data, gen) {
  const ec = gen.length - 1;
  const rem = new Array(ec).fill(0);
  for (let k = 0; k < data.length; k++) {
    const f = data[k] ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < ec; i++) rem[i] ^= gfMul(gen[i + 1], f);
  }
  return rem;
}

function utf8(text) {
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
  return Array.from(Buffer.from(text, 'utf8'));
}

function dataCodewords(v) {
  const e = EC_M[v];
  return e[1] * e[2] + e[3] * e[4];
}

function pickVersion(len) {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const need = 4 + (v < 10 ? 8 : 16) + len * 8;
    if (need <= dataCodewords(v) * 8) return v;
  }
  return 0;
}

function buildCodewords(bytes, v) {
  const cap = dataCodewords(v) * 8;
  const bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4);
  put(bytes.length, v < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }

  const [ecLen, n1, d1, n2, d2] = EC_M[v];
  const gen = rsGenerator(ecLen);
  const blocks = [];
  let p = 0;
  for (let i = 0; i < n1 + n2; i++) {
    const len = i < n1 ? d1 : d2;
    const d = data.slice(p, p + len);
    p += len;
    blocks.push({ d, e: rsRemainder(d, gen) });
  }
  const out = [];
  const maxD = Math.max(d1, d2);
  for (let i = 0; i < maxD; i++) blocks.forEach((b) => { if (i < b.d.length) out.push(b.d[i]); });
  for (let i = 0; i < ecLen; i++) blocks.forEach((b) => out.push(b.e[i]));
  return out;
}

function makeMatrix(v, codewords) {
  const size = 17 + 4 * v;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x, y, dark) => { m[y][x] = !!dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(x, y, d !== 2 && d !== 4);
      }
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const pos = ALIGN[v];
  pos.forEach((px, i) => pos.forEach((py, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));

  function formatBits(mask) {
    const data = mask; // level M = 00
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  }
  formatBits(0);

  if (v >= 7) {
    let rem = v;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (v << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFn(a, b, dark); setFn(b, a, dark);
    }
  }

  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && i < codewords.length * 8) {
          m[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  ];
  const applyMask = (k) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x];
  };

  function penalty() {
    let p = 0;
    const lines = [];
    for (let a = 0; a < size; a++) {
      lines.push(m[a].slice());
      lines.push(m.map((row) => row[a]));
    }
    const P1 = [true, false, true, true, true, false, true, false, false, false, false];
    const P2 = [false, false, false, false, true, false, true, true, true, false, true];
    lines.forEach((ln) => {
      let run = 1;
      for (let k = 1; k <= size; k++) {
        if (k < size && ln[k] === ln[k - 1]) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      for (let k = 0; k + 11 <= size; k++) {
        let a1 = true, a2 = true;
        for (let t = 0; t < 11; t++) { if (ln[k + t] !== P1[t]) a1 = false; if (ln[k + t] !== P2[t]) a2 = false; }
        if (a1) p += 40;
        if (a2) p += 40;
      }
    });
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
      }
    }
    let dark = 0;
    m.forEach((row) => row.forEach((c) => { if (c) dark++; }));
    const total = size * size;
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  }

  let best = 0, bestP = Infinity;
  for (let k = 0; k < 8; k++) {
    applyMask(k);
    formatBits(k);
    const p = penalty();
    if (p < bestP) { bestP = p; best = k; }
    applyMask(k);
  }
  applyMask(best);
  formatBits(best);
  return { size, modules: m };
}

// Kembalikan { size, modules } atau lempar error kalau teks terlalu panjang (> 213 byte).
function encode(text) {
  const bytes = utf8(String(text));
  const v = pickVersion(bytes.length);
  if (!v) throw new Error('Teks terlalu panjang untuk QR code.');
  return makeMatrix(v, buildCodewords(bytes, v));
}

// Path SVG (satu perintah per deretan modul gelap), sudah termasuk zona tenang.
function svgPath(qr, border) {
  const b = border === undefined ? 4 : border;
  let d = '';
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.modules[y][x]) { x++; continue; }
      let e = x;
      while (e < qr.size && qr.modules[y][e]) e++;
      d += 'M' + (x + b) + ' ' + (y + b) + 'h' + (e - x) + 'v1h-' + (e - x) + 'z';
      x = e;
    }
  }
  return { d, total: qr.size + b * 2 };
}

function toSvg(qr, border) {
  const { d, total } = svgPath(qr, border);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="' + total * 10 + '" height="' + total * 10 + '" shape-rendering="crispEdges">' +
    '<rect width="' + total + '" height="' + total + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}

module.exports = { encode, svgPath, toSvg, MAX_VERSION };
