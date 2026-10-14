-- Pengaturan bahasa balasan asisten per toko: 'id' = selalu Indonesia (bawaan), 'auto' = ikuti bahasa pelanggan.
-- Jalankan sekali di Supabase > SQL Editor SEBELUM deploy versi baru. Aman dijalankan ulang.
alter table public.shops add column if not exists reply_language text not null default 'id';

alter table public.shops drop constraint if exists shops_reply_language_chk;
alter table public.shops add constraint shops_reply_language_chk check (reply_language in ('id','auto'));
