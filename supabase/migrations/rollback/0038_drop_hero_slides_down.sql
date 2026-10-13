-- ============================================================
-- SORA LIFE — Migration 0038 ROLLBACK. Recreates an EMPTY hero_slides table with its
-- 0001 + 0029 shape and policies. The slides 0038 deleted are not restored (backups only).
-- Nothing in the current code reads this table.
-- ============================================================
create table if not exists public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'image' check (kind in ('image', 'video')),
  image_url text,
  desktop_image_url text,
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
create policy "hero_slides public read" on public.hero_slides for select
  using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
drop policy if exists "hero_slides admin write" on public.hero_slides;
create policy "hero_slides admin write" on public.hero_slides for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
notify pgrst, 'reload schema';
-- ============================================================
