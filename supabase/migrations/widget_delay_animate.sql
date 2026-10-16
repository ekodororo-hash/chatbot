-- Jalankan sekali di Supabase SQL Editor sebelum deploy perubahan "Tunda tampil" dan "Animasi saat muncul".
-- Aman dijalankan ulang (IF NOT EXISTS).

alter table shops add column if not exists widget_delay integer not null default 0;
alter table shops add column if not exists widget_animate boolean not null default true;

-- Postgres belum mendukung "ADD CONSTRAINT IF NOT EXISTS", jadi dicek manual.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'widget_delay_range') then
    alter table shops add constraint widget_delay_range check (widget_delay >= 0 and widget_delay <= 30);
  end if;
end $$;
