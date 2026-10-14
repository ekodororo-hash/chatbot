import channels from '@/lib/channels';
import auth from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Hapus toko permanen. Khusus pemilik, dan nama toko harus diketik persis sebagai konfirmasi.
// Produk, FAQ, percakapan, pesan, saluran, anggota tim, undangan, pengaturan notifikasi, paket, dan riwayat
// pembayaran ikut terhapus oleh "on delete cascade" di database.
export async function DELETE(request) {
  try {
    const { sb, shop } = await auth.requireMember(request, { ownerOnly: true });
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    if (String((b && b.confirm) || '').trim() !== String(shop.name || '').trim()) {
      return json({ error: 'Nama toko yang diketik tidak cocok.' }, 400);
    }

    // Lepas webhook bot Telegram dulu supaya bot tidak terus mengirim pesan ke toko yang sudah tidak ada.
    // Gagal di sini tidak menghalangi penghapusan.
    try {
      const ch = await sb.from('shop_channels').select('telegram_token').eq('shop_id', shop.id).maybeSingle();
      if (ch.data && ch.data.telegram_token) await channels.telegramApi(ch.data.telegram_token, 'deleteWebhook');
    } catch (e) { /* abaikan */ }

    const d = await sb.from('shops').delete().eq('id', shop.id);
    if (d.error) throw d.error;
    return json({ ok: true });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
