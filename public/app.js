/* Helper bersama untuk halaman login dan dashboard. */
window.App = (function () {
  var client = null;

  async function init() {
    if (client) return client;
    var r = await fetch('/api/config');
    var c = await r.json();
    if (!r.ok) throw new Error(c.error || 'Konfigurasi server belum lengkap');
    client = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey);
    return client;
  }

  // Pembuat elemen DOM. Teks selalu lewat textContent/createTextNode, jadi aman dari XSS.
  function h(tag, attrs) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { append(e, x); });
    else e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }

  var tt;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(tt);
    tt = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  return { init: init, h: h, toast: toast };
})();
