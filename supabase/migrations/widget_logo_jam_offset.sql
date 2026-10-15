-- Logo avatar bot, jam operasional + estimasi balasan admin, dan jarak tombol widget dari tepi layar.
-- Jalankan sekali di Supabase > SQL Editor SEBELUM deploy versi baru. Aman dijalankan ulang.
alter table public.shops add column if not exists widget_logo text not null default '';
alter table public.shops add column if not exists widget_ox integer not null default 20;
alter table public.shops add column if not exists widget_oy integer not null default 20;
alter table public.shops add column if not exists hours_on boolean not null default false;
alter table public.shops add column if not exists hours_open text not null default '09:00';
alter table public.shops add column if not exists hours_close text not null default '17:00';
alter table public.shops add column if not exists hours_days text not null default '1,2,3,4,5,6';
alter table public.shops add column if not exists hours_tz text not null default 'Asia/Jakarta';
alter table public.shops add column if not exists reply_eta integer not null default 0;

alter table public.shops drop constraint if exists shops_widget_logo_chk;
alter table public.shops add constraint shops_widget_logo_chk check (widget_logo = '' or (widget_logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and char_length(widget_logo) <= 60000));
alter table public.shops drop constraint if exists shops_widget_ox_chk;
alter table public.shops add constraint shops_widget_ox_chk check (widget_ox between 0 and 200);
alter table public.shops drop constraint if exists shops_widget_oy_chk;
alter table public.shops add constraint shops_widget_oy_chk check (widget_oy between 0 and 200);
alter table public.shops drop constraint if exists shops_hours_open_chk;
alter table public.shops add constraint shops_hours_open_chk check (hours_open ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.shops drop constraint if exists shops_hours_close_chk;
alter table public.shops add constraint shops_hours_close_chk check (hours_close ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.shops drop constraint if exists shops_hours_days_chk;
alter table public.shops add constraint shops_hours_days_chk check (hours_days ~ '^[0-6](,[0-6]){0,6}$' or hours_days = '');
alter table public.shops drop constraint if exists shops_hours_tz_chk;
alter table public.shops add constraint shops_hours_tz_chk check (hours_tz in ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura'));
alter table public.shops drop constraint if exists shops_reply_eta_chk;
alter table public.shops add constraint shops_reply_eta_chk check (reply_eta between 0 and 1440);
