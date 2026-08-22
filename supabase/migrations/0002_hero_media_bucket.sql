-- ============================================================
-- SORA LIFE — hero-media storage bucket
-- Run this once in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- Mirrors the existing "product-images" bucket pattern from
-- 0001_admin_extensions.sql: public read, admin-only write, gated by
-- the same admin_users membership check.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('hero-media', 'hero-media', true)
on conflict (id) do nothing;

drop policy if exists "hero-media public read" on storage.objects;
create policy "hero-media public read"
  on storage.objects for select
  using (bucket_id = 'hero-media');

drop policy if exists "hero-media admin write" on storage.objects;
create policy "hero-media admin write"
  on storage.objects for all
  using (
    bucket_id = 'hero-media'
    and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  )
  with check (
    bucket_id = 'hero-media'
    and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

select 'hero-media bucket ready.' as status;
