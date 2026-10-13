-- ============================================================
-- SORA LIFE — drop hero_slides. Migration 0038.
--
-- The Hero Slides admin page, the carousel it fed and the storefront's read of this
-- table were retired in 52d3d12 (live 2026-10-12). Nothing reads or writes it now.
--
-- DATA: deletes every saved hero slide. Not reversible except from a backup; the
-- rollback recreates an EMPTY table only. Videos uploaded through the old page stay in
-- the hero-media storage bucket; remove them from the Storage dashboard if wanted.
-- ============================================================
drop table if exists public.hero_slides;
notify pgrst, 'reload schema';

select 'hero_slides present (expect 0)' as what, count(*)::text as detail
  from pg_tables where schemaname = 'public' and tablename = 'hero_slides';
-- ============================================================
