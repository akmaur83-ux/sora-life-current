-- ============================================================
-- SORA LIFE — admin extensions migration
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / ON CONFLICT).
--
-- Does NOT touch existing tables' data. Only adds:
--   - a unique constraint on products.biosash_id (needed for idempotent import)
--   - categories, hero_slides, site_settings tables + RLS
--   - a public "product-images" storage bucket + RLS
--
-- Assumes public.admin_users(user_id uuid) already exists, as described,
-- and that "is admin" is decided by: EXISTS (select 1 from admin_users
-- where user_id = auth.uid()) — the same check adminAuth.jsx already uses.
-- ============================================================

-- ---------- 1. products: idempotent-upsert key + admin-editable extras ----------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_biosash_id_key'
  ) then
    alter table public.products
      add constraint products_biosash_id_key unique (biosash_id);
  end if;
end $$;

-- Additive only — existing rows/columns are untouched. Needed for the
-- "Mark as Bestseller / New / Featured" and rating/review-count admin
-- controls, which the current schema does not yet have.
alter table public.products add column if not exists is_new boolean not null default false;
alter table public.products add column if not exists is_bestseller boolean not null default false;
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists rating numeric(2,1) not null default 0;
alter table public.products add column if not exists review_count int not null default 0;
alter table public.products add column if not exists sort_order int not null default 0;

-- ---------- 2. categories ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text default '',
  blurb text default '',
  image_url text,
  tone text default 'forest',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;

drop policy if exists "categories public read" on public.categories;
create policy "categories public read"
  on public.categories for select
  using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write"
  on public.categories for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ---------- 3. hero_slides ----------
create table if not exists public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'image' check (kind in ('image', 'video')),
  image_url text,
  video_url text,
  poster_url text,
  kicker text default '',
  title text not null default '',
  subtitle text default '',
  lede text default '',
  cta_label text default 'SHOP NOW',
  cta_link text default '/shop',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hero_slides enable row level security;

drop policy if exists "hero_slides public read" on public.hero_slides;
create policy "hero_slides public read"
  on public.hero_slides for select
  using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "hero_slides admin write" on public.hero_slides;
create policy "hero_slides admin write"
  on public.hero_slides for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ---------- 4. site_settings (key/value, one row per config group) ----------
create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read"
  on public.site_settings for select
  using (true);

drop policy if exists "site_settings admin write" on public.site_settings;
create policy "site_settings admin write"
  on public.site_settings for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Seed default rows (no-op if already present) so the admin UI has something
-- to load and edit; every value below matches what the live site already
-- shows today, so seeding this changes nothing visible until an admin edits it.
insert into public.site_settings (key, value) values
  ('branding', jsonb_build_object(
    'logo_url', '/assets/sora-life-logo.png',
    'site_name', 'SORA LIFE',
    'tagline', 'HEALTH & WELLNESS',
    'primary_color', '#1E3A2F',
    'accent_color', '#E8B04B',
    'favicon_url', null
  )),
  ('announcement', jsonb_build_object(
    'notices', jsonb_build_array(
      'FREE SHIPPING on orders above ₹699',
      'COD Available',
      '100% Authentic Biosash Products'
    ),
    'free_shipping_threshold', 699
  )),
  ('contact', jsonb_build_object(
    'phone', '', 'email', '', 'address', ''
  )),
  ('homepage', jsonb_build_object(
    'bestseller_title', 'Bestsellers',
    'bestseller_subtitle', 'Our most loved products by our customers'
  ))
on conflict (key) do nothing;

-- ---------- 5. Storage bucket for admin-uploaded product/brand images ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product-images public read" on storage.objects;
create policy "product-images public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product-images admin write" on storage.objects;
create policy "product-images admin write"
  on storage.objects for all
  using (
    bucket_id = 'product-images'
    and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  )
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

-- ---------- done ----------
select 'Migration complete.' as status;
