-- ============================================================
-- SORA LIFE — Migration 0039 ROLLBACK. Apply in the SQL Editor ("sora life") only to undo 0039.
-- The server notices the functions are gone and falls back to its pre-0039 behaviour
-- (consume_coupon on payment, no stock movement), so checkout keeps working either way.
-- DATA: drops every hold and the orders' hold_warnings / reserved_until columns. Stock already
-- taken stays taken and coupon uses already counted stay counted; nothing is put back.
-- ============================================================
drop trigger if exists order_holds_fulfilment on public.orders;
drop function if exists public.order_holds_on_fulfilment();
drop function if exists public.restore_order_holds(uuid);
drop function if exists public.release_order_holds(uuid);
drop function if exists public.settle_order_holds(uuid, text, uuid, jsonb);
drop function if exists public.reserve_order_holds(uuid, boolean, integer, text, uuid, jsonb);
drop function if exists public.order_hold_count_coupon(uuid, uuid, uuid);
drop function if exists public.order_hold_coupon_room(uuid, uuid, uuid);
drop function if exists public.order_hold_lines(jsonb);
drop function if exists public.order_hold_adjust_stock(text, uuid, integer);
drop function if exists public.order_hold_lock_stock(text, uuid);
drop table if exists public.order_holds;
alter table public.orders drop column if exists hold_warnings;
alter table public.orders drop column if exists reserved_until;
notify pgrst, 'reload schema';
-- ============================================================
