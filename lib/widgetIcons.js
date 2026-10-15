'use strict';

// Ikon SVG bawaan untuk tombol chat dan avatar. Tersimpan sebagai teks "svg:nama" di kolom widget_icon (maks 16 karakter),
// jadi tidak perlu migrasi database. Hanya nama di daftar ini yang dikenali, dan isinya hanya path (garis, 24x24),
// sehingga tidak ada markup dari luar yang bisa sampai ke halaman pengunjung. Warna mengikuti warna teks tombol.
const SVG_ICONS = {
  chat: { label: 'Chat', paths: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'] },
  pesan: { label: 'Pesan', paths: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'] },
  headset: { label: 'Headset', paths: ['M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3'] },
  cart: { label: 'Keranjang', paths: ['M8 20a1 1 0 1 0 2 0 1 1 0 1 0-2 0', 'M18 20a1 1 0 1 0 2 0 1 1 0 1 0-2 0', 'M2 3h2l2.7 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L22 7H5.1'] },
  bag: { label: 'Tas belanja', paths: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'] },
  phone: { label: 'Telepon', paths: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z'] },
  mail: { label: 'Email', paths: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm22 7-10 6L2 7'] },
  help: { label: 'Bantuan', paths: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3', 'M12 17h.01'] },
  gift: { label: 'Hadiah', paths: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'] },
  bot: { label: 'Robot', paths: ['M12 8V4H8', 'M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2'] },
  heart: { label: 'Hati', paths: ['M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z'] },
  star: { label: 'Bintang', paths: ['M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8l-6.2 3.3L7 14.2 2 9.3l6.9-1L12 2z'] },
  bolt: { label: 'Kilat', paths: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'] },
  user: { label: 'Orang', paths: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'] },
  smile: { label: 'Senyum', paths: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01'] }
};

// "svg:chat" -> daftar path, atau null kalau bukan ikon SVG yang dikenal (berarti ikon biasa: emoji atau huruf).
function iconPaths(icon) {
  const m = /^svg:([a-z0-9]{1,12})$/.exec(String(icon == null ? '' : icon).trim());
  return m && Object.prototype.hasOwnProperty.call(SVG_ICONS, m[1]) ? SVG_ICONS[m[1]].paths : null;
}

module.exports = { SVG_ICONS, iconPaths };
