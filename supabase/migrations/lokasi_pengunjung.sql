-- Lokasi perkiraan (kota, negara) dan IP pengunjung web, dicatat sekali saat percakapan dibuat (diambil di server dari header Vercel).
-- Kota dan negara: kolom di conversations, terlihat oleh semua anggota toko di dashboard.
-- IP: tabel terpisah conversation_visitors tanpa akses dari dashboard/browser. Hanya server yang bisa membaca, dan hanya
-- ditampilkan ke email admin layanan (ADMIN_EMAILS) lewat /api/admin/visitor.
-- Jalankan sekali di Supabase > SQL Editor. Untuk proyek baru, bagian ini juga sudah ada di schema.sql.
-- Sebelum dijalankan, semuanya tetap berfungsi: chat jalan normal, hanya info lokasi/IP belum tercatat dan belum tampil.
alter table public.conversations add column if not exists visitor_country text;
alter table public.conversations add column if not exists visitor_city text;

create table if not exists public.conversation_visitors (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  ip text not null,
  created_at timestamptz not null default now()
);
alter table public.conversation_visitors enable row level security;
revoke all on public.conversation_visitors from anon, authenticated;

-- Hanya relevan kalau versi lama migrasi ini (kolom conversations.visitor_ip) sempat dijalankan: pindahkan datanya, lalu hapus kolomnya
-- supaya IP tidak lagi terbaca oleh anggota toko.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conversations' and column_name = 'visitor_ip') then
    insert into public.conversation_visitors (conversation_id, ip)
      select id, visitor_ip from public.conversations where visitor_ip is not null on conflict do nothing;
    alter table public.conversations drop column visitor_ip;
  end if;
end $$;
