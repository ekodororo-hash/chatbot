// Dipanggil di server component. Dua nilai ini memang publik (dibatasi RLS di Supabase),
// jadi aman diteruskan ke komponen browser. Service role key TIDAK pernah lewat sini.
export function getPublicConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return { error: 'Env Supabase belum diatur' };
  return { supabaseUrl, supabaseAnonKey };
}
