-- Statistik widget per toko per hari: tombol dilihat, chat dibuka, pesanan masuk dari chat web.
-- Jalankan sekali di Supabase > SQL Editor (aman dijalankan ulang). Untuk proyek baru, ini sudah ada di schema.sql.
-- Kalau belum dijalankan, widget dan chat tetap jalan; hanya statistiknya yang kosong.

create table if not exists public.widget_stats (
  shop_id uuid not null references public.shops(id) on delete cascade,
  day date not null,                       -- tanggal WIB
  views integer not null default 0,
  opens integer not null default 0,
  orders integer not null default 0,
  primary key (shop_id, day)
);

alter table public.widget_stats enable row level security;
revoke all on public.widget_stats from anon;
revoke all on public.widget_stats from authenticated;
grant select on public.widget_stats to authenticated;
drop policy if exists widget_stats_select on public.widget_stats;
create policy widget_stats_select on public.widget_stats for select to authenticated using (public.owns_shop(shop_id));

-- Dipanggil server. kind: 'view' | 'open' | 'order'.
create or replace function public.widget_stat_add(sid uuid, kind text) returns void
language sql security definer set search_path = public as $$
  insert into public.widget_stats (shop_id, day, views, opens, orders)
  values (sid, (now() at time zone 'Asia/Jakarta')::date,
          (kind = 'view')::int, (kind = 'open')::int, (kind = 'order')::int)
  on conflict (shop_id, day) do update set
    views  = public.widget_stats.views  + (kind = 'view')::int,
    opens  = public.widget_stats.opens  + (kind = 'open')::int,
    orders = public.widget_stats.orders + (kind = 'order')::int;
$$;
revoke all on function public.widget_stat_add(uuid, text) from public, anon, authenticated;
grant execute on function public.widget_stat_add(uuid, text) to service_role;
