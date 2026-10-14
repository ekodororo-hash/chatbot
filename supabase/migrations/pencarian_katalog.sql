-- Pencarian produk dan FAQ untuk katalog besar (di atas 100 item).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Untuk proyek baru, isi yang sama sudah ada di bagian akhir schema.sql.

create extension if not exists pg_trgm;

create index if not exists products_name_trgm on public.products using gin (lower(name) gin_trgm_ops);
create index if not exists products_desc_trgm on public.products using gin (lower(description) gin_trgm_ops);
create index if not exists faqs_question_trgm on public.faqs using gin (lower(question) gin_trgm_ops);

-- Produk paling relevan untuk kata kunci pelanggan. Skor: kata muncul di nama (3), di deskripsi (1),
-- atau mirip nama (salah ketik kecil, 2). Hanya dipanggil dari server (service role).
create or replace function public.search_products(sid uuid, terms text[], n int default 40)
returns table (name text, price bigint, stock int, description text, score bigint)
language sql stable set search_path = public, extensions as $$
  select p.name, p.price, p.stock, p.description, s.score
  from public.products p
  cross join lateral (
    select coalesce(sum(
      case when lower(p.name) like '%' || t || '%' then 3
           when lower(p.description) like '%' || t || '%' then 1
           when word_similarity(t, lower(p.name)) >= 0.5 then 2
           else 0 end), 0) as score
    from unnest(terms) as t
  ) s
  where p.shop_id = sid and s.score > 0
  order by s.score desc, p.name
  limit least(greatest(n, 1), 100)
$$;
revoke all on function public.search_products(uuid, text[], int) from public, anon, authenticated;

create or replace function public.search_faqs(sid uuid, terms text[], n int default 20)
returns table (question text, answer text, score bigint)
language sql stable set search_path = public, extensions as $$
  select f.question, f.answer, s.score
  from public.faqs f
  cross join lateral (
    select coalesce(sum(
      case when lower(f.question) like '%' || t || '%' then 3
           when lower(f.answer) like '%' || t || '%' then 1
           when word_similarity(t, lower(f.question)) >= 0.5 then 2
           else 0 end), 0) as score
    from unnest(terms) as t
  ) s
  where f.shop_id = sid and s.score > 0
  order by s.score desc, f.question
  limit least(greatest(n, 1), 100)
$$;
revoke all on function public.search_faqs(uuid, text[], int) from public, anon, authenticated;
