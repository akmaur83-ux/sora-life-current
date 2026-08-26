-- ============================================================
-- SORA LIFE — security hardening (additive, idempotent, non-destructive)
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Closes three audit findings without changing any existing behaviour:
--   1. Coupon usage limit is now ENFORCED and race-safe (M2).
--   2. A shared, serverless-safe rate-limit store + function (M3).
--   3. site_settings public read is narrowed to presentation keys (L4).
--
-- Touches NO existing data. Adds two tables, two SECURITY DEFINER functions
-- (locked search_path, executable only by the service role), one nullable
-- column, and one narrowed SELECT policy. No table is dropped, no row is
-- modified, no policy is loosened. Razorpay is untouched.
-- ============================================================

-- ------------------------------------------------------------
-- 1. COUPON USAGE — atomic, race-safe consumption
--
-- Problem: api/_lib/supabaseAdmin.js checked used_count < usage_limit but
-- nothing ever incremented used_count, so a limited coupon was infinite-use.
--
-- Fix: a ledger table + a function that runs the whole decision under a row
-- lock on the coupon (FOR UPDATE), so two simultaneous paid orders can never
-- push used_count past usage_limit, and a duplicate webhook/verify for the
-- SAME order is a no-op (per-order idempotency via a unique index).
-- ------------------------------------------------------------

-- Optional per-customer cap. NULL (default) = no per-user limit -> existing
-- coupons behave exactly as before.
alter table public.coupons add column if not exists per_user_limit integer;

create table if not exists public.coupon_redemptions (
  id           uuid primary key default gen_random_uuid(),
  coupon_id    uuid not null references public.coupons(id) on delete cascade,
  order_id     uuid references public.orders(id) on delete set null,
  order_number text,
  user_id      uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- The per-order idempotency guard: one redemption per (coupon, order).
create unique index if not exists coupon_redemptions_coupon_order_key
  on public.coupon_redemptions (coupon_id, order_id) where order_id is not null;
create index if not exists coupon_redemptions_user_idx
  on public.coupon_redemptions (coupon_id, user_id);

alter table public.coupon_redemptions enable row level security;
-- Admin read only; NO insert/update/delete policy -> only the service-role
-- SECURITY DEFINER function below can write. anon/authenticated get nothing.
drop policy if exists "coupon_redemptions admin read" on public.coupon_redemptions;
create policy "coupon_redemptions admin read"
  on public.coupon_redemptions for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create or replace function public.consume_coupon(
  p_code         text,
  p_order_id     uuid,
  p_user_id      uuid,
  p_order_number text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coupon    public.coupons%rowtype;
  v_user_uses integer;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return 'no_coupon';
  end if;

  -- Lock the coupon row: concurrent consumers serialise here, so the
  -- used_count check and increment below are atomic with respect to races.
  select * into v_coupon
  from public.coupons
  where upper(code) = upper(trim(p_code)) and is_active = true
  for update;

  if not found then
    return 'no_coupon';
  end if;

  -- Idempotency: a duplicate verify/webhook for the same order must not
  -- consume the coupon twice.
  if p_order_id is not null and exists (
    select 1 from public.coupon_redemptions
    where coupon_id = v_coupon.id and order_id = p_order_id
  ) then
    return 'already';
  end if;

  -- Optional per-customer cap (only when configured and the buyer is known).
  if v_coupon.per_user_limit is not null and p_user_id is not null then
    select count(*) into v_user_uses
    from public.coupon_redemptions
    where coupon_id = v_coupon.id and user_id = p_user_id;
    if v_user_uses >= v_coupon.per_user_limit then
      return 'user_limit';
    end if;
  end if;

  -- Global usage limit.
  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
    return 'exhausted';
  end if;

  update public.coupons
    set used_count = used_count + 1
    where id = v_coupon.id;

  insert into public.coupon_redemptions (coupon_id, order_id, order_number, user_id)
    values (v_coupon.id, p_order_id, p_order_number, p_user_id);

  return 'consumed';
end;
$$;

-- Only the server (service-role) may consume. A customer/anon must never be
-- able to call this and burn or inflate coupon counts.
revoke all on function public.consume_coupon(text, uuid, uuid, text) from public;
revoke all on function public.consume_coupon(text, uuid, uuid, text) from anon, authenticated;
grant execute on function public.consume_coupon(text, uuid, uuid, text) to service_role;

-- ------------------------------------------------------------
-- 2. RATE LIMITING — shared store + atomic fixed-window counter
--
-- Serverless functions do not share memory, so the limiter lives in Postgres
-- (the infrastructure this project already runs). One atomic upsert per hit.
-- ------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket_key text primary key,          -- "<name>:<ip>:<window-bucket>"
  count      integer not null default 0,
  expires_at timestamptz not null
);
create index if not exists rate_limits_expires_idx on public.rate_limits (expires_at);

alter table public.rate_limits enable row level security;
-- No policy at all: only the service-role SECURITY DEFINER function writes it.

create or replace function public.rate_limit_check(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window integer := greatest(coalesce(p_window_seconds, 60), 1);
  v_bucket bigint  := floor(extract(epoch from now()) / v_window);
  v_key    text    := p_key || ':' || v_bucket::text;
  v_reset  timestamptz := to_timestamp((v_bucket + 1) * v_window);
  v_count  integer;
begin
  insert into public.rate_limits (bucket_key, count, expires_at)
    values (v_key, 1, v_reset)
  on conflict (bucket_key)
    do update set count = public.rate_limits.count + 1
    returning count into v_count;

  -- Occasional opportunistic cleanup so the table cannot grow unbounded.
  if random() < 0.02 then
    delete from public.rate_limits where expires_at < now() - interval '2 minutes';
  end if;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count',   v_count,
    'limit',   p_limit,
    'reset',   floor(extract(epoch from v_reset))::bigint
  );
end;
$$;

revoke all on function public.rate_limit_check(text, integer, integer) from public;
revoke all on function public.rate_limit_check(text, integer, integer) from anon, authenticated;
grant execute on function public.rate_limit_check(text, integer, integer) to service_role;

-- ------------------------------------------------------------
-- 3. site_settings — narrow public read to presentation keys only (L4)
--
-- Previously `using (true)` made every row world-readable. Now only the known
-- presentation keys are public; anything else added later is admin-only by
-- default. The admin for-all policy still gives admins full read/write, so
-- the admin UI is unaffected, and the storefront keys stay public.
-- ------------------------------------------------------------
drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read"
  on public.site_settings for select
  using (key in ('branding', 'announcement', 'contact', 'homepage'));

-- ------------------------------------------------------------
-- 4. Defensive: ensure admin_users has RLS on (no-op if already enabled).
--    Does NOT add/alter any policy, so admin login is unaffected.
-- ------------------------------------------------------------
alter table if exists public.admin_users enable row level security;

select 'Security hardening migration complete.' as status;
