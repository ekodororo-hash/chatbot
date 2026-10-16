import admin from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Alamat IP pengunjung sebuah percakapan. Hanya untuk email di ADMIN_EMAILS; anggota toko lain mendapat 403.
// Tabel conversation_visitors tidak bisa dibaca dari browser, jadi ini satu-satunya jalan menuju IP.
export async function GET(request) {
  try {
    const { sb } = await admin.requireSuperAdmin(request);
    const id = new URL(request.url).searchParams.get('conversationId') || '';
    if (!UUID.test(id)) return json({ error: 'ID percakapan tidak valid' }, 400);
    const { data, error } = await sb.from('conversation_visitors').select('ip').eq('conversation_id', id).maybeSingle();
    if (error) {
      // Tabel belum dibuat (migrasi belum dijalankan): anggap belum ada IP.
      if (error.code === '42P01' || error.code === 'PGRST205') return json({ ip: null });
      throw error;
    }
    return json({ ip: (data && data.ip) || null });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
