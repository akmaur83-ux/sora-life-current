-- ============================================================
-- SORA LIFE — variant seed, remaining 250/750 ml juices (4 products, 8 rows)
-- Run once in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- WHY: migration 0007 seeded only 4 of the 8 juices that genuinely ship in
-- both 250 ml and 750 ml. The other four fell back to the bundled catalogue's
-- label-only pack sizes, which is the reported bug: on Sea Buckthorn Empower
-- Juice the selector offered "250 ml / 750 ml" but the price stayed at Rs.640
-- because those labels carry no price.
--
-- ------------------------------------------------------------
-- FULL JUICE-CATALOGUE AUDIT (all 25 juices, checked against the official
-- Biosash WooCommerce Store API — type + size attribute + price_range).
-- Scripts: scripts/audit-juice-catalog.mjs, scripts/fetch-biosash-official.mjs
--
--   type=variable (250 ml + 750 ml)  -> 8 products, the ONLY variant candidates
--     already seeded by 0007 : b82, b114, b122, b353
--     seeded by THIS file    : b115, b119, b1395, b117
--
--   type=simple (single size, NO variants exist officially) -> 17 products:
--     b139 Turmeric-Guggul(250ml)  b151 Bioradiance(250ml)  b1403 Biosip(250ml)
--     b157 Cardiosash(250ml)  b141 Detoxo(250ml)  b147 Digestosash(250ml)
--     b159 Empower-X(250ml)  b153 Femsash(250ml)  b145 Ferrosash(250ml)
--     b143 Giloysash(250ml)  b319 Jam(400g)  b155 Livosash(250ml)
--     b149 Memorysash(250ml)  b161 Stressaid(250ml)  b1280 Seabuck Tea(250g)
--     b1792 Wellsash Capsules(60)  + id=156 duplicate "Diabo" (no biosash_id,
--     no source_url — FLAGGED for manual dedupe, deliberately NOT seeded).
--   These are intentionally left alone: adding a 750 ml here would INVENT a
--   size the official source does not offer.
--
-- Net effect: after this migration, all 8 officially-variable juices carry
-- real 250/750 variants and no other juice is touched.
-- ------------------------------------------------------------
--
-- Same rules as 0007. Touches ONE table: public.product_variants.
-- products is only READ, to resolve the foreign key. ON CONFLICT (sku)
-- DO NOTHING, so a re-run inserts nothing and overwrites nothing.
--
-- ------------------------------------------------------------
-- PROVENANCE
--
-- sizes   Official Biosash WooCommerce Store API. All four report
--         type="variable" with exactly ["250 ml", "750 ml"]:
--           GET https://biosash.com/wp-json/wc/store/v1/products?slug=<slug>
--
-- mrp     Official price_range from the same endpoint. Every one of these
--         four returns min=Rs.800 (250 ml), max=Rs.2400 (750 ml). The min
--         matches this project's stored products.original_price exactly,
--         which is what confirms the min <-> 250 ml mapping.
--
-- price   SORA LIFE's own selling price, using EACH PRODUCT'S OWN
--         discount_percent — not a shared rate. Verified that
--         round(mrp * (1 - discount/100)) reproduces the CURRENTLY STORED
--         250 ml sale_price for all four:
--           b115  Diabo    800 x 80% = 640  (stored 640, 20% off)
--           b119  Empower  800 x 80% = 640  (stored 640, 20% off)
--           b117  Trimfit  800 x 85% = 680  (stored 680, 15% off)
--           b1395 Moringa  800 x 80% = 640  (stored 640, 20% off)
--         The 750 ml price is that verified rule applied to the official
--         750 ml MRP of Rs.2400.
--
--         NOTE: Empower's 750 ml is Rs.1920, NOT Rs.1968. Rs.1968 belongs to
--         Sea Buckthorn Juice (b82), which carries an 18% discount; Empower
--         carries 20%. Using 1968 here would contradict this product's own
--         configured discount.
--
-- stock   40 — this codebase's existing documented stand-in for "in stock"
--         (IN_STOCK_QTY in adminApi.js). Neither the official API nor this
--         project stores a stock COUNT; both express it as a boolean.
--
-- sku     Generated (products has no sku column; official sku is empty).
--         Deterministic: SL-<BIOSASH_ID>-<SIZE>.
--
-- gst_rate NULL = "use the configured default". No rate is invented.
-- ------------------------------------------------------------

insert into public.product_variants
  (product_id, label, size, unit, sku, mrp, sale_price, stock, volume_ml, is_active, sort_order)
select
  p.id, v.label, v.size, 'ml', v.sku, v.mrp, v.sale_price, v.stock, v.size, true, v.sort_order
from (values
  -- biosash_id, label,   size,          sku,               mrp,            sale_price,     stock, sort
  ('b115',  '250 ml', 250::numeric, 'SL-B115-250ML',  800::numeric,  640::numeric,  40, 1),
  ('b115',  '750 ml', 750::numeric, 'SL-B115-750ML',  2400::numeric, 1920::numeric, 40, 2),

  ('b119',  '250 ml', 250::numeric, 'SL-B119-250ML',  800::numeric,  640::numeric,  40, 1),
  ('b119',  '750 ml', 750::numeric, 'SL-B119-750ML',  2400::numeric, 1920::numeric, 40, 2),

  ('b117',  '250 ml', 250::numeric, 'SL-B117-250ML',  800::numeric,  680::numeric,  40, 1),
  ('b117',  '750 ml', 750::numeric, 'SL-B117-750ML',  2400::numeric, 2040::numeric, 40, 2),

  ('b1395', '250 ml', 250::numeric, 'SL-B1395-250ML', 800::numeric,  640::numeric,  40, 1),
  ('b1395', '750 ml', 750::numeric, 'SL-B1395-750ML', 2400::numeric, 1920::numeric, 40, 2)
) as v(biosash_id, label, size, sku, mrp, sale_price, stock, sort_order)
join public.products p
  on p.biosash_id = v.biosash_id
 and p.is_active = true
on conflict (sku) do nothing;

-- Verification: expect 16 variant rows in total (8 from 0007 + 8 from here).
select
  p.biosash_id,
  p.name                as product,
  p.original_price      as base_mrp_unchanged,
  p.sale_price          as base_price_unchanged,
  p.discount_percent    as product_discount_pct,
  pv.label,
  pv.sku,
  pv.mrp                as variant_mrp,
  pv.sale_price         as variant_price,
  pv.stock
from public.product_variants pv
join public.products p on p.id = pv.product_id
order by p.biosash_id, pv.sort_order;
