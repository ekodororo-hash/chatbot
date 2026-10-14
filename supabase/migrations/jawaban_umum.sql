-- Jawaban pengetahuan umum per toko (gratis untuk semua paket).
-- Jalankan sekali di Supabase > SQL Editor SEBELUM deploy versi baru. Aman dijalankan ulang.
alter table public.shops add column if not exists general_on boolean not null default false;
alter table public.shops add column if not exists general_topic text not null default '';

alter table public.shops drop constraint if exists shops_general_topic_chk;
alter table public.shops add constraint shops_general_topic_chk check (char_length(general_topic) <= 150);
