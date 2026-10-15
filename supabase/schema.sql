-- Jalankan sekali di Supabase: SQL Editor > New query > tempel > Run.
create extension if not exists pgcrypto;

-- ============ TABEL ============
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,30}$'),
  name text not null check (char_length(name) between 1 and 100),
  hours text not null default '' check (char_length(hours) <= 200),
  address text not null default '' check (char_length(address) <= 500),
  shipping text not null default '' check (char_length(shipping) <= 1000),
  payment text not null default '' check (char_length(payment) <= 500),
  bot_name text not null default 'Asisten Toko' check (char_length(bot_name) between 1 and 60),
  tone text not null default 'ramah' check (tone in ('ramah','santai','formal')),
  greeting text not null default 'Halo {k}, ada yang bisa dibantu?' check (char_length(greeting) <= 300),
  fallback text not null default 'Maaf {k}, saya belum punya jawabannya. Mau saya sambungkan ke admin?' check (char_length(fallback) <= 300),
  accent text not null default '#0b7a75' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  bot_on boolean not null default true,
  general_on boolean not null default false,
  general_topic text not null default '' check (char_length(general_topic) <= 150),
  reply_language text not null default 'id' check (reply_language in ('id','auto')),
  daily_limit int not null default 50 check (daily_limit between 1 and 5000),
  allowed_domains text[] not null default '{}' check (cardinality(allowed_domains) <= 20),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  price bigint not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  description text not null default '' check (char_length(description) <= 300),
  created_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 200),
  answer text not null check (char_length(answer) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  visitor_token uuid not null default gen_random_uuid(),
  customer_name text not null default 'Pengunjung',
  status text not null default 'bot' check (status in ('bot','human','selesai')),
  flag text check (flag in ('Pesanan')),
  unanswered boolean not null default false,
  last_question text,
  channel text not null default 'web' check (channel in ('web','telegram','whatsapp')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  role text not null check (role in ('customer','bot','admin')),
  content text not null check (char_length(content) between 1 and 2000),
  external_id text,
  created_at timestamptz not null default now()
);

create index on public.products (shop_id);
create index on public.faqs (shop_id);
create index on public.conversations (shop_id, updated_at desc);
create index on public.messages (conversation_id, id);
create index on public.messages (shop_id, role, created_at);
create index conversations_channel_ext on public.conversations (shop_id, channel, external_id, created_at desc) where external_id is not null;
create unique index messages_shop_external on public.messages (shop_id, external_id) where external_id is not null;

-- Perbarui waktu percakapan setiap ada pesan baru
-- security definer: pemilik hanya punya izin ubah kolom tertentu (lihat grant di bawah), jadi trigger ini harus jalan
-- dengan hak pemilik fungsi. Tanpa ini, balasan admin dari dashboard gagal: "permission denied for table conversations".
create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end $$;
create trigger messages_touch after insert on public.messages
for each row execute function public.touch_conversation();

-- ============ KEAMANAN (Row Level Security) ============
-- Pelanggan TIDAK pernah mengakses database langsung. Semua lewat server (api/chat.js)
-- dengan service role. Yang boleh akses langsung dari browser hanya pemilik toko yang login.
create or replace function public.owns_shop(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shops where id = sid and owner_id = auth.uid())
$$;
revoke all on function public.owns_shop(uuid) from public;
grant execute on function public.owns_shop(uuid) to authenticated;

alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.faqs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

revoke all on public.shops, public.products, public.faqs, public.conversations, public.messages from anon;

create policy shops_select on public.shops for select to authenticated using (owner_id = auth.uid());
create policy shops_insert on public.shops for insert to authenticated with check (owner_id = auth.uid());
create policy shops_update on public.shops for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy products_all on public.products for all to authenticated
  using (public.owns_shop(shop_id)) with check (public.owns_shop(shop_id));
create policy faqs_all on public.faqs for all to authenticated
  using (public.owns_shop(shop_id)) with check (public.owns_shop(shop_id));

create policy conv_select on public.conversations for select to authenticated using (public.owns_shop(shop_id));
create policy conv_update on public.conversations for update to authenticated
  using (public.owns_shop(shop_id)) with check (public.owns_shop(shop_id));
create policy conv_delete on public.conversations for delete to authenticated
  using (public.owns_shop(shop_id));
-- Pemilik hanya boleh mengubah kolom ini (bukan token pengunjung atau shop_id)
revoke update on public.conversations from authenticated;
grant update (status, flag, unanswered, last_question, customer_name) on public.conversations to authenticated;

create policy msg_select on public.messages for select to authenticated using (public.owns_shop(shop_id));
create policy msg_insert_admin on public.messages for insert to authenticated
  with check (
    public.owns_shop(shop_id) and role = 'admin'
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.shop_id = messages.shop_id)
  );

-- Kunci akses Telegram/WhatsApp per toko. RLS aktif TANPA policy: hanya server (service role) yang bisa membaca/menulis.
create table public.shop_channels (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  telegram_token text,
  telegram_secret text,
  telegram_username text,
  wa_phone_id text,
  wa_number text,
  wa_token text,
  wa_app_secret text,
  wa_verify_token text,
  updated_at timestamptz not null default now()
);
alter table public.shop_channels enable row level security;
revoke all on public.shop_channels from anon, authenticated;


-- =====================================================================
-- BAGIAN TAMBAHAN: banyak toko, tim admin, notifikasi, realtime.
-- Sama dengan supabase/migrations/banyak_toko_tim_notifikasi.sql.
-- =====================================================================
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

-- =====================================================================
-- BAGIAN TAMBAHAN: pencarian katalog besar dan langganan berbayar.
-- Sama dengan supabase/migrations/pencarian_katalog.sql dan langganan.sql (tanpa pemberian paket ke toko lama).
-- =====================================================================
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
create index if not exists payments_shop_idx on public.payments (shop_id, created_at desc);

alter table public.shop_billing enable row level security;
alter table public.payments enable row level security;
revoke all on public.shop_billing, public.payments from anon, authenticated;



create extension if not exists pg_trgm;

create index if not exists products_name_trgm on public.products using gin (lower(name) gin_trgm_ops);
create index if not exists products_desc_trgm on public.products using gin (lower(description) gin_trgm_ops);
create index if not exists faqs_question_trgm on public.faqs using gin (lower(question) gin_trgm_ops);

-- Produk paling relevan untuk kata kunci pelanggan. Skor: kata muncul di nama (3), di deskripsi (1),
-- atau mirip nama (salah ketik kecil, 2). Hanya dipanggil dari server (service role).
create or replace function public.search_products(sid uuid, terms text[], n int default 40)
returns table (name text, price bigint, stock int, description text, score bigint)
language sql stable set search_path = public, extensions as $$
  select p.name, p.price, p.stock, p.description, s.score
  from public.products p
  cross join lateral (
    select coalesce(sum(
      case when lower(p.name) like '%' || t || '%' then 3
           when lower(p.description) like '%' || t || '%' then 1
           when word_similarity(t, lower(p.name)) >= 0.5 then 2
           else 0 end), 0) as score
    from unnest(terms) as t
  ) s
  where p.shop_id = sid and s.score > 0
  order by s.score desc, p.name
  limit least(greatest(n, 1), 100)
$$;
revoke all on function public.search_products(uuid, text[], int) from public, anon, authenticated;

create or replace function public.search_faqs(sid uuid, terms text[], n int default 20)
returns table (question text, answer text, score bigint)
language sql stable set search_path = public, extensions as $$
  select f.question, f.answer, s.score
  from public.faqs f
  cross join lateral (
    select coalesce(sum(
      case when lower(f.question) like '%' || t || '%' then 3
           when lower(f.answer) like '%' || t || '%' then 1
           when word_similarity(t, lower(f.question)) >= 0.5 then 2
           else 0 end), 0) as score
    from unnest(terms) as t
  ) s
  where f.shop_id = sid and s.score > 0
  order by s.score desc, f.question
  limit least(greatest(n, 1), 100)
$$;
revoke all on function public.search_faqs(uuid, text[], int) from public, anon, authenticated;

-- Pengaturan layanan (key pembayaran dari halaman admin). Hanya server; RLS tanpa policy.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- Pengingat masa langganan habis (sama dengan supabase/migrations/pengingat_langganan.sql).
alter table public.shop_billing add column if not exists reminded_stage int not null default 0;
alter table public.shop_billing add column if not exists reminded_for timestamptz;


-- =====================================================================
-- BAGIAN TAMBAHAN: status pesanan dan notifikasi kuota.
-- Sama dengan supabase/migrations/dashboard_pesanan_kuota.sql.
-- =====================================================================
alter table public.conversations add column if not exists order_status text
  check (order_status in ('baru','diproses','selesai','batal'));
grant update (order_status) on public.conversations to authenticated;
create index if not exists conversations_order_idx on public.conversations (shop_id, order_status) where order_status is not null;
create index if not exists conversations_unanswered_idx on public.conversations (shop_id, updated_at desc) where unanswered;
alter table public.shop_notify add column if not exists quota_alert_month text;
alter table public.shop_notify add column if not exists quota_alert_stage int not null default 0;


-- =====================================================================
-- BAGIAN TAMBAHAN: rating percakapan dan penangkapan kontak (lead).
-- Sama dengan supabase/migrations/rating_dan_kontak.sql.
-- =====================================================================
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

-- ============ PEMAKAIAN BALASAN BOT (kuota tidak kembali saat percakapan dihapus) ============

create table if not exists public.bot_usage (
  shop_id uuid not null references public.shops(id) on delete cascade,
  day date not null,                       -- tanggal WIB
  n integer not null default 0,
  primary key (shop_id, day)
);

alter table public.bot_usage enable row level security;
revoke all on public.bot_usage from anon;
revoke all on public.bot_usage from authenticated;
grant select on public.bot_usage to authenticated;
drop policy if exists bot_usage_select on public.bot_usage;
create policy bot_usage_select on public.bot_usage for select to authenticated using (public.owns_shop(shop_id));

-- Dipanggil server (bot.js) sekali setiap AI selesai membalas.
create or replace function public.bot_usage_add(sid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.bot_usage (shop_id, day, n)
  values (sid, (now() at time zone 'Asia/Jakarta')::date, 1)
  on conflict (shop_id, day) do update set n = public.bot_usage.n + 1;
$$;
revoke all on function public.bot_usage_add(uuid) from public, anon, authenticated;
grant execute on function public.bot_usage_add(uuid) to service_role;

-- Versi awal memakai trigger yang menghitung SEMUA pesan bot (termasuk pesan otomatis). Kalau trigger itu ada:
-- kurangi dulu pesan otomatis yang masih tersimpan, lalu buang triggernya (hanya terjadi sekali).
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'messages_bot_usage' and not tgisinternal) then
    update public.bot_usage u set n = greatest(0, u.n - c.k)
    from (
      select shop_id, (created_at at time zone 'Asia/Jakarta')::date as d, count(*) as k
      from public.messages
      where role = 'bot' and (content like 'Maaf %, asisten otomatis sedang nonaktif.%' or content like 'Maaf %, kuota balasan otomatis %')
      group by 1, 2
    ) c
    where u.shop_id = c.shop_id and u.day = c.d;
    drop trigger messages_bot_usage on public.messages;
  end if;
end $$;
drop function if exists public.bot_usage_count();

-- Isi awal dari pesan bot yang masih ada (tanpa pesan otomatis). Pesan yang sudah terlanjur dihapus tidak bisa dipulihkan.
-- greatest() membuat menjalankan ulang aman (tidak mengurangi dan tidak menghitung ganda).
insert into public.bot_usage (shop_id, day, n)
select shop_id, (created_at at time zone 'Asia/Jakarta')::date, count(*)
from public.messages
where role = 'bot'
  and content not like 'Maaf %, asisten otomatis sedang nonaktif.%'
  and content not like 'Maaf %, kuota balasan otomatis %'
group by 1, 2
on conflict (shop_id, day) do update set n = greatest(public.bot_usage.n, excluded.n);

-- ============================================================
-- BAGIAN TAMBAHAN: percakapan ditutup oleh pelanggan.
-- Sama dengan supabase/migrations/ditutup_pelanggan.sql.
-- ============================================================
alter table public.conversations add column if not exists closed_by_customer boolean not null default false;
grant update (closed_by_customer) on public.conversations to authenticated;
