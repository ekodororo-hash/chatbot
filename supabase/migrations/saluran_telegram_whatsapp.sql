-- Dukungan Telegram dan WhatsApp. Jalankan sekali di Supabase > SQL Editor.
-- Untuk proyek baru, isi yang sama sudah ada di schema.sql.

alter table public.conversations
  add column if not exists channel text not null default 'web' check (channel in ('web','telegram','whatsapp')),
  add column if not exists external_id text;   -- chat id Telegram / nomor WhatsApp pelanggan
create index if not exists conversations_channel_ext
  on public.conversations (shop_id, channel, external_id, created_at desc) where external_id is not null;

-- ID pesan dari Telegram/WhatsApp, supaya pesan yang dikirim ulang (retry webhook) tidak diproses dua kali.
alter table public.messages add column if not exists external_id text;
create unique index if not exists messages_shop_external
  on public.messages (shop_id, external_id) where external_id is not null;

-- Kunci akses saluran per toko. RLS aktif TANPA policy: hanya server (service role) yang bisa membaca/menulis.
create table if not exists public.shop_channels (
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
