-- ============================================================
-- SORA LIFE — 0041 PRODUCT REVIEWS: customers rate and review, an admin approves
-- Safe to re-run.
--
-- product_reviews   one review per signed-in customer per product: 1-5 stars,
--                   an optional title, the text, the name they choose to show.
--                   Every review starts 'pending'; only 'approved' ones are
--                   public. A customer reads and may delete their own; an admin
--                   (is_sora_admin) reads all and sets the status.
--
-- product_key is '<store>:<id>' (wellness:<products.id>, homeliving:<uuid>,
-- fashion:<uuid>) so one table serves every store without foreign keys
-- across two catalogue tables.
-- ============================================================
create table if not exists public.product_reviews (
  id           uuid primary key default gen_random_uuid(),
  product_key  text not null check (product_key ~ '^(wellness|homeliving|fashion):[A-Za-z0-9-]{1,64}$'),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  title        text check (title is null or char_length(title) <= 120),
  body         text not null check (char_length(body) between 10 and 2000),
  author_name  text not null check (char_length(author_name) between 1 and 60),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  unique (product_key, user_id)
);
create index if not exists product_reviews_public_idx on public.product_reviews (product_key, created_at desc) where status = 'approved';

alter table public.product_reviews enable row level security;

-- Public reads see approved reviews only, and never user_id: column grants below.
drop policy if exists "reviews public read approved" on public.product_reviews;
create policy "reviews public read approved" on public.product_reviews
  for select using (status = 'approved');

drop policy if exists "reviews own read" on public.product_reviews;
create policy "reviews own read" on public.product_reviews
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "reviews own insert pending" on public.product_reviews;
create policy "reviews own insert pending" on public.product_reviews
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and reviewed_at is null);

drop policy if exists "reviews own delete" on public.product_reviews;
create policy "reviews own delete" on public.product_reviews
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "reviews admin all" on public.product_reviews;
create policy "reviews admin all" on public.product_reviews
  for all to authenticated using (public.is_sora_admin()) with check (public.is_sora_admin());

revoke select on public.product_reviews from anon, authenticated;
grant select (id, product_key, rating, title, body, author_name, status, created_at) on public.product_reviews to anon, authenticated;
grant insert, delete on public.product_reviews to authenticated;
grant update on public.product_reviews to authenticated;
