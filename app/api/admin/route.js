import admin from '@/lib/admin';
import plans from '@/lib/plans';
import usage from '@/lib/usage';
import shops from '@/lib/shops';
import settings from '@/lib/settings';
import gemini from '@/lib/gemini';
import otak from '@/lib/otak';
import adminLib from '@/lib/admin';
import widgetConfig from '@/lib/widgetConfig';
import widgetIcons from '@/lib/widgetIcons';
import widgetAnim from '@/lib/widgetAnim';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SHOPS = 200;

async function must(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
async function count(q) {
  const { count: c, error } = await q;
  if (error) throw error;
  return c || 0;
}

// Terapkan paket/harga/diskon buatan admin sebelum angka paket dipakai (sama seperti yang dilakukan lib/billing.js).
async function applyPlanConfig() {
  const v = await settings.getAll();
  let parsed = null;
  try { parsed = v.PLANS_CONFIG ? JSON.parse(v.PLANS_CONFIG) : null; } catch (e) { parsed = null; }
  plans.configure(parsed);
}

// Ringkasan seluruh layanan: semua toko, paket, pemakaian bulan ini, dan pembayaran terbaru.
export async function GET(request) {
  try {
    const { sb } = await admin.requireSuperAdmin(request);
    await applyPlanConfig();
    const now = new Date();
    const monthStart = plans.startOfMonthWIB(now).toISOString();

    const [shops, billing, owners, pays, paidRows] = await Promise.all([
      must(sb.from('shops').select('id,name,slug,bot_on,daily_limit,created_at').order('created_at', { ascending: false }).limit(MAX_SHOPS)),
      must(sb.from('shop_billing').select('shop_id,plan,expires_at')),
      must(sb.from('shop_members').select('shop_id,email').eq('role', 'owner')),
      must(sb.from('payments').select('order_id,shop_id,plan,months,amount,status,provider,created_at,paid_at').order('created_at', { ascending: false }).limit(30)),
      must(sb.from('payments').select('amount,paid_at').eq('status', 'paid').gte('paid_at', monthStart).limit(1000))
    ]);

    const billBy = {}; (billing || []).forEach((b) => { billBy[b.shop_id] = b; });
    const ownerBy = {}; (owners || []).forEach((o) => { ownerBy[o.shop_id] = o.email; });
    const nameBy = {}; (shops || []).forEach((s) => { nameBy[s.id] = s.name; });

    // Hitung per toko secara paralel (head count, tanpa menarik isi pesan).
    const rows = await Promise.all((shops || []).map(async (s) => {
      const [used, convs] = await Promise.all([
        usage.repliesSince(sb, s.id, plans.startOfMonthWIB(now)),
        count(sb.from('conversations').select('id', { count: 'exact', head: true }).eq('shop_id', s.id))
      ]);
      const plan = plans.effectivePlan(billBy[s.id], now);
      return {
        id: s.id, name: s.name, slug: s.slug, bot_on: s.bot_on, created_at: s.created_at,
        owner: ownerBy[s.id] || '',
        plan: plan.id, plan_name: plan.name, quota: plan.quota,
        expires_at: plan.id === 'free' ? null : (billBy[s.id] && billBy[s.id].expires_at) || null,
        used, convs
      };
    }));

    const [totalShops, totalConvs] = await Promise.all([
      count(sb.from('shops').select('id', { count: 'exact', head: true })),
      count(sb.from('conversations').select('id', { count: 'exact', head: true }))
    ]);
    // Total balasan bulan ini = jumlah pemakaian per toko di atas (dari bot_usage, tidak berkurang saat percakapan dihapus).
    const botToday = rows.reduce((sum, r) => sum + r.used, 0);

    const allSettings = await settings.getAll();
    const meta = await settings.describe();

    return json({
      totals: {
        shops: totalShops, conversations: totalConvs, botRepliesMonth: botToday,
        paidShops: rows.filter((r) => r.plan !== 'free').length,
        revenueMonth: (paidRows || []).reduce((n, p) => n + Number(p.amount || 0), 0),
        capped: totalShops > MAX_SHOPS
      },
      shops: rows,
      // Slug toko yang dipasangi widget di situs sendiri (env WIDGET_BOT), dipakai halaman /admin/widget.
      widgetBot: /^[a-z0-9-]{3,30}$/.test(process.env.WIDGET_BOT || '') ? process.env.WIDGET_BOT : '',
      payments: (pays || []).map((p) => Object.assign({}, p, { shop_name: nameBy[p.shop_id] || '' })),
      plans: Object.values(plans.PLANS).map((p) => ({ id: p.id, name: p.name })),
      planConfig: planConfig(),
      // Hanya status dan 4 karakter terakhir; isi key tidak pernah dikirim ke browser.
      gateways: gateways(meta),
      // Key Gemini: hanya status dan 4 karakter terakhir. Key bawaan + key per paket (kosong = ikut bawaan). Model per paket (kosong = bawaan).
      ai: {
        key: meta.GEMINI_API_KEY || { source: null, hint: '' },
        planKeys: Object.fromEntries(Object.keys(plans.PLANS).map((id) => [id, Array.from({ length: gemini.KEYS_PER_PLAN }, (_, i) => meta[gemini.keyName(id, i + 1)] || { source: null, hint: '' })])),
        perPlan: gemini.KEYS_PER_PLAN,
        models: gemini.parseModels(allSettings.AI_CONFIG),
        providers: gemini.parseProviders(allSettings.AI_CONFIG),
        providerList: Object.values(gemini.PROVIDERS).map((p) => ({ id: p.id, label: p.label, keyHint: p.keyHint, defaultModel: p.model })),
        defaultModel: gemini.DEFAULT_MODEL,
        // Otak EMAHAIRSHOP (lib/otak.js). Teks lengkap hanya dikirim ke super admin; tidak ada jalur lain ke browser.
        otak: await otakInfo(allSettings)
      }
    });
  } catch (e) { return fail(e); }
}

// Ringkasan otak untuk halaman /admin/ai. text = teks yang sedang berlaku (buatan admin atau bawaan).
async function otakInfo(allSettings) {
  const custom = String(allSettings.OTAK_TEMPLATE || '').trim();
  return {
    on: String(allSettings.OTAK_MODE || '').trim().toLowerCase() !== 'off',
    custom: !!custom,
    hasPrev: !!String(allSettings.OTAK_TEMPLATE_PREV || '').trim(),
    text: custom || otak.DEFAULT_TEMPLATE,
    defaultLength: otak.DEFAULT_TEMPLATE.length,
    max: otak.MAX_TEMPLATE,
    adminEmails: adminLib.adminEmails().length
  };
}

// Paket yang sedang berlaku (sudah termasuk pengaturan admin), untuk halaman /admin/paket.
function planConfig() {
  const c = plans.current();
  return { plans: c.plans, terms: c.terms, defaults: { plans: c.defaults.plans, terms: c.defaults.terms } };
}

function gateways(m) {
  const g = (k) => m[k] || { source: null, hint: '' };
  return [
    { id: 'midtrans', ready: !!g('MIDTRANS_SERVER_KEY').source, production: g('MIDTRANS_IS_PRODUCTION').hint === 'true',
      fields: { server_key: g('MIDTRANS_SERVER_KEY') } },
    { id: 'doku', ready: !!(g('DOKU_CLIENT_ID').source && g('DOKU_SECRET_KEY').source), production: g('DOKU_IS_PRODUCTION').hint === 'true',
      fields: { client_id: g('DOKU_CLIENT_ID'), secret_key: g('DOKU_SECRET_KEY') } }
  ];
}

const FIELD_KEYS = {
  midtrans: { server_key: 'MIDTRANS_SERVER_KEY', production: 'MIDTRANS_IS_PRODUCTION' },
  doku: { client_id: 'DOKU_CLIENT_ID', secret_key: 'DOKU_SECRET_KEY', production: 'DOKU_IS_PRODUCTION' }
};

// Aksi admin: ubah paket toko secara manual (misalnya klien bayar transfer) nyalakan/matikan bot toko, dan hapus toko.
export async function POST(request) {
  try {
    const { sb } = await admin.requireSuperAdmin(request);
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    b = b || {};

    // Paket, harga, kuota chat, dan diskon: berlaku untuk semua toko.
    if (b.action === 'save_plans' || b.action === 'reset_plans') {
      if (b.action === 'reset_plans') await settings.save({ PLANS_CONFIG: '' });
      else await settings.save({ PLANS_CONFIG: JSON.stringify(plans.sanitize({ plans: b.plans, terms: b.terms })) });
      return json({ ok: true });
    }

    // AI: key Gemini. Tanpa plan = key bawaan. Dengan plan = key khusus paket itu (sampai 3, slot 1 sampai 3).
    if (b.action === 'save_ai_key' || b.action === 'clear_ai_key') {
      const planId = String(b.plan || '');
      if (planId && !Object.prototype.hasOwnProperty.call(plans.PLANS, planId)) return json({ error: 'Paket tidak dikenal.' }, 400);
      const checkKey = (raw) => {
        const v = String(raw || '').trim();
        if (v.length > 500 || /\s/.test(v)) throw Object.assign(new Error('API key tidak valid.'), { httpStatus: 400 });
        return v;
      };
      if (!planId) {
        if (b.action === 'clear_ai_key') await settings.save({ GEMINI_API_KEY: '' });
        else {
          const v = checkKey(b.key);
          if (!v) return json({ error: 'Isi API key Gemini dulu.' }, 400);
          await settings.save({ GEMINI_API_KEY: v });
        }
        return json({ ok: true });
      }
      const slotOk = (n) => Number.isInteger(n) && n >= 1 && n <= gemini.KEYS_PER_PLAN;
      if (b.action === 'clear_ai_key') {
        const n = Number(b.slot);
        if (!slotOk(n)) return json({ error: 'Nomor key tidak valid (1 sampai ' + gemini.KEYS_PER_PLAN + ').' }, 400);
        await settings.save({ [gemini.keyName(planId, n)]: '' });
        return json({ ok: true });
      }
      // keys = { "1": "AIza...", "2": "...", "3": "" }; isian kosong tidak mengubah apa pun.
      const patch = {};
      Object.keys(b.keys || {}).forEach((k) => {
        const n = Number(k);
        if (!slotOk(n)) throw Object.assign(new Error('Nomor key tidak valid (1 sampai ' + gemini.KEYS_PER_PLAN + ').'), { httpStatus: 400 });
        const v = checkKey(b.keys[k]);
        if (v) patch[gemini.keyName(planId, n)] = v;
      });
      if (!Object.keys(patch).length) return json({ error: 'Isi API key dulu.' }, 400);
      await settings.save(patch);
      return json({ ok: true });
    }
    if (b.action === 'save_ai_models') {
      const clean = gemini.sanitizeModels(b.models);
      // Penyedia per paket (kosong = Gemini). Bila klien lama tidak mengirimnya, penyedia yang tersimpan dipertahankan.
      const cur = gemini.parseProviders((await settings.getAll()).AI_CONFIG);
      const provs = b.providers === undefined ? cur : gemini.sanitizeProviders(b.providers);
      const cfg = {};
      if (Object.keys(clean).length) cfg.models = clean;
      if (Object.keys(provs).length) cfg.providers = provs;
      await settings.save({ AI_CONFIG: Object.keys(cfg).length ? JSON.stringify(cfg) : '' });
      return json({ ok: true });
    }
    // Otak EMAHAIRSHOP: saklar, simpan teks, kembali ke bawaan, batalkan perubahan terakhir. Versi sebelumnya disimpan satu tingkat.
    if (b.action === 'set_otak_mode') {
      await settings.save({ OTAK_MODE: b.on === false ? 'off' : '' });
      return json({ ok: true });
    }
    if (b.action === 'save_otak' || b.action === 'reset_otak' || b.action === 'restore_otak') {
      const all = await settings.getAll();
      const cur = String(all.OTAK_TEMPLATE || '').trim();
      let next;
      if (b.action === 'reset_otak') next = '';
      else if (b.action === 'restore_otak') {
        next = String(all.OTAK_TEMPLATE_PREV || '').trim();
        if (!next) return json({ error: 'Belum ada versi sebelumnya untuk dikembalikan.' }, 400);
      } else {
        next = String(b.text == null ? '' : b.text).replace(/\r\n/g, '\n').trim();
        if (next.length < 200) return json({ error: 'Teks otak terlalu pendek (minimal 200 karakter). Untuk kembali ke bawaan, pakai tombol Kembalikan ke bawaan.' }, 400);
        if (next.length > otak.MAX_TEMPLATE) return json({ error: 'Teks otak terlalu panjang (maksimal ' + otak.MAX_TEMPLATE + ' karakter).' }, 400);
        if (next === otak.DEFAULT_TEMPLATE.trim()) next = '';   // sama dengan bawaan: tidak perlu disimpan, ikut bawaan
      }
      if (next === cur) return json({ ok: true, unchanged: true });
      await settings.save({ OTAK_TEMPLATE_PREV: cur, OTAK_TEMPLATE: next });
      return json({ ok: true });
    }
    if (b.action === 'test_ai') {
      const planId = String(b.plan || '');
      if (!Object.prototype.hasOwnProperty.call(plans.PLANS, planId)) return json({ error: 'Paket tidak dikenal.' }, 400);
      const slot = b.slot ? Number(b.slot) : 0;
      const { model, keySource, provider } = await gemini.resolve(planId);
      const t0 = Date.now();
      try {
        await gemini.generate({
          system: 'Balas HANYA dengan JSON: {"reply":"ok"}',
          contents: [{ role: 'user', parts: [{ text: 'tes' }] }],
          plan: planId,
          slot: slot || undefined
        });
        return json({ ok: true, model, provider, keySource, slot, ms: Date.now() - t0 });
      } catch (e) {
        return json({ ok: false, model, provider, keySource, error: String((e && e.message) || e).slice(0, 300) });
      }
    }

    // Pengaturan pembayaran: tidak terkait satu toko.
    if (b.action === 'save_gateway' || b.action === 'clear_gateway') {
      const map = Object.prototype.hasOwnProperty.call(FIELD_KEYS, b.provider) ? FIELD_KEYS[b.provider] : null;
      if (!map) return json({ error: 'Penyedia pembayaran tidak dikenal.' }, 400);
      const patch = {};
      if (b.action === 'clear_gateway') Object.values(map).forEach((k) => { patch[k] = ''; });
      else {
        Object.keys(map).forEach((f) => {
          if (f === 'production') return;
          const v = String(b[f] || '').trim();
          if (v.length > 500) throw Object.assign(new Error('Isian terlalu panjang.'), { httpStatus: 400 });
          if (v) patch[map[f]] = v;   // kosong = tidak diubah
        });
        patch[map.production] = b.production ? 'true' : 'false';
      }
      await settings.save(patch);
      return json({ ok: true });
    }

    const shopId = String(b.shopId || '');
    if (!UUID.test(shopId)) return json({ error: 'Toko tidak valid.' }, 400);
    const shop = await must(sb.from('shops').select('id').eq('id', shopId).maybeSingle());
    if (!shop) return json({ error: 'Toko tidak ditemukan.' }, 404);

    if (b.action === 'set_plan') {
      const planId = String(b.plan || '');
      if (!Object.prototype.hasOwnProperty.call(plans.PLANS, planId)) return json({ error: 'Paket tidak dikenal.' }, 400);
      const now = new Date();
      let expires = null;
      if (planId !== 'free') {
        const days = parseInt(b.days, 10);
        if (!Number.isFinite(days) || days < 1 || days > 3650) return json({ error: 'Lama harus 1 sampai 3650 hari.' }, 400);
        expires = new Date(now.getTime() + days * 86400000).toISOString();
      }
      await must(sb.from('shop_billing').upsert({ shop_id: shopId, plan: planId, expires_at: expires, updated_at: now.toISOString() }, { onConflict: 'shop_id' }));
      return json({ ok: true });
    }

    if (b.action === 'delete_shop') {
      const full = await must(sb.from('shops').select('id,slug').eq('id', shopId).maybeSingle());
      if (String(b.confirm || '').trim() !== full.slug) return json({ error: 'Alamat chat yang diketik tidak cocok.' }, 400);
      await shops.deleteShop(sb, shopId);
      return json({ ok: true });
    }

    if (b.action === 'set_bot') {
      await must(sb.from('shops').update({ bot_on: !!b.on }).eq('id', shopId));
      return json({ ok: true });
    }

    if (b.action === 'get_widget') {
      const s = await must(sb.from('shops').select('*').eq('id', shopId).maybeSingle());
      return json({ shop: widgetFields(s) });
    }

    if (b.action === 'save_widget') {
      const v = b.widget || {};
      const c = widgetConfig;
      const icon = c.str(v.widget_icon, 16);
      if (!icon || (!widgetIcons.iconPaths(icon) && Array.from(icon).length > 8)) return json({ error: 'Ikon tombol: pilih ikon dari daftar, atau 1 sampai 8 karakter.' }, 400);
      if (!/^#[0-9a-fA-F]{6}$/.test(String(v.accent || ''))) return json({ error: 'Warna tidak valid.' }, 400);
      if (!c.POS.includes(v.widget_pos) || !c.SIZE.includes(v.widget_size) || !c.SHAPE.includes(v.widget_shape) || !c.BUBBLE.includes(v.widget_bubble)) return json({ error: 'Posisi, ukuran, atau bentuk tidak valid.' }, 400);
      const ox = Number(v.widget_ox), oy = Number(v.widget_oy), eta = Number(v.reply_eta), delay = Number(v.widget_delay);
      if (!(Number.isInteger(ox) && ox >= 0 && ox <= 200 && Number.isInteger(oy) && oy >= 0 && oy <= 200)) return json({ error: 'Jarak tombol dari tepi: 0 sampai 200 px.' }, 400);
      if (!(Number.isInteger(eta) && eta >= 0 && eta <= 1440)) return json({ error: 'Estimasi balasan admin: 0 sampai 1440 menit.' }, 400);
      if (!(Number.isInteger(delay) && delay >= 0 && delay <= 30)) return json({ error: 'Tunda tampil tombol: 0 sampai 30 detik.' }, 400);
      const logo = typeof v.widget_logo === 'string' ? v.widget_logo : '';
      if (logo && (logo.length > c.LOGO_MAX || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo))) return json({ error: 'Logo tidak valid atau terlalu besar.' }, 400);
      const days = Array.isArray(v.hours_days) ? v.hours_days : String(v.hours_days || '').split(',');
      const dayList = Array.from(new Set(days.map(String).filter((d) => /^[0-6]$/.test(d)))).sort();
      const on = v.hours_on === true;
      if (on && !dayList.length) return json({ error: 'Pilih minimal satu hari operasional.' }, 400);
      const T = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
      if (on && (!T.test(String(v.hours_open)) || !T.test(String(v.hours_close)))) return json({ error: 'Jam buka dan tutup tidak valid.' }, 400);
      if (!c.TZ.includes(v.hours_tz)) return json({ error: 'Zona waktu tidak valid.' }, 400);
      const anim = widgetAnim.resolve(v.widget_anim, v.widget_animate);
      const cur = await must(sb.from('shops').select('*').eq('id', shopId).maybeSingle());
      const patch = {
        accent: v.accent, widget_pos: v.widget_pos, widget_icon: icon, widget_label: c.str(v.widget_label, 30),
        widget_teaser: c.str(v.widget_teaser, 100), widget_size: v.widget_size, widget_shape: v.widget_shape,
        widget_bubble: v.widget_bubble, widget_logo: logo, widget_ox: ox, widget_oy: oy,
        widget_delay: delay, widget_animate: anim !== 'tanpa',
        hours_on: on, hours_open: T.test(String(v.hours_open)) ? v.hours_open : '09:00', hours_close: T.test(String(v.hours_close)) ? v.hours_close : '17:00',
        hours_days: dayList.join(','), hours_tz: v.hours_tz, reply_eta: eta
      };
      // Kolom widget_anim ada setelah migrasi widget_animasi.sql; sebelum itu hanya aktif/nonaktif yang tersimpan.
      if (cur && Object.prototype.hasOwnProperty.call(cur, 'widget_anim')) patch.widget_anim = anim;
      await must(sb.from('shops').update(patch).eq('id', shopId));
      return json({ ok: true, shop: widgetFields(Object.assign({}, await must(sb.from('shops').select('*').eq('id', shopId).maybeSingle()))) });
    }

    return json({ error: 'Aksi tidak dikenal' }, 400);
  } catch (e) { return fail(e); }
}

// Hanya kolom tampilan widget (plus nama/sapaan/pilihan cepat untuk pratinjau chat). Kolom rahasia toko tidak ikut.
function widgetFields(s) {
  const keys = ['id', 'name', 'slug', 'bot_name', 'greeting', 'tone', 'quick_on', 'quick_replies', 'accent', 'widget_pos', 'widget_icon', 'widget_label',
    'widget_teaser', 'widget_size', 'widget_shape', 'widget_bubble', 'widget_logo', 'widget_ox', 'widget_oy', 'widget_delay', 'widget_animate', 'widget_anim',
    'hours_on', 'hours_open', 'hours_close', 'hours_days', 'hours_tz', 'reply_eta'];
  const out = {};
  keys.forEach((k) => { if (Object.prototype.hasOwnProperty.call(s, k)) out[k] = s[k]; });
  return out;
}

function fail(e) {
  const code = e.httpStatus || 500;
  if (code === 500) console.error(e);
  return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
}
