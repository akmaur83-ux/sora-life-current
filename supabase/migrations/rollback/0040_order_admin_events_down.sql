-- ============================================================
-- SORA LIFE — Migration 0040 ROLLBACK. Apply in the SQL Editor ("sora life") only to undo 0040.
-- The server notices mark_cod_collected() is gone and falls back to marking the order paid
-- without the record of who did it, so "Mark cash collected" keeps working either way.
-- DATA: drops every order admin event — the record of which admin collected which COD order.
-- ============================================================
drop function if exists public.mark_cod_collected(uuid, uuid, text, text);
drop table if exists public.order_admin_events;
notify pgrst, 'reload schema';
-- ============================================================
