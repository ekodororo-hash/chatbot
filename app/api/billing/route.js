import auth from '@/lib/auth';
import billing from '@/lib/billing';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Halaman Langganan: hanya pemilik toko.
export async function GET(request) {
  try {
    const { sb, shop } = await auth.requireMember(request, { ownerOnly: true });
    const brief = new URL(request.url).searchParams.get('brief') === '1';
    return json(await billing.status(sb, shop, undefined, { brief }));
  } catch (e) { return fail(e); }
}

export async function POST(request) {
  try {
    const { sb, shop, user } = await auth.requireMember(request, { ownerOnly: true });
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    b = b || {};

    if (b.action === 'checkout') {
      const r = await billing.checkout({ shop, user, planId: String(b.plan || ''), months: b.months, provider: b.provider ? String(b.provider) : '' });
      return json({ url: r.url });
    }

    // Tombol "Periksa pembayaran": tanya Midtrans langsung kalau notifikasinya belum sampai.
    if (b.action === 'check') {
      await billing.syncOrder(shop, String(b.orderId || ''));
      return json(await billing.status(sb, shop));
    }

    return json({ error: 'Aksi tidak dikenal' }, 400);
  } catch (e) { return fail(e); }
}

function fail(e) {
  const code = e.httpStatus || 500;
  if (code === 500) console.error(e);
  return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
}
