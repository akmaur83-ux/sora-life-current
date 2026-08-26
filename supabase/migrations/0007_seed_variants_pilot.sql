-- ============================================================
-- SORA LIFE — PILOT variant seed (4 products, 8 variants)
-- Run once in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- SCOPE: deliberately small. This is a pilot to exercise the end-to-end
-- variant pricing path (PDP -> cart -> checkout -> billing -> order) before
-- any bulk catalogue seed. It touches ONE table: public.product_variants.
--
-- NOTHING EXISTING IS MODIFIED:
--   * public.products is only READ (to resolve the foreign key). No product
--     price, stock or flag is changed.
--   * No other table is referenced.
--   * ON CONFLICT (sku) DO NOTHING -> a re-run inserts nothing and never
--     overwrites a price you have since edited.
--
-- FOREIGN KEY SAFETY: product_id is resolved by JOINing on products.biosash_id
-- rather than hard-coding a numeric id, so this stays correct even if the
-- products table is ever re-imported with different surrogate ids. Rows whose
-- product is missing or inactive simply insert nothing.
--
-- ------------------------------------------------------------
-- PROVENANCE OF EVERY VALUE
--
-- label / size / unit  Official Biosash WooCommerce Store API
--                      GET https://biosash.com/wp-json/wc/store/v1/products?slug=<slug>
--                      Each of these 4 products reports type="variable" with
--                      exactly two variations: "250 ml" and "750 ml".
--
-- mrp                  Official price_range from the same API endpoint:
--                      min_amount = the 250 ml price, max_amount = the 750 ml
--                      price. The min value matches this project's existing
--                      products.original_price for all 4 products exactly,
--                      which is what confirms the min <-> 250 ml mapping.
--                      Independently corroborated on the product page, which
--                      renders "Price range: Rs.800.00 through Rs.2,400.00"
--                      and an add-to-cart button reading Rs.800.00 for the
--                      250 ml variation (variation_id 2612).
--
-- sale_price           SORA LIFE's own selling price, NOT the official one.
--                      This project already discounts each product via
--                      products.discount_percent (18% / 15%). The formula
--                      round(mrp * (1 - discount_percent/100)) — the same one
--                      used by adminApi.js and api/_lib/pricing.js — was
--                      verified to reproduce the CURRENTLY STORED 250 ml
--                      sale_price for all four products exactly:
--                        b82  800 x 82% = 656  (stored 656)
--                        b122 850 x 82% = 697  (stored 697)
--                        b114 1800 x 82% = 1476 (stored 1476)
--                        b353 1585 x 85% = 1347 (stored 1347)
--                      The 750 ml sale_price below is that same verified rule
--                      applied to the officially-verified 750 ml MRP. The
--                      250 ml sale_price is simply the value already stored.
--
-- stock                The one value with no external quantity source. Both
--                      the official API (is_in_stock: true) and this project
--                      (products.stock = true) express stock as a BOOLEAN, not
--                      a count. 40 is this codebase's existing documented
--                      stand-in for "in stock" (IN_STOCK_QTY in adminApi.js),
--                      reused here rather than invented. Adjust freely.
--
-- sku                  Generated. products has no sku column and the official
--                      API returns an empty sku for these products, so there
--                      is no existing SKU to preserve. Deterministic pattern:
--                      SL-<BIOSASH_ID>-<SIZE>.
--
-- gst_rate             NULL on purpose = "use the configured default rate".
--                      No GST rate is invented anywhere in this system.
--
-- weight_grams,        Left NULL — not published by the official source.
-- barcode, image_url
-- ------------------------------------------------------------

insert into public.product_variants
  (product_id, label, size, unit, sku, mrp, sale_price, stock, volume_ml, is_active, sort_order)
select
  p.id,
  v.label,
  v.size,
  'ml',
  v.sku,
  v.mrp,
  v.sale_price,
  v.stock,
  v.size,          -- volume_ml is the same figure for a millilitre pack
  true,
  v.sort_order
from (values
  -- biosash_id, label,    size, sku,                mrp,    sale_price, stock, sort_order
  ('b82',  '250 ml', 250::numeric, 'SL-B82-250ML',  800::numeric,  656::numeric,  40, 1),
  ('b82',  '750 ml', 750::numeric, 'SL-B82-750ML',  2400::numeric, 1968::numeric, 40, 2),

  ('b122', '250 ml', 250::numeric, 'SL-B122-250ML', 850::numeric,  697::numeric,  40, 1),
  ('b122', '750 ml', 750::numeric, 'SL-B122-750ML', 2500::numeric, 2050::numeric, 40, 2),

  ('b114', '250 ml', 250::numeric, 'SL-B114-250ML', 1800::numeric, 1476::numeric, 40, 1),
  ('b114', '750 ml', 750::numeric, 'SL-B114-750ML', 4950::numeric, 4059::numeric, 40, 2),

  ('b353', '250 ml', 250::numeric, 'SL-B353-250ML', 1585::numeric, 1347::numeric, 40, 1),
  ('b353', '750 ml', 750::numeric, 'SL-B353-750ML', 4750::numeric, 4038::numeric, 40, 2)
) as v(biosash_id, label, size, sku, mrp, sale_price, stock, sort_order)
join public.products p
  on p.biosash_id = v.biosash_id
 and p.is_active = true
on conflict (sku) do nothing;

-- ------------------------------------------------------------
-- Verification: expect 8 rows, two per product, 750 ml priced above 250 ml.
-- ------------------------------------------------------------
select
  p.biosash_id,
  p.name                              as product,
  p.original_price                    as base_mrp_unchanged,
  p.sale_price                        as base_price_unchanged,
  pv.label,
  pv.sku,
  pv.mrp                              as variant_mrp,
  pv.sale_price                       as variant_price,
  round((1 - pv.sale_price / pv.mrp) * 100) as discount_pct,
  pv.stock,
  pv.is_active
from public.product_variants pv
join public.products p on p.id = pv.product_id
order by p.biosash_id, pv.sort_order;
