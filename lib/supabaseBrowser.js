import { createClient } from '@supabase/supabase-js';

let client = null;

// Satu klien untuk seluruh halaman di browser (sesi login disimpan otomatis).
export function getBrowserClient(url, key) {
  if (!client) client = createClient(url, key);
  return client;
}
