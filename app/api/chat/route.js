import bot from '@/lib/bot';
import { visitorFromHeaders } from '@/lib/visitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HEADERS = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

// Menolak panggilan lintas situs dari browser. Ini bukan pengaman utama (curl bisa memalsukan
// header); pengaman utamanya adalah batas laju dan batas balasan harian di lib/bot.js.
function sameOrigin(request) {
  const o = request.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === request.headers.get('host'); } catch (e) { return false; }
}

function fail(e) {
  const code = e.httpStatus || 500;
  if (code === 500) console.error(e);
  return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'Asal permintaan tidak diizinkan' }, 403);
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
  b = b || {};
  try {
    return json(await bot.handleMessage({
      slug: b.slug, conversationId: b.conversationId, token: b.token, text: b.text, after: b.after, lang: typeof b.lang === 'string' ? b.lang.slice(0, 5) : '',
      visitor: visitorFromHeaders(request.headers)
    }));
  } catch (e) { return fail(e); }
}

export async function GET(request) {
  if (!sameOrigin(request)) return json({ error: 'Asal permintaan tidak diizinkan' }, 403);
  const q = new URL(request.url).searchParams;
  try {
    return json(await bot.getMessages({
      conversationId: q.get('conversationId'), token: q.get('token'), after: q.get('after')
    }));
  } catch (e) { return fail(e); }
}
