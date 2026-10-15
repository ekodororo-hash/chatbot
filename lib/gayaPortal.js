'use strict';
// Apakah toko ini tampil dan berperilaku seperti portal (balasan dengan tombol WhatsApp dan ikon tautan)? Sama dengan gerbang
// asisten khusus pemilik layanan: hanya toko milik email di ADMIN_EMAILS dan saklarnya menyala. Hanya mengembalikan true/false,
// isi aturan asisten tidak pernah lewat sini, jadi aman dipanggil dari halaman chat publik.
const brain = require('./otak');

async function aktif(sb, shop) {
  try {
    const c = await brain.config();
    if (!c.on) return false;
    return await brain.ownerIsAdmin(sb, shop);
  } catch (e) { return false; }
}

module.exports = { aktif };
