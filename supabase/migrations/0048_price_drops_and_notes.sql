-- ============================================================
-- 0048 · Price drops and enquiry notes (owner, 2026-11-20: more features, round 20)
--   * catalogue_price_drops — live products whose price today is below the highest
--     price recorded for them in the last 30 days (catalogue_price_history, 0043).
--     The cards say "Price dropped" only from this: nothing is shown until a price
--     really falls. A view with security_invoker: it reads only what the visitor could
--     read anyway (active products, the public price history).
--   * enquiries.notes — the admin's own notes on an enquiry (who called, what was
--     agreed). Admin only, like the rest of the row.
-- Rollback: rollback/0048_price_drops_and_notes_down.sql
-- ============================================================
create or replace view public.catalogue_price_drops with (security_invoker = true) as
select p.id as product_id, p.store, h.was_price, coalesce(p.sale_price, p.mrp) as now_price
from public.catalogue_products p
join (
  select product_id, max(price) as was_price
  from public.catalogue_price_history
  where recorded_on >= (now() at time zone 'Asia/Kolkata')::date - 30
  group by product_id
) h on h.product_id = p.id
where p.is_active and coalesce(p.sale_price, p.mrp) < h.was_price;
grant select on public.catalogue_price_drops to anon, authenticated;

alter table public.enquiries add column if not exists notes text check (notes is null or char_length(notes) <= 1000);
grant update (status, notes) on public.enquiries to authenticated;
