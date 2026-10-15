import supabase from '@/lib/supabase';
import widgetConfig from '@/lib/widgetConfig';

export const dynamic = 'force-dynamic';

// Tampilan widget bersifat publik (warna, posisi, teks tombol), jadi boleh dibaca dari situs mana pun.
// Dengan ini perubahan di dashboard langsung berlaku tanpa klien menempel ulang kodenya.
const CORS = { 'Access-Control-Allow-Origin': '*' };

function reply(body, status, cache) {
  return Response.json(body, { status, headers: { ...CORS, 'Cache-Control': cache } });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' } });
}

export async function GET(request, context) {
  const { slug: raw } = await context.params;
  const slug = String(raw || '');
  if (!/^[a-z0-9-]{3,30}$/.test(slug)) return reply({ error: 'Bot tidak ditemukan' }, 404, 'public, max-age=60');
  try {
    const r = await supabase.getAdmin().from('shops').select('*').eq('slug', slug).maybeSingle();
    if (r.error) throw r.error;
    if (!r.data) return reply({ error: 'Bot tidak ditemukan' }, 404, 'public, max-age=60');
    // Logo (data URL, bisa puluhan KB) hanya dipakai halaman chat, jadi tidak ikut dikirim ke widget.
    const { logo, hours, eta, ...cfg } = widgetConfig.clean(r.data);
    return reply(cfg, 200, 'public, max-age=60, s-maxage=60');
  } catch (e) {
    console.error(e);
    return reply({ error: 'Terjadi gangguan' }, 500, 'no-store');
  }
}
