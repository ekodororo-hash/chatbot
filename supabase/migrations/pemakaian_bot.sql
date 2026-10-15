-- Pemakaian balasan bot dicatat terpisah dari pesan, supaya menghapus percakapan tidak mengembalikan kuota.
-- Yang dihitung HANYA balasan yang benar-benar dibuat AI. Pesan otomatis ("asisten nonaktif", "kuota habis") tidak memakai kuota.
-- Sebelumnya kuota dihitung dari jumlah pesan bot; pesan ikut terhapus bersama percakapan (ON DELETE CASCADE),
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

-- Dipanggil server (bot.js) sekali setiap AI selesai membalas.
create or replace function public.bot_usage_add(sid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.bot_usage (shop_id, day, n)
  values (sid, (now() at time zone 'Asia/Jakarta')::date, 1)
  on conflict (shop_id, day) do update set n = public.bot_usage.n + 1;
$$;
revoke all on function public.bot_usage_add(uuid) from public, anon, authenticated;
grant execute on function public.bot_usage_add(uuid) to service_role;

-- Versi awal memakai trigger yang menghitung SEMUA pesan bot (termasuk pesan otomatis). Kalau trigger itu ada:
-- kurangi dulu pesan otomatis yang masih tersimpan, lalu buang triggernya (hanya terjadi sekali).
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'messages_bot_usage' and not tgisinternal) then
    update public.bot_usage u set n = greatest(0, u.n - c.k)
    from (
      select shop_id, (created_at at time zone 'Asia/Jakarta')::date as d, count(*) as k
      from public.messages
      where role = 'bot' and (content like 'Maaf %, asisten otomatis sedang nonaktif.%' or content like 'Maaf %, kuota balasan otomatis %')
      group by 1, 2
    ) c
    where u.shop_id = c.shop_id and u.day = c.d;
    drop trigger messages_bot_usage on public.messages;
  end if;
end $$;
drop function if exists public.bot_usage_count();

-- Isi awal dari pesan bot yang masih ada (tanpa pesan otomatis). Pesan yang sudah terlanjur dihapus tidak bisa dipulihkan.
-- greatest() membuat menjalankan ulang aman (tidak mengurangi dan tidak menghitung ganda).
insert into public.bot_usage (shop_id, day, n)
select shop_id, (created_at at time zone 'Asia/Jakarta')::date, count(*)
from public.messages
where role = 'bot'
  and content not like 'Maaf %, asisten otomatis sedang nonaktif.%'
  and content not like 'Maaf %, kuota balasan otomatis %'
group by 1, 2
on conflict (shop_id, day) do update set n = greatest(public.bot_usage.n, excluded.n);
