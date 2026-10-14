import channels from '@/lib/channels';
import auth from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Admin membalas percakapan Telegram/WhatsApp dari dashboard: kirim dulu ke pelanggan, baru disimpan.
// Kalau pengiriman gagal (mis. WhatsApp di luar jendela 24 jam), pesan tidak disimpan dan admin diberi tahu.
export async function POST(request) {
  try {
    const { sb, shop } = await auth.requireOwner(request);
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    const text = String((b && b.text) || '').trim();
    if (!UUID.test(String((b && b.conversationId) || ''))) return json({ error: 'Percakapan tidak valid' }, 400);
    if (!text) return json({ error: 'Pesan kosong' }, 400);
    if (text.length > 1000) return json({ error: 'Pesan terlalu panjang (maksimal 1000 karakter)' }, 400);

    const c = await sb.from('conversations').select('id,channel,external_id')
      .eq('id', b.conversationId).eq('shop_id', shop.id).maybeSingle();
    if (c.error) throw c.error;
    if (!c.data) return json({ error: 'Percakapan tidak ditemukan' }, 404);
    if (c.data.channel === 'web' || !c.data.external_id) return json({ error: 'Percakapan ini bukan dari Telegram/WhatsApp' }, 400);

    const ch = await sb.from('shop_channels').select('*').eq('shop_id', shop.id).maybeSingle();
    if (ch.error) throw ch.error;
    try {
      await channels.sendToCustomer(c.data.channel, ch.data, c.data.external_id, text);
    } catch (e) {
      return json({ error: 'Gagal mengirim ke pelanggan. ' + (e && e.message ? e.message : '') }, 502);
    }
    const ins = await sb.from('messages').insert({ conversation_id: c.data.id, shop_id: shop.id, role: 'admin', content: text });
    if (ins.error) throw ins.error;
    return json({ ok: true });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
