-- ============================================================
-- SORA LIFE — 0042 PRODUCT QUESTIONS & STOCK ALERTS (owner, 2026-11-08: more features)
-- Safe to re-run.
--
-- product_questions  a signed-in customer asks about a product; it waits
--                    'pending' until an admin answers it and publishes it.
--                    Public reads see published questions with their answer,
--                    never user_id (column grants). A customer reads and may
--                    delete their own; an admin (is_sora_admin) does the rest.
--
-- stock_alerts       "Notify me when it is back": anyone leaves an email for an
--                    out-of-stock product (and the size/colour they wanted).
--                    Nobody but an admin can read them; one per product, choice
--                    and email. The admin marks them notified once told.
--
-- product_key is '<store>:<id>' as in product_reviews (0041).
-- ============================================================
create table if not exists public.product_questions (
  id           uuid primary key default gen_random_uuid(),
  product_key  text not null check (product_key ~ '^(wellness|homeliving|fashion):[A-Za-z0-9-]{1,64}$'),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question     text not null check (char_length(question) between 10 and 500),
  author_name  text not null check (char_length(author_name) between 1 and 60),
  answer       text check (answer is null or char_length(answer) between 1 and 2000),
  status       text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz,
  check (status <> 'published' or answer is not null)
);
create index if not exists product_questions_public_idx on public.product_questions (product_key, answered_at desc) where status = 'published';

alter table public.product_questions enable row level security;

drop policy if exists "questions public read published" on public.product_questions;
create policy "questions public read published" on public.product_questions
  for select using (status = 'published');

drop policy if exists "questions own read" on public.product_questions;
create policy "questions own read" on public.product_questions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "questions own insert pending" on public.product_questions;
create policy "questions own insert pending" on public.product_questions
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and answer is null and answered_at is null);

drop policy if exists "questions own delete" on public.product_questions;
create policy "questions own delete" on public.product_questions
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "questions admin all" on public.product_questions;
create policy "questions admin all" on public.product_questions
  for all to authenticated using (public.is_sora_admin()) with check (public.is_sora_admin());

revoke all on public.product_questions from anon, authenticated;
grant select (id, product_key, question, author_name, answer, status, created_at, answered_at) on public.product_questions to anon, authenticated;
grant insert (product_key, question, author_name) on public.product_questions to authenticated;
grant delete on public.product_questions to authenticated;
grant update (answer, status, answered_at) on public.product_questions to authenticated;

create table if not exists public.stock_alerts (
  id            uuid primary key default gen_random_uuid(),
  product_key   text not null check (product_key ~ '^(wellness|homeliving|fashion):[A-Za-z0-9-]{1,64}$'),
  product_name  text not null check (char_length(product_name) between 1 and 200),
  choice        text not null default '' check (char_length(choice) <= 80),
  email         text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  user_id       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  notified_at   timestamptz
);
create unique index if not exists stock_alerts_once on public.stock_alerts (product_key, choice, lower(email));
create index if not exists stock_alerts_open_idx on public.stock_alerts (created_at desc) where notified_at is null;

alter table public.stock_alerts enable row level security;

drop policy if exists "alerts anyone insert" on public.stock_alerts;
create policy "alerts anyone insert" on public.stock_alerts
  for insert to anon, authenticated with check (notified_at is null and (user_id is null or user_id = auth.uid()));

drop policy if exists "alerts admin all" on public.stock_alerts;
create policy "alerts admin all" on public.stock_alerts
  for all to authenticated using (public.is_sora_admin()) with check (public.is_sora_admin());

revoke all on public.stock_alerts from anon, authenticated;
grant insert (product_key, product_name, choice, email) on public.stock_alerts to anon, authenticated;
grant select, update (notified_at), delete on public.stock_alerts to authenticated;
