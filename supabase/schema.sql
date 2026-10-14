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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  role text not null check (role in ('customer','bot','admin')),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index on public.products (shop_id);
create index on public.faqs (shop_id);
create index on public.conversations (shop_id, updated_at desc);
create index on public.messages (conversation_id, id);
create index on public.messages (shop_id, role, created_at);

-- Perbarui waktu percakapan setiap ada pesan baru
create or replace function public.touch_conversation() returns trigger
language plpgsql as $$
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
