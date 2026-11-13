-- Rollback of 0043_insights.sql
drop function if exists public.vote_question_helpful(uuid);
alter table public.product_questions drop column if exists helpful;
drop function if exists public.popular_searches(integer, integer);
drop table if exists public.search_log;
drop view if exists public.catalogue_category_covers;
drop trigger if exists catalogue_price_history_trg on public.catalogue_products;
drop function if exists public.record_catalogue_price();
drop table if exists public.catalogue_price_history;
