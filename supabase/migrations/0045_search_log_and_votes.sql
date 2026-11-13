-- ============================================================
-- 0045 · The search log and "Was this answer helpful?" (owner, 2026-11-13:
-- features 33, 36, 37). Applied together with 0043 as one migration on the
-- database; kept in its own file because these two functions run as their owner
-- (security definer) on purpose — each exposes only an aggregate or a +1 — and
-- they touch no product tables.
--   * search_log — the query text, the store and the result count; nothing
--     personal. Anyone can add a row; only the admin reads them.
--   * popular_searches() — the public aggregate: searched 3+ times in N days, found something.
--   * product_questions.helpful + vote_question_helpful() — published questions only.
-- Rollback: rollback/0043_insights_down.sql
-- ============================================================
create table if not exists public.search_log (
  id          bigint generated always as identity primary key,
  q           text not null check (char_length(q) between 1 and 80),
  store       text not null check (store in ('wellness', 'fashion', 'homeliving', 'grocery')),
  results     integer not null check (results >= 0 and results < 100000),
  created_at  timestamptz not null default now()
);
create index if not exists search_log_recent_idx on public.search_log (created_at desc);
alter table public.search_log enable row level security;
drop policy if exists "search log anyone insert" on public.search_log;
create policy "search log anyone insert" on public.search_log for insert to anon, authenticated with check (true);
drop policy if exists "search log admin read" on public.search_log;
create policy "search log admin read" on public.search_log for select to authenticated using (public.is_sora_admin());
revoke all on public.search_log from anon, authenticated;
grant insert (q, store, results) on public.search_log to anon, authenticated;
grant select on public.search_log to authenticated;

create or replace function public.popular_searches(days integer default 14, max_rows integer default 8)
returns table (q text, n bigint)
language sql stable security definer set search_path = public as $$
  select lower(trim(s.q)) as q, count(*) as n
  from public.search_log s
  where s.created_at > now() - make_interval(days => least(greatest(days, 1), 60))
    and s.results > 0
  group by lower(trim(s.q))
  having count(*) >= 3
  order by n desc, q
  limit least(greatest(max_rows, 1), 20);
$$;
revoke all on function public.popular_searches(integer, integer) from public;
grant execute on function public.popular_searches(integer, integer) to anon, authenticated;

alter table public.product_questions add column if not exists helpful integer not null default 0 check (helpful >= 0);
grant select (helpful) on public.product_questions to anon, authenticated;

create or replace function public.vote_question_helpful(qid uuid) returns integer
language sql security definer set search_path = public as $$
  update public.product_questions set helpful = helpful + 1
  where id = qid and status = 'published'
  returning helpful;
$$;
revoke all on function public.vote_question_helpful(uuid) from public;
grant execute on function public.vote_question_helpful(uuid) to anon, authenticated;
