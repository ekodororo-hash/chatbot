-- Pengaturan layanan (key pembayaran yang diisi admin lewat halaman /admin/pengaturan).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Hanya boleh diakses server (service role): RLS aktif TANPA policy. Nilai rahasia disimpan terenkripsi.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
