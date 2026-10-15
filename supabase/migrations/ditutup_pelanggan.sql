-- Pelanggan bisa mengakhiri percakapan sendiri (tombol "Akhiri percakapan" di chat). Kolom ini menandai bahwa status "selesai"
-- berasal dari pelanggan, supaya dashboard menampilkan "Ditutup pelanggan" dan pemilik toko tidak perlu menebak.
-- Jalankan sekali di Supabase > SQL Editor. Untuk proyek baru, bagian ini juga sudah ada di schema.sql.
-- Sebelum dijalankan, semuanya tetap berfungsi: percakapan hanya tampil "Selesai" tanpa keterangan siapa yang menutup.
alter table public.conversations add column if not exists closed_by_customer boolean not null default false;
grant update (closed_by_customer) on public.conversations to authenticated;
