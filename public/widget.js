/* Widget chat. Dipasang klien dengan satu baris:
   <script src="https://DOMAINMU/widget.js" data-bot="slug-toko" data-color="#0b7a75" defer></script> */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var bot = (s.getAttribute('data-bot') || '').trim();
  if (!/^[a-z0-9-]{3,30}$/.test(bot)) return;
  var color = s.getAttribute('data-color') || '#0b7a75';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = '#0b7a75';
  var origin;
  try { origin = new URL(s.src).origin; } catch (e) { return; }
  if (document.getElementById('isengin-chat-btn')) return;

  var css = document.createElement('style');
  css.textContent =
    '#isengin-chat-btn{position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;border:0;' +
    'background:' + color + ';color:#fff;font-size:26px;line-height:1;cursor:pointer;z-index:2147483000;' +
    'box-shadow:0 6px 20px rgba(0,0,0,.25);font-family:system-ui,sans-serif}' +
    '#isengin-chat-btn:focus-visible,#isengin-chat-x:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px ' + color + '}' +
    '#isengin-chat-box{display:none;position:fixed;right:20px;bottom:90px;width:370px;max-width:calc(100vw - 24px);' +
    'height:min(580px,calc(100vh - 110px));border-radius:16px;overflow:hidden;background:#fff;z-index:2147483001;' +
    'box-shadow:0 12px 40px rgba(0,0,0,.3)}' +
    '#isengin-chat-box iframe{width:100%;height:100%;border:0;display:block}' +
    '#isengin-chat-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;' +
    'background:rgba(0,0,0,.25);color:#fff;font-size:16px;cursor:pointer;z-index:2;font-family:system-ui,sans-serif}' +
    '@media (max-width:480px){#isengin-chat-box{right:0;left:0;top:0;bottom:0;width:auto;max-width:none;height:auto;border-radius:0}' +
    '#isengin-chat-btn.open{display:none}}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.id = 'isengin-chat-btn';
  btn.type = 'button';
  btn.textContent = '\uD83D\uDCAC';
  btn.setAttribute('aria-label', 'Buka chat');
  btn.setAttribute('aria-expanded', 'false');

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

  var frame = null;
  function open() {
    if (!frame) {
      frame = document.createElement('iframe');
      frame.src = origin + '/chat/' + encodeURIComponent(bot);
      frame.title = 'Chat dengan asisten toko';
      box.appendChild(frame);
    }
    box.style.display = 'block';
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
  function close() {
    box.style.display = 'none';
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }
  btn.addEventListener('click', function () { box.style.display === 'block' ? close() : open(); });
  x.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.style.display === 'block') close(); });

  document.body.appendChild(box);
  document.body.appendChild(btn);
})();
