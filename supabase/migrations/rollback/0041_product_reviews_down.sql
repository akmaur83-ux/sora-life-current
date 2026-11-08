-- Rollback for 0041: removes the reviews table and every review in it.
drop table if exists public.product_reviews;
