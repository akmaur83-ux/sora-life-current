-- ============================================================
-- SORA LIFE — Migration 0036 ROLLBACK. Apply in the SQL Editor ("sora life") only to undo 0036.
-- DATA: drops every party and stone record, and the new
-- product/variant columns with their values. Nothing else changes.
-- ============================================================
do $$ begin
  raise notice 'Rolling back 0036: % part(ies) and % stone row(s) will be dropped.',
    (select count(*) from public.catalogue_parties),
    (select count(*) from public.catalogue_product_stones);
end $$;

drop table if exists public.catalogue_product_stones;

alter table public.catalogue_variants
  drop constraint if exists catalogue_variants_weights_chk,
  drop column if exists gross_weight_g,
  drop column if exists net_metal_weight_g;

alter table public.catalogue_products
  drop constraint if exists catalogue_products_country_chk,
  drop constraint if exists catalogue_products_text_len_chk,
  drop constraint if exists catalogue_products_metal_chk,
  drop constraint if exists catalogue_products_purity_chk,
  drop constraint if exists catalogue_products_making_chk,
  drop constraint if exists catalogue_products_pricing_mode_chk,
  drop constraint if exists catalogue_products_rate_linked_live_chk,
  drop column if exists country_of_origin,
  drop column if exists generic_name,
  drop column if exists manufacturer_id,
  drop column if exists packer_id,
  drop column if exists importer_id,
  drop column if exists material,
  drop column if exists care,
  drop column if exists fit,
  drop column if exists metal,
  drop column if exists purity,
  drop column if exists making_charge_type,
  drop column if exists making_charge_value,
  drop column if exists pricing_mode;

drop table if exists public.catalogue_parties;

notify pgrst, 'reload schema';
