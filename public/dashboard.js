/* Dashboard pemilik toko. Semua akses data lewat Supabase dengan sesi login,
   dan dibatasi oleh Row Level Security (lihat supabase/schema.sql). */
(async function () {
  'use strict';
  const { h, toast, init } = App;
  const view = document.getElementById('view');
  const tabsEl = document.getElementById('tabs');

  let sb;
  try { sb = await init(); } catch (e) { view.textContent = e.message; return; }
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) { location.replace('/login.html'); return; }
  const user = sess.session.user;
  document.getElementById('who').textContent = user.email;
  document.getElementById('out').onclick = async () => { await sb.auth.signOut(); location.replace('/login.html'); };
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace('/login.html'); });

  let shop = null, tab = 'chat', openConv = null, prefillQ = '', pollTimer = null, humanCount = 0;
  const TABS = [['chat', 'Percakapan'], ['produk', 'Produk'], ['faq', 'FAQ'], ['toko', 'Toko'], ['bot', 'Bot'], ['pasang', 'Pasang']];

  const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  function normalizeDomain(input) {
    let s = String(input || '').trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/^www\./, '');
    if (s === 'localhost') return s;
    return DOMAIN_RE.test(s) ? s : null;
  }
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
  const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : NaN; };
  const rp = (n) => 'Rp' + Math.round(Number(n)).toLocaleString('id-ID');
  const fail = (err) => { console.error(err); toast(err && err.message ? err.message : 'Terjadi kesalahan'); };
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  const dayTime = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  function startOfTodayWIB() {
    const w = new Date(Date.now() + 7 * 3600000); w.setUTCHours(0, 0, 0, 0);
    return new Date(w.getTime() - 7 * 3600000);
  }
  function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  function field(id, label, input) { return [h('label', { for: id }, label), input]; }

  async function loadShop() {
    const { data, error } = await sb.from('shops').select('*').eq('owner_id', user.id).maybeSingle();
    if (error) { fail(error); return; }
    shop = data;
  }

  async function refreshHumanCount() {
    if (!shop) return;
    const { count } = await sb.from('conversations').select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id).eq('status', 'human');
    humanCount = count || 0;
    renderTabs();
  }

  function renderTabs() {
    clear(tabsEl);
    if (!shop) return;
    TABS.forEach(([k, label]) => {
      tabsEl.appendChild(h('button', {
        type: 'button', 'aria-selected': String(tab === k),
        onclick: () => { tab = k; openConv = null; show(); }
      }, label, (k === 'chat' && humanCount) ? h('i', { text: String(humanCount) }) : null));
    });
  }

  function show() {
    stopPoll(); renderTabs(); window.scrollTo(0, 0);
    ({ chat: vChat, produk: vProduk, faq: vFaq, toko: vToko, bot: vBot, pasang: vPasang })[tab]();
  }

  /* ---------- onboarding ---------- */
  function vOnboarding() {
    clear(tabsEl); clear(view);
    const name = h('input', { id: 'on', maxlength: '100', placeholder: 'Contoh: Toko Ayu Hijab' });
    const slug = h('input', { id: 'os', maxlength: '30', placeholder: 'toko-ayu', autocapitalize: 'off' });
    const err = h('div', { class: 'err', role: 'alert' });
    let touched = false;
    slug.oninput = () => { touched = true; slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); };
    name.oninput = () => { if (!touched) slug.value = name.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30); };
    const btn = h('button', { class: 'btn', type: 'button', style: 'width:100%;margin-top:12px' }, 'Buat toko');
    btn.onclick = async () => {
      err.textContent = '';
      const n = name.value.trim(), s = slug.value.trim();
      if (!n) { err.textContent = 'Isi nama toko.'; return; }
      if (!/^[a-z0-9-]{3,30}$/.test(s)) { err.textContent = 'Alamat chat: 3-30 karakter, huruf kecil, angka, atau tanda hubung.'; return; }
      btn.disabled = true;
      const { data, error } = await sb.from('shops').insert({ owner_id: user.id, name: n, slug: s }).select('*').single();
      btn.disabled = false;
      if (error) { err.textContent = error.code === '23505' ? 'Alamat chat ini sudah dipakai. Coba yang lain.' : error.message; return; }
      shop = data; tab = 'toko'; toast('Toko dibuat. Lengkapi datanya.'); show();
    };
    view.appendChild(h('div', { style: 'max-width:420px;margin:0 auto' },
      h('h1', { style: 'font-size:30px;margin-top:12px', text: 'Buat toko pertamamu' }),
      h('div', { class: 'card' }, field('on', 'Nama toko', name), field('os', 'Alamat chat (dipakai di link dan widget)', slug),
        h('p', { class: 'hint', text: 'Link chat tokomu: ' + location.origin + '/chat/alamat-ini' }), err, btn)));
  }

  /* ---------- percakapan ---------- */
  const STATUS = { bot: ['Dijawab bot', ''], human: ['Butuh admin', 'w'], selesai: ['Selesai', ''] };

  async function vChat() {
    clear(view);
    if (openConv) return vConv();
    const box = h('div', { class: 'card' }, h('h2', { text: 'Percakapan terbaru' }), h('div', { id: 'cl' }));
    view.appendChild(box);
    await drawList();
    pollTimer = setInterval(() => { if (!document.hidden && !openConv && tab === 'chat') drawList(); }, 10000);
  }

  async function drawList() {
    const cl = document.getElementById('cl'); if (!cl) return;
    const { data: convs, error } = await sb.from('conversations')
      .select('id,customer_name,status,flag,unanswered,last_question,updated_at')
      .eq('shop_id', shop.id).order('updated_at', { ascending: false }).limit(50);
    if (error) { fail(error); return; }
    const prev = {};
    if (convs.length) {
      const { data: ms } = await sb.from('messages').select('conversation_id,content').eq('role', 'customer')
        .in('conversation_id', convs.map(c => c.id)).order('id', { ascending: false }).limit(300);
      (ms || []).forEach(m => { if (!prev[m.conversation_id]) prev[m.conversation_id] = m.content; });
    }
    humanCount = convs.filter(c => c.status === 'human').length; renderTabs();
    clear(cl);
    if (!convs.length) { cl.appendChild(h('p', { class: 'hint', text: 'Belum ada percakapan. Coba chat lewat tab Pasang untuk melihat hasilnya di sini.' })); return; }
    convs.forEach(c => {
      cl.appendChild(h('button', { class: 'li', type: 'button', onclick: () => { openConv = c; show(); } },
        h('div', { class: 't' }, h('b', { text: c.customer_name + ' - ' + dayTime(c.updated_at) }), h('small', { text: prev[c.id] || '(belum ada pesan)' })),
        c.flag ? h('span', { class: 'tag a', text: c.flag }) : null,
        h('span', { class: 'tag ' + STATUS[c.status][1], text: STATUS[c.status][0] })));
    });
  }

  async function vConv() {
    const c = openConv;
    const list = h('div', { class: 'msgs', 'aria-live': 'polite' });
    const seen = new Set();
    let lastId = 0;
    async function pull() {
      const { data, error } = await sb.from('messages').select('id,role,content,created_at')
        .eq('conversation_id', c.id).gt('id', lastId).order('id', { ascending: true }).limit(200);
      if (error) { fail(error); return; }
      let added = false;
      (data || []).forEach(m => {
        if (seen.has(m.id)) return; seen.add(m.id); lastId = Math.max(lastId, m.id); added = true;
        list.appendChild(h('div', { class: 'm ' + m.role }, m.role === 'admin' ? h('em', { text: 'Kamu (admin)' }) : (m.role === 'bot' ? h('em', { text: 'Bot' }) : null), m.content, h('small', { text: hhmm(m.created_at) })));
      });
      if (added) list.scrollTop = list.scrollHeight;
    }
    const input = h('input', { maxlength: '1000', placeholder: 'Balas sebagai admin...', 'aria-label': 'Balasan admin' });
    const form = h('form', { class: 'row', onsubmit: async (e) => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      input.value = '';
      const { error } = await sb.from('messages').insert({ conversation_id: c.id, shop_id: shop.id, role: 'admin', content: text });
      if (error) { fail(error); input.value = text; return; }
      if (c.status !== 'human') { await setStatus('human', true); }
      await pull();
    } }, h('div', { style: 'flex:1;min-width:160px' }, input), h('button', { class: 'btn', type: 'submit' }, 'Kirim'));
    async function setStatus(s, silent) {
      const patch = { status: s }; if (s !== 'human') patch.unanswered = false;
      const { error } = await sb.from('conversations').update(patch).eq('id', c.id);
      if (error) { fail(error); return; }
      c.status = s; if (!silent) { toast('Status diubah.'); drawBar(); refreshHumanCount(); }
    }
    const bar = h('div', { class: 'row' });
    function drawBar() {
      clear(bar);
      bar.appendChild(h('span', { class: 'tag ' + STATUS[c.status][1], text: STATUS[c.status][0] }));
      if (c.status !== 'selesai') bar.appendChild(h('button', { class: 'btn ghost sm', type: 'button', onclick: () => setStatus('selesai') }, 'Tandai selesai'));
      if (c.status !== 'bot') bar.appendChild(h('button', { class: 'btn ghost sm', type: 'button', onclick: () => setStatus('bot') }, 'Kembalikan ke bot'));
      if (c.unanswered && c.last_question) bar.appendChild(h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { prefillQ = c.last_question; tab = 'faq'; openConv = null; show(); } }, 'Jadikan FAQ'));
    }
    drawBar();
    view.appendChild(h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { openConv = null; show(); } }, '← Semua percakapan'));
    view.appendChild(h('div', { class: 'card', style: 'margin-top:12px' }, h('h2', { text: c.customer_name }), list, form, bar));
    await pull();
    pollTimer = setInterval(() => { if (!document.hidden) pull(); }, 8000);
  }

  /* ---------- produk ---------- */
  async function vProduk() {
    clear(view);
    const { data, error } = await sb.from('products').select('*').eq('shop_id', shop.id).order('created_at');
    if (error) { fail(error); return; }
    const n = h('input', { id: 'pn', maxlength: '100', placeholder: 'Nama produk' });
    const p = h('input', { id: 'pp', type: 'number', inputmode: 'numeric', min: '0', placeholder: 'Harga (Rp)' });
    const k = h('input', { id: 'pk', type: 'number', inputmode: 'numeric', min: '0', placeholder: 'Stok' });
    const d = h('input', { id: 'pd', maxlength: '300', placeholder: 'Deskripsi singkat (boleh kosong)' });
    const add = h('button', { class: 'btn', type: 'button' }, 'Tambah produk');
    add.onclick = async () => {
      const price = toInt(p.value), stock = k.value === '' ? 0 : toInt(k.value);
      if (!n.value.trim()) return toast('Isi nama produk.');
      if (!(price >= 0)) return toast('Isi harga dengan angka.');
      if (!(stock >= 0)) return toast('Stok harus angka 0 atau lebih.');
      add.disabled = true;
      const { error: e } = await sb.from('products').insert({ shop_id: shop.id, name: n.value.trim(), price, stock, description: d.value.trim() });
      add.disabled = false;
      if (e) return fail(e);
      toast('Produk ditambahkan.'); vProduk();
    };
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Tambah produk' }),
      h('div', { class: 'item' }, h('div', { class: 'grid3' }, n, p, k), h('div', { style: 'margin-top:8px' }, d)), h('div', { class: 'row' }, add)));
    const box = h('div', { class: 'card' }, h('h2', { text: 'Daftar produk (' + data.length + ')' }));
    if (!data.length) box.appendChild(h('p', { class: 'hint', text: 'Belum ada produk. Bot hanya bisa menjawab dari data yang kamu isi di sini.' }));
    data.forEach(pr => {
      const name = h('input', { value: pr.name, maxlength: '100', 'aria-label': 'Nama produk' });
      const price = h('input', { value: String(pr.price), type: 'number', inputmode: 'numeric', min: '0', 'aria-label': 'Harga' });
      const stock = h('input', { value: String(pr.stock), type: 'number', inputmode: 'numeric', min: '0', 'aria-label': 'Stok' });
      const desc = h('input', { value: pr.description || '', maxlength: '300', placeholder: 'Deskripsi', 'aria-label': 'Deskripsi' });
      const save = async () => {
        const pv = toInt(price.value), sv = toInt(stock.value);
        if (!name.value.trim() || !(pv >= 0) || !(sv >= 0)) { toast('Nama, harga, dan stok harus valid.'); return; }
        const { error: e } = await sb.from('products').update({ name: name.value.trim(), price: pv, stock: sv, description: desc.value.trim() }).eq('id', pr.id);
        if (e) fail(e); else toast('Tersimpan.');
      };
      [name, price, stock, desc].forEach(i => i.addEventListener('change', save));
      box.appendChild(h('div', { class: 'item' }, h('div', { class: 'grid3' }, name, price, stock), h('div', { style: 'margin-top:8px' }, desc),
        h('div', { class: 'row' }, h('span', { class: 'hint', text: rp(pr.price) }),
          h('button', { class: 'btn danger sm', type: 'button', onclick: async () => {
            if (!confirm('Hapus produk "' + pr.name + '"?')) return;
            const { error: e } = await sb.from('products').delete().eq('id', pr.id);
            if (e) fail(e); else { toast('Produk dihapus.'); vProduk(); }
          } }, 'Hapus'))));
    });
    view.appendChild(box);
    view.appendChild(h('p', { class: 'hint', text: 'Perubahan tersimpan otomatis. Bot memakai data terbaru pada pesan berikutnya.' }));
  }

  /* ---------- FAQ ---------- */
  async function vFaq() {
    clear(view);
    const { data, error } = await sb.from('faqs').select('*').eq('shop_id', shop.id).order('created_at');
    if (error) { fail(error); return; }
    const q = h('input', { id: 'fq', maxlength: '200', placeholder: 'Pertanyaan pelanggan', value: prefillQ });
    const a = h('textarea', { id: 'fa', maxlength: '1000', placeholder: 'Jawaban' });
    const add = h('button', { class: 'btn', type: 'button' }, 'Tambah FAQ');
    add.onclick = async () => {
      if (!q.value.trim() || !a.value.trim()) return toast('Isi pertanyaan dan jawaban.');
      add.disabled = true;
      const { error: e } = await sb.from('faqs').insert({ shop_id: shop.id, question: q.value.trim(), answer: a.value.trim() });
      add.disabled = false;
      if (e) return fail(e);
      toast('FAQ ditambahkan.'); vFaq();
    };
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Tambah FAQ' }), q, h('div', { style: 'margin-top:8px' }, a), h('div', { class: 'row' }, add)));
    if (prefillQ) { prefillQ = ''; setTimeout(() => a.focus(), 50); }
    const box = h('div', { class: 'card' }, h('h2', { text: 'Daftar FAQ (' + data.length + ')' }));
    if (!data.length) box.appendChild(h('p', { class: 'hint', text: 'Belum ada FAQ. Contoh: kebijakan retur, cara reseller, lama pengemasan.' }));
    data.forEach(f => {
      const qi = h('input', { value: f.question, maxlength: '200', 'aria-label': 'Pertanyaan' });
      const ai = h('textarea', { maxlength: '1000', 'aria-label': 'Jawaban' }); ai.value = f.answer;
      const save = async () => {
        if (!qi.value.trim() || !ai.value.trim()) return toast('Pertanyaan dan jawaban tidak boleh kosong.');
        const { error: e } = await sb.from('faqs').update({ question: qi.value.trim(), answer: ai.value.trim() }).eq('id', f.id);
        if (e) fail(e); else toast('Tersimpan.');
      };
      qi.addEventListener('change', save); ai.addEventListener('change', save);
      box.appendChild(h('div', { class: 'item' }, qi, h('div', { style: 'margin-top:8px' }, ai), h('div', { class: 'row' },
        h('button', { class: 'btn danger sm', type: 'button', onclick: async () => {
          if (!confirm('Hapus FAQ ini?')) return;
          const { error: e } = await sb.from('faqs').delete().eq('id', f.id);
          if (e) fail(e); else { toast('FAQ dihapus.'); vFaq(); }
        } }, 'Hapus'))));
    });
    view.appendChild(box);
  }

  /* ---------- info toko ---------- */
  function vToko() {
    clear(view);
    const f = {
      name: h('input', { id: 't1', maxlength: '100', value: shop.name }),
      hours: h('input', { id: 't2', maxlength: '200', value: shop.hours }),
      address: h('textarea', { id: 't3', maxlength: '500' }),
      shipping: h('textarea', { id: 't4', maxlength: '1000' }),
      payment: h('textarea', { id: 't5', maxlength: '500' })
    };
    f.address.value = shop.address; f.shipping.value = shop.shipping; f.payment.value = shop.payment;
    const btn = h('button', { class: 'btn', type: 'button' }, 'Simpan');
    btn.onclick = async () => {
      if (!f.name.value.trim()) return toast('Nama toko tidak boleh kosong.');
      btn.disabled = true;
      const patch = { name: f.name.value.trim(), hours: f.hours.value.trim(), address: f.address.value.trim(), shipping: f.shipping.value.trim(), payment: f.payment.value.trim() };
      const { error } = await sb.from('shops').update(patch).eq('id', shop.id);
      btn.disabled = false;
      if (error) return fail(error);
      Object.assign(shop, patch); toast('Info toko disimpan.');
    };
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Info toko' }),
      h('p', { class: 'hint', text: 'Bot hanya menjawab dari data toko, produk, dan FAQ. Semakin lengkap, semakin jarang bot meneruskan ke admin.' }),
      field('t1', 'Nama toko', f.name), field('t2', 'Jam buka', f.hours), field('t3', 'Alamat', f.address),
      field('t4', 'Pengiriman (ekspedisi, estimasi, gratis ongkir)', f.shipping), field('t5', 'Pembayaran', f.payment),
      h('div', { class: 'row' }, btn)));
  }

  /* ---------- bot ---------- */
  async function vBot() {
    clear(view);
    const { count } = await sb.from('messages').select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id).eq('role', 'bot').gte('created_at', startOfTodayWIB().toISOString());
    const used = count || 0, pct = Math.min(100, Math.round(used / shop.daily_limit * 100));
    const on = h('input', { id: 'b0', type: 'checkbox', checked: shop.bot_on });
    const name = h('input', { id: 'b1', maxlength: '60', value: shop.bot_name });
    const tone = h('select', { id: 'b2' },
      h('option', { value: 'ramah' }, 'Ramah (kak, boleh emoji)'), h('option', { value: 'santai' }, 'Santai (kak)'), h('option', { value: 'formal' }, 'Formal (Bapak/Ibu)'));
    tone.value = shop.tone;
    const greet = h('textarea', { id: 'b3', maxlength: '300' }); greet.value = shop.greeting;
    const fb = h('textarea', { id: 'b4', maxlength: '300' }); fb.value = shop.fallback;
    const lim = h('input', { id: 'b5', type: 'number', inputmode: 'numeric', min: '1', max: '5000', value: String(shop.daily_limit) });
    const col = h('input', { id: 'b6', type: 'color', value: shop.accent });
    const btn = h('button', { class: 'btn', type: 'button' }, 'Simpan');
    btn.onclick = async () => {
      const limit = toInt(lim.value);
      if (!name.value.trim()) return toast('Isi nama asisten.');
      if (!(limit >= 1 && limit <= 5000)) return toast('Batas harian: 1 sampai 5000.');
      btn.disabled = true;
      const patch = { bot_on: on.checked, bot_name: name.value.trim(), tone: tone.value, greeting: greet.value.trim(), fallback: fb.value.trim(), daily_limit: limit, accent: col.value };
      const { error } = await sb.from('shops').update(patch).eq('id', shop.id);
      btn.disabled = false;
      if (error) return fail(error);
      Object.assign(shop, patch); toast('Pengaturan bot disimpan.'); vBot();
    };
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Pemakaian hari ini' }),
      h('div', { class: 'hint', text: 'Balasan bot: ' + used + ' dari batas ' + shop.daily_limit }),
      h('div', { class: 'bar' + (pct > 80 ? ' hot' : '') }, h('i', { style: 'width:' + pct + '%' })),
      h('p', { class: 'hint', text: 'Setelah batas tercapai, pesan baru diteruskan ke admin. Ini menjaga biaya AI tetap terkendali.' })));
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Perilaku bot' }),
      h('label', { for: 'b0', style: 'display:flex;gap:8px;align-items:center;color:var(--ink);font-size:15px;margin:0' }, on, 'Bot aktif (kalau mati, semua pesan langsung ke admin)'),
      field('b1', 'Nama asisten', name), field('b2', 'Gaya bahasa', tone),
      field('b3', 'Sapaan pembuka (tulis {k} untuk panggilan otomatis)', greet),
      field('b4', 'Kalimat saat bot tidak tahu', fb),
      field('b5', 'Batas balasan otomatis per hari', lim), field('b6', 'Warna widget dan halaman chat', col),
      h('div', { class: 'row' }, btn)));
  }

  /* ---------- pasang ---------- */
  function vPasang() {
    clear(view);
    const link = location.origin + '/chat/' + shop.slug;
    const snippet = '<script src="' + location.origin + '/widget.js" data-bot="' + shop.slug + '" data-color="' + shop.accent + '" defer></' + 'script>';
    function copy(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Disalin.'), () => toast('Tekan lama pada teks untuk menyalin.'));
      else toast('Tekan lama pada teks untuk menyalin.');
    }
    const dom = h('textarea', { id: 'pd', rows: '4', placeholder: 'tokoayu.com\nwww.tokoayu.com' }); dom.value = (shop.allowed_domains || []).join('\n');
    const err = h('div', { class: 'err', role: 'alert' });
    const save = h('button', { class: 'btn', type: 'button' }, 'Simpan domain');
    save.onclick = async () => {
      err.textContent = '';
      const raw = dom.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const out = []; const bad = [];
      raw.forEach(r => { const n = normalizeDomain(r); if (n) { if (!out.includes(n)) out.push(n); } else bad.push(r); });
      if (bad.length) { err.textContent = 'Domain tidak valid: ' + bad.join(', '); return; }
      if (out.length > 20) { err.textContent = 'Maksimal 20 domain.'; return; }
      save.disabled = true;
      const { error } = await sb.from('shops').update({ allowed_domains: out }).eq('id', shop.id);
      save.disabled = false;
      if (error) return fail(error);
      shop.allowed_domains = out; dom.value = out.join('\n'); toast('Domain disimpan.');
    };
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: '1. Pasang di website' }),
      h('p', { class: 'hint', text: 'Tempel kode ini sebelum penutup </body> di website klien (WordPress, Shopify, Wix, atau HTML biasa).' }),
      h('pre', { text: snippet }), h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => copy(snippet) }, 'Salin kode'))));
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: '2. Domain yang boleh memasang widget' }),
      h('p', { class: 'hint', text: 'Satu domain per baris. Browser hanya mau menampilkan chat di situs yang terdaftar, jadi orang lain tidak bisa menempelkan botmu di situs mereka. Subdomain ikut diizinkan. Kosong berarti widget tidak bisa dipasang di situs mana pun.' }),
      dom, err, h('div', { class: 'row' }, save)));
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: '3. Link chat (untuk bio Instagram, Tokopedia, Shopee)' }),
      h('p', { class: 'hint', text: 'Marketplace tidak bisa dipasangi widget. Taruh link ini di bio atau deskripsi toko.' }),
      h('pre', { text: link }), h('div', { class: 'row' },
        h('button', { class: 'btn sm', type: 'button', onclick: () => copy(link) }, 'Salin link'),
        h('a', { class: 'btn ghost sm', href: link, target: '_blank', rel: 'noopener' }, 'Buka'))));
    view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Coba bot' }),
      h('p', { class: 'hint', text: 'Percakapan percobaan ikut muncul di tab Percakapan.' }),
      h('iframe', { class: 'preview', src: '/chat/' + shop.slug, title: 'Pratinjau chat' })));
  }

  await loadShop();
  if (!shop) vOnboarding(); else { show(); refreshHumanCount(); }
})();
