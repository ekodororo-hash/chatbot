'use strict';
// Apakah toko ini tampil dan berperilaku seperti portal (balasan dengan tombol WhatsApp dan ikon tautan)? Sama dengan gerbang
// asisten khusus pemilik layanan: hanya toko milik email di ADMIN_EMAILS dan saklarnya menyala. Hanya mengembalikan true/false,
// isi aturan asisten tidak pernah lewat sini, jadi aman dipanggil dari halaman chat publik.
const brain = require('./otak');

async function aktif(sb, shop) {
  try {
    const c = await brain.config();
    if (!c.on) return false;
    // Toko widget admin (env WIDGET_BOT) tampil sebagai toko biasa, bukan gaya portal EMAHAIRSHOP.
    const wb = String(process.env.WIDGET_BOT || '').trim();
    if (wb && shop && shop.slug === wb) return false;
    // Toko isengin.site (env ISENGIN_BOT) punya otak sendiri dan juga tampil sebagai toko biasa.
    if (require('./otakIsengin').isIsenginShop(shop)) return false;
    return await brain.ownerIsAdmin(sb, shop);
  } catch (e) { return false; }
}

module.exports = { aktif };
