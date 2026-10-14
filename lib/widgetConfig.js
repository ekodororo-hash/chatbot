'use strict';

// Tampilan widget yang dipakai bersama oleh /api/widget/:slug dan halaman chat.
// Semua nilai divalidasi ulang di sini, jadi data aneh di database tidak sampai ke browser pengunjung.
const DEFAULT_COLOR = '#0b7a75';
const POS = ['right', 'left'];
const SIZE = ['kecil', 'sedang', 'besar'];
const SHAPE = ['bulat', 'kotak'];

function str(v, max) {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
  return Array.from(s).slice(0, max).join('');
}

function clean(shop) {
  const s = shop || {};
  return {
    color: /^#[0-9a-fA-F]{6}$/.test(s.accent) ? s.accent : DEFAULT_COLOR,
    pos: POS.includes(s.widget_pos) ? s.widget_pos : 'right',
    icon: str(s.widget_icon, 8) || '\uD83D\uDCAC',
    label: str(s.widget_label, 30),
    teaser: str(s.widget_teaser, 100),
    size: SIZE.includes(s.widget_size) ? s.widget_size : 'sedang',
    shape: SHAPE.includes(s.widget_shape) ? s.widget_shape : 'bulat'
  };
}

module.exports = { clean, str, POS, SIZE, SHAPE, DEFAULT_COLOR };
