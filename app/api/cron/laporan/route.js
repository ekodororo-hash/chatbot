import supabase from '@/lib/supabase';
import reminder from '@/lib/reminder';
import weeklyReport from '@/lib/weeklyReport';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Dipanggil terjadwal oleh cron-job.org (sekali seminggu, mis. Senin 07.00 WIB). Dijaga CRON_SECRET yang sama
// dengan /api/cron/langganan. Toko yang sudah dikirimi dalam 6 hari terakhir dilewati, jadi aman dipanggil ulang.
async function handle(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: 'CRON_SECRET belum diatur' }, 503);
  const key = new URL(request.url).searchParams.get('key');
  if (!reminder.authorized(secret, request.headers.get('authorization'), key)) return json({ error: 'Tidak diizinkan' }, 401);
  try {
    return json({ ok: true, ...(await weeklyReport.run(supabase.getAdmin())) });
  } catch (e) {
    console.error('Cron laporan gagal:', e && e.message);
    return json({ error: 'Gagal menjalankan laporan mingguan. Pastikan migrasi pesanan_terstruktur.sql sudah dijalankan.' }, 500);
  }
}

export const GET = handle;
export const POST = handle;
