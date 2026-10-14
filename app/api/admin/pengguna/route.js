import admin from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const PER_PAGE = 1000;   // batas per halaman dari Supabase Auth
const MAX_PAGES = 3;     // paling banyak 3000 akun yang dibaca
const SHOW = 200;        // paling banyak 200 baris dikirim ke browser

async function must(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Daftar akun yang mendaftar di web (Supabase Auth), lengkap dengan toko yang mereka miliki / kelola.
// Hanya untuk admin layanan. Tidak ada data sensitif (password, token) yang dikirim.
export async function GET(request) {
  try {
    const { sb } = await admin.requireSuperAdmin(request);
    const q = (new URL(request.url).searchParams.get('q') || '').trim().toLowerCase().slice(0, 100);

    let users = [];
    let total = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PER_PAGE });
      if (error) throw error;
      const batch = (data && data.users) || [];
      users = users.concat(batch);
      total = Math.max((data && data.total) || 0, users.length);
      if (batch.length < PER_PAGE) break;
    }
    users.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    const [members, shops] = await Promise.all([
      must(sb.from('shop_members').select('user_id,shop_id,role').limit(10000)),
      must(sb.from('shops').select('id,name,slug').limit(10000))
    ]);
    const shopBy = {}; (shops || []).forEach((s) => { shopBy[s.id] = s; });
    const shopsOf = {};
    (members || []).forEach((m) => {
      const s = shopBy[m.shop_id];
      if (!s) return;
      (shopsOf[m.user_id] = shopsOf[m.user_id] || []).push({ name: s.name, slug: s.slug, role: m.role });
    });

    const now = Date.now();
    const DAY = 86400000;
    const rows = users.map((u) => ({
      id: u.id,
      email: u.email || '',
      created_at: u.created_at || null,
      last_sign_in_at: u.last_sign_in_at || null,
      confirmed: !!(u.email_confirmed_at || u.confirmed_at),
      provider: (u.app_metadata && u.app_metadata.provider) || 'email',
      shops: shopsOf[u.id] || []
    }));

    const stats = {
      total,
      new7: rows.filter((r) => r.created_at && now - Date.parse(r.created_at) <= 7 * DAY).length,
      active30: rows.filter((r) => r.last_sign_in_at && now - Date.parse(r.last_sign_in_at) <= 30 * DAY).length,
      noShop: rows.filter((r) => !r.shops.length).length,
      capped: total > rows.length
    };

    const filtered = q
      ? rows.filter((r) => r.email.toLowerCase().includes(q) || r.shops.some((s) => String(s.name).toLowerCase().includes(q) || String(s.slug).toLowerCase().includes(q)))
      : rows;

    return json({ stats, matched: filtered.length, users: filtered.slice(0, SHOW) });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
