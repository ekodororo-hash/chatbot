'use strict';
const { createClient } = require('@supabase/supabase-js');

let admin = null;

// Client dengan service role: HANYA dipakai di server (folder api/ dan lib/).
function getAdmin() {
  if (!admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diatur');
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

module.exports = { getAdmin };
