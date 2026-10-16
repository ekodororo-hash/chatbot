-- Info toko: "Tentang toko" (deskripsi singkat, maks 500 karakter) dan "Catatan untuk AI" (preferensi gaya jawaban, maks 300 karakter).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Untuk proyek baru, isi yang sama sudah ada di bagian akhir schema.sql.
alter table public.shops add column if not exists about text not null default '' check (char_length(about) <= 500);
alter table public.shops add column if not exists ai_notes text not null default '' check (char_length(ai_notes) <= 300);
