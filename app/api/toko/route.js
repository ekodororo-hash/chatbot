import shops from '@/lib/shops';
import auth from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Hapus toko permanen. Khusus pemilik, dan nama toko harus diketik persis sebagai konfirmasi.
export async function DELETE(request) {
  try {
    const { sb, shop } = await auth.requireMember(request, { ownerOnly: true });
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    if (String((b && b.confirm) || '').trim() !== String(shop.name || '').trim()) {
      return json({ error: 'Nama toko yang diketik tidak cocok.' }, 400);
    }

    await shops.deleteShop(sb, shop.id);
    return json({ ok: true });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
