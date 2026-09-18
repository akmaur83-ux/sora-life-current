-- ============================================================
-- SORA LIFE — Home & Living store. Migration 0035 ROLLBACK.
-- Removes every Home & Living row and narrows the store list back to
-- ('fashion', 'grocery'). Apply in the SQL Editor ("sora life").
--
-- DATA: every row with store = 'homeliving' is DELETED — categories,
-- products, their variants and media (cascade). Fashion and grocery rows
-- are not touched. If real (non-demo) Home & Living products exist by the
-- time you run this, the notice below counts them first; stop if that
-- number is not what you expect.
-- ============================================================

do $$
declare v_real integer := (select count(*) from public.catalogue_products where store = 'homeliving' and not is_demo);
begin
  if not exists (select 1 from pg_constraint where conname = 'catalogue_products_store_chk' and pg_get_constraintdef(oid) like '%homeliving%') then
    raise notice 'Nothing to roll back: the store list does not include homeliving.';
  end if;
  raise notice 'Rolling back 0035: % homeliving product(s) (% of them NOT demo) and % categor(ies) will be deleted.',
    (select count(*) from public.catalogue_products where store = 'homeliving'), v_real,
    (select count(*) from public.catalogue_categories where store = 'homeliving');
end $$;

-- 1. rows first (media and variants cascade from products)
delete from public.catalogue_variants   where store = 'homeliving';
delete from public.catalogue_products   where store = 'homeliving';
delete from public.catalogue_categories where store = 'homeliving';

-- 2. the 0034 store list
alter table public.catalogue_categories drop constraint if exists catalogue_categories_store_chk;
alter table public.catalogue_categories add constraint catalogue_categories_store_chk check (store in ('fashion', 'grocery'));
alter table public.catalogue_products   drop constraint if exists catalogue_products_store_chk;
alter table public.catalogue_products   add constraint catalogue_products_store_chk check (store in ('fashion', 'grocery'));
alter table public.catalogue_variants   drop constraint if exists catalogue_variants_store_chk;
alter table public.catalogue_variants   add constraint catalogue_variants_store_chk check (store in ('fashion', 'grocery'));

notify pgrst, 'reload schema';

-- Verify
select 'homeliving rows left (must be 0)' as what,
  ((select count(*) from public.catalogue_categories where store = 'homeliving')
   + (select count(*) from public.catalogue_products where store = 'homeliving'))::text as detail
union all select 'store checks mentioning homeliving (must be 0)', count(*)::text
  from pg_constraint where conname like 'catalogue\_%\_store\_chk' and pg_get_constraintdef(oid) like '%homeliving%'
union all select 'fashion products (unchanged)', count(*)::text from public.catalogue_products where store = 'fashion'
union all select 'grocery products (unchanged)', count(*)::text from public.catalogue_products where store = 'grocery';
