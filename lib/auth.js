'use strict';
const { getAdmin } = require('./supabase');

function httpError(status, message) {
  const e = new Error(message);
  e.httpStatus = status;
  return e;
}

// Memastikan pemanggil adalah pemilik toko: token login (Bearer) dari dashboard diperiksa ke Supabase Auth.
async function requireOwner(request) {
  const m = String(request.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (!m) throw httpError(401, 'Silakan login ulang.');
  const sb = getAdmin();
  const { data, error } = await sb.auth.getUser(m[1]);
  if (error || !data || !data.user) throw httpError(401, 'Sesi habis. Silakan login ulang.');
  const s = await sb.from('shops').select('*').eq('owner_id', data.user.id).maybeSingle();
  if (s.error) throw s.error;
  if (!s.data) throw httpError(404, 'Toko tidak ditemukan.');
  return { sb, user: data.user, shop: s.data };
}

module.exports = { requireOwner, httpError };
