-- Rollback of 0048_price_drops_and_notes.sql.
drop view if exists public.catalogue_price_drops;
alter table public.enquiries drop column if exists notes;
