-- Rollback for 0042: removes product questions and stock alerts (their rows go with them).
drop table if exists public.stock_alerts;
drop table if exists public.product_questions;
