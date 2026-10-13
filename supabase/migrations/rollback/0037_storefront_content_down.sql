-- ============================================================
-- SORA LIFE — Migration 0037 ROLLBACK. Apply in the SQL Editor ("sora life") only to undo 0037,
-- and only together with code that no longer reads storefront_published: the site's build
-- reads it and fails while it is absent.
-- DATA: drops every storefront draft and published record. The homepage site setting is not
-- touched by 0037, so its old fashion_storefront / lifestyle_storefront copies are still there.
-- ============================================================
drop function if exists public.admin_publish_storefront(text, integer);
drop function if exists public.admin_save_storefront_draft(text, jsonb, integer);
drop table if exists public.storefront_published;
drop table if exists public.storefront_drafts;
notify pgrst, 'reload schema';
-- ============================================================
