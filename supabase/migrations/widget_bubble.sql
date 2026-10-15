-- Bentuk bubble pesan di jendela chat: bulat (bawaan), kotak, atau lancip (ekor runcing).
-- Jalankan sekali di Supabase > SQL Editor SEBELUM deploy versi baru. Aman dijalankan ulang.
alter table public.shops add column if not exists widget_bubble text not null default 'bulat';
alter table public.shops drop constraint if exists shops_widget_bubble_chk;
alter table public.shops add constraint shops_widget_bubble_chk check (widget_bubble in ('bulat','kotak','lancip'));
