-- Izinkan pemilik toko menghapus percakapan miliknya (pesan ikut terhapus lewat ON DELETE CASCADE).
-- Jalankan sekali di Supabase > SQL Editor. Untuk proyek baru, baris ini juga sudah ada di schema.sql.
create policy conv_delete on public.conversations for delete to authenticated
  using (public.owns_shop(shop_id));
