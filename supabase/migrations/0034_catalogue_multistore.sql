-- ============================================================
-- SORA LIFE — Shared multi-store catalogue. Migration 0034 (forward).
-- Apply in the SQL Editor of the project whose breadcrumb reads "sora life".
-- Do not run supabase db push. Rollback: rollback/0034_catalogue_multistore_down.sql
--
-- Requires 0033 (the fashion tables) and Postgres 15+ (security_invoker
-- views). Pre-flight:   select version();   -- must read PostgreSQL 15 or later
--
-- WHAT THIS DOES
--   fashion_categories → catalogue_categories   + store
--   fashion_products   → catalogue_products     + store, sku, hsn_code, gst_rate, net_content, stock
--   fashion_variants   → catalogue_variants     + store
--   NEW catalogue_product_media                  the ordered gallery (primary + detail shots)
--   NEW fashion_categories / fashion_products / fashion_variants  compatibility VIEWS over
--       the catalogue tables where store = 'fashion', so every reader that has not
--       been updated yet (the server's cart pricing path in particular) keeps working.
--
-- Every existing fashion row keeps its id and every column; it is stamped
-- store = 'fashion'. Nothing is deleted. Renames preserve data, indexes,
-- constraints, triggers and policies; the ones whose meaning changes (slug
-- uniqueness, the category guard, the policies' names) are dropped and
-- recreated below. Every step is idempotent.
--
-- RULES THE DATABASE NOW ENFORCES
--   store        NOT NULL, CHECK in ('fashion', 'grocery'), immutable after insert
--   slug         unique per store (products) / per store + parent (categories)
--   sku          unique per store on products; variant sku unique as before
--   a variant belongs to a product of the SAME store        (trigger)
--   a category's parent is a category of the SAME store     (trigger)
--   a product's category is a category of the SAME store    (trigger)
--   images[]     a cache of catalogue_product_media, primary first, then sort_order —
--                maintained by trigger; write the media table, not the array
--   colour       required for fashion variants, optional ('' by default) for other stores,
--                so a grocery pack size is a variant with a size and no colour
--
-- FIELD MAP for the brief's list: name ✓ brand ✓ description ✓ price = sale_price
-- (null → MRP is the price) ✓ mrp ✓ weight_or_volume = net_content (wellness naming,
-- products.net_content from 0025) ✓ sku ✓ hsn_code ✓ tax_rate = gst_rate (wellness
-- naming, product_variants.gst_rate; null → the configured default slab) ✓
-- stock (product level; a product WITH variants is stocked per variant) ✓
-- category = category_id ✓ status = is_active (+ is_demo) ✓
-- ============================================================

-- ------------------------------------------------------------
-- 0. Pre-flight: refuse to run against the wrong state
-- ------------------------------------------------------------
do $$
declare v_num integer := current_setting('server_version_num')::integer;
begin
  if v_num < 150000 then
    raise exception 'Migration 0034 needs PostgreSQL 15 or later (security_invoker views); this server is %', current_setting('server_version');
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'catalogue_products' and c.relkind = 'r') then
    raise notice 'catalogue_products already exists — 0034 was applied before; every step below is idempotent and no-ops where done.';
  elsif not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'fashion_products' and c.relkind = 'r') then
    raise exception 'Migration 0034 needs the fashion tables from 0033; public.fashion_products is not a table here.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Rename the three tables (only while they are still TABLES — after
--    this migration the old names are views), then give every constraint
--    and index that kept a fashion_ name its catalogue_ name.
-- ------------------------------------------------------------
do $$
declare r record;
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'fashion_categories' and c.relkind = 'r') then
    alter table public.fashion_categories rename to catalogue_categories;
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'fashion_products' and c.relkind = 'r') then
    alter table public.fashion_products rename to catalogue_products;
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'fashion_variants' and c.relkind = 'r') then
    alter table public.fashion_variants rename to catalogue_variants;
  end if;
  -- constraints (pkey, fkeys, checks, uniques) keep their data; only the name changes
  for r in
    select conrelid::regclass as tbl, conname from pg_constraint
    where connamespace = 'public'::regnamespace and conname like 'fashion\_%'
      and conrelid in ('public.catalogue_categories'::regclass, 'public.catalogue_products'::regclass, 'public.catalogue_variants'::regclass)
  loop
    execute format('alter table %s rename constraint %I to %I', r.tbl, r.conname, 'catalogue_' || substr(r.conname, 9));
  end loop;
  -- standalone indexes likewise
  for r in
    select indexname from pg_indexes
    where schemaname = 'public' and indexname like 'fashion\_%'
      and tablename in ('catalogue_categories', 'catalogue_products', 'catalogue_variants')
  loop
    execute format('alter index public.%I rename to %I', r.indexname, 'catalogue_' || substr(r.indexname, 9));
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. store — NOT NULL, closed list, immutable. Existing rows → 'fashion'.
--    The default is dropped once the backfill is done: every new row must
--    say which store it belongs to.
-- ------------------------------------------------------------
alter table public.catalogue_categories add column if not exists store text not null default 'fashion';
alter table public.catalogue_products   add column if not exists store text not null default 'fashion';
alter table public.catalogue_variants   add column if not exists store text not null default 'fashion';

alter table public.catalogue_categories alter column store drop default;
alter table public.catalogue_products   alter column store drop default;
alter table public.catalogue_variants   alter column store drop default;

alter table public.catalogue_categories drop constraint if exists catalogue_categories_store_chk;
alter table public.catalogue_categories add constraint catalogue_categories_store_chk check (store in ('fashion', 'grocery'));
alter table public.catalogue_products   drop constraint if exists catalogue_products_store_chk;
alter table public.catalogue_products   add constraint catalogue_products_store_chk check (store in ('fashion', 'grocery'));
alter table public.catalogue_variants   drop constraint if exists catalogue_variants_store_chk;
alter table public.catalogue_variants   add constraint catalogue_variants_store_chk check (store in ('fashion', 'grocery'));

create or replace function public.catalogue_store_immutable()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.store is distinct from old.store then
    raise exception '%: store is set when a row is created and cannot change (was %, now %)', tg_table_name, old.store, new.store
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_catalogue_categories_store on public.catalogue_categories;
create trigger trg_catalogue_categories_store before update of store on public.catalogue_categories
  for each row execute function public.catalogue_store_immutable();
drop trigger if exists trg_catalogue_products_store on public.catalogue_products;
create trigger trg_catalogue_products_store before update of store on public.catalogue_products
  for each row execute function public.catalogue_store_immutable();
drop trigger if exists trg_catalogue_variants_store on public.catalogue_variants;
create trigger trg_catalogue_variants_store before update of store on public.catalogue_variants
  for each row execute function public.catalogue_store_immutable();

-- ------------------------------------------------------------
-- 3. Same-store relationships. The three single-column foreign keys from
--    0033 stay exactly as they are (renamed in §1) — PostgREST embeds
--    catalogue_variants under catalogue_products through them, as it did
--    for the fashion tables. A trigger on each child refuses a parent from
--    another store.
-- ------------------------------------------------------------
create or replace function public.catalogue_variants_store_guard()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare v_store text;
begin
  select store into v_store from public.catalogue_products where id = new.product_id;
  if v_store is not null and v_store <> new.store then
    raise exception 'catalogue_variants: variant % is in the % store but its product is in the % store', coalesce(new.sku, new.size), new.store, v_store
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_catalogue_variants_store_guard on public.catalogue_variants;
create trigger trg_catalogue_variants_store_guard
  before insert or update of product_id, store on public.catalogue_variants
  for each row execute function public.catalogue_variants_store_guard();

create or replace function public.catalogue_categories_parent_guard()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare v_store text;
begin
  if new.parent_id is null then return new; end if;
  select store into v_store from public.catalogue_categories where id = new.parent_id;
  if v_store is not null and v_store <> new.store then
    raise exception 'catalogue_categories: "%" is in the % store but its parent is in the % store', new.name, new.store, v_store
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_catalogue_categories_parent_guard on public.catalogue_categories;
create trigger trg_catalogue_categories_parent_guard
  before insert or update of parent_id, store on public.catalogue_categories
  for each row execute function public.catalogue_categories_parent_guard();

create or replace function public.catalogue_products_category_guard()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare v_store text;
begin
  if new.category_id is null then return new; end if;
  select store into v_store from public.catalogue_categories where id = new.category_id;
  if v_store is not null and v_store <> new.store then
    raise exception 'catalogue_products: "%" is in the % store but its category is in the % store', new.name, new.store, v_store
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_catalogue_products_category_guard on public.catalogue_products;
create trigger trg_catalogue_products_category_guard
  before insert or update of category_id, store on public.catalogue_products
  for each row execute function public.catalogue_products_category_guard();

-- ------------------------------------------------------------
-- 4. Slug uniqueness per store; the required indexes
-- ------------------------------------------------------------
-- categories: slug unique per store + parent (sentinel for a root's NULL parent)
drop index if exists public.catalogue_categories_parent_slug_key;
create unique index if not exists catalogue_categories_store_parent_slug_key
  on public.catalogue_categories (store, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
drop index if exists public.catalogue_categories_parent_idx;
create index if not exists catalogue_categories_store_parent_idx
  on public.catalogue_categories (store, parent_id, sort_order);
drop index if exists public.catalogue_categories_slug_idx;
create index if not exists catalogue_categories_store_slug_idx
  on public.catalogue_categories (store, slug);

-- products: slug unique per store (was a global UNIQUE constraint)
alter table public.catalogue_products drop constraint if exists catalogue_products_slug_key;
create unique index if not exists catalogue_products_store_slug_key
  on public.catalogue_products (store, slug);
drop index if exists public.catalogue_products_category_idx;
create index if not exists catalogue_products_store_category_idx
  on public.catalogue_products (store, category_id, sort_order);
drop index if exists public.catalogue_products_active_idx;
create index if not exists catalogue_products_store_active_idx
  on public.catalogue_products (store, is_active, sort_order);
drop index if exists public.catalogue_products_brand_idx;
create index if not exists catalogue_products_store_brand_idx
  on public.catalogue_products (store, brand);

-- variants: unique (product_id, size, colour), unique sku and (product_id, sort_order) carry over unchanged.

-- ------------------------------------------------------------
-- 5. The fields the other stores need (fashion rows get the defaults)
-- ------------------------------------------------------------
alter table public.catalogue_products add column if not exists sku         text;
alter table public.catalogue_products add column if not exists hsn_code    text;
alter table public.catalogue_products add column if not exists gst_rate    numeric(5,2);
alter table public.catalogue_products add column if not exists net_content text;
alter table public.catalogue_products add column if not exists stock       integer not null default 0;

alter table public.catalogue_products drop constraint if exists catalogue_products_sku_chk;
alter table public.catalogue_products add constraint catalogue_products_sku_chk
  check (sku is null or sku ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$');
alter table public.catalogue_products drop constraint if exists catalogue_products_hsn_code_chk;
alter table public.catalogue_products add constraint catalogue_products_hsn_code_chk
  check (hsn_code is null or hsn_code ~ '^[0-9]{4}([0-9]{2}){0,2}$');   -- 4, 6 or 8 digits
alter table public.catalogue_products drop constraint if exists catalogue_products_gst_rate_chk;
alter table public.catalogue_products add constraint catalogue_products_gst_rate_chk
  check (gst_rate is null or (gst_rate >= 0 and gst_rate <= 100));
alter table public.catalogue_products drop constraint if exists catalogue_products_stock_chk;
alter table public.catalogue_products add constraint catalogue_products_stock_chk check (stock >= 0);

-- sku unique per store (NULLs are free)
create unique index if not exists catalogue_products_store_sku_key
  on public.catalogue_products (store, sku) where sku is not null;

-- variants: colour is required for fashion only. A grocery pack size
-- ("1 kg", "5 kg") is a variant with a size and an empty colour.
alter table public.catalogue_variants alter column colour set default '';
alter table public.catalogue_variants drop constraint if exists catalogue_variants_colour_check;
alter table public.catalogue_variants drop constraint if exists catalogue_variants_colour_chk;
alter table public.catalogue_variants add constraint catalogue_variants_colour_chk
  check (store <> 'fashion' or length(trim(colour)) > 0);

-- ------------------------------------------------------------
-- 6. The gallery: catalogue_product_media (mirrors product_media, 0016)
--    One row per image; exactly one primary per product; ordered by
--    sort_order. catalogue_products.images stays as a read cache the
--    trigger below rewrites, primary first, so every existing reader of
--    images[0] keeps working and never sees the two disagree.
--    Storage: the existing public "product-images" bucket, under
--    catalogue/<store>/<random>.<ext>  (storage_path), or a bundled /img/… path.
-- ------------------------------------------------------------
create table if not exists public.catalogue_product_media (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.catalogue_products(id) on delete cascade,
  storage_path text check (storage_path is null or (storage_path !~ '\.\.' and storage_path ~ '^[A-Za-z0-9/_.\-]+$')),
  public_url   text not null check (length(trim(public_url)) > 0),
  alt_text     text not null default '',
  sort_order   integer not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists catalogue_product_media_product_idx on public.catalogue_product_media (product_id, sort_order);
create unique index if not exists catalogue_product_media_one_primary_idx
  on public.catalogue_product_media (product_id) where is_primary;

-- BEFORE insert/update: stamp updated_at; making a row primary demotes its siblings first.
create or replace function public.catalogue_product_media_enforce_primary()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if new.is_primary then
    update public.catalogue_product_media
       set is_primary = false, updated_at = now()
     where product_id = new.product_id and id <> new.id and is_primary;
  end if;
  return new;
end $$;

drop trigger if exists trg_catalogue_product_media_primary on public.catalogue_product_media;
create trigger trg_catalogue_product_media_primary
  before insert or update on public.catalogue_product_media
  for each row execute function public.catalogue_product_media_enforce_primary();

-- AFTER delete of the primary: promote the next image so a product with any image has a primary.
create or replace function public.catalogue_product_media_promote_after_delete()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.is_primary then
    update public.catalogue_product_media set is_primary = true, updated_at = now()
     where id = (select id from public.catalogue_product_media where product_id = old.product_id
                 order by sort_order asc, created_at asc limit 1);
  end if;
  return old;
end $$;

drop trigger if exists trg_catalogue_product_media_promote on public.catalogue_product_media;
create trigger trg_catalogue_product_media_promote
  after delete on public.catalogue_product_media
  for each row execute function public.catalogue_product_media_promote_after_delete();

-- AFTER any change: rewrite the product's images[] cache (primary first, then sort_order).
create or replace function public.catalogue_product_media_sync_images()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.catalogue_products p
     set images = coalesce((
       select array_agg(m.public_url order by m.is_primary desc, m.sort_order asc, m.created_at asc)
       from public.catalogue_product_media m where m.product_id = v_product), '{}')
   where p.id = v_product;
  if tg_op = 'UPDATE' and new.product_id <> old.product_id then
    update public.catalogue_products p
       set images = coalesce((
         select array_agg(m.public_url order by m.is_primary desc, m.sort_order asc, m.created_at asc)
         from public.catalogue_product_media m where m.product_id = old.product_id), '{}')
     where p.id = old.product_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_catalogue_product_media_sync on public.catalogue_product_media;
create trigger trg_catalogue_product_media_sync
  after insert or update or delete on public.catalogue_product_media
  for each row execute function public.catalogue_product_media_sync_images();

alter table public.catalogue_product_media enable row level security;

drop policy if exists "catalogue_product_media public read" on public.catalogue_product_media;
create policy "catalogue_product_media public read"
  on public.catalogue_product_media for select using (true);

drop policy if exists "catalogue_product_media admin write" on public.catalogue_product_media;
create policy "catalogue_product_media admin write"
  on public.catalogue_product_media for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Backfill: every images[] entry becomes a media row (index 1 = primary),
-- for products that have no media rows yet. Re-running never duplicates.
insert into public.catalogue_product_media (product_id, storage_path, public_url, alt_text, sort_order, is_primary)
select p.id, null, u.url, coalesce(nullif(p.name, ''), 'Product image'), (u.ord - 1)::integer, u.ord = 1
from public.catalogue_products p
cross join lateral unnest(p.images) with ordinality as u(url, ord)
where u.url is not null and u.url <> ''
  and not exists (select 1 from public.catalogue_product_media m where m.product_id = p.id);

-- ------------------------------------------------------------
-- 7. Triggers and functions that name the table: the depth/cycle guard and
--    the updated_at stamps, re-created under the catalogue names.
-- ------------------------------------------------------------
create or replace function public.catalogue_categories_guard()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_depth integer := 1;
  v_height integer := 0;
  v_cursor uuid := new.parent_id;
  v_steps integer := 0;
begin
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'catalogue_categories: "%" cannot be its own ancestor', new.name using errcode = 'check_violation';
    end if;
    v_depth := v_depth + 1;
    v_steps := v_steps + 1;
    if v_steps > 3 then
      raise exception 'catalogue_categories: ancestry of "%" is deeper than 3 levels or circular', new.name using errcode = 'check_violation';
    end if;
    select parent_id into v_cursor from public.catalogue_categories where id = v_cursor;
  end loop;
  if tg_op = 'UPDATE' then
    with recursive below as (
      select id, 1 as lvl from public.catalogue_categories where parent_id = new.id
      union all
      select c.id, b.lvl + 1 from public.catalogue_categories c join below b on c.parent_id = b.id where b.lvl < 4
    )
    select coalesce(max(lvl), 0) into v_height from below;
  end if;
  if v_depth + v_height > 3 then
    raise exception 'catalogue_categories: "%" would sit at level % with % level(s) below it; the tree is 3 levels deep at most',
      new.name, v_depth, v_height using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_fashion_categories_guard on public.catalogue_categories;
drop trigger if exists trg_catalogue_categories_guard on public.catalogue_categories;
create trigger trg_catalogue_categories_guard
  before insert or update of parent_id, id on public.catalogue_categories
  for each row execute function public.catalogue_categories_guard();
drop function if exists public.fashion_categories_guard();

drop trigger if exists trg_fashion_categories_touch on public.catalogue_categories;
drop trigger if exists trg_catalogue_categories_touch on public.catalogue_categories;
create trigger trg_catalogue_categories_touch before update on public.catalogue_categories
  for each row execute function public.sora_touch_updated_at();
drop trigger if exists trg_fashion_products_touch on public.catalogue_products;
drop trigger if exists trg_catalogue_products_touch on public.catalogue_products;
create trigger trg_catalogue_products_touch before update on public.catalogue_products
  for each row execute function public.sora_touch_updated_at();
drop trigger if exists trg_fashion_variants_touch on public.catalogue_variants;
drop trigger if exists trg_catalogue_variants_touch on public.catalogue_variants;
create trigger trg_catalogue_variants_touch before update on public.catalogue_variants
  for each row execute function public.sora_touch_updated_at();

-- ------------------------------------------------------------
-- 8. RLS — the same predicates as 0033, under the catalogue names.
--    Public read of active rows and admin everything, for every store: the
--    read rule is identical for fashion and grocery, so no policy is
--    store-specific; a page chooses its store with a WHERE clause.
-- ------------------------------------------------------------
alter table public.catalogue_categories enable row level security;
alter table public.catalogue_products   enable row level security;
alter table public.catalogue_variants   enable row level security;

drop policy if exists "fashion_categories public read"   on public.catalogue_categories;
drop policy if exists "fashion_categories admin write"   on public.catalogue_categories;
drop policy if exists "catalogue_categories public read" on public.catalogue_categories;
drop policy if exists "catalogue_categories admin write" on public.catalogue_categories;
create policy "catalogue_categories public read" on public.catalogue_categories for select
  using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "catalogue_categories admin write" on public.catalogue_categories for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "fashion_products public read"   on public.catalogue_products;
drop policy if exists "fashion_products admin write"   on public.catalogue_products;
drop policy if exists "catalogue_products public read" on public.catalogue_products;
drop policy if exists "catalogue_products admin write" on public.catalogue_products;
create policy "catalogue_products public read" on public.catalogue_products for select
  using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "catalogue_products admin write" on public.catalogue_products for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "fashion_variants public read"   on public.catalogue_variants;
drop policy if exists "fashion_variants admin read"    on public.catalogue_variants;
drop policy if exists "fashion_variants admin write"   on public.catalogue_variants;
drop policy if exists "catalogue_variants public read" on public.catalogue_variants;
drop policy if exists "catalogue_variants admin read"  on public.catalogue_variants;
drop policy if exists "catalogue_variants admin write" on public.catalogue_variants;
create policy "catalogue_variants public read" on public.catalogue_variants for select using (is_active = true);
create policy "catalogue_variants admin read"  on public.catalogue_variants for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "catalogue_variants admin write" on public.catalogue_variants for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 9. Compatibility views under the OLD names — the fashion store as it was.
--    security_invoker: the caller's RLS on the base tables applies, exactly
--    as when these were tables. The server's cart pricing
--    (api/_lib/supabaseAdmin.js) and any client not yet on the catalogue
--    tables keep reading fashion_products / fashion_variants unchanged.
--    Column lists are the 0033 columns, in the 0033 order.
-- ------------------------------------------------------------
create or replace view public.fashion_categories with (security_invoker = true) as
  select id, parent_id, name, slug, tagline, image_url, sort_order, is_active, is_demo, created_at, updated_at
  from public.catalogue_categories where store = 'fashion';
create or replace view public.fashion_products with (security_invoker = true) as
  select id, name, slug, brand, description, category_id, mrp, sale_price, discount_percent, images, rating, review_count,
         is_active, is_new, is_bestseller, sort_order, is_demo, created_at, updated_at
  from public.catalogue_products where store = 'fashion';
create or replace view public.fashion_variants with (security_invoker = true) as
  select id, product_id, size, colour, colour_hex, sku, stock, price_override, is_active, sort_order, is_demo, created_at, updated_at
  from public.catalogue_variants where store = 'fashion';
grant select on public.fashion_categories, public.fashion_products, public.fashion_variants to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 10. Grocery seed — the ten categories and four products the /grocery
--     homepage ships with today (src/data/groceryHomepage.js), so Step 3 can
--     switch that file to a query. Demo rows (is_demo = true); product ids
--     are the fixed ids the data file already uses, so a grocery cart line
--     saved in a browser before the switch still resolves. hsn_code and
--     gst_rate are left NULL on purpose — fill them before selling.
-- ------------------------------------------------------------
insert into public.catalogue_categories (store, parent_id, name, slug, tagline, image_url, sort_order, is_demo)
select 'grocery', null, v.name, v.slug, '', v.image_url, v.sort_order, true
from (values
  ('Everyday Staples',  'everyday-staples',  '/img/grocery-circle-everyday-staples.webp',  1),
  ('Packaged Foods',    'packaged-foods',    '/img/grocery-circle-packaged-foods.webp',    2),
  ('Spices & Masalas',  'spices-masalas',    '/img/grocery-circle-spices-masalas.webp',    3),
  ('Cooking Oils',      'cooking-oils',      '/img/grocery-circle-cooking-oils.webp',      4),
  ('Dry Fruits & Nuts', 'dry-fruits-nuts',   '/img/grocery-circle-dry-fruits-nuts.webp',   5),
  ('Atta & Rice',       'atta-rice',         '/img/grocery-circle-atta-rice.webp',         6),
  ('Tea & Coffee',      'tea-coffee',        '/img/grocery-circle-tea-coffee.webp',        7),
  ('Pulses & Dal',      'pulses-dal',        '/img/grocery-circle-pulses-dal.webp',        8),
  ('Snacks & Munchies', 'snacks-munchies',   '/img/grocery-circle-snacks-munchies.webp',   9),
  ('Pantry Essentials', 'pantry-essentials', '/img/grocery-circle-pantry-essentials.webp', 10)
) as v(name, slug, image_url, sort_order)
on conflict do nothing;

insert into public.catalogue_products (id, store, name, slug, brand, description, category_id, mrp, sale_price, images, sku, net_content, stock, sort_order, is_demo)
select v.id::uuid, 'grocery', v.name, v.slug, 'SORA LIFE', v.description,
       (select c.id from public.catalogue_categories c where c.store = 'grocery' and c.parent_id is null and c.slug = v.cat),
       v.mrp, v.sale_price, array[v.image], v.sku, v.net_content, v.stock, v.sort_order, true
from (values
  ('00000000-0000-4000-8000-000000000701', 'Sona Masoori Rice', 'sona-masoori-rice-1kg', 'Light, fragrant medium-grain rice for everyday meals.',      'atta-rice',    99.00, 89.00,  '/img/grocery-product-sona-masoori-rice.webp', 'SL-GR-RICE-SM-1KG', '1 kg',  100, 1),
  ('00000000-0000-4000-8000-000000000702', 'Whole Wheat Atta',  'whole-wheat-atta-1kg', 'Stone-ground whole wheat flour for soft rotis.',              'atta-rice',    58.00, 52.00,  '/img/grocery-product-whole-wheat-atta.webp',  'SL-GR-ATTA-WW-1KG', '1 kg',  100, 2),
  ('00000000-0000-4000-8000-000000000703', 'Sunflower Oil',     'sunflower-oil-1l',     'Light refined sunflower oil for everyday cooking.',           'cooking-oils', 165.00, 142.00, '/img/grocery-product-sunflower-oil.webp',     'SL-GR-OIL-SF-1L',   '1 L',   100, 3),
  ('00000000-0000-4000-8000-000000000704', 'Masoor Dal',        'masoor-dal-500g',      'Split red lentils that cook quickly and take spice well.',    'pulses-dal',   89.00, 78.00,  '/img/grocery-product-masoor-dal.webp',        'SL-GR-DAL-MAS-500', '500 g', 100, 4)
) as v(id, name, slug, description, cat, mrp, sale_price, image, sku, net_content, stock, sort_order)
on conflict do nothing;

-- Media rows for the seeded grocery products (the backfill in §6 ran before the seed).
insert into public.catalogue_product_media (product_id, storage_path, public_url, alt_text, sort_order, is_primary)
select p.id, null, u.url, p.name, (u.ord - 1)::integer, u.ord = 1
from public.catalogue_products p
cross join lateral unnest(p.images) with ordinality as u(url, ord)
where p.store = 'grocery' and u.url is not null and u.url <> ''
  and not exists (select 1 from public.catalogue_product_media m where m.product_id = p.id);

-- PostgREST picks up the renamed relations and the views.
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
select 'catalogue_categories by store' as what, string_agg(store || '=' || n, ', ' order by store) as detail
  from (select store, count(*) as n from public.catalogue_categories group by store) s
union all select 'catalogue_products by store', string_agg(store || '=' || n, ', ' order by store)
  from (select store, count(*) as n from public.catalogue_products group by store) s
union all select 'catalogue_variants by store', string_agg(store || '=' || n, ', ' order by store)
  from (select store, count(*) as n from public.catalogue_variants group by store) s
union all select 'media rows / products with a primary', count(*)::text || ' / ' || (count(distinct product_id) filter (where is_primary))::text
  from public.catalogue_product_media
union all select 'products whose images[] disagrees with media (must be 0)', count(*)::text
  from public.catalogue_products p
  where p.images is distinct from coalesce((select array_agg(m.public_url order by m.is_primary desc, m.sort_order, m.created_at) from public.catalogue_product_media m where m.product_id = p.id), '{}')
union all select 'fashion_products VIEW rows', count(*)::text from public.fashion_products
union all select 'shirt M/Sage stock via the view', stock::text from public.fashion_variants where sku = 'AW-MLS-M-SAGE'
union all select 'constraints/indexes still named fashion_* (must be 0)',
  ((select count(*) from pg_constraint where connamespace = 'public'::regnamespace and conname like 'fashion\_%')
   + (select count(*) from pg_indexes where schemaname = 'public' and indexname like 'fashion\_%'))::text
union all select 'policies on catalogue_*', count(*)::text from pg_policies where schemaname = 'public' and tablename like 'catalogue_%'
union all select 'store checks', count(*)::text from pg_constraint where conname like 'catalogue\_%\_store\_chk';
