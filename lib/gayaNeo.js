'use strict';
// Gaya "Neo" untuk widget toko isengin.site (env ISENGIN_BOT). Sama dengan tema Neo di isengin-link (dashboard dan halaman link):
// latar kuning, teks navy, kartu krem, garis navy 3px, bayangan keras tanpa blur, merah sebagai aksen, huruf Bungee untuk judul.
// Hanya toko ISENGIN_BOT yang memakainya; toko lain tidak berubah sama sekali.
//
// Dua bagian yang memakainya:
//   - tombol dan jendela chat di web klien: public/widget.js membaca "gaya":"neo" dari /api/widget/:slug (CSS-nya ada di widget.js sendiri)
//   - halaman chat di dalam iframe: app/chat/[slug]/route.js menyisipkan CSS di bawah, memasang atribut data-gaya pada <html>,
//     dan membuka izin font Google (hanya untuk halaman ini) di CSP.

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Bungee&family=Plus+Jakarta+Sans:wght@500;600;800&display=swap';
const FONT_LINK = '<link rel="stylesheet" href="' + FONT_URL + '">';

// true kalau toko ini toko ISENGIN_BOT. Aturannya sama dengan isIsenginShop di lib/otakIsengin.js (slug sama dengan env ISENGIN_BOT,
// dan kalau ISENGIN_BOT sama dengan WIDGET_BOT maka WIDGET_BOT menang), ditulis ulang di sini supaya route widget dan chat
// tidak perlu memuat otak AI hanya untuk urusan tampilan.
function aktif(shop) {
  const ib = String(process.env.ISENGIN_BOT || '').trim();
  const wb = String(process.env.WIDGET_BOT || '').trim();
  return !!ib && ib !== wb && !!shop && shop.slug === ib;
}
function forShop(shop) { return aktif(shop) ? 'neo' : ''; }

const CSS = String.raw`
/* ===== gaya Neo (toko isengin.site) ===== */
html[data-gaya="neo"]{--navy:#1f2255;--yel:#ffd23f;--red:#ff5a43;--cream:#fffbe8;--accent:#ff5a43;--onaccent:#fff;--bg:#fffbe8;--panel:#fff;--ink:#1f2255;--mute:#4a4d7a;--line:#1f2255;--adm:#b8f06a;--admink:#1f2255;--warn:#a00018;--warnbg:#ffe0dc;--wa:#1d8a38;--wabg:#e6f9d0;color-scheme:light}
html[data-gaya="neo"] body{background:var(--yel);color:var(--navy);font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-weight:600}
html[data-gaya="neo"] .app{background:var(--bg)}
@media (min-width:660px){html[data-gaya="neo"] .app{border-left:3px solid var(--navy);border-right:3px solid var(--navy)}}
html[data-gaya="neo"] button,html[data-gaya="neo"] input{font-family:inherit}
html[data-gaya="neo"] button:focus-visible{outline:3px dashed var(--navy);outline-offset:2px}

/* header: kuning, garis navy di bawah */
html[data-gaya="neo"] header{background:var(--yel);color:var(--navy);border-bottom:3px solid var(--navy);height:68px}
html[data-gaya="neo"] .logo{width:42px;height:42px;background:#fff;border:3px solid var(--navy);box-shadow:2px 2px 0 var(--navy)}
html[data-gaya="neo"] .dot{width:13px;height:13px;right:-4px;bottom:-4px;border:2px solid var(--navy);box-shadow:none;background:#c9cbe0}
html[data-gaya="neo"] .dot.on{background:#b8f06a}
html[data-gaya="neo"] header b{font-family:Bungee,"Arial Black",Impact,sans-serif;font-weight:400;font-size:15px;letter-spacing:.01em}
html[data-gaya="neo"] header small{opacity:.85;font-weight:600}
html[data-gaya="neo"] .mn>button{width:36px;height:36px;background:#fff;color:var(--navy);border:3px solid var(--navy);box-shadow:2px 2px 0 var(--navy);transition:transform .1s,box-shadow .1s}
html[data-gaya="neo"] .mn>button:hover{background:var(--cream)}
html[data-gaya="neo"] .mn>button:active{transform:translate(2px,2px);box-shadow:none}
html[data-gaya="neo"] .mn>button:focus-visible{outline:3px dashed var(--navy);outline-offset:2px}
html[data-gaya="neo"] .mm{top:46px;background:#fff;border:3px solid var(--navy);border-radius:16px;box-shadow:4px 4px 0 var(--navy)}
html[data-gaya="neo"] .mm button{font-weight:800;color:var(--navy);border-radius:10px}
html[data-gaya="neo"] .mm button:hover{background:var(--yel)}
html[data-gaya="neo"] .mm .sw{background:#fff;border:2px solid var(--navy)}
html[data-gaya="neo"] .mm .sw::after{top:2px;left:2px;width:12px;height:12px;background:var(--navy)}
html[data-gaya="neo"] .mm button[aria-checked="true"] .sw{background:var(--red)}

/* pesan */
html[data-gaya="neo"] #msgs{background:var(--bg);scrollbar-color:var(--navy) var(--cream)}
html[data-gaya="neo"] .m,html[data-gaya="neo"] .m.customer,html[data-gaya="neo"] .m.bot,html[data-gaya="neo"] .m.admin{border:3px solid var(--navy);border-radius:18px;box-shadow:3px 3px 0 var(--navy);font-size:14.5px;font-weight:600;margin:0 3px 3px 0}
html[data-gaya="neo"] .m.customer{background:var(--red);color:#fff;border-bottom-right-radius:4px;margin:0 3px 3px 0}
html[data-gaya="neo"] .m.bot{background:#fff;color:var(--navy);border-bottom-left-radius:4px}
html[data-gaya="neo"] .m.admin{background:var(--adm);color:var(--navy);border-bottom-left-radius:4px}
html[data-gaya="neo"] .m::after{display:none!important}
html[data-gaya="neo"] .m a{font-weight:800}
html[data-gaya="neo"] .m.admin em{font-weight:800}
html[data-gaya="neo"] .dots i{background:var(--navy)}
html[data-gaya="neo"] .ainote{color:var(--mute);font-weight:600}
html[data-gaya="neo"] .sys{background:var(--warnbg);color:var(--warn);border:3px solid var(--navy);border-radius:14px;font-weight:700}
html[data-gaya="neo"] .sys button{border:2px solid var(--navy);color:var(--navy);background:#fff;font-weight:800}
html[data-gaya="neo"] a.wa{border:3px solid var(--navy);box-shadow:3px 3px 0 var(--navy);font-weight:800}

/* pilihan cepat */
html[data-gaya="neo"] .qr button{background:#fff;color:var(--navy);border:3px solid var(--navy);box-shadow:3px 3px 0 var(--navy);font-weight:800;font-size:13px;padding:6px 14px;transition:transform .1s,box-shadow .1s}
html[data-gaya="neo"] .qr button:hover{background:var(--yel);color:var(--navy)}
html[data-gaya="neo"] .qr button:active{transform:translate(3px,3px);box-shadow:none}

/* tombol "Pesan baru" */
html[data-gaya="neo"] #nb{background:var(--yel);color:var(--navy);border:3px solid var(--navy);box-shadow:3px 3px 0 var(--navy);font-family:Bungee,"Arial Black",Impact,sans-serif;font-weight:400;font-size:11px}

/* kolom tulis */
html[data-gaya="neo"] form{background:var(--yel);border-top:3px solid var(--navy);gap:8px;padding:10px 12px 8px}
html[data-gaya="neo"] input{background:#fff;color:var(--navy);border:3px solid var(--navy);border-radius:999px;padding:7px 14px;font-weight:600}
html[data-gaya="neo"] input::placeholder{color:var(--mute);opacity:.8}
html[data-gaya="neo"] input:focus{border-color:var(--navy);box-shadow:3px 3px 0 var(--red)}
html[data-gaya="neo"] .em{width:42px;height:42px;background:#fff;color:var(--navy);border:3px solid var(--navy);box-shadow:2px 2px 0 var(--navy);transition:transform .1s,box-shadow .1s}
html[data-gaya="neo"] .em:hover,html[data-gaya="neo"] .em[aria-expanded="true"]{background:var(--cream);color:var(--navy);border-color:var(--navy)}
html[data-gaya="neo"] #s{width:42px;height:42px;background:var(--red);color:#fff;border:3px solid var(--navy);box-shadow:3px 3px 0 var(--navy);transition:transform .1s,box-shadow .1s}
html[data-gaya="neo"] #s.e0{background:#fff;color:#8b8db0;box-shadow:2px 2px 0 var(--navy)}
html[data-gaya="neo"] #s:not(:disabled):active,html[data-gaya="neo"] .em:not(:disabled):active{transform:translate(2px,2px);box-shadow:none}
html[data-gaya="neo"] .ep{background:#fff;border:3px solid var(--navy);border-radius:16px;box-shadow:4px 4px 0 var(--navy)}
html[data-gaya="neo"] .ep button:hover,html[data-gaya="neo"] .ep button:focus-visible{background:var(--yel)}

/* kaki: tombol akhiri/mulai baru */
html[data-gaya="neo"] .priv{background:var(--yel);color:var(--navy);font-weight:700}
html[data-gaya="neo"] .priv .chip{background:#fff;color:var(--navy);border:2px solid var(--navy);box-shadow:2px 2px 0 var(--navy);font-weight:800;font-size:11.5px;transition:transform .1s,box-shadow .1s}
html[data-gaya="neo"] .priv .chip:hover{background:var(--cream)}
html[data-gaya="neo"] .priv .chip:active{transform:translate(2px,2px);box-shadow:none}
html[data-gaya="neo"] .lnk{color:var(--navy);font-weight:800}

/* banner WhatsApp, penilaian, tawaran kontak */
html[data-gaya="neo"] .wab{background:var(--wabg);border:3px solid var(--navy);box-shadow:3px 3px 0 var(--navy);margin:10px 12px 4px 10px}
html[data-gaya="neo"] .wab .wtx b{font-weight:800}
html[data-gaya="neo"] #wb{border:2px solid var(--navy);color:var(--navy);background:#fff;font-weight:800}
html[data-gaya="neo"] #wb:hover{background:var(--yel);color:var(--navy)}
html[data-gaya="neo"] .rate,html[data-gaya="neo"] .lead{background:#fff;border:3px solid var(--navy);border-radius:16px;box-shadow:3px 3px 0 var(--navy);font-weight:600}
html[data-gaya="neo"] .rate .th button{background:#fff;color:var(--navy);border:3px solid var(--navy);box-shadow:2px 2px 0 var(--navy);font-weight:800}
html[data-gaya="neo"] .rate .th button:hover{background:var(--yel);border-color:var(--navy)}
html[data-gaya="neo"] .lead .r button{border:3px solid var(--navy);box-shadow:2px 2px 0 var(--navy);font-weight:800}
html[data-gaya="neo"] .lead .no{color:var(--mute)}
@media (prefers-reduced-motion:reduce){html[data-gaya="neo"] *{transition:none!important}}
`;

// Atribut dan tautan font disisipkan ke dokumen chat. Memakai fungsi pengganti supaya karakter $ di CSS tidak ditafsirkan sebagai pola.
function terapkan(html) {
  return String(html)
    .replace('<html lang="id">', () => '<html lang="id" data-gaya="neo">')
    .replace('</head>', () => FONT_LINK + '\n</head>')
    .replace('</style>', () => CSS + '</style>');
}

// CSP halaman chat: khusus gaya Neo, stylesheet dan file font Google boleh dimuat (halaman lain tetap tanpa itu).
function csp(base) {
  return String(base)
    .replace("style-src 'unsafe-inline';", "style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;");
}

module.exports = { aktif, forShop, terapkan, csp, CSS, FONT_URL, FONT_LINK };
