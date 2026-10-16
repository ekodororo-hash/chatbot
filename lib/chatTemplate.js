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
.m small{display:block;text-align:left;font-size:11px;opacity:.65;margin-top:3px}
.m.customer{align-self:flex-end;background:var(--accent);color:var(--onaccent);border-bottom-right-radius:4px}
.m.customer small{text-align:right}
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
.m a{color:inherit;text-decoration:underline;word-break:normal;overflow-wrap:break-word}
.m .lk{display:inline-flex;align-items:center;gap:6px;max-width:100%}
.m .lk svg{width:16px;height:16px;flex:none}
.m .lk a{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
a.wa{align-self:flex-start;display:inline-block;padding:7px 14px;border-radius:999px;background:#25d366;color:#fff;text-decoration:none;font-weight:600;font-size:13px;overflow-wrap:normal}
.m.admin em{display:block;font-style:normal;font-weight:500;font-size:12px;margin-bottom:2px}
.ainote{align-self:center;color:var(--mute);font-size:12px;text-align:center;padding:2px 12px;max-width:90%}
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
.wb{display:none;margin:6px 10px 0;padding:9px 14px;border-radius:999px;background:#25a244;color:#fff;font-size:14px;font-weight:500;text-align:center;text-decoration:none}.wb.on{display:block}.wb:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
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
  <a id="wb" class="wb" target="_blank" rel="noopener noreferrer" href="#">Lanjut di WhatsApp</a>
  <form id="f" autocomplete="off"><input id="i" maxlength="500" placeholder="Tulis pesan..." aria-label="Pesan"><button id="s" type="submit">Kirim</button></form>
  <p class="priv"><span id="pv"><span style="display:block">Jangan kirim PIN, OTP, atau data kartu. Percakapan disimpan.</span></span> <button type="button" class="lnk" id="cl" hidden>Akhiri percakapan</button> <button type="button" class="lnk" id="rl" hidden>Beri nilai percakapan</button> <button type="button" class="lnk" id="nl" hidden>Mulai percakapan baru</button></p>
</div>
<script>
(function(){
var C=__CONFIG__;
var $=function(i){return document.getElementById(i)};
var call=C.tone==='formal'?'Bapak/Ibu':'kak';
var KEY='chat:'+C.slug,mem={};
var TTL=86400000;
function ld(){try{var o=JSON.parse(localStorage.getItem(KEY))||{};if(o.id){if(!o.t){o.t=Date.now();try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e2){}}else if(Date.now()-o.t>TTL){localStorage.removeItem(KEY);return {}}}return o}catch(e){return mem}}
function sv(){var o={id:st.id,token:st.token,rated:st.rated,t:Date.now()};try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){mem=o}}
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
    im.addEventListener('error',function(){iconInto(box)});
    box.appendChild(im);
  }else iconInto(box);
}
/* ikon bawaan (SVG, hanya path dari server) atau emoji/huruf; dibuat lewat DOM, tanpa innerHTML */
function iconInto(box){
  var p=C.svg;box.textContent='';
  if(p&&p.length&&p.length<=8){
    var NS='http://www.w3.org/2000/svg',sv=document.createElementNS(NS,'svg');
    sv.setAttribute('viewBox','0 0 24 24');sv.setAttribute('width','1em');sv.setAttribute('height','1em');sv.setAttribute('fill','none');
    sv.setAttribute('stroke','currentColor');sv.setAttribute('stroke-width','2');sv.setAttribute('stroke-linecap','round');sv.setAttribute('stroke-linejoin','round');
    sv.setAttribute('aria-hidden','true');sv.style.display='block';
    for(var i=0;i<p.length;i++){if(typeof p[i]!=='string'||!/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]+$/.test(p[i]))continue;var pt=document.createElementNS(NS,'path');pt.setAttribute('d',p[i]);sv.appendChild(pt)}
    box.appendChild(sv);
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
    if(h.days.indexOf(d)>=0&&(i>0||n.min<o))return{on:false,nd:(i===0?-1:i===1?-2:d),open:h.open};
  }
  return{on:false,nd:null,open:''};
}
/* Teks status per bahasa. Hanya toko layanan sendiri (C.portal) yang mengikuti ?lang=; toko lain selalu Indonesia. */
var ST={
id:{seen:'Dibalas admin',fwd:'Diteruskan ke admin',done:'Percakapan selesai',auto:'Membalas otomatis',autoE:'Membalas otomatis · admin balas ±{e}',on:'Admin online',onE:'Admin online · biasanya balas dalam {e}',off:'Admin offline',opens:' · buka {n}',keep:' · asisten tetap membalas',today:'hari ini',tmr:'besok',m:'menit',h:'jam',d:['Min','Sen','Sel','Rab','Kam','Jum','Sab']},
en:{seen:'Replied by admin',fwd:'Forwarded to admin',done:'Conversation ended',auto:'Auto-replying',autoE:'Auto-replying · admin replies in ~{e}',on:'Admin online',onE:'Admin online · usually replies within {e}',off:'Admin offline',opens:' · opens {n}',keep:' · assistant still replies',today:'today',tmr:'tomorrow',m:'min',h:'hr',d:['Sun','Mon','Tue','Wed','Thu','Fri','Sat']},
it:{seen:"Risposta dall'admin",fwd:"Inoltrata all'admin",done:'Conversazione conclusa',auto:'Risposta automatica',autoE:"Risposta automatica · l'admin risponde in ~{e}",on:'Admin online',onE:'Admin online · di solito risponde entro {e}',off:'Admin offline',opens:' · apre {n}',keep:" · l'assistente risponde comunque",today:'oggi',tmr:'domani',m:'min',h:'h',d:['Dom','Lun','Mar','Mer','Gio','Ven','Sab']},
es:{seen:'Respondido por el admin',fwd:'Enviado al admin',done:'Conversación finalizada',auto:'Respuesta automática',autoE:'Respuesta automática · el admin responde en ~{e}',on:'Admin en línea',onE:'Admin en línea · suele responder en {e}',off:'Admin fuera de línea',opens:' · abre {n}',keep:' · el asistente sigue respondiendo',today:'hoy',tmr:'mañana',m:'min',h:'h',d:['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']},
fr:{seen:"Répondu par l'admin",fwd:"Transmis à l'admin",done:'Conversation terminée',auto:'Réponse automatique',autoE:"Réponse automatique · l'admin répond en ~{e}",on:'Admin en ligne',onE:'Admin en ligne · répond généralement en {e}',off:'Admin hors ligne',opens:' · ouvre {n}',keep:" · l'assistant répond toujours",today:"aujourd'hui",tmr:'demain',m:'min',h:'h',d:['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']},
de:{seen:'Vom Admin beantwortet',fwd:'An den Admin weitergeleitet',done:'Unterhaltung beendet',auto:'Automatische Antwort',autoE:'Automatische Antwort · Admin antwortet in ca. {e}',on:'Admin online',onE:'Admin online · antwortet meist innerhalb von {e}',off:'Admin offline',opens:' · öffnet {n}',keep:' · Assistent antwortet weiterhin',today:'heute',tmr:'morgen',m:'Min',h:'Std',d:['So','Mo','Di','Mi','Do','Fr','Sa']},
ru:{seen:'Ответил админ',fwd:'Передано админу',done:'Беседа завершена',auto:'Автоответ',autoE:'Автоответ · админ ответит примерно через {e}',on:'Админ онлайн',onE:'Админ онлайн · обычно отвечает в течение {e}',off:'Админ офлайн',opens:' · откроется {n}',keep:' · ассистент отвечает',today:'сегодня',tmr:'завтра',m:'мин',h:'ч',d:['Вс','Пн','Вт','Ср','Чт','Пт','Сб']},
ar:{seen:'رد المشرف',fwd:'تمت الإحالة إلى المشرف',done:'انتهت المحادثة',auto:'رد تلقائي',autoE:'رد تلقائي · يرد المشرف خلال ~{e}',on:'المشرف متصل',onE:'المشرف متصل · يرد عادة خلال {e}',off:'المشرف غير متصل',opens:' · يفتح {n}',keep:' · المساعد يواصل الرد',today:'اليوم',tmr:'غدًا',m:'د',h:'س',d:['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']}};
var LANG='';   // bahasa yang dikirim situs induk saat bahasa halaman berganti (menang atas ?lang=)
function stLang(){var l='id';if(C.portal){try{l=LANG||String(new URLSearchParams(location.search).get('lang')||'id').toLowerCase().slice(0,2)}catch(e){}}return ST[l]?l:'id'}
function etaText(T){var e=+C.eta||0;return e>0?(e>=60?Math.round(e/60)+' '+T.h:e+' '+T.m):''}
function subtitle(){
  var T=ST[stLang()],dot=$('dot');
  if(status==='human'){dot.hidden=true;return adminSeen?T.seen:T.fwd}
  if(status==='selesai'){dot.hidden=true;return T.done}
  var hi=hoursInfo(),eta=etaText(T);
  if(!hi){dot.hidden=true;return eta?T.autoE.replace('{e}',eta):T.auto}
  dot.hidden=false;dot.className='dot'+(hi.on?' on':'');
  if(hi.on)return eta?T.onE.replace('{e}',eta):T.on;
  var n=hi.nd==null?'':(hi.nd===-1?'':(hi.nd===-2?T.tmr:T.d[hi.nd])+' ')+hi.open;
  return T.off+(n?T.opens.replace('{n}',n):'');
}
function refreshSub(){$('bs').textContent=subtitle()}
setInterval(function(){if(!document.hidden)refreshSub()},60000);
/* Catatan bawah toko layanan sendiri (C.portal): catatan AI portal + peringatan data + branding, dalam bahasa halaman. */
var PV={
id:["Dijawab oleh AI. Untuk harga, stok, dan pesanan, mohon konfirmasi via WhatsApp.","Jangan kirim PIN, OTP, atau data kartu. Percakapan disimpan.","Beri nilai percakapan","Mulai percakapan baru","Akhiri percakapan","Percakapan diakhiri. Kirim pesan kapan saja untuk melanjutkan.","Bagaimana pelayanan kami?","Puas","Kurang puas","Terima kasih atas penilaianmu!","Terima kasih. Masukanmu kami pakai untuk memperbaiki jawaban."],
en:["Answered by AI. For prices, stock and orders, please confirm via WhatsApp.","Never send PINs, OTPs or card details. Conversations are saved.","Rate this conversation","Start a new conversation","End conversation","Conversation ended. Send a message anytime to continue.","How was our service?","Satisfied","Not satisfied","Thank you for your feedback!","Thank you. We'll use your feedback to improve our answers."],
it:["Risposte generate da AI. Per prezzi, disponibilità e ordini, confermi via WhatsApp.","Non inviare PIN, OTP o dati della carta. Le conversazioni vengono salvate.","Valuta la conversazione","Inizia una nuova conversazione","Termina la conversazione","Conversazione conclusa. Scrivi un messaggio in qualsiasi momento per continuare.","Come valuti il nostro servizio?","Soddisfatto","Non soddisfatto","Grazie per la tua valutazione!","Grazie. Useremo il tuo feedback per migliorare le risposte."],
es:["Respuestas generadas por IA. Para precios, stock y pedidos, confirme por WhatsApp.","No envíe PIN, OTP ni datos de tarjeta. Las conversaciones se guardan.","Valorar la conversación","Iniciar una nueva conversación","Finalizar conversación","Conversación finalizada. Envíe un mensaje cuando quiera para continuar.","¿Cómo fue nuestro servicio?","Satisfecho","Insatisfecho","¡Gracias por su valoración!","Gracias. Usaremos sus comentarios para mejorar nuestras respuestas."],
fr:["Réponses générées par IA. Pour les prix, le stock et les commandes, confirmez via WhatsApp.","N'envoyez ni PIN, ni OTP, ni données de carte. Les conversations sont enregistrées.","Évaluer la conversation","Nouvelle conversation","Terminer la conversation","Conversation terminée. Envoyez un message à tout moment pour continuer.","Comment était notre service ?","Satisfait","Insatisfait","Merci pour votre avis !","Merci. Nous utiliserons vos retours pour améliorer nos réponses."],
ar:["الردود من الذكاء الاصطناعي. للأسعار والمخزون والطلبات، يرجى التأكيد عبر واتساب.","لا ترسل رمز PIN أو OTP أو بيانات البطاقة. يتم حفظ المحادثات.","قيّم المحادثة","ابدأ محادثة جديدة","إنهاء المحادثة","انتهت المحادثة. أرسل رسالة في أي وقت للمتابعة.","كيف كانت خدمتنا؟","راضٍ","غير راضٍ","شكرًا على تقييمك!","شكرًا. سنستخدم ملاحظاتك لتحسين إجاباتنا."],
de:["Antworten von KI. Für Preise, Verfügbarkeit und Bestellungen bitte per WhatsApp bestätigen.","Senden Sie keine PIN, OTP oder Kartendaten. Unterhaltungen werden gespeichert.","Unterhaltung bewerten","Neue Unterhaltung starten","Unterhaltung beenden","Unterhaltung beendet. Schreiben Sie jederzeit, um fortzufahren.","Wie war unser Service?","Zufrieden","Unzufrieden","Danke für Ihre Bewertung!","Danke. Wir nutzen Ihr Feedback, um unsere Antworten zu verbessern."],
ru:["Ответы даёт ИИ. Цены, наличие и заказы уточняйте в WhatsApp.","Не отправляйте PIN, OTP и данные карты. Беседы сохраняются.","Оценить беседу","Начать новую беседу","Завершить беседу","Беседа завершена. Напишите в любой момент, чтобы продолжить.","Как вам наш сервис?","Доволен","Не доволен","Спасибо за оценку!","Спасибо. Мы используем ваш отзыв, чтобы улучшить ответы."]};
/* Teks bagian i dari tabel PV: bahasa halaman untuk toko layanan sendiri, Indonesia untuk toko lain. */
function pvt(i){return (C.portal?(PV[stLang()]||PV.id):PV.id)[i]}
function applyPv(){
  if(!C.portal){
    // Toko klien: susunan sama dengan portal (catatan data di baris sendiri, tautan di bawahnya), tanpa baris "Powered by".
    var pv0=$('pv');pv0.textContent='';
    var d0=document.createElement('span');d0.style.display='block';d0.textContent=PV.id[1];pv0.appendChild(d0);
    return;
  }
  var l=stLang(),t=PV[l]||PV.id,pv=$('pv'),p=pv.parentNode;
  if(l==='ar')p.dir='rtl';else p.removeAttribute('dir');
  pv.textContent='';
  [t[1],'Powered by EMAHAIRSHOP'].forEach(function(x,i){
    var d=document.createElement('span');d.style.display='block';
    if(i===1){var a=document.createElement('a');a.href='https://chat.emahairshop.com/';a.target='_blank';a.rel='noopener noreferrer';a.textContent=x;a.style.cssText='color:inherit;opacity:.7;text-decoration:none';d.appendChild(a)}
    else d.textContent=x;
    pv.appendChild(d);
  });
  $('rl').textContent=t[2];$('nl').textContent=t[3];$('cl').textContent=t[4];
}
/* Teks tampilan chat per bahasa (toko layanan sendiri, C.portal; toko lain selalu Indonesia). Kunci: bn gr ph sd al qr ne sf ef gn fn ae */
var UI={
id:{"bn": "Asisten AI", "gr": "Halo {k}, ada yang bisa dibantu?", "ph": "Tulis pesan...", "sd": "Kirim", "al": "Pesan", "qr": "Pilihan cepat", "ne": "Koneksi bermasalah. Coba lagi.", "sf": "Gagal mengirim pesan.", "ef": "Gagal mengakhiri percakapan.", "gn": "Percakapan sebelumnya sudah tidak tersedia. Kirim ulang pesanmu.", "fn": "Percakapan diteruskan ke admin. Balasan akan muncul di sini.", "ae": "Percakapan ini sudah ditandai selesai oleh admin. Terima kasih sudah menghubungi kami."},
en:{"bn": "AI Assistant", "gr": "Hi, how can I help you?", "ph": "Type a message...", "sd": "Send", "al": "Message", "qr": "Quick replies", "ne": "Connection problem. Please try again.", "sf": "Could not send the message.", "ef": "Could not end the conversation.", "gn": "The previous conversation is no longer available. Please resend your message.", "fn": "Conversation forwarded to admin. The reply will appear here.", "ae": "This conversation was marked as ended by the admin. Thank you for contacting us."},
it:{"bn": "Assistente IA", "gr": "Ciao, come posso aiutarti?", "ph": "Scrivi un messaggio...", "sd": "Invia", "al": "Messaggio", "qr": "Risposte rapide", "ne": "Problema di connessione. Riprova.", "sf": "Impossibile inviare il messaggio.", "ef": "Impossibile terminare la conversazione.", "gn": "La conversazione precedente non è più disponibile. Invia di nuovo il messaggio.", "fn": "Conversazione inoltrata all'admin. La risposta apparirà qui.", "ae": "Questa conversazione è stata chiusa dall'admin. Grazie per averci contattato."},
es:{"bn": "Asistente IA", "gr": "Hola, ¿en qué puedo ayudarte?", "ph": "Escribe un mensaje...", "sd": "Enviar", "al": "Mensaje", "qr": "Respuestas rápidas", "ne": "Problema de conexión. Inténtalo de nuevo.", "sf": "No se pudo enviar el mensaje.", "ef": "No se pudo finalizar la conversación.", "gn": "La conversación anterior ya no está disponible. Vuelve a enviar tu mensaje.", "fn": "Conversación enviada al admin. La respuesta aparecerá aquí.", "ae": "Esta conversación fue marcada como finalizada por el admin. Gracias por contactarnos."},
fr:{"bn": "Assistant IA", "gr": "Bonjour, comment puis-je vous aider ?", "ph": "Écrivez un message...", "sd": "Envoyer", "al": "Message", "qr": "Réponses rapides", "ne": "Problème de connexion. Réessayez.", "sf": "Échec de l'envoi du message.", "ef": "Impossible de terminer la conversation.", "gn": "La conversation précédente n'est plus disponible. Renvoyez votre message.", "fn": "Conversation transmise à l'admin. La réponse apparaîtra ici.", "ae": "Cette conversation a été clôturée par l'admin. Merci de nous avoir contactés."},
ar:{"bn": "مساعد الذكاء الاصطناعي", "gr": "مرحبًا، كيف يمكنني مساعدتك؟", "ph": "اكتب رسالة...", "sd": "إرسال", "al": "رسالة", "qr": "ردود سريعة", "ne": "حدثت مشكلة في الاتصال. حاول مرة أخرى.", "sf": "تعذر إرسال الرسالة.", "ef": "تعذر إنهاء المحادثة.", "gn": "لم تعد المحادثة السابقة متاحة. أعد إرسال رسالتك.", "fn": "تمت إحالة المحادثة إلى المشرف. سيظهر الرد هنا.", "ae": "تم إنهاء هذه المحادثة من قبل المشرف. شكرًا لتواصلك معنا."},
de:{"bn": "KI-Assistent", "gr": "Hallo, wie kann ich Ihnen helfen?", "ph": "Nachricht schreiben...", "sd": "Senden", "al": "Nachricht", "qr": "Schnellantworten", "ne": "Verbindungsproblem. Bitte versuchen Sie es erneut.", "sf": "Nachricht konnte nicht gesendet werden.", "ef": "Unterhaltung konnte nicht beendet werden.", "gn": "Die vorherige Unterhaltung ist nicht mehr verfügbar. Bitte senden Sie Ihre Nachricht erneut.", "fn": "Unterhaltung an den Admin weitergeleitet. Die Antwort erscheint hier.", "ae": "Diese Unterhaltung wurde vom Admin beendet. Vielen Dank für Ihre Nachricht."},
ru:{"bn": "ИИ-ассистент", "gr": "Здравствуйте! Чем могу помочь?", "ph": "Введите сообщение...", "sd": "Отправить", "al": "Сообщение", "qr": "Быстрые ответы", "ne": "Проблема с соединением. Попробуйте ещё раз.", "sf": "Не удалось отправить сообщение.", "ef": "Не удалось завершить беседу.", "gn": "Предыдущая беседа больше недоступна. Отправьте сообщение ещё раз.", "fn": "Беседа передана админу. Ответ появится здесь.", "ae": "Эта беседа завершена администратором. Спасибо, что обратились к нам."}
};
function ui(k){return (UI[C.portal?stLang():'id']||UI.id)[k]}
/* Sapaan bawaan (yang belum diubah pemilik toko) ikut bahasa halaman; sapaan buatan pemilik tidak diterjemahkan. */
function greet(){var g=String(C.greeting==null?'':C.greeting);if(C.portal&&stLang()!=='id'&&g==='Halo {k}, ada yang bisa dibantu?')g=ui('gr');return g.replace(/\{k\}/g,call)}
var greetNode=null,qrNode=null;
function applyLang(){
  applyPv();
  if(!C.portal)return;
  var l=stLang(),n=String(C.botName||'');
  $('bn').textContent=(l!=='id'&&(n==='Asisten AI'||n==='Asisten Toko'))?ui('bn'):C.botName;
  var i=$('i');if(!PREVIEW)i.placeholder=ui('ph');i.setAttribute('aria-label',ui('al'));$('s').textContent=ui('sd');
}
applyLang();
/* Situs induk (widget.js) memberi tahu saat bahasa halaman berganti: teks chat diganti di tempat, tanpa memuat ulang. */
function setLang(l){
  if(!C.portal||PREVIEW)return;
  l=String(l||'').toLowerCase().slice(0,2);if(!ST[l])l='id';
  if(l===stLang())return;
  LANG=l;applyLang();refreshSub();
  if(greetNode&&greetNode.firstChild&&greetNode.firstChild.nodeType===3)greetNode.firstChild.nodeValue=greet();
  if(aiNote)aiNote.textContent=pvt(0);
  var old=qrNode;if(old&&old.parentNode){var nw=quickReplies();if(nw)msgs.replaceChild(nw,old)}
  if(rateNode&&!st.rated){rm(rateNode);rateNode=null;showRate()}
}

/* beri tahu widget.js di halaman klien saat chat ini sedang dibuka/ditutup, supaya titik notifikasi balasan baru cuma muncul saat tertutup */
var parentOpen=true;
if(window.parent!==window){
  window.addEventListener('message',function(e){
    var d=e&&e.data||{};
    if(d.type==='isengin-open')parentOpen=true;
    else if(d.type==='isengin-close')parentOpen=false;
    else if(d.type==='isengin-lang'&&e.source===window.parent)setLang(d.lang);
    /* pesan buka/tutup dari situs induk juga membawa bahasa situs: ikut diterapkan supaya tidak tertinggal */
    if((d.type==='isengin-open'||d.type==='isengin-close')&&d.lang&&e.source===window.parent)setLang(d.lang);
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
  var wa='',m=String(text).match(/(?:^|\n)([^\n:]{2,40}):\s*(https:\/\/wa\.me\/\d+)\s*$/);
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
/* Transkrip ringan untuk ringkasan yang ikut terkirim ke WhatsApp. */
var tx=[];
function add(role,text,iso){
  if(role==='customer'||role==='bot'||role==='admin'){tx.push([role,String(text)]);if(tx.length>40)tx.shift()}
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
/* Tombol "Lanjut di WhatsApp": nomor dari pengaturan toko, ringkasan percakapan terakhir ikut sebagai teks awal. */
function waText(){
  var L=['Halo '+C.shopName+', saya lanjut dari chat di website.'];
  var last=tx.slice(-6);
  if(last.length){
    L.push('','Ringkasan chat:');
    last.forEach(function(m){var t=m[1].replace(/\s+/g,' ').trim();if(t.length>140)t=t.slice(0,137)+'...';L.push((m[0]==='customer'?'Saya: ':(m[0]==='admin'?'Admin: ':'Asisten: '))+t)});
  }
  var s=L.join('\n');
  return s.length>900?s.slice(0,897)+'...':s;
}
function setWa(){var b=$('wb');if(!b)return;if(C.wa)b.classList.add('on');else b.classList.remove('on')}
setWa();
$('wb').addEventListener('click',function(){
  if(PREVIEW||!C.wa){return}
  this.href='https://wa.me/'+encodeURIComponent(C.wa)+'?text='+encodeURIComponent(waText());
  try{fetch('/api/widget/'+encodeURIComponent(C.slug),{method:'POST',body:JSON.stringify({kind:'wa'}),keepalive:true,headers:{'Content-Type':'text/plain'}}).catch(function(){})}catch(e){}
});
$('wb').addEventListener('click',function(e){if(PREVIEW)e.preventDefault()});
function sys(text){var d=document.createElement('div');d.className='sys';d.textContent=text;msgs.appendChild(d);scroll();return d}
function typing(){var d=document.createElement('div');d.className='m bot';d.innerHTML='<span class="dots"><i></i><i></i><i></i></span>';msgs.appendChild(d);scroll();return d}
function rm(n){if(n&&n.parentNode)n.parentNode.removeChild(n)}
/* Tombol pilihan cepat di bawah sapaan awal, supaya pelanggan tidak perlu mengetik dari nol. */
/* Pilihan cepat toko layanan sendiri (C.portal): sama dengan portal (index.html). Bahasa dari ?lang=, bawaan Indonesia. */
var PQS={en:["What's the starting price?","What is the minimum order?","How long does shipping take?","How do I order?","Can I use my own logo?"],
id:["Harga mulai berapa?","Minimal order berapa?","Pengiriman berapa lama?","Bagaimana cara order?","Bisa custom logo?"],
it:["Qual è il prezzo di partenza?","Qual è l'ordine minimo?","Quanto tempo richiede la spedizione?","Come posso ordinare?","Posso usare il mio logo?"],
es:["¿Cuál es el precio inicial?","¿Cuál es el pedido mínimo?","¿Cuánto tarda el envío?","¿Cómo hago un pedido?","¿Puedo usar mi propio logo?"],
fr:["Quel est le prix de départ ?","Quelle est la commande minimale ?","Quel est le délai de livraison ?","Comment commander ?","Puis-je utiliser mon propre logo ?"],
ar:["ما هو السعر الابتدائي؟","ما هو الحد الأدنى للطلب؟","كم تستغرق مدة الشحن؟","كيف أطلب؟","هل يمكنني استخدام شعاري الخاص؟"],
de:["Was ist der Einstiegspreis?","Wie hoch ist die Mindestbestellmenge?","Wie lange dauert der Versand?","Wie bestelle ich?","Kann ich mein eigenes Logo verwenden?"],
ru:["Какова начальная цена?","Какой минимальный заказ?","Сколько занимает доставка?","Как сделать заказ?","Можно ли нанести свой логотип?"]};
function portalQs(){return PQS[stLang()]||PQS.id}
/* Pilihan cepat toko biasa: bisa dimatikan dan diedit pemilik (C.quick). Tanpa C.quick (config lama) tetap tiga pilihan bawaan. */
function shopQs(){var q=C.quick;if(!q)return['Tanya produk','Cek status pesanan','Bicara dengan admin'];return q.on===false?[]:(q.items||[])}
function quickReplies(){
  var items=C.portal?portalQs():shopQs();
  if(!items.length){qrNode=null;return null}
  var wrap=document.createElement('div');wrap.className='qr';wrap.setAttribute('role','group');wrap.setAttribute('aria-label',ui('qr'));
  items.forEach(function(t){
    var b=document.createElement('button');b.type='button';b.textContent=t;
    b.addEventListener('click',function(){
      if(PREVIEW)return;
      rm(wrap);$('i').value=t;
      if(typeof $('f').requestSubmit==='function')$('f').requestSubmit();
      else{var ev;try{ev=new Event('submit',{cancelable:true,bubbles:true})}catch(e){ev=document.createEvent('Event');ev.initEvent('submit',true,true)}$('f').dispatchEvent(ev)}
    });
    wrap.appendChild(b);
  });
  qrNode=wrap;msgs.appendChild(wrap);scroll();return wrap;
}

/* Catatan AI toko layanan sendiri (C.portal): tampil sekali di awal percakapan, hilang begitu pelanggan mengirim pesan. */
var aiNote=null;
function showAiNote(){if(!C.portal||PREVIEW||aiNote)return;aiNote=document.createElement('div');aiNote.className='ainote';aiNote.textContent=pvt(0);msgs.appendChild(aiNote);scroll()}
function hideAiNote(){if(aiNote){rm(aiNote);aiNote=null}}

/* Penilaian jempol: muncul sendiri saat percakapan selesai; sebelum itu bisa dibuka lewat tautan kecil di bawah setelah ada balasan. */
var rateNode=null,replied=false;
function canRate(){return !!(C.rating&&!PREVIEW&&st.id)}
function refreshRateLink(){$('rl').hidden=!(canRate()&&replied&&!st.rated&&!rateNode);$('cl').hidden=!(!PREVIEW&&st.id&&replied&&status!=='selesai')}
function showRate(){
  if(!canRate()||st.rated||rateNode)return;
  var d=document.createElement('div');d.className='rate';d.setAttribute('role','group');d.setAttribute('aria-label','Penilaian percakapan');
  var q=document.createElement('span');q.textContent=pvt(6);
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
      q.textContent=v>0?pvt(9):pvt(10);
      th.remove();er.remove();refreshRateLink();
    }).catch(function(){reset();er.textContent=ui('ne')});
  }
  var UP='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
  var DN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>';
  [[1,UP,pvt(7)],[-1,DN,pvt(8)]].forEach(function(o){
    var b=document.createElement('button');b.type='button';b.innerHTML=o[1]+'<span>'+o[2]+'</span>';b.setAttribute('aria-label',o[2]);
    b.addEventListener('click',function(){send(o[0],b)});th.appendChild(b);
  });
  d.appendChild(q);d.appendChild(th);d.appendChild(er);
  msgs.appendChild(d);rateNode=d;refreshRateLink();scroll();
}
$('rl').addEventListener('click',showRate);
/* Pelanggan mengakhiri percakapan sendiri: status jadi "selesai" (pemilik toko tidak perlu menebak), lalu penilaian muncul. Pesan baru membuka lagi. */
$('cl').addEventListener('click',function(){
  if(PREVIEW||!st.id)return;
  var b=$('cl');b.disabled=true;
  req('/api/chat/close',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:C.slug,conversationId:st.id,token:st.token})})
  .then(function(x){
    b.disabled=false;
    if(!x.ok){sys((x.j&&x.j.error)||ui('ef'));return}
    setStatus('selesai');sys(pvt(5));refreshRateLink();
  }).catch(function(){b.disabled=false;sys(ui('ne'))});
});
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
    statusNote=sys(ui('fn'));
  }
  $('nl').hidden=!(s==='human'&&adminSeen);
  if(s==='human'&&!timer)timer=setInterval(poll,6000);
  if(s!=='human'&&timer){clearInterval(timer);timer=null}
  if(s==='selesai')showRate();
  else if(rateNode&&!st.rated){rm(rateNode);rateNode=null}
}
/* Mulai percakapan baru: lupakan percakapan tersimpan, kembali ke sapaan awal. */
function fresh(){
  clr();rm(statusNote);statusNote=null;msgs.innerHTML='';aiNote=null;rateNode=null;leadNode=null;replied=false;adminSeen=false;
  greetNode=add('bot',greet());
  setStatus('bot');$('i').focus();showAiNote();
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
  if(res.status==='selesai'&&prevStatus==='human'){sys(ui('ae'));newReply=true}
  setStatus(res.status||'bot');
  if(res.offerLead)showLead();
  refreshRateLink();scroll();
  if(newReply&&!parentOpen&&window.parent!==window){try{window.parent.postMessage({type:'isengin-newmsg'},'*')}catch(e){}}
}
function req(url,opt){return fetch(url,opt).then(function(r){return r.json().then(function(j){return{ok:r.ok,code:r.status,j:j}})})}
function poll(){
  if(!st.id||document.hidden||ldDots)return;
  req('/api/chat?conversationId='+encodeURIComponent(st.id)+'&token='+encodeURIComponent(st.token)+'&after='+lastId)
    .then(function(x){if(x.ok)apply(x.j);else if(x.code===404){clr();setStatus('bot')}}).catch(function(){});
}

var ldDots=null;
function showGreet(){greetNode=add('bot',greet())}
/* Kabari situs induk (widget.js) bahwa isi chat sudah selesai tampil, supaya animasi muat di panel baru dilepas setelah ini. */
function ready(){setTimeout(function(){if(window.parent!==window){try{window.parent.postMessage({type:'isengin-ready'},'*')}catch(e){}}},60)}
if(st.id){ // pulihkan percakapan sebelumnya: tampilkan titik mengetik dulu, bukan sapaan
  ldDots=typing();
  req('/api/chat?conversationId='+encodeURIComponent(st.id)+'&token='+encodeURIComponent(st.token)+'&after=0')
    .then(function(x){
      rm(ldDots);ldDots=null;showGreet();
      if(x.ok)apply(x.j);else if(x.code===404){clr();showAiNote();quickReplies()}
      ready();
    }).catch(function(){if(ldDots){rm(ldDots);ldDots=null}if(!greetNode)showGreet();ready()});
} else {
  showGreet();showAiNote();quickReplies();ready();
}
refreshSub();
function demo(){add('customer','Ada produk warna merah?');add('bot','Ada kak! Mau lihat pilihan dan harganya?');add('admin','Halo, ini balasan dari admin toko.')}
if(PREVIEW){
  demo();$('i').disabled=true;$('s').disabled=true;$('i').placeholder='Pratinjau, tidak bisa mengirim';
  window.addEventListener('message',function(e){
    if(e.origin!==location.origin)return;
    var d=e.data||{};if(d.type!=='isengin-preview'||!d.cfg)return;
    try{
      ['botName','greeting','tone','accent','icon','svg','logo','hours','eta','bubble','quick','wa'].forEach(function(k){if(d.cfg[k]!==undefined)C[k]=d.cfg[k]});
      call=C.tone==='formal'?'Bapak/Ibu':'kak';
      applyTheme();applyBubble();setAvatar();setWa();$('bn').textContent=C.botName;
      msgs.innerHTML='';add('bot',String(C.greeting).replace(/\{k\}/g,call));quickReplies();demo();refreshSub();
    }catch(err){}
  });
}

$('f').addEventListener('submit',function(e){
  e.preventDefault();
  if(PREVIEW)return;
  var inp=$('i'),text=inp.value.trim();
  if(!text||busy)return;hideAiNote();
  rm(qrNode);qrNode=null;   // pilihan cepat hilang begitu pelanggan mulai chat (diketik maupun diklik)
  busy=true;inp.value='';$('s').disabled=true;
  if(rateNode&&!st.rated){rm(rateNode);rateNode=null}
  var temp=add('customer',text),dots=typing();
  req('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slug:C.slug,conversationId:st.id,token:st.token,text:text,after:lastId,lang:C.portal?stLang():''})})
  .then(function(x){
    rm(temp);rm(dots);
    if(!x.ok){
      if(x.code===404&&st.id){clr();sys(ui('gn'))}
      else sys(x.j&&x.j.error?x.j.error:ui('sf'));
      inp.value=text;return;
    }
    apply(x.j);
  })
  .catch(function(){rm(temp);rm(dots);sys(ui('ne'));inp.value=text})
  .then(function(){busy=false;$('s').disabled=false;
    /* HP/tablet: jangan fokus otomatis setelah balasan datang, karena keyboard muncul sendiri dan mengganggu. Desktop tetap fokus. */
    var touch=false;try{touch=window.matchMedia('(pointer:coarse)').matches||('ontouchstart' in window)}catch(e){}
    if(!touch)inp.focus()});
});
})();
</script>
</body>
</html>
`;
