import billing from '@/lib/billing';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Webhook Midtrans (Settings > Configuration > Payment Notification URL: https://DOMAINMU/api/midtrans).
// Dilindungi tanda tangan sha512 dengan Server Key. Selain 2xx, Midtrans mengirim ulang notifikasi.
export async function POST(request) {
  let n;
  try { n = await request.json(); } catch (e) { return Response.json({ error: 'Format salah' }, { status: 400 }); }
  try {
    const r = await billing.handleNotification(n);
    return Response.json({ ok: true, status: r.status || null });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) { console.error('Webhook Midtrans gagal:', e); return Response.json({ error: 'Gagal memproses' }, { status: 500 }); }
    return Response.json({ error: e.message }, { status: code });
  }
}
