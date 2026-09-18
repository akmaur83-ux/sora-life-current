-- ============================================================
-- SORA LIFE — Home & Living store. Migration 0035 (forward).
-- Apply in the SQL Editor of the project whose breadcrumb reads "sora life".
-- Do not run supabase db push. Rollback: rollback/0035_homeliving_store_down.sql
--
-- Requires 0034 (the shared catalogue tables). Idempotent.
--
--   1. store may now be 'homeliving' on catalogue_categories,
--      catalogue_products and catalogue_variants (the CHECK is widened;
--      nothing else about the column changes — still NOT NULL, still immutable).
--   2. Six categories for the store, is_demo = true, with their circle art.
--   3. Four placeholder products, is_demo = true, so /homeliving renders
--      until the real bedsheet data lands. Remove every placeholder in one
--      action:  delete from public.catalogue_products where store = 'homeliving' and is_demo;
--      (media and variants cascade). Categories are demo too — delete them
--      the same way when the real tree is decided.
--
-- Product ids are fixed (…0000000008xx) so tests, the SSR harness and any
-- cart line saved before the switch resolve the same rows. hsn_code and
-- gst_rate are NULL on purpose — fill them before selling.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Pre-flight
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'catalogue_products' and c.relkind = 'r') then
    raise exception 'Migration 0035 needs the catalogue tables from 0034; public.catalogue_products is not a table here.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'catalogue_products' and column_name = 'store') then
    raise exception 'Migration 0035 needs catalogue_products.store from 0034.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. The store list gains 'homeliving'
-- ------------------------------------------------------------
alter table public.catalogue_categories drop constraint if exists catalogue_categories_store_chk;
alter table public.catalogue_categories add constraint catalogue_categories_store_chk check (store in ('fashion', 'grocery', 'homeliving'));
alter table public.catalogue_products   drop constraint if exists catalogue_products_store_chk;
alter table public.catalogue_products   add constraint catalogue_products_store_chk check (store in ('fashion', 'grocery', 'homeliving'));
alter table public.catalogue_variants   drop constraint if exists catalogue_variants_store_chk;
alter table public.catalogue_variants   add constraint catalogue_variants_store_chk check (store in ('fashion', 'grocery', 'homeliving'));

-- ------------------------------------------------------------
-- 2. Six categories (the textile six; organisers, decor and care come later)
-- ------------------------------------------------------------
insert into public.catalogue_categories (store, parent_id, name, slug, tagline, image_url, sort_order, is_demo)
select 'homeliving', null, v.name, v.slug, v.tagline, v.image_url, v.sort_order, true
from (values
  ('Bedsheets',         'bedsheets',        'Soft cotton for every bed',   '/img/homeliving-circle-bedsheets.webp',        1),
  ('Curtains',          'curtains',         'Light, drape and privacy',    '/img/homeliving-circle-curtains.webp',         2),
  ('Cushion Covers',    'cushion-covers',   'Small changes, warmer rooms', '/img/homeliving-circle-cushion-covers.webp',   3),
  ('Quilts & Blankets', 'quilts-blankets',  'Layers for every season',     '/img/homeliving-circle-quilts-blankets.webp',  4),
  ('Towels',            'towels',           'Thick, thirsty and soft',     '/img/homeliving-circle-towels.webp',           5),
  ('Rugs & Mats',       'rugs-mats',        'Underfoot, everyday',         '/img/homeliving-circle-rugs-mats.webp',        6)
) as v(name, slug, tagline, image_url, sort_order)
on conflict do nothing;

-- ------------------------------------------------------------
-- 3. Four placeholder products (is_demo = true)
-- ------------------------------------------------------------
insert into public.catalogue_products (id, store, name, slug, brand, description, category_id, mrp, sale_price, images, sku, net_content, stock, sort_order, is_demo)
select v.id::uuid, 'homeliving', v.name, v.slug, 'SORA LIFE', v.description,
       (select c.id from public.catalogue_categories c where c.store = 'homeliving' and c.parent_id is null and c.slug = v.cat),
       v.mrp, v.sale_price, array[v.image], v.sku, v.net_content, v.stock, v.sort_order, true
from (values
  ('00000000-0000-4000-8000-000000000801', 'Botanical Bedsheet Set',   'botanical-bedsheet-set-king',  'A king bedsheet with two pillow covers in a soft botanical print on cotton.',      'bedsheets',       1899.00, 1499.00, '/img/homeliving-product-botanical-bedsheet-set.webp',  'SL-HL-BED-BOT-K',  'King · 1 bedsheet + 2 pillow covers', 40, 1),
  ('00000000-0000-4000-8000-000000000802', 'Leaf Cushion Cover Pair',  'leaf-cushion-cover-pair',      'Two 40 × 40 cm cushion covers in a leaf print on natural cotton.',                 'cushion-covers',  699.00,  599.00,  '/img/homeliving-product-leaf-cushion-cover-pair.webp', 'SL-HL-CUS-LEAF-2', 'Set of 2 · 40 × 40 cm',               60, 2),
  ('00000000-0000-4000-8000-000000000803', 'Cotton Quilt',             'cotton-quilt-single',          'A lightly filled, quilted cotton layer for a single bed.',                         'quilts-blankets', 2399.00, 1999.00, '/img/homeliving-product-cotton-quilt.webp',            'SL-HL-QLT-COT-S',  'Single · 150 × 220 cm',               25, 3),
  ('00000000-0000-4000-8000-000000000804', 'Bath Towel Set',           'bath-towel-set-pack-of-2',     'Two thick cotton bath towels, one ivory and one sage.',                            'towels',          949.00,  799.00,  '/img/homeliving-product-bath-towel-set.webp',          'SL-HL-TWL-BATH-2', 'Pack of 2 · 70 × 140 cm',             50, 4)
) as v(id, name, slug, description, cat, mrp, sale_price, image, sku, net_content, stock, sort_order)
on conflict do nothing;

-- Media rows for the placeholders (the 0034 sync trigger keeps images[] in step).
insert into public.catalogue_product_media (product_id, storage_path, public_url, alt_text, sort_order, is_primary)
select p.id, null, u.url, p.name, (u.ord - 1)::integer, u.ord = 1
from public.catalogue_products p
cross join lateral unnest(p.images) with ordinality as u(url, ord)
where p.store = 'homeliving' and u.url is not null and u.url <> ''
  and not exists (select 1 from public.catalogue_product_media m where m.product_id = p.id);

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
select 'store checks allow homeliving' as what, count(*)::text as detail
  from pg_constraint where conname like 'catalogue\_%\_store\_chk' and pg_get_constraintdef(oid) like '%homeliving%'
union all select 'homeliving categories', count(*)::text from public.catalogue_categories where store = 'homeliving'
union all select 'homeliving products (demo)', count(*)::text from public.catalogue_products where store = 'homeliving' and is_demo
union all select 'homeliving media rows', count(*)::text from public.catalogue_product_media m join public.catalogue_products p on p.id = m.product_id where p.store = 'homeliving'
union all select 'products without a category (must be 0)', count(*)::text from public.catalogue_products where store = 'homeliving' and category_id is null
union all select 'fashion products (unchanged)', count(*)::text from public.catalogue_products where store = 'fashion'
union all select 'grocery products (unchanged)', count(*)::text from public.catalogue_products where store = 'grocery';
