-- ============================================================
-- 0047 · Enquiries (owner, 2026-11-20: more features, round 11). What visitors ask of
-- SORA through the site's own forms:
--   * partner — a brand or maker who wants to sell on SORA (/sell);
--   * bulk    — corporate or bulk gifting (/sell#bulk);
--   * request — a product someone searched for and did not find.
-- Anyone can send one (insert only, the listed columns, sizes capped); only the admin
-- reads them and marks them handled. Contact details are what the sender typed, for
-- replying, and are never shown anywhere but Admin → Enquiries.
-- Rollback: rollback/0047_enquiries_down.sql
-- ============================================================
create table if not exists public.enquiries (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('partner', 'bulk', 'request')),
  name        text check (name is null or char_length(name) <= 80),
  phone       text check (phone is null or phone ~ '^[0-9+ -]{7,16}$'),
  email       text check (email is null or (char_length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  business    text check (business is null or char_length(business) <= 120),
  city        text check (city is null or char_length(city) <= 60),
  website     text check (website is null or char_length(website) <= 200),
  query       text check (query is null or char_length(query) <= 120),
  store       text check (store is null or store in ('wellness', 'fashion', 'homeliving')),
  message     text check (message is null or char_length(message) <= 1000),
  status      text not null default 'new' check (status in ('new', 'contacted', 'done')),
  created_at  timestamptz not null default now(),
  -- a way to reply is needed, except for a plain product request
  constraint enquiries_contact check (kind = 'request' or phone is not null or email is not null)
);
create index if not exists enquiries_recent_idx on public.enquiries (created_at desc);
alter table public.enquiries enable row level security;
drop policy if exists "enquiries anyone insert" on public.enquiries;
create policy "enquiries anyone insert" on public.enquiries for insert to anon, authenticated with check (status = 'new');
drop policy if exists "enquiries admin read" on public.enquiries;
create policy "enquiries admin read" on public.enquiries for select to authenticated using (public.is_sora_admin());
drop policy if exists "enquiries admin update" on public.enquiries;
create policy "enquiries admin update" on public.enquiries for update to authenticated using (public.is_sora_admin()) with check (public.is_sora_admin());
revoke all on public.enquiries from anon, authenticated;
grant insert (kind, name, phone, email, business, city, website, query, store, message) on public.enquiries to anon, authenticated;
grant select, update (status) on public.enquiries to authenticated;
