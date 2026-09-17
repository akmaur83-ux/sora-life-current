-- ============================================================
-- SORA LIFE — Shared multi-store catalogue. Migration 0034 ROLLBACK.
-- Restores the 0033 fashion tables exactly: names, columns, constraints,
-- indexes, triggers, policies. Apply in the SQL Editor ("sora life").
--
-- DATA: every fashion row survives with its id and every 0033 column.
-- Rows of any OTHER store (grocery) have no table to go back to and are
-- DELETED, with their variants and media. The gallery table is dropped;
-- its content is already mirrored in images[] (the sync trigger kept the
-- two identical), so no fashion image is lost. The extra product columns
-- (sku, hsn_code, gst_rate, net_content, stock) are dropped with whatever
-- was typed into them.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'catalogue_products' and c.relkind = 'r') then
    raise exception 'Nothing to roll back: public.catalogue_products is not a table here.';
  end if;
  raise notice 'Rolling back 0034: % non-fashion product(s) and % non-fashion categor(ies) will be deleted.',
    (select count(*) from public.catalogue_products where store <> 'fashion'),
    (select count(*) from public.catalogue_categories where store <> 'fashion');
end $$;

-- 1. the compatibility views go first — the table names are needed back
drop view if exists public.fashion_variants;
drop view if exists public.fashion_products;
drop view if exists public.fashion_categories;

-- 2. rows that have no home in the fashion tables (variants and media cascade)
delete from public.catalogue_variants   where store <> 'fashion';
delete from public.catalogue_products   where store <> 'fashion';
delete from public.catalogue_categories where store <> 'fashion';

-- 3. the gallery: images[] already holds every URL in gallery order; drop the table and its plumbing
drop trigger if exists trg_catalogue_product_media_sync    on public.catalogue_product_media;
drop trigger if exists trg_catalogue_product_media_promote on public.catalogue_product_media;
drop trigger if exists trg_catalogue_product_media_primary on public.catalogue_product_media;
drop table if exists public.catalogue_product_media;
drop function if exists public.catalogue_product_media_sync_images();
drop function if exists public.catalogue_product_media_promote_after_delete();
drop function if exists public.catalogue_product_media_enforce_primary();

-- 4. store guards and the immutability triggers
drop trigger if exists trg_catalogue_variants_store_guard   on public.catalogue_variants;
drop trigger if exists trg_catalogue_categories_parent_guard on public.catalogue_categories;
drop trigger if exists trg_catalogue_products_category_guard on public.catalogue_products;
drop trigger if exists trg_catalogue_categories_store on public.catalogue_categories;
drop trigger if exists trg_catalogue_products_store   on public.catalogue_products;
drop trigger if exists trg_catalogue_variants_store   on public.catalogue_variants;
drop function if exists public.catalogue_variants_store_guard();
drop function if exists public.catalogue_categories_parent_guard();
drop function if exists public.catalogue_products_category_guard();
drop function if exists public.catalogue_store_immutable();

-- 5. store-scoped indexes and the added columns/constraints
drop index if exists public.catalogue_categories_store_parent_slug_key;
drop index if exists public.catalogue_categories_store_parent_idx;
drop index if exists public.catalogue_categories_store_slug_idx;
drop index if exists public.catalogue_products_store_slug_key;
drop index if exists public.catalogue_products_store_category_idx;
drop index if exists public.catalogue_products_store_active_idx;
drop index if exists public.catalogue_products_store_brand_idx;
drop index if exists public.catalogue_products_store_sku_key;

alter table public.catalogue_variants drop constraint if exists catalogue_variants_colour_chk;
alter table public.catalogue_variants alter column colour drop default;

alter table public.catalogue_products drop constraint if exists catalogue_products_sku_chk;
alter table public.catalogue_products drop constraint if exists catalogue_products_hsn_code_chk;
alter table public.catalogue_products drop constraint if exists catalogue_products_gst_rate_chk;
alter table public.catalogue_products drop constraint if exists catalogue_products_stock_chk;
alter table public.catalogue_products drop column if exists sku;
alter table public.catalogue_products drop column if exists hsn_code;
alter table public.catalogue_products drop column if exists gst_rate;
alter table public.catalogue_products drop column if exists net_content;
alter table public.catalogue_products drop column if exists stock;

alter table public.catalogue_categories drop constraint if exists catalogue_categories_store_chk;
alter table public.catalogue_products   drop constraint if exists catalogue_products_store_chk;
alter table public.catalogue_variants   drop constraint if exists catalogue_variants_store_chk;
alter table public.catalogue_categories drop column if exists store;
alter table public.catalogue_products   drop column if exists store;
alter table public.catalogue_variants   drop column if exists store;

-- 6. the catalogue-named guard, touch triggers and policies
drop trigger if exists trg_catalogue_categories_guard on public.catalogue_categories;
drop function if exists public.catalogue_categories_guard();
drop trigger if exists trg_catalogue_categories_touch on public.catalogue_categories;
drop trigger if exists trg_catalogue_products_touch   on public.catalogue_products;
drop trigger if exists trg_catalogue_variants_touch   on public.catalogue_variants;
drop policy if exists "catalogue_categories public read" on public.catalogue_categories;
drop policy if exists "catalogue_categories admin write" on public.catalogue_categories;
drop policy if exists "catalogue_products public read"   on public.catalogue_products;
drop policy if exists "catalogue_products admin write"   on public.catalogue_products;
drop policy if exists "catalogue_variants public read"   on public.catalogue_variants;
drop policy if exists "catalogue_variants admin read"    on public.catalogue_variants;
drop policy if exists "catalogue_variants admin write"   on public.catalogue_variants;

-- 7. names back: tables, then every constraint and index that carries the catalogue_ prefix
alter table public.catalogue_categories rename to fashion_categories;
alter table public.catalogue_products   rename to fashion_products;
alter table public.catalogue_variants   rename to fashion_variants;

do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname from pg_constraint
    where connamespace = 'public'::regnamespace and conname like 'catalogue\_%'
      and conrelid in ('public.fashion_categories'::regclass, 'public.fashion_products'::regclass, 'public.fashion_variants'::regclass)
  loop
    execute format('alter table %s rename constraint %I to %I', r.tbl, r.conname, 'fashion_' || substr(r.conname, 11));
  end loop;
  for r in
    select indexname from pg_indexes
    where schemaname = 'public' and indexname like 'catalogue\_%'
      and tablename in ('fashion_categories', 'fashion_products', 'fashion_variants')
  loop
    execute format('alter index public.%I rename to %I', r.indexname, 'fashion_' || substr(r.indexname, 11));
  end loop;
end $$;

-- 8. the 0033 originals that 0034 replaced
alter table public.fashion_products drop constraint if exists fashion_products_slug_key;
alter table public.fashion_products add constraint fashion_products_slug_key unique (slug);

create unique index if not exists fashion_categories_parent_slug_key
  on public.fashion_categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
create index if not exists fashion_categories_parent_idx on public.fashion_categories (parent_id, sort_order);
create index if not exists fashion_categories_slug_idx on public.fashion_categories (slug);
create index if not exists fashion_products_category_idx on public.fashion_products (category_id, sort_order);
create index if not exists fashion_products_active_idx on public.fashion_products (is_active, sort_order);
create index if not exists fashion_products_brand_idx on public.fashion_products (brand);
create index if not exists fashion_variants_product_idx on public.fashion_variants (product_id, sort_order);

alter table public.fashion_variants drop constraint if exists fashion_variants_colour_check;
alter table public.fashion_variants add constraint fashion_variants_colour_check check (length(trim(colour)) > 0);

create or replace function public.fashion_categories_guard()
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
      raise exception 'fashion_categories: "%" cannot be its own ancestor', new.name using errcode = 'check_violation';
    end if;
    v_depth := v_depth + 1;
    v_steps := v_steps + 1;
    if v_steps > 3 then
      raise exception 'fashion_categories: ancestry of "%" is deeper than 3 levels or circular', new.name using errcode = 'check_violation';
    end if;
    select parent_id into v_cursor from public.fashion_categories where id = v_cursor;
  end loop;
  if tg_op = 'UPDATE' then
    with recursive below as (
      select id, 1 as lvl from public.fashion_categories where parent_id = new.id
      union all
      select c.id, b.lvl + 1 from public.fashion_categories c join below b on c.parent_id = b.id where b.lvl < 4
    )
    select coalesce(max(lvl), 0) into v_height from below;
  end if;
  if v_depth + v_height > 3 then
    raise exception 'fashion_categories: "%" would sit at level % with % level(s) below it; the tree is 3 levels deep at most',
      new.name, v_depth, v_height using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_fashion_categories_guard on public.fashion_categories;
create trigger trg_fashion_categories_guard
  before insert or update of parent_id, id on public.fashion_categories
  for each row execute function public.fashion_categories_guard();

drop trigger if exists trg_fashion_categories_touch on public.fashion_categories;
create trigger trg_fashion_categories_touch before update on public.fashion_categories
  for each row execute function public.sora_touch_updated_at();
drop trigger if exists trg_fashion_products_touch on public.fashion_products;
create trigger trg_fashion_products_touch before update on public.fashion_products
  for each row execute function public.sora_touch_updated_at();
drop trigger if exists trg_fashion_variants_touch on public.fashion_variants;
create trigger trg_fashion_variants_touch before update on public.fashion_variants
  for each row execute function public.sora_touch_updated_at();

alter table public.fashion_categories enable row level security;
alter table public.fashion_products   enable row level security;
alter table public.fashion_variants   enable row level security;

drop policy if exists "fashion_categories public read" on public.fashion_categories;
create policy "fashion_categories public read" on public.fashion_categories for select
  using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
drop policy if exists "fashion_categories admin write" on public.fashion_categories;
create policy "fashion_categories admin write" on public.fashion_categories for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "fashion_products public read" on public.fashion_products;
create policy "fashion_products public read" on public.fashion_products for select
  using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
drop policy if exists "fashion_products admin write" on public.fashion_products;
create policy "fashion_products admin write" on public.fashion_products for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "fashion_variants public read" on public.fashion_variants;
create policy "fashion_variants public read" on public.fashion_variants for select using (is_active = true);
drop policy if exists "fashion_variants admin read" on public.fashion_variants;
create policy "fashion_variants admin read" on public.fashion_variants for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
drop policy if exists "fashion_variants admin write" on public.fashion_variants;
create policy "fashion_variants admin write" on public.fashion_variants for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

notify pgrst, 'reload schema';

-- Verify: the 0033 shape is back
select 'fashion_categories' as what, count(*)::text as detail from public.fashion_categories
union all select 'fashion_products (demo)', count(*)::text from public.fashion_products where is_demo
union all select 'fashion_variants (demo)', count(*)::text from public.fashion_variants where is_demo
union all select 'shirt M/Sage stock', stock::text from public.fashion_variants where sku = 'AW-MLS-M-SAGE'
union all select 'columns on fashion_products', count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'fashion_products'
union all select 'catalogue_* relations left (must be 0)', count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'catalogue\_%'
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename like 'fashion_%';
