import bot from '@/lib/bot';
import supabase from '@/lib/supabase';
import gemini from '@/lib/gemini';
import billing from '@/lib/billing';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HEADERS = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

// Cek kesiapan bot untuk pemilik toko yang sedang login. Klien hanya mendapat pesan bahasa awam.
// Detail teknis (nama env, model, pesan error) hanya dikirim untuk email di DEVELOPER_EMAILS
// (pisahkan dengan koma). Isi kunci rahasia tidak pernah ditampilkan.
export async function POST(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Belum login' }, 401);

  let sb;
  try { sb = supabase.getAdmin(); } catch (e) { return json({ error: e.message }, 500); }

  const { data: u, error: ue } = await sb.auth.getUser(token);
  if (ue || !u || !u.user) return json({ error: 'Sesi login tidak valid' }, 401);

  // Toko yang dipilih di dashboard (header X-Shop-Id). Pemilik dan admin tambahan boleh memeriksa.
  const sid = String(request.headers.get('x-shop-id') || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid)) return json({ error: 'Toko belum dipilih' }, 400);
  const { data: shop } = await sb.from('shops').select('*').eq('id', sid).maybeSingle();
  if (!shop) return json({ error: 'Toko tidak ditemukan' }, 404);
  if (shop.owner_id !== u.user.id) {
    const mem = await sb.from('shop_members').select('user_id').eq('shop_id', shop.id).eq('user_id', u.user.id).maybeSingle();
    if (!mem.data) return json({ error: 'Toko tidak ditemukan' }, 404);
  }

  const devs = String(process.env.DEVELOPER_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const isDev = devs.includes(String(u.user.email || '').toLowerCase());

  const checks = [];
  const add = (id, label, ok, detail, tech) => checks.push({ id, label, ok, detail, tech: isDev ? tech : undefined });

  add('aktif', 'Bot aktif di database', !!shop.bot_on,
    shop.bot_on ? 'Tersimpan aktif.' : 'Di database bot masih nonaktif. Buka halaman Bot, centang "Bot aktif", lalu klik Simpan.');

  try {
    const { count } = await sb.from('messages').select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id).eq('role', 'bot').gte('created_at', bot._internal.startOfTodayWIB().toISOString());
    const used = count || 0;
    add('kuota', 'Kuota balasan hari ini', used < shop.daily_limit,
      used + ' dari batas ' + shop.daily_limit + (used < shop.daily_limit ? '.' : '. Naikkan batas di halaman Bot.'));
  } catch (e) { add('kuota', 'Kuota balasan hari ini', false, 'Gagal membaca: ' + e.message); }

  try {
    const [p, f] = await Promise.all([
      sb.from('products').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
      sb.from('faqs').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id)
    ]);
    const np = p.count || 0, nf = f.count || 0;
    add('data', 'Data toko', np + nf > 0,
      np + ' produk, ' + nf + ' FAQ.' + (np + nf > 0 ? '' : ' Isi produk atau FAQ supaya bot punya bahan menjawab.'));
  } catch (e) { add('data', 'Data toko', false, 'Gagal membaca: ' + e.message); }

  const AI_LABEL = 'Layanan AI';
  let planId = 'free';
  try { planId = (await billing.currentPlan(sb, shop.id)).id; } catch (e) { /* tabel paket bermasalah: pakai model paket gratis */ }
  const ai = await gemini.resolve(planId);
  if (!ai.key) {
    add('ai', AI_LABEL, false, 'Layanan AI belum terhubung. Hubungi penyedia layananmu.',
      'API key Gemini belum diisi. Isi di Admin > AI (key bawaan atau key paket ' + planId + ', atau GEMINI_API_KEY di Vercel > Settings > Environment Variables).');
  } else {
    try {
      const raw = await gemini.generate({
        system: 'Balas HANYA dengan JSON: {"reply":"ok"}',
        contents: [{ role: 'user', parts: [{ text: 'tes' }] }],
        plan: planId
      });
      const parsed = bot._internal.parseModelOutput(raw);
      add('ai', AI_LABEL, !!parsed,
        parsed ? 'Terhubung dan berfungsi.' : 'Layanan AI membalas dengan format yang tidak terbaca. Coba lagi nanti atau hubungi penyedia layananmu.',
        'Model ' + ai.model + ' (paket ' + planId + ')' + (parsed ? ': OK.' : '. Jawaban mentah: ' + String(raw).slice(0, 120)));
    } catch (e) {
      add('ai', AI_LABEL, false, 'Layanan AI sedang bermasalah. Coba lagi nanti atau hubungi penyedia layananmu.',
        'Model ' + ai.model + ': ' + String((e && e.message) || e).slice(0, 300));
    }
  }

  return json({ checks, ok: checks.every((c) => c.ok) });
}
