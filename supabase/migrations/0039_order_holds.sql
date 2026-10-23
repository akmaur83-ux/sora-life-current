-- ============================================================
-- SORA LIFE — 0039 ORDER HOLDS: stock and coupon uses held for an order
-- Run once in the Supabase SQL Editor ("sora life"), BEFORE the code that
-- calls these functions is pushed. Safe to re-run.
--
-- Two audit findings (2026-10-20), one mechanism:
--   * stock was checked at checkout but never reduced, so the last unit could
--     be sold any number of times;
--   * a coupon's usage limit counted only PAID orders, so everyone who started
--     checkout before the first payment landed got the discount.
--
-- An order now HOLDS what it needs the moment it is created:
--   online payment    held for 30 minutes (the server passes the length);
--                     taken for good when the payment is captured; let go at
--                     once when a payment fails or the customer starts a
--                     changed checkout; simply ignored once it has lapsed.
--   cash on delivery  taken at once: stock reduced and the coupon use counted
--                     when the order is placed (the owner's decision).
--   cancelled         setting fulfilment to 'cancelled' puts stock and coupon
--                     uses back; un-cancelling a paid or COD order takes them
--                     again.
--
-- Expiry needs no background job: a hold counts only while status = 'held'
-- and expires_at > now(). Stock columns are reduced only when a hold is
-- TAKEN, so the storefront's stock figures never include a mere hold.
-- A payment captured after its hold lapsed is still honoured — the money has
-- moved — and anything that had run out by then is written to
-- orders.hold_warnings for the admin, never silently oversold.
--
-- Every function runs as its CALLER (security invoker) and only the server's
-- service role may execute them. The cancel trigger fires inside the existing
-- admin fulfilment function (0022), which already runs as its owner; 0022 is
-- not changed. No existing table loses a column or a row; consume_coupon
-- (0009) stays in place for code that predates this migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Two order columns
-- ------------------------------------------------------------
-- When an unpaid online order's holds lapse. NULL for COD (nothing lapses)
-- and for orders placed before this migration.
alter table public.orders add column if not exists reserved_until timestamptz;
-- What could not be honoured when the order was paid or un-cancelled:
-- [{ kind: 'stock', label, qty, short } | { kind: 'coupon', code, reason }].
alter table public.orders add column if not exists hold_warnings jsonb;

-- ------------------------------------------------------------
-- 2. The holds
-- ------------------------------------------------------------
create table if not exists public.order_holds (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  kind        text not null check (kind in ('stock', 'coupon')),
  -- stock: which counted stock column, which row, how many
  target      text check (target in ('product_variants', 'catalogue_variants', 'catalogue_products')),
  target_id   uuid,
  qty         integer check (qty > 0),
  label       text,
  -- coupon: which coupon, for whom (per-customer limits)
  coupon_id   uuid references public.coupons(id) on delete cascade,
  user_id     uuid,
  status      text not null check (status in ('held', 'committed', 'released', 'restored')),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint order_holds_shape check (
    (kind = 'stock' and target is not null and target_id is not null and qty is not null and coupon_id is null)
    or (kind = 'coupon' and coupon_id is not null and target is null and target_id is null and qty is null)
  ),
  constraint order_holds_held_lapses check (status <> 'held' or expires_at is not null)
);

create unique index if not exists order_holds_stock_key on public.order_holds (order_id, target, target_id) where kind = 'stock';
create unique index if not exists order_holds_coupon_key on public.order_holds (order_id) where kind = 'coupon';
create index if not exists order_holds_live_stock_idx on public.order_holds (target, target_id) where status = 'held';
create index if not exists order_holds_live_coupon_idx on public.order_holds (coupon_id) where status = 'held';

alter table public.order_holds enable row level security;
-- Admin read only; nothing in the browser writes a hold. The server's
-- service role (which bypasses RLS) is the only writer, through the
-- functions below.
drop policy if exists "order_holds admin read" on public.order_holds;
create policy "order_holds admin read"
  on public.order_holds for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
revoke insert, update, delete, truncate on public.order_holds from anon, authenticated;

-- ------------------------------------------------------------
-- 3. Stock rows: lock, adjust
--
-- Only these three columns are counts. products.stock (wellness without a
-- pack size) is an in-stock flag, not a number, so there is nothing to hold
-- or reduce there; the server simply sends no line for it.
-- ------------------------------------------------------------
create or replace function public.order_hold_lock_stock(p_target text, p_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v integer;
begin
  if p_target = 'product_variants' then
    select stock into v from public.product_variants where id = p_id for update;
  elsif p_target = 'catalogue_variants' then
    select stock into v from public.catalogue_variants where id = p_id for update;
  elsif p_target = 'catalogue_products' then
    select stock into v from public.catalogue_products where id = p_id for update;
  else
    raise exception 'unknown stock target %', p_target using errcode = '22023';
  end if;
  return v; -- NULL when the row is gone
end $$;

-- Move a stock count by p_delta, never below zero. Returns the units that
-- could not be taken (0 unless the count ran out). updated_at moves too, so
-- an admin form opened before the change cannot save the old count back.
create or replace function public.order_hold_adjust_stock(p_target text, p_id uuid, p_delta integer)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_before integer;
  v_after integer;
begin
  v_before := public.order_hold_lock_stock(p_target, p_id);
  if v_before is null then
    return greatest(-p_delta, 0);
  end if;
  v_after := greatest(v_before + p_delta, 0);
  if p_target = 'product_variants' then
    update public.product_variants set stock = v_after, updated_at = now() where id = p_id;
  elsif p_target = 'catalogue_variants' then
    update public.catalogue_variants set stock = v_after, updated_at = now() where id = p_id;
  else
    update public.catalogue_products set stock = v_after, updated_at = now() where id = p_id;
  end if;
  return greatest(-(v_before + p_delta), 0);
end $$;

-- The server's stock lines, one per stock row: [{ target, id, qty, label, line }].
-- Two lines naming one row (it should never happen) are added together.
create or replace function public.order_hold_lines(p_lines jsonb)
returns table (target text, target_id uuid, qty integer, label text, line integer)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select e->>'target', (e->>'id')::uuid, sum((e->>'qty')::integer)::integer, min(e->>'label'), min((e->>'line')::integer)
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as e
  where (e->>'qty')::integer > 0
  group by e->>'target', (e->>'id')::uuid
  order by 1, 2
$$;

-- ------------------------------------------------------------
-- 4. Room on a coupon for one more use
--
-- Counts what consume_coupon counted (used_count, this buyer's redemptions)
-- PLUS the live holds of other orders. The caller holds the coupon row lock.
-- ------------------------------------------------------------
create or replace function public.order_hold_coupon_room(p_coupon_id uuid, p_user_id uuid, p_order_id uuid)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v public.coupons%rowtype;
  v_held integer;
  v_mine integer;
begin
  select * into v from public.coupons where id = p_coupon_id;
  if not found or v.is_active is not true then
    return 'inactive';
  end if;
  if v.usage_limit is not null then
    select count(*) into v_held from public.order_holds
      where kind = 'coupon' and coupon_id = v.id and status = 'held' and expires_at > now() and order_id <> p_order_id;
    if v.used_count + v_held >= v.usage_limit then
      return 'exhausted';
    end if;
  end if;
  if v.per_user_limit is not null and p_user_id is not null then
    select count(*) into v_mine from public.coupon_redemptions
      where coupon_id = v.id and user_id = p_user_id and order_id is distinct from p_order_id;
    v_mine := v_mine + (select count(*) from public.order_holds
      where kind = 'coupon' and coupon_id = v.id and user_id = p_user_id
        and status = 'held' and expires_at > now() and order_id <> p_order_id);
    if v_mine >= v.per_user_limit then
      return 'user_limit';
    end if;
  end if;
  return 'ok';
end $$;

-- Count one use of a coupon against an order — once. The redemption row's
-- unique (coupon, order) index decides; used_count moves only with it.
create or replace function public.order_hold_count_coupon(p_coupon_id uuid, p_order_id uuid, p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_inserted uuid;
begin
  insert into public.coupon_redemptions (coupon_id, order_id, order_number, user_id)
    values (p_coupon_id, p_order_id, (select order_number from public.orders where id = p_order_id), p_user_id)
    on conflict do nothing
    returning id into v_inserted;
  if v_inserted is not null then
    update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
  end if;
end $$;

-- ------------------------------------------------------------
-- 5. reserve_order_holds — called by create-order right after the order row
--    is written, before any Razorpay order exists.
--
--   p_commit       true for cash on delivery: take at once, nothing lapses
--   p_hold_minutes how long an online order's holds last
--   p_lines        the server's stock lines (see order_hold_lines)
--
-- Returns { ok: true, reserved_until } or { ok: false, reason, line?, available? }
-- with reason 'inactive' | 'exhausted' | 'user_limit' | 'stock'. A refusal
-- writes nothing. Idempotent per order: a retried call returns 'already'.
-- Lock order everywhere: the order row, then the coupon row, then stock rows
-- sorted by (target, id) — so two checkouts can never deadlock each other.
-- ------------------------------------------------------------
create or replace function public.reserve_order_holds(
  p_order_id     uuid,
  p_commit       boolean,
  p_hold_minutes integer,
  p_coupon_code  text,
  p_user_id      uuid,
  p_lines        jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_commit boolean := coalesce(p_commit, false);
  v_until timestamptz;
  v_coupon_id uuid;
  v_room text;
  v_stock integer;
  v_held integer;
  l record;
begin
  if p_order_id is null then
    raise exception 'order id is required' using errcode = '22023';
  end if;
  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.order_holds where order_id = p_order_id) then
    return jsonb_build_object('ok', true, 'already', true,
      'reserved_until', (select reserved_until from public.orders where id = p_order_id));
  end if;
  if not v_commit and coalesce(p_hold_minutes, 0) < 1 then
    raise exception 'a hold needs a length in minutes' using errcode = '22023';
  end if;
  v_until := case when v_commit then null else now() + make_interval(mins => p_hold_minutes) end;

  -- 1. The coupon.
  if nullif(btrim(p_coupon_code), '') is not null then
    select id into v_coupon_id from public.coupons where upper(code) = upper(btrim(p_coupon_code)) for update;
    if v_coupon_id is null then
      return jsonb_build_object('ok', false, 'reason', 'inactive');
    end if;
    v_room := public.order_hold_coupon_room(v_coupon_id, p_user_id, p_order_id);
    if v_room <> 'ok' then
      return jsonb_build_object('ok', false, 'reason', v_room);
    end if;
  end if;

  -- 2. Every stock line, locked and checked before anything is written.
  for l in select * from public.order_hold_lines(p_lines) loop
    v_stock := public.order_hold_lock_stock(l.target, l.target_id);
    select coalesce(sum(h.qty), 0) into v_held from public.order_holds h
      where h.kind = 'stock' and h.target = l.target and h.target_id = l.target_id
        and h.status = 'held' and h.expires_at > now();
    if v_stock is null or l.qty > v_stock - v_held then
      return jsonb_build_object('ok', false, 'reason', 'stock', 'line', l.line,
        'available', greatest(coalesce(v_stock, 0) - v_held, 0));
    end if;
  end loop;

  -- 3. Hold, or take.
  if v_coupon_id is not null then
    insert into public.order_holds (order_id, kind, coupon_id, user_id, status, expires_at)
      values (p_order_id, 'coupon', v_coupon_id, p_user_id,
              case when v_commit then 'committed' else 'held' end, v_until);
    if v_commit then
      perform public.order_hold_count_coupon(v_coupon_id, p_order_id, p_user_id);
    end if;
  end if;
  for l in select * from public.order_hold_lines(p_lines) loop
    insert into public.order_holds (order_id, kind, target, target_id, qty, label, status, expires_at)
      values (p_order_id, 'stock', l.target, l.target_id, l.qty, l.label,
              case when v_commit then 'committed' else 'held' end, v_until);
    if v_commit then
      perform public.order_hold_adjust_stock(l.target, l.target_id, -l.qty);
    end if;
  end loop;

  update public.orders set reserved_until = v_until where id = p_order_id;
  return jsonb_build_object('ok', true, 'reserved_until', v_until);
end $$;

-- ------------------------------------------------------------
-- 6. settle_order_holds — called once an online order is PAID (verify or
--    webhook, whichever settled it), and by the cancel trigger when a
--    cancelled paid/COD order is un-cancelled.
--
-- A live hold is simply taken. A lapsed, released or restored one is taken
-- again where there is still room: a coupon with no room left is not counted
-- (exactly as consume_coupon refused it) and stock that has run out is taken
-- down to zero — both are written to orders.hold_warnings, because the money
-- has already moved and the order must be honoured or refunded by a person.
-- An order placed before 0039 has no holds; p_coupon_code and p_lines say
-- what it needs. A cancelled order is left alone. Idempotent.
-- ------------------------------------------------------------
create or replace function public.settle_order_holds(
  p_order_id    uuid,
  p_coupon_code text,
  p_user_id     uuid,
  p_lines       jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fulfilment text;
  v_coupon_id uuid;
  v_room text;
  v_short integer;
  v_warnings jsonb := '[]'::jsonb;
  v_taken integer := 0;
  r public.order_holds%rowtype;
begin
  select fulfillment_status into v_fulfilment from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_fulfilment = 'cancelled' then
    return jsonb_build_object('ok', true, 'skipped', 'cancelled');
  end if;

  if not exists (select 1 from public.order_holds where order_id = p_order_id) then
    if nullif(btrim(p_coupon_code), '') is not null then
      select id into v_coupon_id from public.coupons where upper(code) = upper(btrim(p_coupon_code));
      if v_coupon_id is not null then
        insert into public.order_holds (order_id, kind, coupon_id, user_id, status)
          values (p_order_id, 'coupon', v_coupon_id, p_user_id, 'released');
      end if;
    end if;
    insert into public.order_holds (order_id, kind, target, target_id, qty, label, status)
      select p_order_id, 'stock', l.target, l.target_id, l.qty, l.label, 'released'
      from public.order_hold_lines(p_lines) l;
  end if;

  for r in select * from public.order_holds
           where order_id = p_order_id and kind = 'coupon' and status in ('held', 'released', 'restored') loop
    perform 1 from public.coupons where id = r.coupon_id for update;
    if not (r.status = 'held' and r.expires_at > now()) then
      v_room := public.order_hold_coupon_room(r.coupon_id, r.user_id, p_order_id);
      if v_room <> 'ok' then
        update public.order_holds set status = 'released', updated_at = now() where id = r.id;
        v_warnings := v_warnings || jsonb_build_object('kind', 'coupon',
          'code', (select code from public.coupons where id = r.coupon_id), 'reason', v_room);
        continue;
      end if;
    end if;
    perform public.order_hold_count_coupon(r.coupon_id, p_order_id, r.user_id);
    update public.order_holds set status = 'committed', updated_at = now() where id = r.id;
    v_taken := v_taken + 1;
  end loop;

  for r in select * from public.order_holds
           where order_id = p_order_id and kind = 'stock' and status in ('held', 'released', 'restored')
           order by target, target_id loop
    v_short := public.order_hold_adjust_stock(r.target, r.target_id, -r.qty);
    if v_short > 0 then
      v_warnings := v_warnings || jsonb_build_object('kind', 'stock', 'label', r.label, 'qty', r.qty, 'short', v_short);
    end if;
    update public.order_holds set status = 'committed', updated_at = now() where id = r.id;
    v_taken := v_taken + 1;
  end loop;

  if jsonb_array_length(v_warnings) > 0 then
    update public.orders set hold_warnings = coalesce(hold_warnings, '[]'::jsonb) || v_warnings where id = p_order_id;
  end if;
  return jsonb_build_object('ok', true, 'taken', v_taken, 'warnings', v_warnings);
end $$;

-- ------------------------------------------------------------
-- 7. release_order_holds — a payment failed, or the customer started a
--    changed checkout. Lets go of live holds only; anything already taken
--    stays taken. Returns how many were released.
-- ------------------------------------------------------------
create or replace function public.release_order_holds(p_order_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  update public.order_holds set status = 'released', updated_at = now()
    where order_id = p_order_id and status = 'held';
  get diagnostics n = row_count;
  return n;
end $$;

-- ------------------------------------------------------------
-- 8. restore_order_holds — the order was cancelled: put back what it took.
-- ------------------------------------------------------------
create or replace function public.restore_order_holds(p_order_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  n integer := 0;
  r public.order_holds%rowtype;
begin
  update public.order_holds set status = 'released', updated_at = now()
    where order_id = p_order_id and status = 'held';
  for r in select * from public.order_holds
           where order_id = p_order_id and kind = 'coupon' and status = 'committed' loop
    perform 1 from public.coupons where id = r.coupon_id for update;
    delete from public.coupon_redemptions where coupon_id = r.coupon_id and order_id = p_order_id;
    if found then
      update public.coupons set used_count = greatest(used_count - 1, 0) where id = r.coupon_id;
    end if;
    update public.order_holds set status = 'restored', updated_at = now() where id = r.id;
    n := n + 1;
  end loop;
  for r in select * from public.order_holds
           where order_id = p_order_id and kind = 'stock' and status = 'committed'
           order by target, target_id loop
    perform public.order_hold_adjust_stock(r.target, r.target_id, r.qty);
    update public.order_holds set status = 'restored', updated_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------
-- 9. Cancel and un-cancel, wherever fulfilment_status is set.
-- ------------------------------------------------------------
create or replace function public.order_holds_on_fulfilment()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.fulfillment_status is not distinct from old.fulfillment_status then
    return new;
  end if;
  if new.fulfillment_status = 'cancelled' then
    perform public.restore_order_holds(new.id);
  elsif old.fulfillment_status = 'cancelled' and (new.payment_status = 'paid' or new.payment_method = 'cod') then
    perform public.settle_order_holds(new.id, null, null, '[]'::jsonb);
  end if;
  return new;
end $$;

drop trigger if exists order_holds_fulfilment on public.orders;
create trigger order_holds_fulfilment
  after update of fulfillment_status on public.orders
  for each row execute function public.order_holds_on_fulfilment();

-- ------------------------------------------------------------
-- 10. Who may call them: the server's service role, nobody else.
-- ------------------------------------------------------------
revoke all on function public.order_hold_lock_stock(text, uuid) from public, anon, authenticated;
revoke all on function public.order_hold_adjust_stock(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.order_hold_lines(jsonb) from public, anon, authenticated;
revoke all on function public.order_hold_coupon_room(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.order_hold_count_coupon(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_order_holds(uuid, boolean, integer, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.settle_order_holds(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.release_order_holds(uuid) from public, anon, authenticated;
revoke all on function public.restore_order_holds(uuid) from public, anon, authenticated;
revoke all on function public.order_holds_on_fulfilment() from public, anon, authenticated;
grant execute on function public.order_hold_lock_stock(text, uuid) to service_role;
grant execute on function public.order_hold_adjust_stock(text, uuid, integer) to service_role;
grant execute on function public.order_hold_lines(jsonb) to service_role;
grant execute on function public.order_hold_coupon_room(uuid, uuid, uuid) to service_role;
grant execute on function public.order_hold_count_coupon(uuid, uuid, uuid) to service_role;
grant execute on function public.reserve_order_holds(uuid, boolean, integer, text, uuid, jsonb) to service_role;
grant execute on function public.settle_order_holds(uuid, text, uuid, jsonb) to service_role;
grant execute on function public.release_order_holds(uuid) to service_role;
grant execute on function public.restore_order_holds(uuid) to service_role;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
select 'order_holds table (expect 1)' as what, count(*)::text as detail
  from pg_class where relname = 'order_holds' and relrowsecurity
union all select 'new order columns (expect 2)', count(*)::text
  from information_schema.columns where table_schema = 'public' and table_name = 'orders'
   and column_name in ('reserved_until', 'hold_warnings')
union all select 'functions (expect 10)', count(*)::text
  from pg_proc where proname in ('order_hold_lock_stock', 'order_hold_adjust_stock', 'order_hold_lines',
    'order_hold_coupon_room', 'order_hold_count_coupon', 'reserve_order_holds', 'settle_order_holds',
    'release_order_holds', 'restore_order_holds', 'order_holds_on_fulfilment')
union all select 'functions running as their owner (expect 0)', count(*)::text
  from pg_proc where proname in ('order_hold_lock_stock', 'order_hold_adjust_stock', 'order_hold_lines',
    'order_hold_coupon_room', 'order_hold_count_coupon', 'reserve_order_holds', 'settle_order_holds',
    'release_order_holds', 'restore_order_holds', 'order_holds_on_fulfilment') and prosecdef
union all select 'cancel trigger (expect 1)', count(*)::text
  from pg_trigger where tgname = 'order_holds_fulfilment' and not tgisinternal;
-- ============================================================
