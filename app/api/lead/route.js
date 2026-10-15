import bot from '@/lib/bot';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const HEADERS = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

function sameOrigin(request) {
  const o = request.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === request.headers.get('host'); } catch (e) { return false; }
}

// Pengunjung meninggalkan nomor WhatsApp/email untuk dikabari soal promo. Body: { slug, conversationId, token, contact }
export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'Asal permintaan tidak diizinkan' }, 403);
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
  b = b || {};
  try {
    return json(await bot.saveLead({ slug: b.slug, conversationId: b.conversationId, token: b.token, contact: b.contact }));
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
