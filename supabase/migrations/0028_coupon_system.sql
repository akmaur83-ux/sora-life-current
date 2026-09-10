-- ============================================================
-- 0028 — COUPON SYSTEM
--
-- coupons and coupon_redemptions already exist (0006, hardened in 0009).
-- This migration ADDS ONLY what is missing. It does not create a coupon
-- table, does not rename a column, and does not touch consume_coupon().
--
-- Four columns are genuinely new. Everything else the brief asked for is
-- already there under a different name, and the existing names are kept
-- because consume_coupon(), computeCouponDiscount() and fetchCouponByCode()
-- all read them — renaming is a three-file breaking change to gain nothing.
--
--   brief                 existing column        status
--   title                 —                      ADDED here
--   description           —                      ADDED here
--   first_order_only      —                      ADDED here
--   is_stackable          —                      ADDED here
--   discount_type         type                   exists (flat | percent)
--   discount_value        value                  exists
--   max_discount          max_discount           exists
--   min_order_value       min_order_value        exists, NOT NULL DEFAULT 0
--   starts_at/expires_at  same                   exists
--   usage_limit_total     usage_limit            exists (+ used_count)
--   per_user_limit        per_user_limit         exists (0009)
--   is_active             is_active              exists, default flipped below
-- ============================================================

-- ------------------------------------------------------------
-- 1. The four new columns
-- ------------------------------------------------------------

-- Card copy. Held as data rather than derived in the UI so the PDP and the
-- cart render the same words the admin typed, and neither has to phrase a
-- discount itself.
alter table public.coupons add column if not exists title       text;
alter table public.coupons add column if not exists description text;

-- Restricts a coupon to a customer who has never had a paid order. Checked
-- server-side against orders; NULL/false means anyone may use it.
alter table public.coupons add column if not exists first_order_only boolean not null default false;

-- One coupon per order is the rule. The column exists so the rule is data
-- rather than an assumption, and so combining becomes a policy change rather
-- than a schema change later.
alter table public.coupons add column if not exists is_stackable boolean not null default false;

-- ------------------------------------------------------------
-- 2. New coupons default to OFF
--
-- 0006 created this column DEFAULT true, so a half-filled row was live the
-- moment it was inserted. The system ships dormant: a coupon becomes real
-- when someone deliberately enables it.
--
-- This changes the default for FUTURE inserts only. Existing rows are not
-- touched (there are none today).
-- ------------------------------------------------------------
alter table public.coupons alter column is_active set default false;

-- ------------------------------------------------------------
-- 3. RLS
--
-- 0006 enabled RLS and created exactly one policy: "coupons admin read".
-- There is NO insert/update/delete policy, which means nothing outside the
-- service role can write a coupon — the admin editor cannot save one.
--
-- This adds the write half, copied verbatim from the categories /
-- hero_slides / site_settings pattern in 0001 rather than composed fresh.
-- ------------------------------------------------------------
drop policy if exists "coupons admin write" on public.coupons;
create policy "coupons admin write"
  on public.coupons for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 4. Public read is deliberately NOT added — see the note at the gate.
--
-- 0006 says, in the file: "No public read: a customer must not be able to
-- enumerate every coupon. Validation happens server-side with the
-- service-role key." The PDP card does not need this policy: it is fed by
-- POST /api/coupons/eligible, which runs service-role and returns only the
-- coupons that apply to the cart in hand.
--
-- If you want the storefront reading the table directly instead, this is the
-- policy — window-bounded, active-only. Enable it INSTEAD of the endpoint,
-- not as well, and note that it makes every active code enumerable by anyone.
--
-- drop policy if exists "coupons public read" on public.coupons;
-- create policy "coupons public read"
--   on public.coupons for select
--   using (
--     is_active = true
--     and (starts_at is null or starts_at <= now())
--     and (expires_at is null or expires_at >= now())
--   );
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 5. Lookup support for the eligible/quote endpoints, which filter on
--    exactly this shape.
-- ------------------------------------------------------------
create index if not exists coupons_active_window_idx
  on public.coupons (is_active, starts_at, expires_at);

-- ------------------------------------------------------------
-- NOT DONE HERE, on purpose: consume_coupon() is unchanged.
--
-- It enforces exists+active, per-order idempotency, per_user_limit and
-- usage_limit under a FOR UPDATE row lock. It does NOT check the date
-- window, min_order_value or first_order_only — those live in the API and in
-- create-order's revalidation. See the gate note; extending the function is
-- a decision, not a detail.
-- ------------------------------------------------------------
