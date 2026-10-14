'use strict';
const channels = require('./channels');

// Hapus toko permanen. Produk, FAQ, percakapan, pesan, saluran, anggota tim, undangan, pengaturan notifikasi,
// paket, dan riwayat pembayaran ikut terhapus oleh "on delete cascade" di database.
// Webhook bot Telegram dilepas dulu supaya bot tidak terus mengirim ke toko yang sudah tidak ada (gagal tidak menghalangi).
async function deleteShop(sb, shopId) {
  try {
    const ch = await sb.from('shop_channels').select('telegram_token').eq('shop_id', shopId).maybeSingle();
    if (ch.data && ch.data.telegram_token) await channels.telegramApi(ch.data.telegram_token, 'deleteWebhook');
  } catch (e) { /* abaikan */ }
  const d = await sb.from('shops').delete().eq('id', shopId);
  if (d.error) throw d.error;
}

module.exports = { deleteShop };
