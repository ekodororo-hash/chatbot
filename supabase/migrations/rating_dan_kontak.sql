-- Rating percakapan (jempol atas/bawah) dan penangkapan kontak pengunjung (lead).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Untuk proyek baru, isi yang sama sudah ada di bagian akhir schema.sql.

-- ============ 1. RATING PERCAKAPAN ============
-- rating: 1 = jempol atas, -1 = jempol bawah. Hanya server (service role) yang mengisinya, dari halaman chat pelanggan.
-- rating_q: pertanyaan pelanggan yang paling pantas jadi bahan FAQ (diisi saat jempol bawah).
-- rating_done: pemilik sudah menanganinya (dijadikan FAQ atau ditandai beres), supaya hilang dari daftar Ringkasan.
alter table public.conversations add column if not exists rating smallint check (rating in (-1, 1));
alter table public.conversations add column if not exists rated_at timestamptz;
alter table public.conversations add column if not exists rating_q text check (char_length(rating_q) <= 200);
alter table public.conversations add column if not exists rating_done boolean not null default false;
grant update (rating_done) on public.conversations to authenticated;
create index if not exists conversations_rating_idx on public.conversations (shop_id, rated_at desc) where rating is not null;

-- ============ 2. PENANGKAPAN KONTAK (LEAD) ============
-- lead_on: pemilik menyalakannya di menu Asisten AI. Mati secara bawaan, supaya toko lama tidak tiba-tiba menawarkan kontak.
alter table public.shops add column if not exists lead_on boolean not null default false;
-- lead_offered_at: kartu tawaran hanya muncul sekali per percakapan.
alter table public.conversations add column if not exists lead_offered_at timestamptz;

-- Satu kontak = satu baris per toko. Diisi lewat server (/api/lead); pemilik dan admin hanya bisa melihat dan menghapus.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  -- set null (bukan cascade): menghapus percakapan tidak boleh menghapus kontak yang sudah diberikan pelanggan.
  conversation_id uuid references public.conversations(id) on delete set null,
  kind text not null check (kind in ('phone', 'email')),
  contact text not null check (char_length(contact) between 5 and 200),
  source text not null default 'chat' check (source in ('chat')),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists leads_shop_contact on public.leads (shop_id, contact);
create index if not exists leads_shop_created_idx on public.leads (shop_id, created_at desc);
create index if not exists leads_conv_idx on public.leads (conversation_id);

alter table public.leads enable row level security;
revoke all on public.leads from anon;
revoke all on public.leads from authenticated;
grant select, delete on public.leads to authenticated;
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated using (public.owns_shop(shop_id));
drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete to authenticated using (public.owns_shop(shop_id));
