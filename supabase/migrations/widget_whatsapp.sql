-- Tombol "Lanjut di WhatsApp" di jendela chat + hitungan kliknya di statistik widget.
-- Jalankan sekali di Supabase > SQL Editor (aman dijalankan ulang), setelah widget_statistik.sql.
-- Kalau belum dijalankan, tombol tidak muncul dan semuanya tetap berjalan seperti biasa.

alter table public.shops add column if not exists wa_button boolean not null default false;
alter table public.shops add column if not exists wa_number text not null default '';
alter table public.shops drop constraint if exists shops_wa_number_chk;
alter table public.shops add constraint shops_wa_number_chk check (char_length(wa_number) <= 20);

alter table public.widget_stats add column if not exists wa_clicks integer not null default 0;

-- kind: 'view' | 'open' | 'wa'. (Kolom orders dari versi awal tidak dipakai lagi.)
create or replace function public.widget_stat_add(sid uuid, kind text) returns void
language sql security definer set search_path = public as $$
  insert into public.widget_stats (shop_id, day, views, opens, wa_clicks)
  values (sid, (now() at time zone 'Asia/Jakarta')::date,
          (kind = 'view')::int, (kind = 'open')::int, (kind = 'wa')::int)
  on conflict (shop_id, day) do update set
    views     = public.widget_stats.views     + (kind = 'view')::int,
    opens     = public.widget_stats.opens     + (kind = 'open')::int,
    wa_clicks = public.widget_stats.wa_clicks + (kind = 'wa')::int;
$$;
revoke all on function public.widget_stat_add(uuid, text) from public, anon, authenticated;
grant execute on function public.widget_stat_add(uuid, text) to service_role;
