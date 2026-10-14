import crypto from 'crypto';
import channels from '@/lib/channels';
import auth from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const rand = (n) => crypto.randomBytes(n).toString('hex');

function originOf(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || (host && host.startsWith('localhost') ? 'http' : 'https');
  return proto + '://' + host;
}

// Yang dikirim ke browser hanya status. Token dan secret tidak pernah dikembalikan.
function status(ch, shop, origin) {
  const c = ch || {};
  return {
    telegram: { connected: !!(c.telegram_token && c.telegram_secret), username: c.telegram_username || '' },
    whatsapp: {
      connected: !!(c.wa_token && c.wa_phone_id && c.wa_app_secret),
      number: c.wa_number || '', phoneId: c.wa_phone_id || '',
      verifyToken: c.wa_verify_token || '',
      webhookUrl: origin + '/api/whatsapp/' + shop.slug
    }
  };
}

async function load(sb, shop) {
  const r = await sb.from('shop_channels').select('*').eq('shop_id', shop.id).maybeSingle();
  if (r.error) throw r.error;
  return r.data;
}

async function save(sb, shop, patch) {
  const r = await sb.from('shop_channels')
    .upsert(Object.assign({ shop_id: shop.id, updated_at: new Date().toISOString() }, patch), { onConflict: 'shop_id' });
  if (r.error) throw r.error;
}

export async function GET(request) {
  try {
    const { sb, shop } = await auth.requireMember(request, { ownerOnly: true });
    return json(status(await load(sb, shop), shop, originOf(request)));
  } catch (e) { return fail(e); }
}

export async function POST(request) {
  try {
    const { sb, shop } = await auth.requireMember(request, { ownerOnly: true });
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    b = b || {};
    const origin = originOf(request);
    const cur = await load(sb, shop);

    if (b.action === 'telegram_connect') {
      const token = String(b.token || '').trim();
      if (!/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token)) return json({ error: 'Format token Telegram tidak valid. Salin utuh dari @BotFather.' }, 400);
      let me;
      try { me = await channels.telegramApi(token, 'getMe'); } catch (e) { return json({ error: 'Token ditolak Telegram. Cek lagi token dari @BotFather.' }, 400); }
      const secret = rand(24);
      try {
        await channels.telegramApi(token, 'setWebhook', {
          url: origin + '/api/telegram/' + shop.slug, secret_token: secret, allowed_updates: ['message']
        });
      } catch (e) { return json({ error: 'Gagal memasang webhook. ' + e.message }, 502); }
      await save(sb, shop, { telegram_token: token, telegram_secret: secret, telegram_username: me.username || '' });
      return json(status(await load(sb, shop), shop, origin));
    }

    if (b.action === 'telegram_disconnect') {
      if (cur && cur.telegram_token) {
        try { await channels.telegramApi(cur.telegram_token, 'deleteWebhook'); } catch (e) { /* tetap lepas di sisi kita */ }
      }
      await save(sb, shop, { telegram_token: null, telegram_secret: null, telegram_username: null });
      return json(status(await load(sb, shop), shop, origin));
    }

    if (b.action === 'whatsapp_save') {
      const phoneId = String(b.phoneId || '').trim();
      const appSecret = String(b.appSecret || '').trim();
      // Token dan App Secret yang sudah tersimpan boleh dikosongkan di formulir (berarti tidak diubah).
      const token = String(b.token || '').trim() || (cur && cur.wa_token) || '';
      const secret = appSecret || (cur && cur.wa_app_secret) || '';
      if (!/^\d{5,20}$/.test(phoneId)) return json({ error: 'Phone number ID harus berupa angka.' }, 400);
      if (token.length < 20) return json({ error: 'Access token WhatsApp belum diisi atau terlalu pendek.' }, 400);
      if (!/^[A-Za-z0-9]{16,}$/.test(secret)) return json({ error: 'App Secret belum diisi atau formatnya salah.' }, 400);
      let info;
      try {
        const res = await channels.timedFetch('https://graph.facebook.com/' + channels.waVersion() + '/' + phoneId + '?fields=display_phone_number,verified_name',
          { headers: { Authorization: 'Bearer ' + token } });
        info = await res.json().catch(() => ({}));
        if (!res.ok) return json({ error: 'Ditolak Meta: ' + ((info.error && info.error.message) || ('HTTP ' + res.status)) }, 400);
      } catch (e) { return json({ error: 'Tidak bisa menghubungi Meta. Coba lagi.' }, 502); }
      await save(sb, shop, {
        wa_phone_id: phoneId, wa_token: token, wa_app_secret: secret,
        wa_number: info.display_phone_number || '', wa_verify_token: (cur && cur.wa_verify_token) || rand(16)
      });
      return json(status(await load(sb, shop), shop, origin));
    }

    if (b.action === 'whatsapp_disconnect') {
      await save(sb, shop, { wa_phone_id: null, wa_number: null, wa_token: null, wa_app_secret: null, wa_verify_token: null });
      return json(status(await load(sb, shop), shop, origin));
    }

    return json({ error: 'Aksi tidak dikenal' }, 400);
  } catch (e) { return fail(e); }
}

function fail(e) {
  const code = e.httpStatus || 500;
  if (code === 500) console.error(e);
  return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
}
