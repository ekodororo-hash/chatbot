import bot from '@/lib/bot';
import supabase from '@/lib/supabase';
import gemini from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HEADERS = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

// Cek kesiapan bot untuk pemilik toko yang sedang login. Hanya melaporkan ada/tidaknya kunci,
// tidak pernah menampilkan isi kunci rahasia.
export async function POST(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Belum login' }, 401);

  let sb;
  try { sb = supabase.getAdmin(); } catch (e) { return json({ error: e.message }, 500); }

  const { data: u, error: ue } = await sb.auth.getUser(token);
  if (ue || !u || !u.user) return json({ error: 'Sesi login tidak valid' }, 401);

  const { data: shop } = await sb.from('shops').select('*').eq('owner_id', u.user.id).maybeSingle();
  if (!shop) return json({ error: 'Toko belum dibuat' }, 404);

  const checks = [];
  const add = (id, label, ok, detail) => checks.push({ id, label, ok, detail });

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

  const hasKey = !!process.env.GEMINI_API_KEY;
  add('kunci', 'GEMINI_API_KEY di server', hasKey,
    hasKey ? 'Terisi.' : 'Belum diisi. Tambahkan di Vercel > Settings > Environment Variables (atau .env.local), lalu deploy ulang / restart.');

  if (hasKey) {
    try {
      const raw = await gemini.generate({
        system: 'Balas HANYA dengan JSON: {"reply":"ok"}',
        contents: [{ role: 'user', parts: [{ text: 'tes' }] }]
      });
      const parsed = bot._internal.parseModelOutput(raw);
      add('gemini', 'Panggilan ke Gemini (' + gemini.MODEL + ')', !!parsed,
        parsed ? 'Berhasil dibalas.' : 'Terhubung, tapi format jawaban tidak terbaca: ' + String(raw).slice(0, 120));
    } catch (e) {
      add('gemini', 'Panggilan ke Gemini (' + gemini.MODEL + ')', false, String(e && e.message || e).slice(0, 300));
    }
  }

  return json({ checks, ok: checks.every((c) => c.ok) });
}
