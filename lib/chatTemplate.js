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
.logo{position:relative;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:18px;flex:none}
.logo img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
.dot{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;background:#9aa7a5;box-shadow:0 0 0 2px var(--accent)}
.dot.on{background:#22c55e}
.dot[hidden]{display:none}
header b{display:block;line-height:1.2;font-size:15px;font-weight:600}
header small{opacity:.85;font-size:12px}
header .nm{flex:1;min-width:0}
.qr{display:flex;flex-wrap:wrap;gap:8px;align-self:flex-start;max-width:100%}
.qr button{border:1px solid var(--accent);color:var(--accent);background:none;font:inherit;font-size:13px;padding:7px 14px;border-radius:999px;cursor:pointer}
.qr button:hover{background:var(--accent);color:var(--onaccent)}
#msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--bg)}
.m{max-width:85%;padding:9px 12px;border-radius:16px;white-space:pre-wrap;word-wrap:break-word;font-size:15px}
.m small{display:block;font-size:11px;opacity:.65;margin-top:3px}
.m.customer{align-self:flex-end;background:var(--accent);color:var(--onaccent);border-bottom-right-radius:4px}
.m.bot{align-self:flex-start;background:var(--panel);border:1px solid var(--line);border-bottom-left-radius:4px}
.m.admin{align-self:flex-start;background:var(--adm);color:var(--admink);border-bottom-left-radius:4px}
/* bentuk bubble: bulat (bawaan), kotak, atau lancip (ekor runcing) */
html[data-bubble="kotak"] .m,html[data-bubble="kotak"] .m.customer,html[data-bubble="kotak"] .m.bot,html[data-bubble="kotak"] .m.admin{border-radius:6px}
html[data-bubble="lancip"] .m{position:relative;border-radius:14px}
html[data-bubble="lancip"] .m.customer{border-bottom-right-radius:0}
html[data-bubble="lancip"] .m.bot,html[data-bubble="lancip"] .m.admin{border-bottom-left-radius:0}
html[data-bubble="lancip"] .m.bot{border:0;box-shadow:0 1px 2px rgba(0,0,0,.14)}
html[data-bubble="lancip"] .m::after{content:"";position:absolute;bottom:0;width:0;height:0;border-top:10px solid transparent}
html[data-bubble="lancip"] .m.customer::after{right:-10px;border-left:10px solid var(--accent)}
html[data-bubble="lancip"] .m.bot::after{left:-10px;border-right:10px solid var(--panel);filter:drop-shadow(-1px 1px 0 rgba(0,0,0,.08))}
html[data-bubble="lancip"] .m.admin::after{left:-10px;border-right:10px solid var(--adm)}
html[data-bubble="lancip"] .m:has(.dots)::after{display:none}
.m a{color:inherit;text-decoration:underline;overflow-wrap:anywhere}
.m .lk{display:inline-flex;align-items:center;gap:6px;max-width:100%}
.m .lk svg{width:16px;height:16px;flex:none}
a.wa{align-self:flex-start;display:inline-block;padding:7px 14px;border-radius:999px;background:#25d366;color:#fff;text-decoration:none;font-weight:600;font-size:13px;overflow-wrap:normal}
.m.admin em{display:block;font-style:normal;font-weight:500;font-size:12px;margin-bottom:2px}
.sys{align-self:center;background:var(--warnbg);color:var(--warn);font-size:13px;padding:6px 12px;border-radius:16px;text-align:center}
.sys button{display:block;margin:6px auto 2px;padding:5px 12px;background:none;color:inherit;border:1px solid currentColor;font-size:12px}
.dots{display:inline-flex;gap:4px;padding:4px 0}
.dots i{width:7px;height:7px;border-radius:50%;background:var(--mute);animation:bl 1s infinite}
.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}
@keyframes bl{0%,60%,100%{opacity:.25}30%{opacity:1}}
.sp{display:inline-block;vertical-align:-3px;flex:none;width:16px;height:16px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spn .7s linear infinite}
@keyframes spn{to{transform:rotate(360deg)}}
.rate .th button:disabled{opacity:.55;cursor:default}.rate .th button.ld{opacity:1}
form{display:flex;gap:8px;padding:8px 10px 6px;border-top:1px solid var(--line);background:var(--panel)}
input{flex:1;min-width:0;font:inherit;font-size:14px;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:8px 14px}
@media (pointer:coarse){input{font-size:16px}}
input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 22%,transparent)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button{border:0;background:var(--accent);color:var(--onaccent);font:inherit;font-size:14px;font-weight:500;padding:0 16px;border-radius:999px;cursor:pointer}
button:disabled{opacity:.5}
.priv{margin:0;padding:2px 14px calc(10px + env(safe-area-inset-bottom,0px));font-size:11px;color:var(--mute);text-align:center;background:var(--panel)}
/* penilaian jempol dan kartu tawaran kontak */
.rate,.lead{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:12px 14px;font-size:14px}
.rate{align-self:center;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;max-width:90%}
.rate .th{display:flex;gap:10px}
.rate .th button{display:inline-flex;align-items:center;gap:6px;background:none;color:var(--ink);border:1px solid var(--line);font-size:13px;font-weight:600;line-height:1;padding:9px 14px}
.rate .th svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.rate .th button:hover{border-color:var(--accent)}
.rate .er,.lead .er{color:var(--warn);font-size:12px}
.lead{align-self:flex-start;max-width:90%}
.lead .r{display:flex;gap:8px;margin-top:8px}
.lead .r button{padding:8px 14px;flex:none}
.lead .no{display:block;margin:8px 0 0;padding:0;background:none;color:var(--mute);font-size:12px;text-decoration:underline}
.lnk{padding:0;background:none;color:var(--accent);font-size:11px;font-weight:400;text-decoration:underline;border-radius:0}
@media (prefers-reduced-motion:reduce){.dots i{animation:none}.sp{animation:bl 1s infinite}}
</style>
</head>
<body>
<div class="app">
  <header><div class="logo" aria-hidden="true"><span id="lg">💬</span><i class="dot" id="dot" hidden></i></div><div class="nm"><b id="bn"></b><small id="bs">Membalas otomatis</small></div></header>
  <main id="msgs" role="log" aria-live="polite" aria-label="Percakapan"></main>
  <form id="f" autocomplete="off"><input id="i" maxlength="500" placeholder="Tulis pesan..." aria-label="Pesan"><button id="s" type="submit">Kirim</button></form>
  <p class="priv">Percakapan ini disimpan oleh toko untuk melayani kamu. Jangan kirim PIN, OTP, atau data kartu. <button type="button" class="lnk" id="rl" hidden>Beri nilai percakapan</button> <button type="button" class="lnk" id="nl" hidden>Mulai percakapan baru</button></p>
</div>
<script>
(function(){
var C=__CONFIG__;
var $=function(i){return document.getElementById(i)};
var call=C.tone==='formal'?'Bapak/Ibu':'kak';
var KEY='chat:'+C.slug,mem={};
function ld(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return mem}}
function sv(){var o={id:st.id,token:st.token,rated:st.rated};try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){mem=o}}
function clr(){st={};lastId=0;seen={};try{localStorage.removeItem(KEY)}catch(e){}mem={}}
var st=ld(),lastId=0,seen={},status='bot',busy=false,timer=null;
/* mode pratinjau: dipakai dashboard (iframe satu domain), tidak mengirim apa pun ke server */
var PREVIEW=/[?&]preview=1(&|$)/.test(location.search)&&window.parent!==window;
if(PREVIEW)st={};

/* tema */
function applyTheme(){
  var a=/^#[0-9a-fA-F]{6}$/.test(C.accent)?C.accent:'#0b7a75',r=parseInt(a.slice(1,3),16),g=parseInt(a.slice(3,5),16),b=parseInt(a.slice(5,7),16);
  var lum=(0.299*r+0.587*g+0.114*b)/255;
  document.documentElement.style.setProperty('--accent',a);
  document.documentElement.style.setProperty('--onaccent',lum>0.62?'#111111':'#ffffff');
}
function applyBubble(){document.documentElement.setAttribute('data-bubble',/^(bulat|kotak|lancip)$/.test(C.bubble)?C.bubble:'bulat')}
applyTheme();applyBubble();
document.title='Chat - '+C.shopName;
$('bn').textContent=C.botName;
/* avatar: logo toko kalau ada (gambar data:), kalau tidak ya ikon emoji/teks */
function setAvatar(){
  var box=$('lg');box.textContent='';
  if(C.logo&&/^data:image\/(png|jpeg|webp);base64,/.test(C.logo)){
    var im=document.createElement('img');im.alt='';im.src=C.logo;
    im.addEventListener('error',function(){box.textContent=C.icon||'💬'});
    box.appendChild(im);
  }else box.textContent=C.icon||'💬';
}
setAvatar();

/* jam operasional: dihitung di browser pelanggan dengan zona waktu toko */
var DAYN=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
function nowIn(tz){
  try{
    var o={};
    new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(function(x){o[x.type]=x.value});
    return{wd:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[o.weekday],min:(parseInt(o.hour,10)%24)*60+parseInt(o.minute,10)};
  }catch(e){return null}
}
function tmin(t){var a=String(t).split(':');return(+a[0])*60+(+a[1])}
function hoursInfo(){
  var h=C.hours;
  if(!h||!h.on||!h.days||!h.days.length)return null;
  var n=nowIn(h.tz);if(!n||n.wd==null)return null;
  var o=tmin(h.open),c=tmin(h.close),on;
  if(o===c)on=h.days.indexOf(n.wd)>=0;
  else if(o<c)on=h.days.indexOf(n.wd)>=0&&n.min>=o&&n.min<c;
  else on=(h.days.indexOf(n.wd)>=0&&n.min>=o)||(h.days.indexOf((n.wd+6)%7)>=0&&n.min<c);
  if(on)return{on:true};
  for(var i=0;i<=7;i++){
    var d=(n.wd+i)%7;
    if(h.days.indexOf(d)>=0&&(i>0||n.min<o))return{on:false,next:(i===0?'hari ini':i===1?'besok':DAYN[d])+' '+h.open};
  }
  return{on:false,next:''};
}
function etaText(){var e=+C.eta||0;return e>0?(e>=60?Math.round(e/60)+' jam':e+' menit'):''}
function subtitle(){
  var dot=$('dot');
  if(status==='human'){dot.hidden=true;return adminSeen?'Dibalas admin':'Diteruskan ke admin'}
  if(status==='selesai'){dot.hidden=true;return'Percakapan selesai'}
  var hi=hoursInfo(),eta=etaText();
  if(!hi){dot.hidden=true;return eta?'Membalas otomatis \u00b7 admin balas \u00b1'+eta:'Membalas otomatis'}
  dot.hidden=false;dot.className='dot'+(hi.on?' on':'');
  if(hi.on)return'Admin online'+(eta?' \u00b7 biasanya balas dalam '+eta:'');
  return'Admin offline'+(hi.next?' \u00b7 buka '+hi.next:'')+' \u00b7 asisten tetap membalas';
}
function refreshSub(){$('bs').textContent=subtitle()}
setInterval(function(){if(!document.hidden)refreshSub()},60000);

/* beri tahu widget.js di halaman klien saat chat ini sedang dibuka/ditutup, supaya titik notifikasi balasan baru cuma muncul saat tertutup */
var parentOpen=true;
if(window.parent!==window){
  window.addEventListener('message',function(e){
    var d=e&&e.data||{};
    if(d.type==='isengin-open')parentOpen=true;
    else if(d.type==='isengin-close')parentOpen=false;
  });
}

var msgs=$('msgs');
function scroll(){msgs.scrollTop=msgs.scrollHeight}
function hhmm(iso){try{var d=iso?new Date(iso):new Date();return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}).replace('.',':')}catch(e){return ''}}
var IC={
shop:['currentColor','<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>'],
track:['currentColor','<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'],
verify:['currentColor','<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>'],
blog:['currentColor','<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>'],
help:['currentColor','<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>'],
review:['currentColor','<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>']};
// Ikon tautan resmi EMAHAIRSHOP (sama dengan portal); domain lain tetap tautan biasa tanpa ikon.
function icFor(u){var h=u.replace(/^https?:\/\//,'').split(/[\/?#]/)[0];
  return h==='shop.emahairshop.com'?(/^https?:\/\/shop\.emahairshop\.com\/view-review/i.test(u)?IC.review:IC.shop):h==='track.emahairshop.com'?IC.track:h==='verify.emahairshop.com'?IC.verify:h==='blog.emahairshop.com'?IC.blog:h==='help.emahairshop.com'?IC.help:null}
function anchor(u){var a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener noreferrer';a.textContent=u;return a}
// Isi balasan bot/admin: URL jadi tautan yang bisa diklik; URL yang berdiri sendiri di satu baris diberi ikon;
// baris penutup "<label>: https://wa.me/..." (label sudah sesuai bahasa, dari server) dijadikan tombol. Hanya node DOM + textContent, tanpa innerHTML dari teks.
// Mengembalikan tautan WhatsApp untuk tombol, atau ''.
var waLabel='';
function rich(d,text){
  var wa='',m=String(text).match(/\n*([^\n:]{2,40}):\s*(https:\/\/wa\.me\/\d+)\s*$/);
  if(m){wa=m[2];waLabel=m[1].trim();text=String(text).slice(0,m.index)}
  var lines=String(text).split('\n');
  lines.forEach(function(line,i){
    var u=line.match(/^\s*(https?:\/\/\S*[^\s.,;:!?)\]])\s*$/);
    if(u){
      var w=document.createElement('span');w.className='lk';
      var ic=icFor(u[1]);
      if(ic){var h=document.createElement('span');h.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="'+ic[0]+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ic[1]+'</svg>';w.appendChild(h.firstChild)}
      w.appendChild(anchor(u[1]));d.appendChild(w);
    }else{
      var re=/(https?:\/\/[^\s<]*[^\s<.,;:!?)\]])/g,last=0,x;
      while((x=re.exec(line))){
        if(x.index>last)d.appendChild(document.createTextNode(line.slice(last,x.index)));
        d.appendChild(anchor(x[1]));last=x.index+x[1].length;
      }
      if(last<line.length)d.appendChild(document.createTextNode(line.slice(last)));
    }
    if(i<lines.length-1)d.appendChild(document.createTextNode('\n'));
  });
  return wa;
}
function add(role,text,iso){
  var d=document.createElement('div');d.className='m '+role;
  if(role==='admin'){var em=document.createElement('em');em.textContent='Admin';d.appendChild(em)}
  // Tampilan portal (tautan bisa diklik, ikon, tombol WhatsApp) hanya untuk toko layanan sendiri (C.portal); toko lain teks biasa seperti sebelumnya.
  var wa=(role!=='customer'&&C.portal)?rich(d,text):'';
  if(!(role!=='customer'&&C.portal))d.appendChild(document.createTextNode(text));
  var s=document.createElement('small');s.textContent=hhmm(iso);d.appendChild(s);
  msgs.appendChild(d);
  // Tombol WhatsApp ditaruh SETELAH bubble (elemen tersendiri, bukan di dalam bubble), sama seperti di portal.
  if(wa){var b=document.createElement('a');b.className='wa';b.href=wa;b.target='_blank';b.rel='noopener noreferrer';b.textContent=waLabel||'Tanya lewat WhatsApp';msgs.appendChild(b)}
  scroll();return d;
}
function sys(text){var d=document.createElement('div');d.className='sys';d.textContent=text;msgs.appendChild(d);scroll();return d}
function typing(){var d=document.createElement('div');d.className='m bot';d.innerHTML='<span class="dots"><i></i><i></i><i></i></span>';msgs.appendChild(d);scroll();return d}
function rm(n){if(n&&n.parentNode)n.parentNode.removeChild(n)}
/* Tombol pilihan cepat di bawah sapaan awal, supaya pelanggan tidak perlu mengetik dari nol. */
function quickReplies(){
  var wrap=document.createElement('div');wrap.className='qr';wrap.setAttribute('role','group');wrap.setAttribute('aria-label','Pilihan cepat');
  ['Tanya produk','Cek status pesanan','Bicara dengan admin'].forEach(function(t){
    var b=document.createElement('button');b.type='button';b.textContent=t;
    b.addEventListener('click',function(){
      if(PREVIEW)return;
      rm(wrap);$('i').value=t;
      if(typeof $('f').requestSubmit==='function')$('f').requestSubmit();
      else{var ev;try{ev=new Event('submit',{cancelable:true,bubbles:true})}catch(e){ev=document.createEvent('Event');ev.initEvent('submit',true,true)}$('f').dispatchEvent(ev)}
    });
    wrap.appendChild(b);
  });
  msgs.appendChild(wrap);scroll();return wrap;
}

/* Penilaian jempol: muncul sendiri saat percakapan selesai; sebelum itu bisa dibuka lewat tautan kecil di bawah setelah ada balasan. */
var rateNode=null,replied=false;
function canRate(){return !!(C.rating&&!PREVIEW&&st.id)}
function refreshRateLink(){$('rl').hidden=!(canRate()&&replied&&!st.rated&&!rateNode)}
function showRate(){
  if(!canRate()||st.rated||rateNode)return;
  var d=document.createElement('div');d.className='rate';d.setAttribute('role','group');d.setAttribute('aria-label','Penilaian percakapan');
  var q=document.createElement('span');q.textContent='Bagaimana pelayanan kami?';
  var th=document.createElement('div');th.className='th';
  var er=document.createElement('span');er.className='er';
  function send(v,btn){
    var ic=btn.querySelector('svg'),sp=document.createElement('i');sp.className='sp';
    function reset(){th.querySelectorAll('button').forEach(function(b){b.disabled=false});btn.classList.remove('ld');if(sp.parentNode)btn.replaceChild(ic,sp)}
    th.querySelectorAll('button').forEach(function(b){b.disabled=true});er.textContent='';
    btn.classList.add('ld');btn.replaceChild(sp,ic);
    req('/api/rating',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:C.slug,conversationId:st.id,token:st.token,value:v})})
    .then(function(x){
      if(!x.ok){reset();er.textContent=(x.j&&x.j.error)||'Gagal mengirim penilaian.';return}
      st.rated=v;sv();
      q.textContent=v>0?'Terima kasih atas penilaianmu!':'Terima kasih. Masukanmu kami pakai untuk memperbaiki jawaban.';
      th.remove();er.remove();refreshRateLink();
    }).catch(function(){reset();er.textContent='Koneksi bermasalah. Coba lagi.'});
  }
  var UP='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
  var DN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>';
  [[1,UP,'Puas'],[-1,DN,'Kurang puas']].forEach(function(o){
    var b=document.createElement('button');b.type='button';b.innerHTML=o[1]+'<span>'+o[2]+'</span>';b.setAttribute('aria-label',o[2]);
    b.addEventListener('click',function(){send(o[0],b)});th.appendChild(b);
  });
  d.appendChild(q);d.appendChild(th);d.appendChild(er);
  msgs.appendChild(d);rateNode=d;refreshRateLink();scroll();
}
$('rl').addEventListener('click',showRate);
$('nl').addEventListener('click',function(){fresh()});

/* Tawaran dikabari soal promo: server yang memutuskan kapan (sekali per percakapan, hanya untuk yang belum memesan). */
var leadNode=null,LKEY='lead:'+C.slug;
function leadSaved(){try{return localStorage.getItem(LKEY)==='1'}catch(e){return false}}
function showLead(){
  if(!C.lead||PREVIEW||!st.id||leadNode||leadSaved())return;
  var d=document.createElement('div');d.className='lead';d.setAttribute('role','group');d.setAttribute('aria-label','Dikabari soal promo atau stok');
  var p=document.createElement('div');p.textContent='Mau dikabari kalau ada promo atau produknya tersedia? Tinggalkan nomor WhatsApp atau email, nanti '+C.shopName+' kabari kamu. Kamu bisa minta berhenti kapan saja.';
  var r=document.createElement('div');r.className='r';
  var inp=document.createElement('input');inp.maxLength=120;inp.placeholder='WhatsApp atau email';inp.setAttribute('aria-label','Nomor WhatsApp atau email');
  var ok=document.createElement('button');ok.type='button';ok.textContent='Kabari saya';
  var no=document.createElement('button');no.type='button';no.className='no';no.textContent='Tidak, terima kasih';
  var er=document.createElement('div');er.className='er';
  function close(){rm(d);leadNode=null}
  function go(){
    var v=inp.value.trim();if(!v){er.textContent='Isi nomor WhatsApp atau email dulu ya.';return}
    ok.disabled=true;er.textContent='';ok.textContent='';var sp=document.createElement('i');sp.className='sp';ok.appendChild(sp);ok.appendChild(document.createTextNode(' Mengirim...'));
    req('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:C.slug,conversationId:st.id,token:st.token,contact:v})})
    .then(function(x){
      ok.disabled=false;ok.textContent='Kabari saya';
      if(!x.ok){er.textContent=(x.j&&x.j.error)||'Gagal menyimpan. Coba lagi.';return}
      try{localStorage.setItem(LKEY,'1')}catch(e){}
      d.textContent='Terima kasih! Nanti kamu dikabari kalau ada promo atau produknya tersedia.';
    }).catch(function(){ok.disabled=false;ok.textContent='Kabari saya';er.textContent='Koneksi bermasalah. Coba lagi.'});
  }
  ok.addEventListener('click',go);
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go()}});
  no.addEventListener('click',close);
  r.appendChild(inp);r.appendChild(ok);
  d.appendChild(p);d.appendChild(r);d.appendChild(er);d.appendChild(no);
  msgs.appendChild(d);leadNode=d;scroll();
}

var statusNote=null,adminSeen=false;   // adminSeen: admin sudah membalas, jadi catatan "balasan akan muncul di sini" tidak perlu lagi
function setStatus(s){
  status=s;
  refreshSub();
  rm(statusNote);statusNote=null;
  if(s==='human'&&!adminSeen){
    statusNote=sys('Percakapan diteruskan ke admin. Balasan akan muncul di sini.');
    var nb=document.createElement('button');nb.type='button';nb.textContent='Mulai percakapan baru';
    nb.addEventListener('click',fresh);statusNote.appendChild(nb);
  }
  $('nl').hidden=!(s==='human'&&adminSeen);
  if(s==='human'&&!timer)timer=setInterval(poll,6000);
  if(s!=='human'&&timer){clearInterval(timer);timer=null}
  if(s==='selesai')showRate();
  else if(rateNode&&!st.rated){rm(rateNode);rateNode=null}
}
/* Mulai percakapan baru: lupakan percakapan tersimpan, kembali ke sapaan awal. */
function fresh(){
  clr();rm(statusNote);statusNote=null;msgs.innerHTML='';rateNode=null;leadNode=null;replied=false;adminSeen=false;
  add('bot',C.greeting.replace(/\{k\}/g,call));
  setStatus('bot');$('i').focus();
  quickReplies();
}
function apply(res){
  if(res.conversationId&&res.token){st.id=res.conversationId;st.token=res.token;sv()}
  rm(statusNote);statusNote=null;
  var newReply=false,prevStatus=status;
  (res.messages||[]).forEach(function(m){
    if(seen[m.id])return;seen[m.id]=1;if(m.id>lastId)lastId=m.id;add(m.role,m.content,m.created_at);
    if(m.role==='bot'||m.role==='admin'){newReply=true;replied=true}
    if(m.role==='admin')adminSeen=true;
  });
  /* Admin menandai selesai saat chat dipegang admin: beri kabar di chat (dan titik notifikasi kalau widget sedang tertutup). */
  if(res.status==='selesai'&&prevStatus==='human'){sys('Percakapan ini sudah ditandai selesai oleh admin. Terima kasih sudah menghubungi kami.');newReply=true}
  setStatus(res.status||'bot');
  if(res.offerLead)showLead();
  refreshRateLink();scroll();
  if(newReply&&!parentOpen&&window.parent!==window){try{window.parent.postMessage({type:'isengin-newmsg'},'*')}catch(e){}}
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
} else {
  quickReplies();
}
refreshSub();
function demo(){add('customer','Ada produk warna merah?');add('bot','Ada kak! Mau lihat pilihan dan harganya?');add('admin','Halo, ini balasan dari admin toko.')}
if(PREVIEW){
  demo();$('i').disabled=true;$('s').disabled=true;$('i').placeholder='Pratinjau, tidak bisa mengirim';
  window.addEventListener('message',function(e){
    if(e.origin!==location.origin)return;
    var d=e.data||{};if(d.type!=='isengin-preview'||!d.cfg)return;
    try{
      ['botName','greeting','tone','accent','icon','logo','hours','eta','bubble'].forEach(function(k){if(d.cfg[k]!==undefined)C[k]=d.cfg[k]});
      call=C.tone==='formal'?'Bapak/Ibu':'kak';
      applyTheme();applyBubble();setAvatar();$('bn').textContent=C.botName;
      msgs.innerHTML='';add('bot',String(C.greeting).replace(/\{k\}/g,call));quickReplies();demo();refreshSub();
    }catch(err){}
  });
}

$('f').addEventListener('submit',function(e){
  e.preventDefault();
  if(PREVIEW)return;
  var inp=$('i'),text=inp.value.trim();
  if(!text||busy)return;
  busy=true;inp.value='';$('s').disabled=true;
  if(rateNode&&!st.rated){rm(rateNode);rateNode=null}
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
