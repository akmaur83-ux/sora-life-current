-- ============================================================
-- 0043 · Shop insights (owner, 2026-11-13: features 23, 26, 33, 36, 37)
--
--   * catalogue_price_history — one row per product per day with that day's price
--     and M.R.P., written by a trigger whenever a catalogue price is set or changed
--     (and once for every live product today). The product pages draw it as a small
--     price graph once there are two or more days to show. Public read; no client writes.
--   * catalogue_category_covers — a view: each catalogue category's first product
--     picture, for the menus' category tiles. security_invoker, so it reads only
--     what the visitor could read anyway (active products).
--   (The search log and the Q&A votes are in 0045_search_log_and_votes.sql.)
--   * search_log — what shoppers searched for, in which store, and how many results
--     came back. No user, no IP, nothing personal: the query text only. Anyone can
--     add a row; only the admin reads them (the Insights page). popular_searches()
--     gives the public the aggregate only: queries searched at least 3 times in the
--     last N days that found something.
--   * product_questions.helpful — "Was this answer helpful?" count, raised one at a
--     time through vote_question_helpful(); published questions only.
-- Rollback: rollback/0043_insights_down.sql
-- ============================================================

create table if not exists public.catalogue_price_history (
  product_id   uuid not null references public.catalogue_products(id) on delete cascade,
  recorded_on  date not null default (now() at time zone 'Asia/Kolkata')::date,
  price        numeric not null check (price >= 0),
  mrp          numeric check (mrp is null or mrp >= 0),
  primary key (product_id, recorded_on)
);
alter table public.catalogue_price_history enable row level security;
drop policy if exists "price history public read" on public.catalogue_price_history;
create policy "price history public read" on public.catalogue_price_history for select using (true);
-- The trigger runs as whoever changed the price (security invoker): the catalogue admin,
-- through the same admin_users rule as every catalogue write; imports use the service role.
drop policy if exists "price history admin write" on public.catalogue_price_history;
create policy "price history admin write" on public.catalogue_price_history for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
revoke all on public.catalogue_price_history from anon, authenticated;
grant select on public.catalogue_price_history to anon, authenticated;
grant insert, update on public.catalogue_price_history to authenticated;

create or replace function public.record_catalogue_price() returns trigger
language plpgsql security invoker set search_path = public as $$
declare p numeric := coalesce(new.sale_price, new.mrp);
begin
  if p is null then return new; end if;
  insert into public.catalogue_price_history (product_id, recorded_on, price, mrp)
  values (new.id, (now() at time zone 'Asia/Kolkata')::date, p, new.mrp)
  on conflict (product_id, recorded_on) do update set price = excluded.price, mrp = excluded.mrp;
  return new;
end $$;
revoke all on function public.record_catalogue_price() from public, anon, authenticated;

drop trigger if exists catalogue_price_history_trg on public.catalogue_products;
create trigger catalogue_price_history_trg
  after insert or update of sale_price, mrp on public.catalogue_products
  for each row execute function public.record_catalogue_price();

insert into public.catalogue_price_history (product_id, price, mrp)
select id, coalesce(sale_price, mrp), mrp from public.catalogue_products
where is_active and coalesce(sale_price, mrp) is not null
on conflict do nothing;

create or replace view public.catalogue_category_covers with (security_invoker = true) as
select distinct on (p.category_id) p.category_id, p.images[1] as image
from public.catalogue_products p
where p.is_active and p.category_id is not null and array_length(p.images, 1) > 0
order by p.category_id, p.sort_order nulls last, p.id;
grant select on public.catalogue_category_covers to anon, authenticated;
