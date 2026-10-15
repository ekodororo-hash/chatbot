-- Pemakaian balasan bot dicatat terpisah dari pesan, supaya menghapus percakapan tidak mengembalikan kuota.
-- Sebelumnya kuota harian/bulanan dihitung dari jumlah pesan bot; pesan ikut terhapus bersama percakapan (ON DELETE CASCADE),
-- jadi pemakaian bisa "kembali ke 0" setelah semua percakapan dihapus.
-- Jalankan sekali di Supabase > SQL Editor (aman dijalankan ulang). Untuk proyek baru, ini sudah ada di schema.sql.
-- Kalau belum dijalankan, aplikasi tetap jalan dan menghitung dari pesan seperti sebelumnya.

create table if not exists public.bot_usage (
  shop_id uuid not null references public.shops(id) on delete cascade,
  day date not null,                       -- tanggal WIB
  n integer not null default 0,
  primary key (shop_id, day)
);

alter table public.bot_usage enable row level security;
revoke all on public.bot_usage from anon;
revoke all on public.bot_usage from authenticated;
grant select on public.bot_usage to authenticated;
drop policy if exists bot_usage_select on public.bot_usage;
create policy bot_usage_select on public.bot_usage for select to authenticated using (public.owns_shop(shop_id));

create or replace function public.bot_usage_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'bot' then
    insert into public.bot_usage (shop_id, day, n)
    values (new.shop_id, (new.created_at at time zone 'Asia/Jakarta')::date, 1)
    on conflict (shop_id, day) do update set n = public.bot_usage.n + 1;
  end if;
  return null;
end $$;
revoke all on function public.bot_usage_count() from public, anon, authenticated;

drop trigger if exists messages_bot_usage on public.messages;
create trigger messages_bot_usage after insert on public.messages
for each row execute function public.bot_usage_count();

-- Isi awal dari pesan bot yang masih ada. Pesan yang sudah terlanjur dihapus tidak bisa dipulihkan.
-- greatest() membuat menjalankan ulang aman (tidak mengurangi dan tidak menghitung ganda).
insert into public.bot_usage (shop_id, day, n)
select shop_id, (created_at at time zone 'Asia/Jakarta')::date, count(*)
from public.messages where role = 'bot' group by 1, 2
on conflict (shop_id, day) do update set n = greatest(public.bot_usage.n, excluded.n);
