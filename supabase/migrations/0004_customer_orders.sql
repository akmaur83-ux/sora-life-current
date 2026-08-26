-- ============================================================
-- SORA LIFE — customer ↔ order linkage (Phase 2)
-- Run once in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- Additive only. Adds a nullable orders.user_id so a signed-in customer's
-- NEW orders can be linked to their auth.users identity, and a customer
-- SELECT policy so a customer can read ONLY their own linked orders.
--
-- Deliberately unchanged by this migration:
--   * existing "orders admin read" policy (admins keep full read access)
--   * all writes stay server-side via the service-role key — NO customer
--     insert/update/delete policy is created, so a customer can never
--     create or alter an order, amount, or payment status.
--   * historical/guest orders keep user_id = NULL and are never auto-linked
--     by email (email is not proof of account ownership).
-- ============================================================

-- 1. Nullable link to the authenticated user. NULL for every existing row
--    and for all future guest orders. on delete set null keeps the order
--    record (for accounting/audit) if the auth user is ever deleted.
alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 2. Index for the customer's "my orders" lookup (user_id = auth.uid()).
create index if not exists orders_user_id_idx on public.orders (user_id);

-- 3. Customer may READ only their own linked orders. A NULL user_id row
--    (guest/historical) yields (NULL = uid) -> NULL -> excluded; an
--    anonymous request has auth.uid() = NULL -> excluded. So guests and
--    anon can never read any order through this policy.
drop policy if exists "orders customer read" on public.orders;
create policy "orders customer read"
  on public.orders for select
  using (
    user_id is not null
    and user_id = auth.uid()
  );

-- 4. Existing admin read policy is intentionally left exactly as created in
--    0003_orders.sql — not redefined here.

select 'orders.user_id + customer read policy ready.' as status;
