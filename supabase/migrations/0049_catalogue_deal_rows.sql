-- ============================================================
-- 0049 · catalogue_deal_rows (owner, 2026-11-21: "speed slow lag rhi hai")
--   The winter band read 701 whole product rows (every picture, every variant) to show
--   five tiles: 805 KB, 1.2 s on the server, and the homepage's largest paint waited on
--   it. This view gives one small row per live, non-demo product: its first picture, its
--   category, its prices and whether anything of it is in stock (its active variants
--   when it has any, else its own stock) — the same rule as the band's.
--   security_invoker: it reads only what the visitor could read anyway.
-- Rollback: rollback/0049_catalogue_deal_rows_down.sql
-- ============================================================
create or replace view public.catalogue_deal_rows with (security_invoker = true) as
select p.id, p.store, p.slug, p.name, p.mrp, p.sale_price, p.sort_order,
       p.images[1] as image, c.slug as category_slug,
       case when exists (select 1 from public.catalogue_variants v where v.product_id = p.id and v.is_active is not false)
            then exists (select 1 from public.catalogue_variants v where v.product_id = p.id and v.is_active is not false and v.stock > 0)
            else coalesce(p.stock, 0) > 0 end as in_stock
from public.catalogue_products p
join public.catalogue_categories c on c.id = p.category_id
where p.is_active and not coalesce(p.is_demo, false) and p.images[1] is not null;
grant select on public.catalogue_deal_rows to anon, authenticated;
