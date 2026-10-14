-- Banyak toko per akun, peran admin tambahan, notifikasi admin, dan realtime.
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Untuk proyek baru, isi yang sama sudah ada di bagian akhir schema.sql.

-- ============ 1. TIM TOKO ============
-- Satu akun boleh punya banyak toko (hapus syarat satu pemilik satu toko).
alter table public.shops drop constraint if exists shops_owner_id_key;
create index if not exists shops_owner_idx on public.shops (owner_id);

-- Anggota toko: pemilik (owner) dan admin tambahan (admin). Pemilik = shops.owner_id.
create table if not exists public.shop_members (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin')),
  email text not null default '',
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index if not exists shop_members_user_idx on public.shop_members (user_id);

-- Undangan admin lewat email. Diterima otomatis saat orang itu login dengan email yang sama.
create table if not exists public.shop_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 5 and 200),
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);
create unique index if not exists shop_invites_unique on public.shop_invites (shop_id, email);

-- Pemilik lama otomatis jadi anggota (role owner).
insert into public.shop_members (shop_id, user_id, role, email)
select s.id, s.owner_id, 'owner', coalesce(lower(u.email), '')
from public.shops s left join auth.users u on u.id = s.owner_id
on conflict (shop_id, user_id) do nothing;

-- owns_shop sekarang berarti "anggota toko" (pemilik atau admin). Semua policy lama otomatis ikut.
create or replace function public.owns_shop(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shop_members where shop_id = sid and user_id = auth.uid())
$$;
revoke all on function public.owns_shop(uuid) from public;
grant execute on function public.owns_shop(uuid) to authenticated;

create or replace function public.is_shop_owner(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shops where id = sid and owner_id = auth.uid())
$$;
revoke all on function public.is_shop_owner(uuid) from public;
grant execute on function public.is_shop_owner(uuid) to authenticated;

-- Toko baru: pemilik otomatis masuk daftar anggota. Batas 5 toko per akun (ubah angkanya kalau perlu).
create or replace function public.shops_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.shop_members (shop_id, user_id, role, email)
  values (new.id, new.owner_id, 'owner', lower(coalesce(auth.jwt() ->> 'email', '')))
  on conflict (shop_id, user_id) do nothing;
  return new;
end $$;
drop trigger if exists shops_member on public.shops;
create trigger shops_member after insert on public.shops
for each row execute function public.shops_after_insert();

create or replace function public.shops_before_insert() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.shops where owner_id = new.owner_id) >= 5 then
    raise exception 'Batas 5 toko per akun sudah tercapai.';
  end if;
  return new;
end $$;
drop trigger if exists shops_limit on public.shops;
create trigger shops_limit before insert on public.shops
for each row execute function public.shops_before_insert();

-- Terima undangan: dipanggil dashboard setiap login. Mengembalikan jumlah toko yang baru diterima.
create or replace function public.accept_invites() returns int
language plpgsql security definer set search_path = public as $$
declare mail text; n int := 0;
begin
  mail := lower(coalesce(auth.jwt() ->> 'email', ''));
  if auth.uid() is null or mail = '' then return 0; end if;
  with moved as (
    delete from public.shop_invites where email = mail returning shop_id, role
  )
  insert into public.shop_members (shop_id, user_id, role, email)
  select shop_id, auth.uid(), role, mail from moved
  on conflict (shop_id, user_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.accept_invites() from public;
grant execute on function public.accept_invites() to authenticated;

alter table public.shop_members enable row level security;
alter table public.shop_invites enable row level security;
revoke all on public.shop_members, public.shop_invites from anon;

-- Toko terlihat oleh semua anggota. Yang boleh mengubah pengaturan toko tetap pemilik.
drop policy if exists shops_select on public.shops;
create policy shops_select on public.shops for select to authenticated
  using (owner_id = auth.uid() or public.owns_shop(id));

drop policy if exists members_select on public.shop_members;
create policy members_select on public.shop_members for select to authenticated
  using (public.owns_shop(shop_id));
-- Pemilik mengeluarkan admin; admin boleh keluar sendiri. Baris pemilik tidak bisa dihapus.
drop policy if exists members_delete on public.shop_members;
create policy members_delete on public.shop_members for delete to authenticated
  using (role <> 'owner' and (public.is_shop_owner(shop_id) or user_id = auth.uid()));

drop policy if exists invites_all on public.shop_invites;
create policy invites_all on public.shop_invites for all to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

-- ============ 2. NOTIFIKASI ADMIN ============
alter table public.conversations add column if not exists notified_at timestamptz;

-- Pengaturan notifikasi per toko. RLS aktif TANPA policy: hanya server (service role) yang bisa membaca/menulis.
create table if not exists public.shop_notify (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  email_on boolean not null default true,
  tg_on boolean not null default true,
  tg_code text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  tg_chat_ids text[] not null default '{}' check (cardinality(tg_chat_ids) <= 10),
  updated_at timestamptz not null default now()
);
alter table public.shop_notify enable row level security;
revoke all on public.shop_notify from anon, authenticated;

-- ============ 3. REALTIME ============
-- Dashboard menerima perubahan percakapan dan pesan langsung (tetap dibatasi RLS).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
