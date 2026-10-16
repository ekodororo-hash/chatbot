'use strict';
// Nomor WhatsApp toko: terima 0812..., +62 812..., 62812..., lalu simpan sebagai digit saja dengan awalan 62 (format wa.me).
// Mengembalikan '' kalau tidak valid (8 sampai 15 digit setelah dinormalkan).
function clean(input) {
  let d = String(input == null ? '' : input).replace(/[\s().-]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (!/^\d+$/.test(d)) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '62' + d.slice(1);
  return d.length >= 8 && d.length <= 15 ? d : '';
}
module.exports = { clean };
