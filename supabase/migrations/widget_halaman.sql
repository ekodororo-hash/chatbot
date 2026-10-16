-- Aturan tampil widget per halaman: sembunyikan di checkout/pembayaran, plus daftar alamat halaman
-- yang disembunyikan ('hide') atau satu-satunya tempat widget tampil ('only').
-- Jalankan sekali di Supabase > SQL Editor SEBELUM deploy versi baru. Aman dijalankan ulang.
alter table public.shops add column if not exists widget_hide_checkout boolean not null default true;
alter table public.shops add column if not exists widget_paths_mode text not null default 'hide';
alter table public.shops add column if not exists widget_paths text not null default '';

alter table public.shops drop constraint if exists shops_widget_paths_mode_chk;
alter table public.shops add constraint shops_widget_paths_mode_chk check (widget_paths_mode in ('hide','only'));
alter table public.shops drop constraint if exists shops_widget_paths_chk;
alter table public.shops add constraint shops_widget_paths_chk check (char_length(widget_paths) <= 2100);
