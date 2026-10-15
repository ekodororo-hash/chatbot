-- Pesanan terstruktur (rincian item, total, alamat) dan laporan mingguan ke Telegram pemilik.
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Untuk proyek baru, isi yang sama sudah ada di bagian akhir schema.sql.

-- ============ 1. TABEL PESANAN ============
-- Satu baris per pesanan. Bot mengisinya saat pelanggan selesai memesan; harga dihitung server dari katalog toko,
-- bukan dari tebakan AI. Status diubah lewat server (/api/orders/status) supaya pelanggan ikut dikabari.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  -- set null (bukan cascade): menghapus percakapan tidak boleh menghapus catatan pesanan dan omzetnya.
  conversation_id uuid references public.conversations(id) on delete set null,
  customer_name text not null default '' check (char_length(customer_name) <= 100),
  phone text not null default '' check (char_length(phone) <= 40),
  address text not null default '' check (char_length(address) <= 500),
  note text not null default '' check (char_length(note) <= 500),
  items jsonb not null default '[]'::jsonb,
  subtotal bigint not null default 0 check (subtotal >= 0),
  status text not null default 'baru' check (status in ('baru','diproses','selesai','batal')),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_shop_created_idx on public.orders (shop_id, created_at desc);
create index if not exists orders_conv_idx on public.orders (conversation_id);

alter table public.orders enable row level security;
revoke all on public.orders from anon;
revoke all on public.orders from authenticated;
grant select on public.orders to authenticated;
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated using (public.owns_shop(shop_id));

-- Realtime: daftar Pesanan di dashboard langsung menampilkan rincian pesanan baru (tetap dibatasi RLS).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ============ 2. LAPORAN MINGGUAN ============
-- weekly_on: pemilik bisa mematikan laporan. weekly_sent_at: mencegah laporan terkirim dobel.
alter table public.shop_notify add column if not exists weekly_on boolean not null default true;
alter table public.shop_notify add column if not exists weekly_sent_at timestamptz;
