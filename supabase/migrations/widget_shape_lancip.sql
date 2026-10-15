-- Bentuk tombol widget: tambah pilihan 'lancip' (bulat dengan satu sudut runcing).
-- Jalankan di Supabase SQL Editor. Aman dijalankan berulang.
alter table public.shops drop constraint if exists shops_widget_shape_chk;
alter table public.shops add constraint shops_widget_shape_chk check (widget_shape in ('bulat','kotak','lancip'));
