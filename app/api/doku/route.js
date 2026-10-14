import billing from '@/lib/billing';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Webhook DOKU. Isi Notification URL di DOKU Back Office (Settings > Payment Channels, per channel yang dipakai)
// dengan https://DOMAINMU/api/doku. Tanda tangan dihitung dari body MENTAH dan path URL ini, jadi body dibaca sebagai teks dulu.
export async function POST(request) {
  const raw = await request.text();
  const h = request.headers;
  try {
    const r = await billing.handleDokuNotification({
      raw,
      target: new URL(request.url).pathname,
      headers: {
        clientId: h.get('client-id') || '', requestId: h.get('request-id') || '',
        timestamp: h.get('request-timestamp') || '', signature: h.get('signature') || ''
      }
    });
    return Response.json({ ok: true, status: r.status || null });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) { console.error('Webhook DOKU gagal:', e); return Response.json({ error: 'Gagal memproses' }, { status: 500 }); }
    return Response.json({ error: e.message }, { status: code });
  }
}
