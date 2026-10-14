import channels from '@/lib/channels';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ok = () => Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
const no = (status) => Response.json({ ok: false }, { status, headers: { 'Cache-Control': 'no-store' } });

// Webhook Telegram. Telegram mengirim header X-Telegram-Bot-Api-Secret-Token yang kita tentukan saat setWebhook.
export async function POST(request, context) {
  const { slug } = await context.params;
  let ctx;
  try { ctx = await channels.loadChannels(slug); } catch (e) { console.error(e); return no(500); }
  if (!ctx || !ctx.ch.telegram_token || !ctx.ch.telegram_secret) return no(404);
  if (!channels.safeEqual(request.headers.get('x-telegram-bot-api-secret-token'), ctx.ch.telegram_secret)) return no(403);

  let update;
  try { update = await request.json(); } catch (e) { return no(400); }
  const msg = channels.parseTelegramUpdate(update);
  if (!msg) return ok();

  await channels.handleInbound('telegram', ctx, msg, (t) => channels.sendTelegram(ctx.ch.telegram_token, msg.externalId, t));
  return ok();
}
