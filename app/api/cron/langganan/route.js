import supabase from '@/lib/supabase';
import reminder from '@/lib/reminder';
import billing from '@/lib/billing';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Dipanggil terjadwal oleh cron-job.org (sehari sekali). Dijaga CRON_SECRET.
// Selain pengingat langganan, sekalian menandai tagihan yang belum dibayar lewat 24 jam sebagai Kedaluwarsa.
async function handle(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: 'CRON_SECRET belum diatur' }, 503);
  const key = new URL(request.url).searchParams.get('key');
  if (!reminder.authorized(secret, request.headers.get('authorization'), key)) return json({ error: 'Tidak diizinkan' }, 401);
  try {
    const sb = supabase.getAdmin();
    const expired = await billing.expireStale(sb).catch((e) => { console.error('Gagal menutup tagihan lama:', e && e.message); return 0; });
    return json({ ok: true, expiredPayments: expired, ...(await reminder.run(sb)) });
  } catch (e) {
    console.error('Cron langganan gagal:', e && e.message);
    return json({ error: 'Gagal menjalankan pengingat' }, 500);
  }
}

export const GET = handle;
export const POST = handle;
