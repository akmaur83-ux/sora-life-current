-- ============================================================
-- SORA LIFE — orders + Razorpay payment tracking
-- Run once in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- There was no orders table before this; nothing here alters existing
-- tables. Orders are written ONLY by the server-side API routes using
-- the service-role key (which bypasses RLS). No anon/public policy is
-- granted for insert/update, so the browser can never create or modify
-- an order — that is the whole point of server-side verification.
-- ============================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,

  -- Lifecycle: pending -> paid | failed | cancelled
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'cancelled')),
  payment_method text not null default 'razorpay'
    check (payment_method in ('razorpay', 'cod')),

  -- Razorpay identifiers. razorpay_order_id is UNIQUE, which is what makes
  -- verification idempotent — a repeated callback can never create a
  -- second paid order for the same Razorpay order.
  razorpay_order_id text unique,
  razorpay_payment_id text,

  -- Amount is stored in the smallest currency unit (paise) exactly as it
  -- was sent to Razorpay, so the charged amount is auditable.
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR',

  -- Server-recalculated line items (never the client's numbers) and the
  -- customer/delivery details captured at checkout.
  items jsonb not null default '[]'::jsonb,
  customer jsonb not null default '{}'::jsonb,
  delivery_method text,

  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status);

alter table public.orders enable row level security;

-- Admins (already-existing admin_users membership) may READ orders so the
-- Admin panel can list them. Deliberately no public select/insert/update
-- policy: anon has no access at all, and all writes go through the
-- service-role key in the server-side API routes.
drop policy if exists "orders admin read" on public.orders;
create policy "orders admin read"
  on public.orders for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

select 'orders table ready.' as status;
