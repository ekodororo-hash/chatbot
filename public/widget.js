/* Widget chat. Dipasang klien dengan satu baris:
   <script src="https://DOMAINMU/widget.js" data-bot="slug-toko" defer></script>
   Tampilan (warna, posisi, jarak dari tepi, ikon, label, ukuran, bentuk, pesan pop-up) diambil dari dashboard lewat
   /api/widget/slug-toko, jadi perubahan langsung berlaku tanpa pasang ulang kode.
   data-color masih dibaca sebagai cadangan untuk kode lama kalau server tidak terjangkau. */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var bot = (s.getAttribute('data-bot') || '').trim();
  if (!/^[a-z0-9-]{3,30}$/.test(bot)) return;
  var origin;
  try { origin = new URL(s.src).origin; } catch (e) { return; }
  if (document.getElementById('isengin-chat-btn')) return;

  /* Bahasa chat mengikuti bahasa situs. Urutan: (1) diatur manual lewat data-lang="id" di tag script atau
     IsenginChat.setLang('id') dari kode situs, (2) ?lang= di URL, (3) segmen pertama path (/id/..., /en/...),
     (4) atribut lang di <html>. Kalau bahasa situs berganti saat halaman terbuka (tanpa reload), chat ikut berganti. */
  var SUPPORTED = ['id', 'en', 'it', 'es', 'fr', 'ar', 'de', 'ru'];
  function langCode(v) {
    var m = /^([a-z]{2})(?:[-_][a-z0-9]{2,8})?$/i.exec(String(v || '').trim());
    var c = m ? m[1].toLowerCase() : '';
    return SUPPORTED.indexOf(c) >= 0 ? c : '';
  }
  var dl = (s.getAttribute('data-lang') || '').trim().toLowerCase();
  var langOverride = dl === 'auto' ? '' : langCode(dl);
  var onLang = function () {};
  window.IsenginChat = { setLang: function (l) { langOverride = langCode(l); onLang(); } };
  /* Sumber bahasa situs, urut prioritas awal. Di HP pengganti bahasa sering tidak mengubah atribut <html lang>
     (mis. hanya menyimpan pilihan di cookie/localStorage, atau URL masih membawa ?lang= lama), jadi semua sumber
     dipantau dan sumber yang BERUBAH paling akhir yang dipakai, bukan sumber dengan prioritas tetap. */
  function readCookie(n) {
    try { var m = new RegExp('(?:^|;\\s*)' + n + '=([^;]*)').exec(document.cookie); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
  }
  function readStore(n) { try { return localStorage.getItem(n) || ''; } catch (e) { return ''; } }
  var STORE_KEYS = ['lang', 'language', 'locale', 'i18nextLng', 'NEXT_LOCALE', 'site_lang', 'selectedLanguage', 'preferred_language'];
  function sources() {
    var o = [];
    try { o.push(langCode(new URLSearchParams(location.search).get('lang'))); } catch (e) { o.push(''); }
    try { o.push(langCode(location.pathname.split('/')[1])); } catch (e) { o.push(''); }
    try { o.push(langCode(document.documentElement.lang)); } catch (e) { o.push(''); }
    try { o.push(langCode(document.documentElement.getAttribute('xml:lang'))); } catch (e) { o.push(''); }
    var i, v, gt = readCookie('googtrans'); // Google Translate: /id/en
    o.push(langCode(gt ? gt.split('/').pop() : ''));
    for (i = 0; i < STORE_KEYS.length; i++) o.push(langCode(readCookie(STORE_KEYS[i])));
    for (i = 0; i < STORE_KEYS.length; i++) o.push(langCode(readStore(STORE_KEYS[i])));
    return o;
  }
  var lastSrc = null, lastWinner = -1;
  function siteLang() {
    if (langOverride) return langOverride;
    var cur = sources(), i, changed = -1;
    if (lastSrc) {
      for (i = 0; i < cur.length; i++) if (cur[i] && cur[i] !== lastSrc[i]) changed = i;
      if (changed >= 0) lastWinner = changed;
    }
    lastSrc = cur;
    if (lastWinner >= 0 && cur[lastWinner]) return cur[lastWinner];
    for (i = 0; i < cur.length; i++) if (cur[i]) return cur[i];
    return '';
  }

  var fbColor = s.getAttribute('data-color') || '#0b7a75';
  if (!/^#[0-9a-fA-F]{6}$/.test(fbColor)) fbColor = '#0b7a75';
  var FALLBACK = { color: fbColor, pos: 'right', icon: '\uD83D\uDCAC', label: '', teaser: '', size: 'sedang', shape: 'bulat', ox: 20, oy: 20 };

  function pick(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }
  function num(v, min, max, def) { return typeof v === 'number' && v % 1 === 0 && v >= min && v <= max ? v : def; }
  function text(v, max, def) {
    if (typeof v !== 'string') return def;
    var t = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    t = Array.from ? Array.from(t).slice(0, max).join('') : t.slice(0, max);
    return t || def;
  }
  // Ikon SVG bawaan dari server: hanya daftar path (maks 8, karakter path saja); selain itu dianggap tidak ada.
  function svgPaths(v) {
    if (!Array.isArray(v) || !v.length || v.length > 8) return null;
    for (var i = 0; i < v.length; i++) {
      if (typeof v[i] !== 'string' || v[i].length > 400 || !/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]+$/.test(v[i])) return null;
    }
    return v;
  }
  function norm(c) {
    c = c || {};
    return {
      color: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : FALLBACK.color,
      pos: pick(c.pos, ['right', 'left'], 'right'),
      icon: text(c.icon, 16, FALLBACK.icon),
      svg: svgPaths(c.svg),
      label: text(c.label, 30, ''),
      teaser: text(c.teaser, 100, ''),
      size: pick(c.size, ['kecil', 'sedang', 'besar'], 'sedang'),
      shape: pick(c.shape, ['bulat', 'kotak', 'lancip'], 'bulat'),
      ox: num(c.ox, 0, 200, 20),
      oy: num(c.oy, 0, 200, 20)
    };
  }

  var started = false;
  function start(cfg) {
    if (started) return;
    started = true;
    if (document.getElementById('isengin-chat-btn')) return;
    build(norm(cfg));
  }

  if (window.fetch) {
    var timer = setTimeout(function () { start(null); }, 3000);
    fetch(origin + '/api/widget/' + encodeURIComponent(bot))
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (c) { clearTimeout(timer); start(c); });
  } else {
    start(null);
  }

  function build(c) {
    var color = c.color;
    var r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
    var onColor = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#111111' : '#ffffff';
    var side = c.pos === 'left' ? 'left' : 'right';
    var px = { kecil: 48, sedang: 58, besar: 70 }[c.size];
    var iconPx = { kecil: 22, sedang: 26, besar: 32 }[c.size];
    // Ukuran jendela chat disamakan kelasnya dengan portal (380x560 di layar kecil/menengah, 440x680 di layar besar
    // lewat media query di bawah), supaya tidak kekecilan seperti sebelumnya (dulu cuma 330-420 x 500-680).
    var boxW = { kecil: 340, sedang: 380, besar: 420 }[c.size];
    var boxH = { kecil: 500, sedang: 560, besar: 620 }[c.size];
    var boxWLg = { kecil: 380, sedang: 440, besar: 480 }[c.size];
    var boxHLg = { kecil: 600, sedang: 680, besar: 760 }[c.size];
    // lancip: kotak dengan semua sudut siku tajam di bawah, di sisi yang dekat tepi layar (seperti ekor balon chat)
    var radius = c.shape === 'kotak' ? '16px' : (c.shape === 'lancip' ? '0' : (c.label ? '999px' : '50%'));
    var boxBottom = c.oy + px + 12;

    var css = document.createElement('style');
    css.textContent =
      '#isengin-chat-btn{position:fixed;' + side + ':' + c.ox + 'px;bottom:' + c.oy + 'px;min-width:' + px + 'px;height:' + px + 'px;' +
      'padding:' + (c.label ? '0 20px' : '0') + ';border-radius:' + radius + ';border:0;display:flex;align-items:center;justify-content:center;gap:8px;' +
      'background:' + color + ';color:' + onColor + ';font-size:' + iconPx + 'px;line-height:1;cursor:pointer;z-index:2147483000;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.25);font-family:system-ui,sans-serif}' +
      '#isengin-chat-btn span.l{font-size:15px;font-weight:600;white-space:nowrap}' +
      '#isengin-chat-btn:focus-visible,#isengin-chat-x:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px ' + color + '}' +
      '#isengin-chat-box{position:fixed;' + side + ':' + c.ox + 'px;bottom:' + boxBottom + 'px;width:' + boxW + 'px;max-width:calc(100vw - 24px);' +
      'height:min(' + boxH + 'px,calc(100vh - ' + (boxBottom + 20) + 'px));border-radius:16px;overflow:hidden;background:#fff;z-index:2147483001;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.3);opacity:0;visibility:hidden;transform:translateY(14px) scale(.98);pointer-events:none;' +
      'transition:opacity .18s ease,transform .18s ease,visibility 0s .18s}' +
      '#isengin-chat-box.show{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity .18s ease,transform .18s ease}' +
      '@media (prefers-reduced-motion:reduce){#isengin-chat-box{transition:opacity .12s ease,visibility 0s .12s}#isengin-chat-box.show{transition:opacity .12s ease}}' +
      '#isengin-chat-box iframe{width:100%;height:100%;border:0;display:block}' +
      '#isengin-chat-ld{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;gap:7px;background:#f4f8f7;transition:opacity .2s ease,visibility 0s .2s}' +
      '#isengin-chat-ld.done{opacity:0;visibility:hidden;pointer-events:none}' +
      '#isengin-chat-ld i{width:10px;height:10px;border-radius:50%;background:' + color + ';opacity:.35;animation:isengin-dot 1.1s ease-in-out infinite}' +
      '#isengin-chat-ld i:nth-child(2){animation-delay:.18s}#isengin-chat-ld i:nth-child(3){animation-delay:.36s}' +
      '@keyframes isengin-dot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-7px);opacity:1}}' +
      '@media (prefers-color-scheme:dark){#isengin-chat-ld{background:#0e1b1e}}' +
      '@media (prefers-reduced-motion:reduce){#isengin-chat-ld i{animation:none;opacity:.7}}' +
      '#isengin-chat-badge{display:none;position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;' +
      'background:#dc2626;box-shadow:0 0 0 2px #fff}' +
      '#isengin-chat-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;' +
      'background:rgba(0,0,0,.25);color:#fff;font-size:16px;cursor:pointer;z-index:2;font-family:system-ui,sans-serif}' +
      '#isengin-chat-tip{display:none;position:fixed;' + side + ':' + c.ox + 'px;bottom:' + boxBottom + 'px;max-width:min(260px,calc(100vw - 40px));' +
      'background:#fff;color:#12262b;border-radius:14px;padding:10px 32px 10px 14px;font:14px/1.4 system-ui,sans-serif;cursor:pointer;' +
      'z-index:2147483000;box-shadow:0 8px 28px rgba(0,0,0,.25)}' +
      '#isengin-chat-tipx{position:absolute;top:4px;right:4px;width:24px;height:24px;border:0;border-radius:50%;background:none;color:#587278;font-size:13px;cursor:pointer}' +
      '@media (min-width:1024px){#isengin-chat-box{width:' + boxWLg + 'px;' +
      'height:min(' + boxHLg + 'px,calc(100vh - ' + (boxBottom + 20) + 'px))}}' +
      '@media (max-width:480px){#isengin-chat-box{right:0;left:0;top:0;bottom:0;width:auto;max-width:none;height:auto;border-radius:0}' +
      '#isengin-chat-btn.open,#isengin-chat-tip{display:none!important}}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'isengin-chat-btn';
    btn.type = 'button';
    var ic = document.createElement('span');
    if (c.svg) {
      var NS = 'http://www.w3.org/2000/svg';
      var sv = document.createElementNS(NS, 'svg');
      sv.setAttribute('viewBox', '0 0 24 24'); sv.setAttribute('width', '1em'); sv.setAttribute('height', '1em');
      sv.setAttribute('fill', 'none'); sv.setAttribute('stroke', 'currentColor'); sv.setAttribute('stroke-width', '2');
      sv.setAttribute('stroke-linecap', 'round'); sv.setAttribute('stroke-linejoin', 'round');
      sv.style.display = 'block';
      for (var pi = 0; pi < c.svg.length; pi++) {
        var pt = document.createElementNS(NS, 'path');
        pt.setAttribute('d', c.svg[pi]);
        sv.appendChild(pt);
      }
      ic.style.display = 'flex';
      ic.appendChild(sv);
    } else ic.textContent = c.icon;
    ic.setAttribute('aria-hidden', 'true');
    btn.appendChild(ic);
    if (c.label) {
      var lb = document.createElement('span');
      lb.className = 'l';
      lb.textContent = c.label;
      btn.appendChild(lb);
    }
    btn.setAttribute('aria-label', c.label ? 'Buka chat: ' + c.label : 'Buka chat');
    btn.setAttribute('aria-expanded', 'false');

    var badge = document.createElement('span');
    badge.id = 'isengin-chat-badge';
    badge.setAttribute('aria-hidden', 'true');
    btn.appendChild(badge);
    function showBadge() { badge.style.display = 'block'; }
    function clearBadge() { badge.style.display = 'none'; }

    var box = document.createElement('div');
    box.id = 'isengin-chat-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Chat dengan asisten toko');

    var x = document.createElement('button');
    x.id = 'isengin-chat-x';
    x.type = 'button';
    x.textContent = '\u2715';
    x.setAttribute('aria-label', 'Tutup chat');
    box.appendChild(x);

    // Animasi tiga titik selama chat di dalam iframe masih dimuat, supaya panel tidak terlihat kosong.
    var ld = document.createElement('div');
    ld.id = 'isengin-chat-ld';
    ld.setAttribute('aria-hidden', 'true');
    ld.innerHTML = '<i></i><i></i><i></i>';
    box.appendChild(ld);
    function hideLd() { ld.classList.add('done'); }

    var tip = null, tipTimer = null, TIPKEY = 'isengin-tip-' + bot;
    function hideTip(remember) {
      clearTimeout(tipTimer);
      if (tip) tip.style.display = 'none';
      if (remember) { try { sessionStorage.setItem(TIPKEY, '1'); } catch (e) {} }
    }
    if (c.teaser) {
      var seen = false;
      try { seen = sessionStorage.getItem(TIPKEY) === '1'; } catch (e) {}
      if (!seen) {
        tip = document.createElement('div');
        tip.id = 'isengin-chat-tip';
        tip.setAttribute('role', 'status');
        var tt = document.createElement('span');
        tt.textContent = c.teaser;
        tip.appendChild(tt);
        var tx = document.createElement('button');
        tx.id = 'isengin-chat-tipx';
        tx.type = 'button';
        tx.textContent = '\u2715';
        tx.setAttribute('aria-label', 'Tutup pesan');
        tip.appendChild(tx);
        tx.addEventListener('click', function (e) { e.stopPropagation(); hideTip(true); });
        tip.addEventListener('click', function () { open(); });
        tipTimer = setTimeout(function () {
          if (box.style.display !== 'block') tip.style.display = 'block';
        }, 2500);
      }
    }

    var frame = null, frameLang = '', srcLang = '';
    function frameSrc() {
      frameLang = srcLang = siteLang();
      return origin + '/chat/' + encodeURIComponent(bot) + (frameLang ? '?lang=' + frameLang : '');
    }
    // Bahasa berganti: chat di dalam iframe mengganti teksnya sendiri lewat pesan, tanpa memuat ulang iframe.
    function sendLang(l) {
      try { frame.contentWindow.postMessage({ type: 'isengin-lang', lang: l || 'id' }, '*'); } catch (e) {}
    }
    function syncLang() {
      if (!frame || siteLang() === frameLang) return;
      frameLang = siteLang();
      sendLang(frameLang);
    }
    onLang = syncLang;
    setInterval(syncLang, 1000);
    try { new MutationObserver(syncLang).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); } catch (e) {}
    window.addEventListener('popstate', syncLang);
    window.addEventListener('storage', syncLang);
    window.addEventListener('hashchange', syncLang);
    window.addEventListener('resize', syncLang);
    window.addEventListener('touchend', function () { setTimeout(syncLang, 400); }, true);
    // Timer di browser HP sering ditahan saat tab di latar belakang: sinkronkan juga saat tab kembali aktif.
    document.addEventListener('visibilitychange', function () { if (!document.hidden) syncLang(); });
    window.addEventListener('pageshow', syncLang);
    window.addEventListener('focus', syncLang);
    // Setiap pesan buka/tutup membawa bahasa situs saat itu. Di HP chat menutupi seluruh layar, jadi bahasa situs
    // baru bisa diganti setelah chat ditutup; dengan ini chat selalu disinkronkan ulang tepat saat dibuka lagi.
    function tellFrame(type) {
      if (frame && frame.contentWindow) { try { frame.contentWindow.postMessage({ type: type, lang: siteLang() || 'id' }, '*'); } catch (e) {} }
    }
    function open() {
      hideTip(true);
      clearBadge();
      syncLang();
      if (!frame) {
        frame = document.createElement('iframe');
        frame.src = frameSrc();
        // Setelah iframe (re)load, beri tahu chat apakah sedang terbuka atau tertutup.
        frame.addEventListener('load', function () {
          setTimeout(hideLd, 6000); // cadangan kalau sinyal siap dari chat tidak datang
          tellFrame(box.classList.contains('show') ? 'isengin-open' : 'isengin-close');
          if (siteLang() !== srcLang) sendLang(siteLang()); // bahasa berganti selagi iframe masih dimuat
        });
        frame.title = 'Chat dengan asisten toko';
        box.appendChild(frame);
      }
      box.classList.add('show');
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      tellFrame('isengin-open');
    }
    function close() {
      box.classList.remove('show');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
      tellFrame('isengin-close');
    }
    btn.addEventListener('click', function () { box.classList.contains('show') ? close() : open(); });
    x.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('show')) close(); });
    window.addEventListener('message', function (e) {
      if (!frame || e.source !== frame.contentWindow) return;
      var d = e.data || {};
      if (d.type === 'isengin-newmsg' && !box.classList.contains('show')) showBadge();
      if (d.type === 'isengin-ready') hideLd();
    });

    document.body.appendChild(box);
    if (tip) document.body.appendChild(tip);
    document.body.appendChild(btn);
  }
})();
