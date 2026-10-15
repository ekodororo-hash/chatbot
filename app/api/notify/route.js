import crypto from 'crypto';
import auth from '@/lib/auth';
import notify from '@/lib/notify';
import weeklyReport from '@/lib/weeklyReport';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Yang dikirim ke browser: status dan kode pendaftaran Telegram (kode ini hanya untuk pemilik toko).
async function status(sb, shop) {
  const st = await notify.ensureSettings(sb, shop.id);
  const ch = await sb.from('shop_channels').select('telegram_token,telegram_username').eq('shop_id', shop.id).maybeSingle();
  if (ch.error) throw ch.error;
  return {
    telegram: {
      on: !!st.tg_on, code: st.tg_code,
      botConnected: !!(ch.data && ch.data.telegram_token), botUsername: (ch.data && ch.data.telegram_username) || '',
      chats: (st.tg_chat_ids || []).length, maxChats: notify.MAX_CHATS
    },
    // available=false: migrasi pesanan_terstruktur.sql belum dijalankan (kolom weekly_on belum ada).
    weekly: { available: Object.prototype.hasOwnProperty.call(st, 'weekly_on'), on: st.weekly_on !== false }
  };
}

export async function GET(request) {
  try {
    const { sb, shop } = await auth.requireMember(request, { ownerOnly: true });
    return json(await status(sb, shop));
  } catch (e) { return fail(e); }
}

export async function POST(request) {
  try {
    const { sb, shop } = await auth.requireMember(request, { ownerOnly: true });
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }
    b = b || {};
    await notify.ensureSettings(sb, shop.id);
    const put = async (patch) => {
      const u = await sb.from('shop_notify').update(Object.assign({ updated_at: new Date().toISOString() }, patch)).eq('shop_id', shop.id);
      if (u.error) throw u.error;
    };

    if (b.action === 'set') {
      const patch = {};
      if (typeof b.tgOn === 'boolean') patch.tg_on = b.tgOn;
      if (typeof b.weeklyOn === 'boolean') patch.weekly_on = b.weeklyOn;
      if (!Object.keys(patch).length) return json({ error: 'Tidak ada yang diubah' }, 400);
      await put(patch);
      return json(await status(sb, shop));
    }

    // Kode baru + semua chat penerima dicabut (dipakai kalau kode bocor atau ada admin yang berhenti).
    if (b.action === 'telegram_reset') {
      await put({ tg_chat_ids: [], tg_code: crypto.randomBytes(6).toString('hex') });
      return json(await status(sb, shop));
    }

    if (b.action === 'test') {
      const result = await notify.sendTest(shop);
      return json(Object.assign(await status(sb, shop), { test: result }));
    }

    // Kirim laporan 7 hari terakhir sekarang juga (tidak mengubah jadwal laporan otomatis).
    if (b.action === 'weekly_test') {
      const result = await weeklyReport.sendForShop(sb, shop, new Date(), true);
      return json(Object.assign(await status(sb, shop), { test: { telegram: result.telegram || { sent: 0, error: 'Tidak ada tujuan.' } } }));
    }

    return json({ error: 'Aksi tidak dikenal' }, 400);
  } catch (e) { return fail(e); }
}

function fail(e) {
  const code = e.httpStatus || 500;
  if (code === 500) console.error(e);
  return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
}
