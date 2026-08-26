-- ============================================================
-- SORA LIFE — customer profiles + saved addresses (Phase 3.1–3.2)
-- Run once in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- Additive only. Creates two owner-scoped tables for the logged-in
-- customer experience (name/phone profile + reusable shipping addresses)
-- and their RLS. Deliberately does NOT touch orders, orders RLS, or any
-- payment path.
--
-- Ownership model mirrors the rest of the app: a row belongs to the
-- authenticated user (auth.uid()), and RLS lets a customer read/write ONLY
-- their own rows. No admin CRUD policy is created on these tables, and anon
-- (auth.uid() = NULL) has no access at all.
--
-- Column names intentionally mirror the fields already snapshotted into
-- orders.customer, so checkout prefill and the order snapshot stay trivial.
-- Saved addresses are only a prefill source — orders.customer remains an
-- independent point-in-time copy, so editing/deleting an address later never
-- changes any historical order.
-- ============================================================

-- ---------- 1. profiles: mutable name/phone, 1:1 with auth.users ----------
-- Email is NOT stored here — it lives in auth.users (the source of truth)
-- and is read from the session, never duplicated as a writable column.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 2. customer_addresses: reusable saved shipping addresses ----------
-- user_id defaults to auth.uid() so the client never has to supply it; RLS
-- (with check below) rejects any attempt to set someone else's user_id.
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text,
  first_name text,
  last_name text,
  phone text,
  address text,
  apartment text,
  landmark text,
  city text,
  state text,
  pin text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3. indexes ----------
create index if not exists customer_addresses_user_id_idx
  on public.customer_addresses (user_id);

-- Enforce AT MOST ONE default address per user at the database level, not
-- just in the app. Partial unique index over user_id where is_default.
create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (user_id)
  where is_default;

-- ---------- 4. RLS ----------
alter table public.profiles enable row level security;
alter table public.customer_addresses enable row level security;

-- profiles: owner-only. No delete policy (a profile is deleted only via the
-- auth.users cascade). No admin policy.
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- customer_addresses: owner-only, all four verbs. The with check on
-- insert/update blocks setting another user's user_id even if forged.
drop policy if exists "customer_addresses self read" on public.customer_addresses;
create policy "customer_addresses self read"
  on public.customer_addresses for select
  using (user_id = auth.uid());

drop policy if exists "customer_addresses self insert" on public.customer_addresses;
create policy "customer_addresses self insert"
  on public.customer_addresses for insert
  with check (user_id = auth.uid());

drop policy if exists "customer_addresses self update" on public.customer_addresses;
create policy "customer_addresses self update"
  on public.customer_addresses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "customer_addresses self delete" on public.customer_addresses;
create policy "customer_addresses self delete"
  on public.customer_addresses for delete
  using (user_id = auth.uid());

select 'profiles + customer_addresses tables, indexes, and RLS ready.' as status;
