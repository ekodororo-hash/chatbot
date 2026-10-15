-- Memperbaiki balasan admin di chat web: "permission denied for table conversations".
-- Penyebab: trigger touch_conversation mengubah kolom updated_at memakai hak si pemilik toko yang login,
-- padahal pemilik hanya boleh mengubah beberapa kolom. Dengan security definer, trigger jalan dengan hak
-- pemilik fungsi, sedangkan pemilik toko tetap tidak bisa mengubah kolom lain.
-- Aman dijalankan ulang. Jalankan sekali di Supabase SQL Editor.

create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end $$;
