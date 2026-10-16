'use strict';

// Pilihan "Animasi saat muncul" untuk tombol chat. Tersimpan di kolom shops.widget_anim (teks).
// Toko lama yang belum punya nilainya: widget_animate true = membal (bawaan lama), false = tanpa.
const ANIMS = [
  { id: 'tanpa', label: 'Tanpa animasi', desc: 'Tombol langsung tampil begitu saja.' },
  { id: 'membal', label: 'Membal', desc: 'Membesar sedikit melewati ukuran asli lalu mantap. Bawaan.' },
  { id: 'pudar', label: 'Muncul pelan', desc: 'Perlahan terlihat dari transparan. Paling kalem.' },
  { id: 'naik', label: 'Naik dari bawah', desc: 'Meluncur naik dari bawah sambil terlihat.' },
  { id: 'geser', label: 'Geser dari samping', desc: 'Masuk dari sisi layar ke posisi tombol.' },
  { id: 'putar', label: 'Putar', desc: 'Berputar sambil membesar dari kecil.' },
  { id: 'goyang', label: 'Goyang', desc: 'Naik lalu bergoyang kiri-kanan.' },
  { id: 'denyut', label: 'Denyut', desc: 'Muncul membal, lalu memancarkan cincin 3 kali.' }
];
const IDS = ANIMS.map((a) => a.id);

function resolve(anim, animate) {
  return IDS.indexOf(anim) >= 0 ? anim : (animate === false ? 'tanpa' : 'membal');
}

// CSS animasi muncul untuk elemen `sel` (string kosong kalau 'tanpa'). kf = awalan nama keyframes,
// dx = arah geser (1 dari kanan, -1 dari kiri), color = #rrggbb untuk cincin Denyut.
// Badan fungsi ini juga disalin ke public/widget.js (animCss), jadi ubah keduanya sekaligus.
function rules(anim, sel, kf, dx, color) {
  if (anim === 'tanpa' || IDS.indexOf(anim) < 0) return '';
  var e = 'cubic-bezier(.2,.8,.2,1)', pop = 'cubic-bezier(.34,1.56,.64,1)', n = kf + '-in', ring = kf + '-ring';
  var membal = '@keyframes ' + n + '{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}';
  var A = {
    membal: [n + ' .5s ' + pop, membal],
    pudar: [n + ' .9s ease', '@keyframes ' + n + '{from{opacity:0}to{opacity:1}}'],
    naik: [n + ' .6s ' + e, '@keyframes ' + n + '{from{transform:translateY(46px);opacity:0}to{transform:none;opacity:1}}'],
    geser: [n + ' .6s ' + e, '@keyframes ' + n + '{from{transform:translateX(' + (dx * 120) + 'px);opacity:0}to{transform:none;opacity:1}}'],
    putar: [n + ' .75s ' + e, '@keyframes ' + n + '{from{transform:rotate(-200deg) scale(.2);opacity:0}to{transform:none;opacity:1}}'],
    goyang: [n + ' 1.1s ease', '@keyframes ' + n + '{0%{transform:translateY(26px);opacity:0}18%{transform:none;opacity:1}32%{transform:rotate(-7deg)}46%{transform:rotate(6deg)}60%{transform:rotate(-4deg)}74%{transform:rotate(3deg)}100%{transform:none}}'],
    denyut: [n + ' .5s ' + pop + ',' + ring + ' 1.5s ease-out .5s 3', membal + '@keyframes ' + ring + '{0%{box-shadow:0 0 0 0 ' + color + '8c}100%{box-shadow:0 0 0 18px ' + color + '00}}']
  };
  return sel + '{animation:' + A[anim][0] + '}' + A[anim][1] + '@media (prefers-reduced-motion:reduce){' + sel + '{animation:none}}';
}

module.exports = { ANIMS, IDS, resolve, rules };
