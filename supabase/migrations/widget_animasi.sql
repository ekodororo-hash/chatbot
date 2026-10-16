-- Jalankan sekali di Supabase SQL Editor sebelum deploy pilihan "Animasi saat muncul".
-- Aman dijalankan ulang (IF NOT EXISTS). Toko lama: animasi aktif jadi 'membal', nonaktif jadi 'tanpa'.

alter table shops add column if not exists widget_anim text;

update shops set widget_anim = case when widget_animate is false then 'tanpa' else 'membal' end
where widget_anim is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'widget_anim_valid') then
    alter table shops add constraint widget_anim_valid
      check (widget_anim is null or widget_anim in ('tanpa','membal','pudar','naik','geser','putar','goyang','denyut'));
  end if;
end $$;
