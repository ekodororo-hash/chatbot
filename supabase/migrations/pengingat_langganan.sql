-- Pengingat masa langganan habis: mencatat pengingat mana yang sudah terkirim per masa berlaku.
-- Jalankan sekali di Supabase > SQL Editor SEBELUM deploy versi baru. Aman dijalankan ulang.
alter table public.shop_billing add column if not exists reminded_stage int not null default 0;
alter table public.shop_billing add column if not exists reminded_for timestamptz;
