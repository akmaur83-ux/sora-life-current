-- Rollback of 0046_product_views.sql.
drop function if exists public.popular_products(integer, integer);
drop table if exists public.product_views;
