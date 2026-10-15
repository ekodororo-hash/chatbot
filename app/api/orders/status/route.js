import auth from '@/lib/auth';
import orders from '@/lib/orders';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ubah status pesanan (pemilik dan admin toko). Hanya mengubah data: pelanggan tidak dikirimi pesan apa pun.
// Body: { conversationId, status }. Menghubungi pelanggan dilakukan admin sendiri lewat percakapan atau WhatsApp.
export async function POST(request) {
  try {
    const { sb, shop } = await auth.requireMember(request);
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    b = b || {};
    const next = String(b.status || '');
    if (!UUID.test(String(b.conversationId || ''))) return json({ error: 'Percakapan tidak valid' }, 400);
    if (!orders.STATUS.includes(next)) return json({ error: 'Status tidak dikenal' }, 400);

    const c = await sb.from('conversations').select('id,order_status')
      .eq('id', b.conversationId).eq('shop_id', shop.id).maybeSingle();
    if (c.error) throw c.error;
    if (!c.data) return json({ error: 'Pesanan tidak ditemukan' }, 404);
    if (!c.data.order_status) return json({ error: 'Percakapan ini bukan pesanan' }, 400);
    const u = await sb.from('conversations').update({ order_status: next }).eq('id', c.data.id);
    if (u.error) throw u.error;

    // Rincian pesanan (tabel orders) ikut berubah. Tabel bisa belum ada: status tetap tersimpan di percakapan.
    try {
      const o = await sb.from('orders').select('id').eq('conversation_id', c.data.id)
        .order('created_at', { ascending: false }).limit(1);
      if (o.error) throw o.error;
      if (o.data && o.data[0]) {
        const patch = { status: next, updated_at: new Date().toISOString(), done_at: next === 'selesai' ? new Date().toISOString() : null };
        const w = await sb.from('orders').update(patch).eq('id', o.data[0].id);
        if (w.error) throw w.error;
      }
    } catch (e) { console.error('Status rincian pesanan dilewati:', e && e.message); }

    return json({ ok: true, status: next });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
