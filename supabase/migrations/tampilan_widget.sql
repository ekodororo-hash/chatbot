-- Tampilan widget chat (posisi, ikon, label, ukuran, bentuk, pesan pop-up).
-- Jalankan sekali di Supabase > SQL Editor SEBELUM deploy versi baru. Aman dijalankan ulang.
alter table public.shops add column if not exists widget_pos text not null default 'right';
alter table public.shops add column if not exists widget_icon text not null default '💬';
alter table public.shops add column if not exists widget_label text not null default '';
alter table public.shops add column if not exists widget_teaser text not null default '';
alter table public.shops add column if not exists widget_size text not null default 'sedang';
alter table public.shops add column if not exists widget_shape text not null default 'bulat';

alter table public.shops drop constraint if exists shops_widget_pos_chk;
alter table public.shops add constraint shops_widget_pos_chk check (widget_pos in ('right','left'));
alter table public.shops drop constraint if exists shops_widget_icon_chk;
alter table public.shops add constraint shops_widget_icon_chk check (char_length(widget_icon) between 1 and 16);
alter table public.shops drop constraint if exists shops_widget_label_chk;
alter table public.shops add constraint shops_widget_label_chk check (char_length(widget_label) <= 30);
alter table public.shops drop constraint if exists shops_widget_teaser_chk;
alter table public.shops add constraint shops_widget_teaser_chk check (char_length(widget_teaser) <= 100);
alter table public.shops drop constraint if exists shops_widget_size_chk;
alter table public.shops add constraint shops_widget_size_chk check (widget_size in ('kecil','sedang','besar'));
alter table public.shops drop constraint if exists shops_widget_shape_chk;
alter table public.shops add constraint shops_widget_shape_chk check (widget_shape in ('bulat','kotak'));
