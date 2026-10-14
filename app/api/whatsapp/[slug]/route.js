import channels from '@/lib/channels';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const plain = (status, body) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

// Verifikasi webhook: Meta memanggil GET ini sekali saat kamu menyimpan Callback URL di dashboard Meta.
export async function GET(request, context) {
  const { slug } = await context.params;
  const q = new URL(request.url).searchParams;
  let ctx;
  try { ctx = await channels.loadChannels(slug); } catch (e) { console.error(e); return plain(500, 'error'); }
  if (!ctx || !ctx.ch.wa_verify_token) return plain(404, 'not found');
  if (q.get('hub.mode') === 'subscribe' && channels.safeEqual(q.get('hub.verify_token'), ctx.ch.wa_verify_token)) {
    return plain(200, q.get('hub.challenge') || '');
  }
  return plain(403, 'forbidden');
}

// Pesan masuk. Tanda tangan X-Hub-Signature-256 dicek terhadap isi mentah dengan App Secret.
export async function POST(request, context) {
  const { slug } = await context.params;
  let ctx;
  try { ctx = await channels.loadChannels(slug); } catch (e) { console.error(e); return plain(500, 'error'); }
  if (!ctx || !ctx.ch.wa_token || !ctx.ch.wa_phone_id) return plain(404, 'not found');

  const raw = await request.text();
  if (!channels.verifyWhatsAppSignature(raw, request.headers.get('x-hub-signature-256'), ctx.ch.wa_app_secret)) return plain(403, 'forbidden');

  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return plain(400, 'bad request'); }

  for (const msg of channels.parseWhatsAppPayload(payload)) {
    // Webhook ini hanya untuk nomor yang disimpan di dashboard.
    if (msg.phoneId && msg.phoneId !== String(ctx.ch.wa_phone_id)) continue;
    await channels.handleInbound('whatsapp', ctx, msg, (t) => channels.sendWhatsApp(ctx.ch, msg.externalId, t));
  }
  return plain(200, 'ok');
}
