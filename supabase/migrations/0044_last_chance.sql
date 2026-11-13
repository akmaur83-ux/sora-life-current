-- ============================================================
-- 0044 · "Last chance" (owner, 2026-11-13: feature 30). Catalogue products with 1 to 3
-- pieces left across their active variants — but only for brands whose stock figures
-- are real: a brand where 80% or more of the variants carry the same stock number
-- (a placeholder, as an import sets) is left out, so nothing claims "only 2 left" on
-- a made-up count. security_invoker: it reads only what the visitor could read.
-- Rollback: drop view if exists public.catalogue_last_chance;
-- ============================================================
create or replace view public.catalogue_last_chance with (security_invoker = true) as
with v as (
  select p.id, p.brand, v.stock
  from public.catalogue_products p join public.catalogue_variants v on v.product_id = p.id
  where p.is_active and v.is_active and not coalesce(p.is_demo, false)
), brand_share as (
  select brand, max(n)::numeric / nullif(sum(n), 0) as top_share
  from (select brand, stock, count(*) n from v group by brand, stock) s
  group by brand
), totals as (
  select id, brand, sum(greatest(stock, 0)) as left_in_stock from v group by id, brand
)
select t.id as product_id, t.left_in_stock::integer as left_in_stock
from totals t join brand_share b on b.brand is not distinct from t.brand
where t.left_in_stock between 1 and 3 and b.top_share < 0.8;
grant select on public.catalogue_last_chance to anon, authenticated;
