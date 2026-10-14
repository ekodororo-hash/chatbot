'use strict';

// Anon key memang publik (dibatasi RLS). Service role key TIDAK pernah dikirim dari sini.
module.exports = (req, res) => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Env Supabase belum diatur' });
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ supabaseUrl: url, supabaseAnonKey: key });
};
