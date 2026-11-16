-- ============================================================
-- 0046 · Product page views, for "Popular this week" (owner, 2026-11-16: more
-- features, round 9). One row per product page a browser opened that day: the
-- store and the product's slug, nothing else — no user, no IP, no session. The
-- page writes at most one row per product per day per browser.
--   * product_views — anyone can add a row; only the admin reads the rows.
--   * popular_products() — the public aggregate only: products opened at least
--     5 times in the last N days, most first. Runs as its owner on purpose so the
--     rows stay private; it returns counts, nothing else.
-- Rollback: rollback/0046_product_views_down.sql
-- ============================================================
create table if not exists public.product_views (
  id         bigint generated always as identity primary key,
  store      text not null check (store in ('wellness', 'fashion', 'homeliving')),
  slug       text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,159}$'),
  created_at timestamptz not null default now()
);
create index if not exists product_views_recent_idx on public.product_views (created_at desc);
alter table public.product_views enable row level security;
drop policy if exists "product views anyone insert" on public.product_views;
create policy "product views anyone insert" on public.product_views for insert to anon, authenticated with check (true);
drop policy if exists "product views admin read" on public.product_views;
create policy "product views admin read" on public.product_views for select to authenticated using (public.is_sora_admin());
revoke all on public.product_views from anon, authenticated;
grant insert (store, slug) on public.product_views to anon, authenticated;
grant select on public.product_views to authenticated;

create or replace function public.popular_products(days integer default 7, max_rows integer default 16)
returns table (store text, slug text, n bigint)
language sql stable security definer set search_path = public as $$
  select v.store, v.slug, count(*) as n
  from public.product_views v
  where v.created_at > now() - make_interval(days => least(greatest(days, 1), 30))
  group by v.store, v.slug
  having count(*) >= 5
  order by n desc, v.slug
  limit least(greatest(max_rows, 1), 40);
$$;
revoke all on function public.popular_products(integer, integer) from public;
grant execute on function public.popular_products(integer, integer) to anon, authenticated;
