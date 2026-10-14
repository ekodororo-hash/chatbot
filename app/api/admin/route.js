import admin from '@/lib/admin';
import plans from '@/lib/plans';

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

// Ringkasan seluruh layanan: semua toko, paket, pemakaian bulan ini, dan pembayaran terbaru.
export async function GET(request) {
  try {
    const { sb } = await admin.requireSuperAdmin(request);
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
        count(sb.from('messages').select('id', { count: 'exact', head: true }).eq('shop_id', s.id).eq('role', 'bot').gte('created_at', monthStart)),
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

    const [totalShops, totalConvs, botToday] = await Promise.all([
      count(sb.from('shops').select('id', { count: 'exact', head: true })),
      count(sb.from('conversations').select('id', { count: 'exact', head: true })),
      count(sb.from('messages').select('id', { count: 'exact', head: true }).eq('role', 'bot').gte('created_at', monthStart))
    ]);

    return json({
      totals: {
        shops: totalShops, conversations: totalConvs, botRepliesMonth: botToday,
        paidShops: rows.filter((r) => r.plan !== 'free').length,
        revenueMonth: (paidRows || []).reduce((n, p) => n + Number(p.amount || 0), 0),
        capped: totalShops > MAX_SHOPS
      },
      shops: rows,
      payments: (pays || []).map((p) => Object.assign({}, p, { shop_name: nameBy[p.shop_id] || '' })),
      plans: Object.values(plans.PLANS).map((p) => ({ id: p.id, name: p.name }))
    });
  } catch (e) { return fail(e); }
}

// Aksi admin: ubah paket toko secara manual (misalnya klien bayar transfer) dan nyalakan/matikan bot toko.
export async function POST(request) {
  try {
    const { sb } = await admin.requireSuperAdmin(request);
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    b = b || {};
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

    if (b.action === 'set_bot') {
      await must(sb.from('shops').update({ bot_on: !!b.on }).eq('id', shopId));
      return json({ ok: true });
    }

    return json({ error: 'Aksi tidak dikenal' }, 400);
  } catch (e) { return fail(e); }
}

function fail(e) {
  const code = e.httpStatus || 500;
  if (code === 500) console.error(e);
  return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
}
