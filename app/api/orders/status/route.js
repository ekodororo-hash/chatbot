import channels from '@/lib/channels';
import auth from '@/lib/auth';
import orders from '@/lib/orders';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ubah status pesanan (pemilik dan admin toko), lalu kabari pelanggan lewat saluran percakapannya.
// Body: { conversationId, status, notifyCustomer? }. Tanpa notifyCustomer: true, status berubah tanpa mengirim pesan.
// Hasil notified: 'sent' (terkirim ke Telegram/WhatsApp), 'saved' (tersimpan di chat web), 'failed', atau 'none'.
// Gagal mengabari tidak membatalkan perubahan status; alasannya dikembalikan di notifyError.
export async function POST(request) {
  try {
    const { sb, shop } = await auth.requireMember(request);
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    b = b || {};
    const next = String(b.status || '');
    if (!UUID.test(String(b.conversationId || ''))) return json({ error: 'Percakapan tidak valid' }, 400);
    if (!orders.STATUS.includes(next)) return json({ error: 'Status tidak dikenal' }, 400);

    const c = await sb.from('conversations').select('id,channel,external_id,customer_name,order_status')
      .eq('id', b.conversationId).eq('shop_id', shop.id).maybeSingle();
    if (c.error) throw c.error;
    if (!c.data) return json({ error: 'Pesanan tidak ditemukan' }, 404);
    if (!c.data.order_status) return json({ error: 'Percakapan ini bukan pesanan' }, 400);
    const prev = c.data.order_status;

    const u = await sb.from('conversations').update({ order_status: next }).eq('id', c.data.id);
    if (u.error) throw u.error;

    // Rincian pesanan (tabel orders) ikut berubah. Tabel bisa belum ada: status tetap tersimpan di percakapan.
    let name = c.data.customer_name;
    try {
      const o = await sb.from('orders').select('id,customer_name').eq('conversation_id', c.data.id)
        .order('created_at', { ascending: false }).limit(1);
      if (o.error) throw o.error;
      if (o.data && o.data[0]) {
        const patch = { status: next, updated_at: new Date().toISOString(), done_at: next === 'selesai' ? new Date().toISOString() : null };
        const w = await sb.from('orders').update(patch).eq('id', o.data[0].id);
        if (w.error) throw w.error;
        if (o.data[0].customer_name) name = o.data[0].customer_name;
      }
    } catch (e) { console.error('Status rincian pesanan dilewati:', e && e.message); }

    const res = { ok: true, status: next, notified: 'none' };
    // Pesan otomatis ke pelanggan hanya bila diminta jelas (notifyCustomer: true). Bawaannya tidak mengirim apa pun.
    if (b.notifyCustomer !== true || !orders.shouldNotify(prev, next)) return json(res);

    const text = orders.statusMessage(shop, next, name);
    const conv = c.data;
    try {
      if (conv.channel === 'web' || !conv.external_id) {
        res.notified = 'saved';
      } else {
        const ch = await sb.from('shop_channels').select('*').eq('shop_id', shop.id).maybeSingle();
        if (ch.error) throw ch.error;
        await channels.sendToCustomer(conv.channel, ch.data, conv.external_id, text);
        res.notified = 'sent';
      }
      const ins = await sb.from('messages').insert({ conversation_id: conv.id, shop_id: shop.id, role: 'admin', content: text });
      if (ins.error) throw ins.error;
    } catch (e) {
      res.notified = 'failed';
      res.notifyError = e && e.message ? String(e.message).slice(0, 200) : 'Gagal mengirim.';
    }
    return json(res);
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
