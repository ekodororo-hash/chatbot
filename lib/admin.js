'use strict';
// Akses halaman admin pengelola layanan (bukan admin toko). Email yang boleh masuk diatur di env ADMIN_EMAILS
// (dipisah koma). Kalau kosong, dipakai DEVELOPER_EMAILS supaya tidak perlu variabel baru.
const { getAdmin } = require('./supabase');

function httpError(status, message) {
  const e = new Error(message);
  e.httpStatus = status;
  return e;
}

function adminEmails() {
  const raw = process.env.ADMIN_EMAILS || process.env.DEVELOPER_EMAILS || '';
  return String(raw).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

async function requireSuperAdmin(request) {
  const m = String(request.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (!m) throw httpError(401, 'Silakan login ulang.');
  const sb = getAdmin();
  const { data, error } = await sb.auth.getUser(m[1]);
  if (error || !data || !data.user) throw httpError(401, 'Sesi habis. Silakan login ulang.');
  const list = adminEmails();
  if (!list.length) throw httpError(403, 'ADMIN_EMAILS belum diatur di server.');
  if (!list.includes(String(data.user.email || '').toLowerCase())) throw httpError(403, 'Akun ini bukan admin layanan.');
  return { sb, user: data.user };
}

module.exports = { requireSuperAdmin, adminEmails };
