-- Statistik widget: 1 IP + 1 browser dihitung 1 kali per hari untuk tiap jenis (view, open, wa).
-- Jalankan sekali di Supabase > SQL Editor (aman dijalankan ulang), setelah widget_statistik.sql dan widget_whatsapp.sql.
-- Tabel widget_stat_seen hanya berisi hash anonim yang berganti tiap hari (bukan IP asli) dan dibersihkan otomatis.
-- Kalau belum dijalankan, statistik tetap tercatat seperti biasa (tanpa pembatasan).

alter table public.widget_stats add column if not exists wa_clicks integer not null default 0;

create table if not exists public.widget_stat_seen (
  shop_id uuid not null references public.shops(id) on delete cascade,
  day date not null,                       -- tanggal WIB
  kind text not null,                      -- 'view' | 'open' | 'wa'
  vid text not null,                       -- hash HMAC(hari + IP + User-Agent), dibuat server
  primary key (shop_id, day, kind, vid)
);
create index if not exists widget_stat_seen_day_idx on public.widget_stat_seen (day);

alter table public.widget_stat_seen enable row level security;
revoke all on public.widget_stat_seen from anon;
revoke all on public.widget_stat_seen from authenticated;

-- Versi 2 argumen diganti versi 3 argumen (vid boleh kosong = hitung tanpa dedup).
drop function if exists public.widget_stat_add(uuid, text);

create or replace function public.widget_stat_add(sid uuid, kind text, vid text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Jakarta')::date;
  n integer;
  fresh boolean := true;
begin
  if kind not in ('view', 'open', 'wa') then return; end if;
  if vid is not null then
    insert into public.widget_stat_seen (shop_id, day, kind, vid) values (sid, d, kind, vid)
    on conflict do nothing;
    get diagnostics n = row_count;
    fresh := n > 0;                        -- false = IP + browser ini sudah terhitung hari ini
  end if;
  if fresh then
    insert into public.widget_stats (shop_id, day, views, opens, wa_clicks)
    values (sid, d, (kind = 'view')::int, (kind = 'open')::int, (kind = 'wa')::int)
    on conflict (shop_id, day) do update set
      views     = public.widget_stats.views     + (kind = 'view')::int,
      opens     = public.widget_stats.opens     + (kind = 'open')::int,
      wa_clicks = public.widget_stats.wa_clicks + (kind = 'wa')::int;
  end if;
  -- Bersih-bersih sesekali (±1% panggilan): hash lebih dari 1 hari tidak dipakai lagi.
  if random() < 0.01 then
    delete from public.widget_stat_seen where day < d - 1;
  end if;
end;
$$;
revoke all on function public.widget_stat_add(uuid, text, text) from public, anon, authenticated;
grant execute on function public.widget_stat_add(uuid, text, text) to service_role;
