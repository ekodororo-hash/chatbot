'use strict';
const bot = require('../lib/bot');

// Menolak panggilan lintas situs dari browser. Ini bukan pengaman utama (curl bisa memalsukan
// header); pengaman utamanya adalah batas laju dan batas balasan harian di lib/bot.js.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Asal permintaan tidak diizinkan' });
  try {
    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') {
        try { b = JSON.parse(b); } catch (e) { return res.status(400).json({ error: 'Format permintaan salah' }); }
      }
      b = b || {};
      return res.status(200).json(await bot.handleMessage({
        slug: b.slug, conversationId: b.conversationId, token: b.token, text: b.text, after: b.after
      }));
    }
    if (req.method === 'GET') {
      const q = req.query || {};
      return res.status(200).json(await bot.getMessages({
        conversationId: q.conversationId, token: q.token, after: q.after
      }));
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Metode tidak didukung' });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return res.status(code).json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message });
  }
};
