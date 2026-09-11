-- ============================================================
-- 0029 — DESKTOP ARTWORK FOR HERO SLIDES AND PROMOTIONS
--
-- One image has been serving every viewport. A portrait creative composed
-- for a 390px phone is absurdly tall at 1440px; a landscape one composed for
-- the desktop stage is cropped on a phone. The fixes so far (frame the hero
-- to the artwork, centre the poster at two thirds) make the single image
-- presentable, but they cannot make one crop right for both.
--
-- Each surface gets an OPTIONAL second image for wide viewports.
--
--   image_url          unchanged. The mobile image, and the default: it is
--                      what every viewport shows when no desktop image is set,
--                      so nothing already configured changes.
--   desktop_image_url  new, nullable. Used at >= 1024px only, via a
--                      <picture> source with a media query, so a phone never
--                      downloads it and a desktop never downloads both.
--
-- Recommended dimensions, shown in the admin beside the upload:
--   hero slide  1600 × 600   promotion poster  1200 × 500
--
-- No policy changes. RLS is row-level: hero_slides public read / admin write
-- (0001) and promotions public read / admin all (0017) cover the new column
-- as they cover every other. Both upload buckets already exist.
-- ============================================================

alter table public.hero_slides add column if not exists desktop_image_url text;
alter table public.promotions  add column if not exists desktop_image_url text;

-- ------------------------------------------------------------
-- Verification. Expect two rows.
-- ------------------------------------------------------------
select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('hero_slides', 'promotions')
   and column_name = 'desktop_image_url'
 order by table_name;
