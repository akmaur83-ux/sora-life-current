-- ============================================================
-- SORA LIFE — product variants, billing breakdown, invoices, payments
-- Run once in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- ADDITIVE ONLY. Nothing here drops or alters an existing column, so the
-- current catalogue, cart, checkout, orders and payment flow keep working
-- exactly as they do today. Every new order column is nullable or has a
-- default, so historical orders remain valid.
--
-- Writes stay server-side via the service-role key. No customer/anon
-- insert/update policy is created for orders or payments.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Product variants (pack sizes: 250 ml, 750 ml, 60 capsules, ...)
--
-- A variant carries its own ABSOLUTE mrp/sale_price rather than a delta, so
-- "750 ml costs more than 250 ml" is data, not arithmetic in a component.
-- The server reads price from here; the browser only ever sends a variant id.
-- ------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products(id) on delete cascade,

  label text not null,                 -- "750 ml", "60 Capsules"
  size numeric,                        -- 750
  unit text,                           -- 'ml' | 'g' | 'capsules' | 'tablets'
  sku text unique,
  barcode text,

  mrp numeric(10,2) not null check (mrp >= 0),
  sale_price numeric(10,2) check (sale_price >= 0),

  -- Per-variant GST slab. NULL means "use the configured default rate";
  -- there is deliberately no hard-coded rate anywhere in the codebase.
  gst_rate numeric(5,2) check (gst_rate >= 0 and gst_rate <= 100),

  stock integer not null default 0 check (stock >= 0),
  weight_grams numeric(10,2),
  volume_ml numeric(10,2),
  image_url text,
  shipping_note text,

  is_active boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id, sort_order);
create index if not exists product_variants_active_idx
  on public.product_variants (is_active);

alter table public.product_variants enable row level security;

-- Storefront needs to read active variants to render the size selector.
drop policy if exists "variants public read" on public.product_variants;
create policy "variants public read"
  on public.product_variants for select
  using (is_active = true);

-- Admins may read everything (including inactive) for management screens.
drop policy if exists "variants admin read" on public.product_variants;
create policy "variants admin read"
  on public.product_variants for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Admin write access for variant management in the admin panel.
drop policy if exists "variants admin write" on public.product_variants;
create policy "variants admin write"
  on public.product_variants for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 2. Coupons (server-validated; the browser only sends a code)
-- ------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null default 'flat' check (type in ('flat', 'percent')),
  value numeric(10,2) not null check (value >= 0),
  max_discount numeric(10,2),
  min_order_value numeric(10,2) not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

-- No public read: a customer must not be able to enumerate every coupon.
-- Validation happens server-side with the service-role key.
drop policy if exists "coupons admin read" on public.coupons;
create policy "coupons admin read"
  on public.coupons for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 3. Orders: invoice identity + full billing breakdown
--
-- amount_paise stays the single source of truth for what was charged. The
-- breakdown columns are the itemised explanation of that number.
-- ------------------------------------------------------------
alter table public.orders add column if not exists invoice_number text;
alter table public.orders add column if not exists invoiced_at timestamptz;

-- Full server-computed breakdown (mrpTotal, discounts, fees, tax block...).
alter table public.orders add column if not exists billing jsonb not null default '{}'::jsonb;

-- Denormalised money columns so admin lists/reports can filter and sum
-- without unpacking jsonb on every row.
alter table public.orders add column if not exists mrp_total numeric(10,2);
alter table public.orders add column if not exists item_total numeric(10,2);
alter table public.orders add column if not exists product_discount numeric(10,2);
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists coupon_discount numeric(10,2);
alter table public.orders add column if not exists shipping_fee numeric(10,2);
alter table public.orders add column if not exists platform_fee numeric(10,2);
alter table public.orders add column if not exists packaging_fee numeric(10,2);
alter table public.orders add column if not exists taxable_amount numeric(10,2);
alter table public.orders add column if not exists tax_total numeric(10,2);
alter table public.orders add column if not exists tax_mode text;
alter table public.orders add column if not exists billing_address jsonb;

-- Unique only where present, so existing rows with NULL are unaffected.
create unique index if not exists orders_invoice_number_key
  on public.orders (invoice_number) where invoice_number is not null;

-- ------------------------------------------------------------
-- 4. Payment transactions — the gateway audit trail
--
-- One row per gateway event. gateway_payment_id is UNIQUE, which is what
-- makes webhook delivery idempotent: Razorpay retries the same payment id,
-- the insert conflicts, and no duplicate order/receipt is produced.
--
-- NOTE: no card data is ever stored. Only the gateway's tokenised ids.
-- ------------------------------------------------------------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  order_number text,

  gateway text not null default 'razorpay',
  gateway_order_id text,
  gateway_payment_id text unique,
  gateway_signature text,

  event text,                          -- 'payment.captured', 'payment.failed', ...
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'captured', 'paid', 'failed', 'refunded', 'cancelled')),
  method text,                         -- 'upi' | 'card' | 'netbanking' | 'cod' ...
  amount_paise integer check (amount_paise >= 0),
  currency text default 'INR',

  error_code text,
  error_description text,

  -- Raw gateway payload for dispute resolution. Never rendered to customers.
  raw jsonb,

  created_at timestamptz not null default now()
);

create index if not exists payment_tx_order_idx on public.payment_transactions (order_id);
create index if not exists payment_tx_order_number_idx on public.payment_transactions (order_number);
create index if not exists payment_tx_created_idx on public.payment_transactions (created_at desc);

alter table public.payment_transactions enable row level security;

-- Admin-only read. Customers see payment status through their order, not
-- through the raw gateway trail.
drop policy if exists "payment tx admin read" on public.payment_transactions;
create policy "payment tx admin read"
  on public.payment_transactions for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 5. Backfill invoice numbers for already-paid orders that lack one.
--    Uses the order's own created_at financial year.
-- ------------------------------------------------------------
update public.orders
set invoice_number = 'SL/'
      || to_char(
           case when extract(month from created_at) >= 4
                then created_at
                else created_at - interval '1 year' end, 'YY')
      || to_char(
           case when extract(month from created_at) >= 4
                then created_at + interval '1 year'
                else created_at end, 'YY')
      || '/' || upper(substr(replace(id::text, '-', ''), 1, 12)),
    invoiced_at = coalesce(paid_at, created_at)
where invoice_number is null
  and payment_status = 'paid';

select 'variants, coupons, billing, invoices and payment_transactions ready.' as status;
