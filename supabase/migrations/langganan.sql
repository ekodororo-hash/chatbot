-- Langganan berbayar: paket per toko dan riwayat pembayaran (Midtrans).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Untuk proyek baru, isi yang sama sudah ada di bagian akhir schema.sql.
--
-- Kedua tabel hanya boleh diakses server (service role): RLS aktif TANPA policy. Sengaja tidak ditaruh di tabel
-- shops, karena pemilik toko boleh mengubah barisnya sendiri dan bisa memberi dirinya paket gratis.

create table if not exists public.shop_billing (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','starter','bisnis')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  provider text not null default 'midtrans' check (provider in ('midtrans','doku')),
  shop_id uuid not null references public.shops(id) on delete cascade,
  plan text not null check (plan in ('starter','bisnis')),
  months int not null check (months > 0),
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','expired')),
  payment_type text,
  snap_token text,
  redirect_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
-- Untuk yang sudah menjalankan versi sebelumnya (hanya Midtrans):
alter table public.payments add column if not exists provider text not null default 'midtrans' check (provider in ('midtrans','doku'));

create index if not exists payments_shop_idx on public.payments (shop_id, created_at desc);

alter table public.shop_billing enable row level security;
alter table public.payments enable row level security;
revoke all on public.shop_billing, public.payments from anon, authenticated;

-- Toko yang sudah ada sebelum fitur ini: masa percobaan paket Bisnis 30 hari supaya tidak langsung
-- terbatas 100 balasan per bulan. Ubah angkanya atau hapus blok ini kalau tidak diinginkan.
insert into public.shop_billing (shop_id, plan, expires_at)
select id, 'bisnis', now() + interval '30 days' from public.shops
on conflict (shop_id) do nothing;

-- Aktivasi manual (misalnya klien bayar transfer): ganti UUID toko dan tanggalnya.
-- insert into public.shop_billing (shop_id, plan, expires_at) values ('UUID-TOKO', 'starter', now() + interval '30 days')
-- on conflict (shop_id) do update set plan = excluded.plan, expires_at = excluded.expires_at, updated_at = now();
