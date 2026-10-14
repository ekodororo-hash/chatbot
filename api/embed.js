'use strict';
const fs = require('fs');
const path = require('path');
const { getAdmin } = require('../lib/supabase');
const { frameAncestors } = require('../lib/domains');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'lib', 'chat.html'), 'utf8');

function safeJson(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function text(res, code, msg) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(msg);
}

// Menyajikan halaman chat untuk /chat/:slug.
// Header CSP frame-ancestors memastikan browser hanya mau menampilkan halaman ini
// sebagai iframe di domain yang diizinkan klien. Dibuka langsung (tab sendiri) tetap bisa.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const slug = String((req.query && req.query.slug) || '');
  if (!/^[a-z0-9-]{3,30}$/.test(slug)) return text(res, 404, 'Bot tidak ditemukan');

  let shop;
  try {
    const r = await getAdmin().from('shops')
      .select('slug,name,bot_name,greeting,tone,accent,allowed_domains')
      .eq('slug', slug).maybeSingle();
    if (r.error) throw r.error;
    shop = r.data;
  } catch (e) {
    console.error(e);
    return text(res, 500, 'Terjadi gangguan. Coba lagi sebentar.');
  }
  if (!shop) return text(res, 404, 'Bot tidak ditemukan');

  const cfg = {
    slug: shop.slug,
    shopName: shop.name,
    botName: shop.bot_name,
    greeting: shop.greeting,
    tone: shop.tone,
    accent: /^#[0-9a-fA-F]{6}$/.test(shop.accent) ? shop.accent : '#0b7a75'
  };
  const html = TEMPLATE.replace('__CONFIG__', () => safeJson(cfg));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy',
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; " +
    "base-uri 'none'; form-action 'none'; " + frameAncestors(shop.allowed_domains));
  res.end(html);
};
