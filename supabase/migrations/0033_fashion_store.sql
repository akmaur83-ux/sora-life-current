-- ============================================================
-- SORA LIFE — Fashion Store, Phase 1 (foundation)
-- Migration 0033. Additive, idempotent. Apply in the SQL Editor of the
-- project whose breadcrumb reads "sora life". Do not run supabase db push.
--
-- A second storefront with its own catalogue, deliberately SEPARATE from the
-- wellness tables (products / categories / product_variants). Nothing here
-- touches them. Shared surfaces — cart, checkout, orders, payments, auth,
-- coupons, the creator programme — are untouched by this migration.
--
--   fashion_categories   three levels via parent_id; slug unique per parent;
--                        a trigger refuses cycles and any depth beyond 3
--   fashion_products     the catalogue row; category_id points at the
--                        deepest level that exists for it
--   fashion_variants     one row per size × colour, stock per combination
--
-- RLS mirrors 0001 (categories) and 0006 (product_variants): public read
-- where is_active, admin read of everything, admin write — "admin" being
-- membership of public.admin_users, the same check adminAuth.jsx uses.
--
-- Demo rows carry is_demo = true. To remove every demo row in one action:
--   delete from public.fashion_products where is_demo;   -- variants cascade
--   delete from public.fashion_categories where is_demo; -- none seeded as demo
-- ============================================================

-- ------------------------------------------------------------
-- 0. shared trigger (exists since 0010; harmless to re-create)
-- ------------------------------------------------------------
create or replace function public.sora_touch_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------------------
-- 1. fashion_categories
-- ------------------------------------------------------------
create table if not exists public.fashion_categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.fashion_categories(id) on delete restrict,
  name        text not null check (length(trim(name)) > 0),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tagline     text not null default '',
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (parent_id is distinct from id)
);

-- Slug unique per parent. Top-level rows have no parent, so a sentinel
-- stands in for NULL — otherwise two roots could share a slug.
create unique index if not exists fashion_categories_parent_slug_key
  on public.fashion_categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
create index if not exists fashion_categories_parent_idx
  on public.fashion_categories (parent_id, sort_order);
create index if not exists fashion_categories_slug_idx
  on public.fashion_categories (slug);

-- Depth and cycle guard. Depth is counted from the root: a root is 1, its
-- child 2, its grandchild 3 — and 3 is the ceiling. The guard also holds
-- when a branch is MOVED: the row's own subtree height is added to the
-- depth of its new position, so re-parenting Clothing under Beauty (which
-- would push Shirts to level 4) is refused too.
create or replace function public.fashion_categories_guard()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_depth integer := 1;      -- depth of NEW itself once placed
  v_height integer := 0;     -- levels below NEW (0 = leaf)
  v_cursor uuid := new.parent_id;
  v_steps integer := 0;
begin
  -- Walk up from the new parent. More than 3 hops means a cycle or an
  -- already-illegal ancestry; either way the write is refused.
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'fashion_categories: "%" cannot be its own ancestor', new.name
        using errcode = 'check_violation';
    end if;
    v_depth := v_depth + 1;
    v_steps := v_steps + 1;
    if v_steps > 3 then
      raise exception 'fashion_categories: ancestry of "%" is deeper than 3 levels or circular', new.name
        using errcode = 'check_violation';
    end if;
    select parent_id into v_cursor from public.fashion_categories where id = v_cursor;
  end loop;

  -- Height of the subtree already hanging off this row (updates only).
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
create trigger trg_fashion_categories_touch
  before update on public.fashion_categories
  for each row execute function public.sora_touch_updated_at();

alter table public.fashion_categories enable row level security;

drop policy if exists "fashion_categories public read" on public.fashion_categories;
create policy "fashion_categories public read"
  on public.fashion_categories for select
  using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "fashion_categories admin write" on public.fashion_categories;
create policy "fashion_categories admin write"
  on public.fashion_categories for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 2. fashion_products
-- ------------------------------------------------------------
create table if not exists public.fashion_products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) > 0),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand            text not null default '',
  description      text,
  category_id      uuid references public.fashion_categories(id) on delete set null,
  mrp              numeric(10,2) not null check (mrp >= 0),
  sale_price       numeric(10,2) check (sale_price is null or (sale_price >= 0 and sale_price <= mrp)),
  -- Derived, never written: the one place the discount is computed, so the
  -- badge, the struck-through MRP and the filter can never disagree.
  discount_percent integer generated always as (
    case when mrp > 0 and sale_price is not null and sale_price < mrp
         then round(((mrp - sale_price) / mrp) * 100)::integer else 0 end
  ) stored,
  images           text[] not null default '{}',
  rating           numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count     integer not null default 0 check (review_count >= 0),
  is_active        boolean not null default true,
  is_new           boolean not null default false,
  is_bestseller    boolean not null default false,
  sort_order       integer not null default 0,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists fashion_products_category_idx on public.fashion_products (category_id, sort_order);
create index if not exists fashion_products_active_idx on public.fashion_products (is_active, sort_order);
create index if not exists fashion_products_brand_idx on public.fashion_products (brand);

drop trigger if exists trg_fashion_products_touch on public.fashion_products;
create trigger trg_fashion_products_touch
  before update on public.fashion_products
  for each row execute function public.sora_touch_updated_at();

alter table public.fashion_products enable row level security;

drop policy if exists "fashion_products public read" on public.fashion_products;
create policy "fashion_products public read"
  on public.fashion_products for select
  using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "fashion_products admin write" on public.fashion_products;
create policy "fashion_products admin write"
  on public.fashion_products for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 3. fashion_variants — one row per size × colour
-- ------------------------------------------------------------
create table if not exists public.fashion_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.fashion_products(id) on delete cascade,
  size           text not null check (length(trim(size)) > 0),
  colour         text not null check (length(trim(colour)) > 0),
  colour_hex     text check (colour_hex is null or colour_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sku            text unique,
  stock          integer not null default 0 check (stock >= 0),
  price_override numeric(10,2) check (price_override is null or price_override >= 0),
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_id, size, colour)
);

create index if not exists fashion_variants_product_idx on public.fashion_variants (product_id, sort_order);

drop trigger if exists trg_fashion_variants_touch on public.fashion_variants;
create trigger trg_fashion_variants_touch
  before update on public.fashion_variants
  for each row execute function public.sora_touch_updated_at();

alter table public.fashion_variants enable row level security;

-- Storefront reads active variants to render sizes, colours and stock.
drop policy if exists "fashion_variants public read" on public.fashion_variants;
create policy "fashion_variants public read"
  on public.fashion_variants for select
  using (is_active = true);

drop policy if exists "fashion_variants admin read" on public.fashion_variants;
create policy "fashion_variants admin read"
  on public.fashion_variants for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "fashion_variants admin write" on public.fashion_variants;
create policy "fashion_variants admin write"
  on public.fashion_variants for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ============================================================
-- 4. DEMO DATA — the category tree and six demo products.
--
-- The tree is the real Phase 1 tree (is_demo = false). The six products
-- and their variants are demo rows (is_demo = true). Every brand name is
-- invented for SORA LIFE; none is a real company.
-- ============================================================

-- ---- 4a. category tree (idempotent on parent + slug) ----
with roots(name, slug, tagline, sort_order, image_url) as (values
  ('Clothing',           'clothing',           'For Every You',      1, '/img/demo-kurta-set.webp'),
  ('Beauty',             'beauty',             'Glow Everyday',      2, null),
  ('Footwear',           'footwear',           'Step Ahead',         3, '/img/demo-sneakers.webp'),
  ('Bags & Accessories', 'bags-accessories',   'Complete Your Look', 4, '/img/demo-handbag.webp')
)
insert into public.fashion_categories (name, slug, tagline, sort_order, image_url)
select name, slug, tagline, sort_order, image_url from roots
on conflict do nothing;

with clothing as (select id from public.fashion_categories where parent_id is null and slug = 'clothing'),
     kids(name, slug, tagline, sort_order, image_url) as (values
  ('Men',   'men',   'Everyday essentials', 1, '/img/demo-mens-shirt.webp'),
  ('Women', 'women', 'Effortless style',    2, '/img/demo-kurta-set.webp'),
  ('Kids',  'kids',  'Little explorers',    3, '/img/demo-kids-set.webp')
)
insert into public.fashion_categories (parent_id, name, slug, tagline, sort_order, image_url)
select clothing.id, name, slug, tagline, sort_order, image_url from kids, clothing
on conflict do nothing;

with men as (
  select c.id from public.fashion_categories c
  join public.fashion_categories p on p.id = c.parent_id
  where p.parent_id is null and p.slug = 'clothing' and c.slug = 'men'
),
     leaves(name, slug, sort_order) as (values
  ('Shirts',   'mens-shirts',   1),
  ('T-Shirts', 'mens-t-shirts', 2),
  ('Trousers', 'mens-trousers', 3)
)
insert into public.fashion_categories (parent_id, name, slug, sort_order)
select men.id, name, slug, sort_order from leaves, men
on conflict do nothing;

-- ---- 4b. six demo products ----
-- category_id is the deepest level that exists: the shirt sits in
-- Clothing → Men → Shirts; the kurta set and kids set in Clothing → Women /
-- Kids (no third level yet); the sneakers in Footwear; the bag and the
-- sunglasses in Bags & Accessories.
with cat as (
  select
    (select c.id from public.fashion_categories c join public.fashion_categories p on p.id = c.parent_id
       join public.fashion_categories g on g.id = p.parent_id where g.slug = 'clothing' and p.slug = 'men' and c.slug = 'mens-shirts') as mens_shirts,
    (select c.id from public.fashion_categories c join public.fashion_categories p on p.id = c.parent_id where p.slug = 'clothing' and c.slug = 'women') as women,
    (select c.id from public.fashion_categories c join public.fashion_categories p on p.id = c.parent_id where p.slug = 'clothing' and c.slug = 'kids') as kids,
    (select id from public.fashion_categories where parent_id is null and slug = 'footwear') as footwear,
    (select id from public.fashion_categories where parent_id is null and slug = 'bags-accessories') as bags
),
rows_(name, slug, brand, description, cat_key, mrp, sale_price, images, rating, review_count, is_new, is_bestseller, sort_order) as (values
  ('Meadow Linen Shirt — Sage',           'meadow-linen-shirt-sage',      'Aurelia Wear',   'A breathable linen-blend shirt in a soft sage, cut for everyday ease with a curved hem and a single chest pocket.', 'mens_shirts', 1999.00, 1099.00, array['/img/demo-mens-shirt.webp'], 4.4, 812,  true,  false, 1),
  ('Little Explorer Frock & Pant Set',    'little-explorer-frock-pant-set','Cub & Clover',   'A two-piece set in embroidered cotton — a flutter-sleeve top with a matching pant, made for playgrounds and picture days.', 'kids', 1499.00, 599.00, array['/img/demo-kids-set.webp'], 4.3, 2400, false, true,  2),
  ('Cloudstep Minimal Sneakers',          'cloudstep-minimal-sneakers',   'Nova Stride',    'Clean white leather-look sneakers on a cushioned sole. Wears with everything, breaks in on day one.', 'footwear', 2499.00, 999.00, array['/img/demo-sneakers.webp'], 4.5, 3200, false, true,  3),
  ('Verona Structured Handbag — Blush',   'verona-structured-handbag-blush','Celeste & Co.', 'A structured top-handle bag in a blush finish with gold-tone hardware, a detachable strap and room for a tablet.', 'bags', 2999.00, 1299.00, array['/img/demo-handbag.webp'], 4.6, 1100, true,  false, 4),
  ('Sunhaven Oversized Sunglasses',       'sunhaven-oversized-sunglasses','Sunhaven',       'Oversized square frames with gradient brown lenses and slim gold arms. UV400 protection.', 'bags', 1299.00, 599.00, array['/img/demo-sunglasses.webp'], 4.2, 640,  false, false, 5),
  ('Ethnic Embroidered Kurta Set — Sage', 'ethnic-embroidered-kurta-set-sage','Aurelia Wear','A three-piece kurta set — straight kurta, matching trousers and a printed dupatta — in soft sage with tonal embroidery.', 'women', 1999.00, 1199.00, array['/img/demo-kurta-set.webp'], 4.5, 3200, true,  true,  6)
)
insert into public.fashion_products (name, slug, brand, description, category_id, mrp, sale_price, images, rating, review_count, is_new, is_bestseller, sort_order, is_demo)
select r.name, r.slug, r.brand, r.description,
       case r.cat_key when 'mens_shirts' then cat.mens_shirts when 'women' then cat.women when 'kids' then cat.kids when 'footwear' then cat.footwear else cat.bags end,
       r.mrp, r.sale_price, r.images, r.rating, r.review_count, r.is_new, r.is_bestseller, r.sort_order, true
from rows_ r, cat
on conflict (slug) do nothing;

-- ---- 4c. variants: stock per size × colour ----
-- The shirt is the per-combination case the phase must prove: Medium in
-- green is OUT while Medium in navy is IN.
with p as (select id, slug from public.fashion_products where is_demo),
     v(product_slug, size, colour, colour_hex, sku, stock, price_override, sort_order) as (values
  ('meadow-linen-shirt-sage', 'S',  'Sage',  '#8A9A6B', 'AW-MLS-S-SAGE',  6,  null, 1),
  ('meadow-linen-shirt-sage', 'M',  'Sage',  '#8A9A6B', 'AW-MLS-M-SAGE',  0,  null, 2),
  ('meadow-linen-shirt-sage', 'L',  'Sage',  '#8A9A6B', 'AW-MLS-L-SAGE',  4,  null, 3),
  ('meadow-linen-shirt-sage', 'S',  'Navy',  '#2F3A56', 'AW-MLS-S-NAVY',  5,  null, 4),
  ('meadow-linen-shirt-sage', 'M',  'Navy',  '#2F3A56', 'AW-MLS-M-NAVY',  8,  null, 5),
  ('meadow-linen-shirt-sage', 'L',  'Navy',  '#2F3A56', 'AW-MLS-L-NAVY',  2,  null, 6),
  ('meadow-linen-shirt-sage', 'M',  'Ivory', '#EDE6D6', 'AW-MLS-M-IVRY',  3,  null, 7),
  ('meadow-linen-shirt-sage', 'XL', 'Ivory', '#EDE6D6', 'AW-MLS-XL-IVRY', 0,  null, 8),
  ('little-explorer-frock-pant-set', '2-3Y', 'Sage',  '#B7C4A1', 'CC-LEF-23-SAGE', 7, null, 1),
  ('little-explorer-frock-pant-set', '4-5Y', 'Sage',  '#B7C4A1', 'CC-LEF-45-SAGE', 5, null, 2),
  ('little-explorer-frock-pant-set', '6-7Y', 'Sage',  '#B7C4A1', 'CC-LEF-67-SAGE', 0, null, 3),
  ('little-explorer-frock-pant-set', '4-5Y', 'Peach', '#F1C6B0', 'CC-LEF-45-PCH',  4, null, 4),
  ('cloudstep-minimal-sneakers', 'UK 6',  'White', '#F5F2EA', 'NS-CMS-6-WHT',  9, null, 1),
  ('cloudstep-minimal-sneakers', 'UK 7',  'White', '#F5F2EA', 'NS-CMS-7-WHT',  12, null, 2),
  ('cloudstep-minimal-sneakers', 'UK 8',  'White', '#F5F2EA', 'NS-CMS-8-WHT',  0, null, 3),
  ('cloudstep-minimal-sneakers', 'UK 9',  'White', '#F5F2EA', 'NS-CMS-9-WHT',  6, null, 4),
  ('cloudstep-minimal-sneakers', 'UK 8',  'Forest', '#1E3A2F', 'NS-CMS-8-FOR', 3, 1099.00, 5),
  ('verona-structured-handbag-blush', 'One size', 'Blush',  '#E7B8A6', 'CC-VSH-OS-BLSH', 10, null, 1),
  ('verona-structured-handbag-blush', 'One size', 'Forest', '#1E3A2F', 'CC-VSH-OS-FOR',  4,  null, 2),
  ('verona-structured-handbag-blush', 'One size', 'Black',  '#1B1B1B', 'CC-VSH-OS-BLK',  0,  null, 3),
  ('sunhaven-oversized-sunglasses', 'One size', 'Gold',  '#C79A45', 'SH-OSG-OS-GLD', 15, null, 1),
  ('sunhaven-oversized-sunglasses', 'One size', 'Black', '#1B1B1B', 'SH-OSG-OS-BLK', 8,  null, 2),
  ('ethnic-embroidered-kurta-set-sage', 'S',  'Sage',  '#A9B48C', 'AW-EKS-S-SAGE',  4, null, 1),
  ('ethnic-embroidered-kurta-set-sage', 'M',  'Sage',  '#A9B48C', 'AW-EKS-M-SAGE',  6, null, 2),
  ('ethnic-embroidered-kurta-set-sage', 'L',  'Sage',  '#A9B48C', 'AW-EKS-L-SAGE',  2, null, 3),
  ('ethnic-embroidered-kurta-set-sage', 'XL', 'Sage',  '#A9B48C', 'AW-EKS-XL-SAGE', 0, null, 4),
  ('ethnic-embroidered-kurta-set-sage', 'M',  'Rust',  '#B4552E', 'AW-EKS-M-RUST',  5, null, 5),
  ('ethnic-embroidered-kurta-set-sage', 'L',  'Rust',  '#B4552E', 'AW-EKS-L-RUST',  3, null, 6)
)
insert into public.fashion_variants (product_id, size, colour, colour_hex, sku, stock, price_override, sort_order, is_demo)
select p.id, v.size, v.colour, v.colour_hex, v.sku, v.stock, v.price_override, v.sort_order, true
from v join p on p.slug = v.product_slug
on conflict (product_id, size, colour) do nothing;

-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
select 'fashion_categories' as what, count(*)::text as detail from public.fashion_categories
union all select 'fashion_products (demo)', count(*)::text from public.fashion_products where is_demo
union all select 'fashion_variants (demo)', count(*)::text from public.fashion_variants where is_demo
union all select 'shirt M/Sage stock', stock::text from public.fashion_variants where sku = 'AW-MLS-M-SAGE'
union all select 'shirt M/Navy stock', stock::text from public.fashion_variants where sku = 'AW-MLS-M-NAVY'
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename like 'fashion_%';
