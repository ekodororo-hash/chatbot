-- Dashboard pemilik: status pesanan dan notifikasi kuota.
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Untuk proyek baru, isi yang sama sudah ada di bagian akhir schema.sql.

-- ============ 1. STATUS PESANAN ============
-- Percakapan yang bot tandai "Pesanan" kini punya status: baru, diproses, selesai, batal.
alter table public.conversations add column if not exists order_status text
  check (order_status in ('baru','diproses','selesai','batal'));

-- Pesanan lama (sebelum fitur ini): yang aktif dalam 14 hari terakhir dianggap "baru" supaya tidak terlewat,
-- sisanya dianggap "selesai" supaya lencana di menu tidak penuh oleh pesanan lama. Ubah kalau perlu.
update public.conversations set order_status = case when updated_at > now() - interval '14 days' then 'baru' else 'selesai' end
where flag = 'Pesanan' and order_status is null;

-- Pemilik dan admin toko boleh mengubah status pesanan (RLS conv_update tetap berlaku).
grant update (order_status) on public.conversations to authenticated;

create index if not exists conversations_order_idx on public.conversations (shop_id, order_status) where order_status is not null;
create index if not exists conversations_unanswered_idx on public.conversations (shop_id, updated_at desc) where unanswered;

-- ============ 2. NOTIFIKASI KUOTA ============
-- Catatan bulan dan tahap terakhir notifikasi kuota, supaya tiap tahap hanya dikirim sekali per bulan.
-- Tahap 1 = kuota terpakai 80%, tahap 2 = kuota habis.
alter table public.shop_notify add column if not exists quota_alert_month text;
alter table public.shop_notify add column if not exists quota_alert_stage int not null default 0;
