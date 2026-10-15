-- Pilihan cepat (tombol di bawah sapaan awal chat): bisa dimatikan dan teksnya bisa diedit pemilik, maksimal 5.
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Untuk proyek baru, isi yang sama sudah ada di bagian akhir schema.sql.
alter table public.shops add column if not exists quick_on boolean not null default true;
alter table public.shops add column if not exists quick_replies text[] not null default array['Tanya produk','Cek status pesanan','Bicara dengan admin'];
alter table public.shops drop constraint if exists shops_quick_replies_chk;
alter table public.shops add constraint shops_quick_replies_chk check (cardinality(quick_replies) <= 5);
