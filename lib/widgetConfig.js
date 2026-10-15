'use strict';

const widgetIcons = require('./widgetIcons');

// Tampilan widget yang dipakai bersama oleh /api/widget/:slug dan halaman chat.
// Semua nilai divalidasi ulang di sini, jadi data aneh di database tidak sampai ke browser pengunjung.
const DEFAULT_COLOR = '#0b7a75';
const POS = ['right', 'left'];
const SIZE = ['kecil', 'sedang', 'besar'];
const SHAPE = ['bulat', 'kotak', 'lancip'];
const BUBBLE = ['bulat', 'kotak', 'lancip'];
const TZ = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'];
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const LOGO_MAX = 60000;
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function str(v, max) {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
  return Array.from(s).slice(0, max).join('');
}

function int(v, min, max, def) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
}

function logo(v) {
  return typeof v === 'string' && v.length <= LOGO_MAX && LOGO_RE.test(v) ? v : '';
}

function days(v) {
  const out = [];
  String(v == null ? '1,2,3,4,5,6' : v).split(',').forEach((d) => {
    const n = Number(d);
    if (d !== '' && Number.isInteger(n) && n >= 0 && n <= 6 && out.indexOf(n) < 0) out.push(n);
  });
  return out.sort();
}

function clean(shop) {
  const s = shop || {};
  return {
    color: /^#[0-9a-fA-F]{6}$/.test(s.accent) ? s.accent : DEFAULT_COLOR,
    pos: POS.includes(s.widget_pos) ? s.widget_pos : 'right',
    icon: str(s.widget_icon, 16) || '💬',
    svg: widgetIcons.iconPaths(str(s.widget_icon, 16)),   // ikon SVG bawaan ("svg:nama"), null kalau emoji/huruf
    logo: logo(s.widget_logo),
    label: str(s.widget_label, 30),
    teaser: str(s.widget_teaser, 100),
    size: SIZE.includes(s.widget_size) ? s.widget_size : 'sedang',
    shape: SHAPE.includes(s.widget_shape) ? s.widget_shape : 'bulat',
    bubble: BUBBLE.includes(s.widget_bubble) ? s.widget_bubble : 'bulat',
    ox: int(s.widget_ox, 0, 200, 20),
    oy: int(s.widget_oy, 0, 200, 20),
    hours: {
      on: s.hours_on === true,
      open: TIME_RE.test(s.hours_open) ? s.hours_open : '09:00',
      close: TIME_RE.test(s.hours_close) ? s.hours_close : '17:00',
      days: days(s.hours_days),
      tz: TZ.includes(s.hours_tz) ? s.hours_tz : 'Asia/Jakarta'
    },
    eta: int(s.reply_eta, 0, 1440, 0)
  };
}

module.exports = { clean, str, POS, SIZE, SHAPE, BUBBLE, TZ, DEFAULT_COLOR, LOGO_MAX };
