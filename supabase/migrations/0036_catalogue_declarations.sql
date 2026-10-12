-- ============================================================
-- SORA LIFE — catalogue declarations. Migration 0036.
-- Applied by the owner in the SQL Editor ("sora life") on 2026-10-12.
--
-- Adds what a fashion or jewellery listing has to (or should) carry and the
-- schema cannot hold today:
--   1. catalogue_parties: manufacturer / packer / importer, typed once, used by many products
--   2. on every product (all stores): country of origin, generic name, the three parties
--   3. garments: material composition, care, fit
--   4. jewellery: metal, purity, making charges, pricing mode (product);
--      gross and net metal weight (variant); stones (own table)
--
-- Owner decisions (2026-10-12): one purity per listing (18K and 22K are separate
-- listings); no HUID table, since the supplier ships direct and the HUID stays its record;
-- rate-linked prices are recorded but cannot go live, and checkout pricing is untouched;
-- completeness is warned in the admin and validator, not enforced here.
--
-- Nothing existing changes: every new column is nullable or defaulted, so the
-- products already loaded stay valid. Format is enforced here; COMPLETENESS
-- (e.g. "a live product names its country of origin") is left to the admin and
-- the validator until the catalogue is backfilled; see the note at the end.
-- Safe to re-run.
-- ============================================================

do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'catalogue_products' and column_name = 'store') then
    raise exception 'Migration 0036 needs the catalogue tables from 0034/0035.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Parties — one row per company a listing names.
-- ------------------------------------------------------------
create table if not exists public.catalogue_parties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0 and length(name) <= 160),
  address     text not null check (length(trim(address)) > 0 and length(address) <= 400),  -- as printed: street, city, state, PIN
  country     text not null default 'IN' check (country ~ '^[A-Z]{2}$'),                   -- ISO 3166-1 alpha-2
  phone       text check (phone is null or length(phone) <= 40),
  email       text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  gstin       text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_catalogue_parties_touch on public.catalogue_parties;
create trigger trg_catalogue_parties_touch before update on public.catalogue_parties
  for each row execute function public.sora_touch_updated_at();

alter table public.catalogue_parties enable row level security;
drop policy if exists "catalogue_parties public read" on public.catalogue_parties;
create policy "catalogue_parties public read" on public.catalogue_parties for select using (true);   -- printed on the product page
drop policy if exists "catalogue_parties admin write" on public.catalogue_parties;
create policy "catalogue_parties admin write" on public.catalogue_parties for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 2–4. Product columns
-- ------------------------------------------------------------
alter table public.catalogue_products
  add column if not exists country_of_origin   text,
  add column if not exists generic_name        text,
  add column if not exists manufacturer_id     uuid references public.catalogue_parties(id) on delete restrict,
  add column if not exists packer_id           uuid references public.catalogue_parties(id) on delete restrict,
  add column if not exists importer_id         uuid references public.catalogue_parties(id) on delete restrict,
  add column if not exists material            text,
  add column if not exists care                text,
  add column if not exists fit                 text,
  add column if not exists metal               text,
  add column if not exists purity              integer,          -- fineness, parts per thousand: 916 = 22K, 750 = 18K, 925 = sterling
  add column if not exists making_charge_type  text,
  add column if not exists making_charge_value numeric(10,2),
  add column if not exists pricing_mode        text not null default 'fixed';

alter table public.catalogue_products drop constraint if exists catalogue_products_country_chk;
alter table public.catalogue_products add constraint catalogue_products_country_chk
  check (country_of_origin is null or country_of_origin ~ '^[A-Z]{2}$');
alter table public.catalogue_products drop constraint if exists catalogue_products_text_len_chk;
alter table public.catalogue_products add constraint catalogue_products_text_len_chk
  check (coalesce(length(generic_name), 0) <= 120 and coalesce(length(material), 0) <= 300
     and coalesce(length(care), 0) <= 1000 and coalesce(length(fit), 0) <= 40);
alter table public.catalogue_products drop constraint if exists catalogue_products_metal_chk;
alter table public.catalogue_products add constraint catalogue_products_metal_chk
  check (metal is null or metal in ('gold', 'silver', 'platinum', 'gold_plated', 'silver_plated', 'brass', 'stainless_steel', 'other'));
alter table public.catalogue_products drop constraint if exists catalogue_products_purity_chk;
alter table public.catalogue_products add constraint catalogue_products_purity_chk
  check (purity is null or (purity between 1 and 999 and metal is not null and metal in ('gold', 'silver', 'platinum')));
alter table public.catalogue_products drop constraint if exists catalogue_products_making_chk;
alter table public.catalogue_products add constraint catalogue_products_making_chk
  check ((making_charge_type is null) = (making_charge_value is null)
     and (making_charge_type is null or making_charge_type in ('per_gram', 'percent', 'flat'))
     and (making_charge_value is null or making_charge_value >= 0)
     and (making_charge_type is distinct from 'percent' or making_charge_value <= 100));
alter table public.catalogue_products drop constraint if exists catalogue_products_pricing_mode_chk;
alter table public.catalogue_products add constraint catalogue_products_pricing_mode_chk
  check (pricing_mode in ('fixed', 'rate_linked'));
-- A rate-linked price needs a metal-rate engine the checkout does not have yet:
-- such a product can be saved as a draft but cannot go live.
alter table public.catalogue_products drop constraint if exists catalogue_products_rate_linked_live_chk;
alter table public.catalogue_products add constraint catalogue_products_rate_linked_live_chk
  check (pricing_mode = 'fixed' or not is_active);

create index if not exists catalogue_products_manufacturer_idx on public.catalogue_products (manufacturer_id) where manufacturer_id is not null;
create index if not exists catalogue_products_importer_idx     on public.catalogue_products (importer_id)     where importer_id is not null;

-- ------------------------------------------------------------
-- 4a. Variant weights — a ring's weight changes with its size.
-- ------------------------------------------------------------
alter table public.catalogue_variants
  add column if not exists gross_weight_g     numeric(8,3),
  add column if not exists net_metal_weight_g numeric(8,3);
alter table public.catalogue_variants drop constraint if exists catalogue_variants_weights_chk;
alter table public.catalogue_variants add constraint catalogue_variants_weights_chk
  check ((gross_weight_g is null or gross_weight_g > 0)
     and (net_metal_weight_g is null or net_metal_weight_g > 0)
     and (gross_weight_g is null or net_metal_weight_g is null or net_metal_weight_g <= gross_weight_g));

-- ------------------------------------------------------------
-- 4b. Stones — several kinds per piece (diamonds + a ruby), so a table, not columns.
-- ------------------------------------------------------------
create table if not exists public.catalogue_product_stones (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.catalogue_products(id) on delete cascade,
  stone           text not null check (length(trim(stone)) > 0 and length(stone) <= 60),   -- diamond, ruby, cubic zirconia …
  origin          text not null check (origin in ('natural', 'lab_grown', 'simulant')),
  shape           text check (shape is null or length(shape) <= 40),
  stone_count     integer not null check (stone_count > 0),
  total_carat     numeric(7,3) check (total_carat is null or total_carat > 0),
  total_weight_g  numeric(8,3) check (total_weight_g is null or total_weight_g > 0),
  clarity         text check (clarity is null or length(clarity) <= 20),
  colour_grade    text check (colour_grade is null or length(colour_grade) <= 20),
  certificate_lab text check (certificate_lab is null or length(certificate_lab) <= 40),
  certificate_no  text check (certificate_no is null or length(certificate_no) <= 60),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((certificate_lab is null) = (certificate_no is null))
);
create index if not exists catalogue_product_stones_product_idx on public.catalogue_product_stones (product_id, sort_order);
drop trigger if exists trg_catalogue_product_stones_touch on public.catalogue_product_stones;
create trigger trg_catalogue_product_stones_touch before update on public.catalogue_product_stones
  for each row execute function public.sora_touch_updated_at();

alter table public.catalogue_product_stones enable row level security;
drop policy if exists "catalogue_product_stones public read" on public.catalogue_product_stones;
create policy "catalogue_product_stones public read" on public.catalogue_product_stones for select using (true);
drop policy if exists "catalogue_product_stones admin write" on public.catalogue_product_stones;
create policy "catalogue_product_stones admin write" on public.catalogue_product_stones for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
select 'new product columns (expect 13)' as what, count(*)::text as detail
  from information_schema.columns where table_schema = 'public' and table_name = 'catalogue_products'
   and column_name in ('country_of_origin', 'generic_name', 'manufacturer_id', 'packer_id', 'importer_id', 'material', 'care', 'fit',
                       'metal', 'purity', 'making_charge_type', 'making_charge_value', 'pricing_mode')
union all select 'new variant columns (expect 2)', count(*)::text
  from information_schema.columns where table_schema = 'public' and table_name = 'catalogue_variants'
   and column_name in ('gross_weight_g', 'net_metal_weight_g')
union all select 'new tables (expect 2)', count(*)::text
  from pg_tables where schemaname = 'public' and tablename in ('catalogue_parties', 'catalogue_product_stones')
union all select 'RLS on the new tables (expect 2)', count(*)::text
  from pg_class where relname in ('catalogue_parties', 'catalogue_product_stones') and relrowsecurity
union all select 'products not fixed-price (expect 0)', count(*)::text from public.catalogue_products where pricing_mode <> 'fixed';

-- ------------------------------------------------------------
-- LATER, once every live product is backfilled (not part of this migration):
--   alter table public.catalogue_products add constraint catalogue_products_live_declarations_chk
--     check (not is_active or (country_of_origin is not null and manufacturer_id is not null)) not valid;
-- "not valid" skips the check on existing rows; new and edited rows must pass it.
-- ============================================================
