'use strict';
const { getAdmin } = require('./supabase');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function httpError(status, message) {
  const e = new Error(message);
  e.httpStatus = status;
  return e;
}

// Memastikan pemanggil adalah anggota toko: token login (Bearer) dari dashboard diperiksa ke Supabase Auth,
// lalu keanggotaannya di toko yang disebut header X-Shop-Id dicek. ownerOnly: true berarti harus pemilik.
async function requireMember(request, opt) {
  const ownerOnly = !!(opt && opt.ownerOnly);
  const m = String(request.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (!m) throw httpError(401, 'Silakan login ulang.');
  const shopId = String(request.headers.get('x-shop-id') || '');
  if (!UUID.test(shopId)) throw httpError(400, 'Toko belum dipilih.');
  const sb = getAdmin();
  const { data, error } = await sb.auth.getUser(m[1]);
  if (error || !data || !data.user) throw httpError(401, 'Sesi habis. Silakan login ulang.');
  const s = await sb.from('shops').select('*').eq('id', shopId).maybeSingle();
  if (s.error) throw s.error;
  if (!s.data) throw httpError(404, 'Toko tidak ditemukan.');
  const isOwner = s.data.owner_id === data.user.id;
  if (!isOwner) {
    if (ownerOnly) throw httpError(403, 'Hanya pemilik toko yang boleh melakukan ini.');
    const mem = await sb.from('shop_members').select('user_id').eq('shop_id', shopId).eq('user_id', data.user.id).maybeSingle();
    if (mem.error) throw mem.error;
    if (!mem.data) throw httpError(404, 'Toko tidak ditemukan.');
  }
  return { sb, user: data.user, shop: s.data, role: isOwner ? 'owner' : 'admin' };
}

// Dipertahankan untuk kode lama: sama dengan requireMember yang khusus pemilik.
const requireOwner = (request) => requireMember(request, { ownerOnly: true });

module.exports = { requireMember, requireOwner, httpError };
