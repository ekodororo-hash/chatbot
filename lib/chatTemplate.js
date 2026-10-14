'use strict';
// Halaman chat untuk iframe/widget. __CONFIG__ diganti dengan data toko oleh app/chat/[slug]/route.js.
// Sengaja berupa dokumen mandiri (bukan komponen React) supaya CSP bisa seketat mungkin:
// tanpa script eksternal, hanya koneksi ke domain sendiri.
module.exports = String.raw`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chat</title>
<style>
:root{--accent:#0b7a75;--onaccent:#fff;--bg:#f4f8f7;--panel:#fff;--ink:#12262b;--mute:#587278;--line:#d3e4e0;--adm:#fff1c2;--admink:#3d2f00;--warn:#d9480f;--warnbg:#ffe8d9;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0e1b1e;--panel:#162a2e;--ink:#e6f4f2;--mute:#8fb0ab;--line:#26413f;--adm:#4a3b00;--admink:#ffe9a3;--warn:#ff9a66;--warnbg:#3b2418}}
*,*::before,*::after{box-sizing:border-box}
html,body{height:100%;margin:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.45;-webkit-font-smoothing:antialiased}
.app{display:flex;flex-direction:column;height:100%;height:100dvh;max-width:640px;margin:0 auto;background:var(--panel)}
header{display:flex;align-items:center;gap:10px;padding:12px 56px 12px 14px;background:var(--accent);color:var(--onaccent)}
.logo{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:18px;flex:none}
header b{display:block;line-height:1.2;font-size:15px;font-weight:600}
header small{opacity:.85;font-size:12px}
#msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--bg)}
.m{max-width:85%;padding:9px 12px;border-radius:16px;white-space:pre-wrap;word-wrap:break-word;font-size:15px}
.m small{display:block;font-size:11px;opacity:.65;margin-top:3px}
.m.customer{align-self:flex-end;background:var(--accent);color:var(--onaccent);border-bottom-right-radius:4px}
.m.bot{align-self:flex-start;background:var(--panel);border:1px solid var(--line);border-bottom-left-radius:4px}
.m.admin{align-self:flex-start;background:var(--adm);color:var(--admink);border-bottom-left-radius:4px}
.m.admin em{display:block;font-style:normal;font-weight:500;font-size:12px;margin-bottom:2px}
.sys{align-self:center;background:var(--warnbg);color:var(--warn);font-size:13px;padding:6px 12px;border-radius:16px;text-align:center}
.sys button{display:block;margin:6px auto 2px;padding:5px 12px;background:none;color:inherit;border:1px solid currentColor;font-size:12px}
.dots{display:inline-flex;gap:4px;padding:4px 0}
.dots i{width:7px;height:7px;border-radius:50%;background:var(--mute);animation:bl 1s infinite}
.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}
@keyframes bl{0%,60%,100%{opacity:.25}30%{opacity:1}}
form{display:flex;gap:8px;padding:10px 12px 8px;border-top:1px solid var(--line);background:var(--panel)}
input{flex:1;min-width:0;font:inherit;font-size:16px;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:10px 14px}
input:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button{border:0;background:var(--accent);color:var(--onaccent);font:inherit;font-weight:500;padding:0 18px;border-radius:999px;cursor:pointer}
button:disabled{opacity:.5}
.priv{margin:0;padding:2px 14px calc(10px + env(safe-area-inset-bottom,0px));font-size:11px;color:var(--mute);text-align:center;background:var(--panel)}
@media (prefers-reduced-motion:reduce){.dots i{animation:none}}
</style>
</head>
<body>
<div class="app">
  <header><div class="logo" id="lg" aria-hidden="true">💬</div><div><b id="bn"></b><small id="bs">Membalas otomatis</small></div></header>
  <main id="msgs" role="log" aria-live="polite" aria-label="Percakapan"></main>
  <form id="f" autocomplete="off"><input id="i" maxlength="500" placeholder="Tulis pesan..." aria-label="Pesan"><button id="s" type="submit">Kirim</button></form>
  <p class="priv">Percakapan ini disimpan oleh toko untuk melayani kamu. Jangan kirim PIN, OTP, atau data kartu.</p>
</div>
<script>
(function(){
var C=__CONFIG__;
var $=function(i){return document.getElementById(i)};
var call=C.tone==='formal'?'Bapak/Ibu':'kak';
var KEY='chat:'+C.slug,mem={};
function ld(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return mem}}
function sv(){var o={id:st.id,token:st.token};try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){mem=o}}
function clr(){st={};lastId=0;seen={};try{localStorage.removeItem(KEY)}catch(e){}mem={}}
var st=ld(),lastId=0,seen={},status='bot',busy=false,timer=null;

/* tema */
(function(){
  var a=C.accent,r=parseInt(a.slice(1,3),16),g=parseInt(a.slice(3,5),16),b=parseInt(a.slice(5,7),16);
  var lum=(0.299*r+0.587*g+0.114*b)/255;
  document.documentElement.style.setProperty('--accent',a);
  document.documentElement.style.setProperty('--onaccent',lum>0.62?'#111111':'#ffffff');
})();
document.title='Chat - '+C.shopName;
$('bn').textContent=C.botName;
if(C.icon)$('lg').textContent=C.icon;

var msgs=$('msgs');
function scroll(){msgs.scrollTop=msgs.scrollHeight}
function hhmm(iso){try{var d=iso?new Date(iso):new Date();return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}).replace('.',':')}catch(e){return ''}}
function add(role,text,iso){
  var d=document.createElement('div');d.className='m '+role;
  if(role==='admin'){var em=document.createElement('em');em.textContent='Admin';d.appendChild(em)}
  d.appendChild(document.createTextNode(text));
  var s=document.createElement('small');s.textContent=hhmm(iso);d.appendChild(s);
  msgs.appendChild(d);scroll();return d;
}
function sys(text){var d=document.createElement('div');d.className='sys';d.textContent=text;msgs.appendChild(d);scroll();return d}
function typing(){var d=document.createElement('div');d.className='m bot';d.innerHTML='<span class="dots"><i></i><i></i><i></i></span>';msgs.appendChild(d);scroll();return d}
function rm(n){if(n&&n.parentNode)n.parentNode.removeChild(n)}

var statusNote=null;
function setStatus(s){
  status=s;
  $('bs').textContent=s==='human'?'Diteruskan ke admin':s==='selesai'?'Percakapan selesai':'Membalas otomatis';
  rm(statusNote);statusNote=null;
  if(s==='human'){
    statusNote=sys('Percakapan diteruskan ke admin. Balasan akan muncul di sini.');
    var nb=document.createElement('button');nb.type='button';nb.textContent='Mulai percakapan baru';
    nb.addEventListener('click',fresh);statusNote.appendChild(nb);
  }
  if(s==='human'&&!timer)timer=setInterval(poll,6000);
  if(s!=='human'&&timer){clearInterval(timer);timer=null}
}
/* Mulai percakapan baru: lupakan percakapan tersimpan, kembali ke sapaan awal. */
function fresh(){
  clr();rm(statusNote);statusNote=null;msgs.innerHTML='';
  add('bot',C.greeting.replace(/\{k\}/g,call));
  setStatus('bot');$('i').focus();
}
function apply(res){
  if(res.conversationId&&res.token){st.id=res.conversationId;st.token=res.token;sv()}
  rm(statusNote);statusNote=null;
  (res.messages||[]).forEach(function(m){
    if(seen[m.id])return;seen[m.id]=1;if(m.id>lastId)lastId=m.id;add(m.role,m.content,m.created_at);
  });
  setStatus(res.status||'bot');scroll();
}
function req(url,opt){return fetch(url,opt).then(function(r){return r.json().then(function(j){return{ok:r.ok,code:r.status,j:j}})})}
function poll(){
  if(!st.id||document.hidden)return;
  req('/api/chat?conversationId='+encodeURIComponent(st.id)+'&token='+encodeURIComponent(st.token)+'&after='+lastId)
    .then(function(x){if(x.ok)apply(x.j);else if(x.code===404){clr();setStatus('bot')}}).catch(function(){});
}

add('bot',C.greeting.replace(/\{k\}/g,call));
if(st.id){ // pulihkan percakapan sebelumnya
  req('/api/chat?conversationId='+encodeURIComponent(st.id)+'&token='+encodeURIComponent(st.token)+'&after=0')
    .then(function(x){if(x.ok)apply(x.j);else if(x.code===404)clr()}).catch(function(){});
}

$('f').addEventListener('submit',function(e){
  e.preventDefault();
  var inp=$('i'),text=inp.value.trim();
  if(!text||busy)return;
  busy=true;inp.value='';$('s').disabled=true;
  var temp=add('customer',text),dots=typing();
  req('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slug:C.slug,conversationId:st.id,token:st.token,text:text,after:lastId})})
  .then(function(x){
    rm(temp);rm(dots);
    if(!x.ok){
      if(x.code===404&&st.id){clr();sys('Percakapan sebelumnya sudah tidak tersedia. Kirim ulang pesanmu.')}
      else sys(x.j&&x.j.error?x.j.error:'Gagal mengirim pesan.');
      inp.value=text;return;
    }
    apply(x.j);
  })
  .catch(function(){rm(temp);rm(dots);sys('Koneksi bermasalah. Coba lagi.');inp.value=text})
  .then(function(){busy=false;$('s').disabled=false;inp.focus()});
});
})();
</script>
</body>
</html>
`;
