import bot from '@/lib/bot';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const HEADERS = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

// Sama seperti /api/chat: menolak panggilan lintas situs dari browser. Pengaman utamanya adalah token pengunjung
// (hanya pemilik percakapan yang bisa menilainya) dan batas laju di lib/bot.js.
function sameOrigin(request) {
  const o = request.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === request.headers.get('host'); } catch (e) { return false; }
}

// Penilaian jempol atas/bawah dari halaman chat. Body: { slug, conversationId, token, value: 1 | -1 }
export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'Asal permintaan tidak diizinkan' }, 403);
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
  b = b || {};
  try {
    return json(await bot.rateConversation({ slug: b.slug, conversationId: b.conversationId, token: b.token, value: b.value }));
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
