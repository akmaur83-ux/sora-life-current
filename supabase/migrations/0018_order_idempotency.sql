-- ============================================================
-- 0018 — Duplicate-submit protection for orders.
--
-- Run ONCE in the Supabase SQL Editor (Project → SQL Editor → New query),
-- the same way every migration in this project is applied. Idempotent and
-- safe to re-run (add column / create index are both IF NOT EXISTS).
--
-- STATUS: NOT APPLIED TO PRODUCTION.
--
-- Additive and safe to run on a live database: the new column is nullable
-- so every existing row stays valid, and the index is partial over a
-- column that is NULL everywhere today, so it cannot fail on existing
-- rows.
--
-- (Coupon double-consumption needs nothing here — 0009 already carries a
-- unique index on coupon_redemptions (coupon_id, order_id).)
--
-- The application code tolerates this migration being absent (an unknown
-- column is stripped from the insert, exactly like the 0006 columns), so
-- code may ship before the migration runs. Running the migration first is
-- still preferable — until it exists, duplicate-submit protection is
-- simply inactive.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Order idempotency key
--
-- One checkout submit == one key, minted by the browser. A retried fetch,
-- a double-click or a back-button resubmit carries the SAME key and must
-- resolve to the SAME order. Two genuinely separate orders (a customer
-- reordering the same basket ten minutes later) carry different keys and
-- both get created, which is why this is not derived from cart contents.
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists idempotency_key text;

-- Partial unique index: NULL keys (every order created before this
-- migration, and any client that does not send one) are unconstrained,
-- while a supplied key can back exactly one order. This is the constraint
-- that decides the winner when two concurrent submits race past the
-- application-level lookup.
create unique index if not exists orders_idempotency_key_uniq
  on public.orders (idempotency_key)
  where idempotency_key is not null;

comment on column public.orders.idempotency_key is
  'Client-supplied per-submit key. Unique when present; used to collapse duplicate order submissions.';

-- ============================================================
-- ROLLBACK
--
--   drop index if exists public.orders_idempotency_key_uniq;
--   alter table public.orders drop column if exists idempotency_key;
--
-- Dropping the column loses the duplicate-submit protection but breaks
-- nothing: the application already treats a missing column as "feature
-- unavailable" and continues to create orders normally.
-- ============================================================
