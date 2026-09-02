-- ============================================================
-- 0019 — Retire the ₹699 free-shipping threshold from live settings data.
--
-- Run ONCE in the Supabase SQL Editor (Project → SQL Editor → New query),
-- the same way every migration in this project is applied. Idempotent and
-- safe to re-run: a second run matches nothing and reports 0 rows.
--
-- STATUS: NOT APPLIED TO PRODUCTION.
--
-- WHY THIS EXISTS
--
-- Removing the threshold from the code was not enough. Migration 0001
-- SEEDED it into public.site_settings:
--
--   ('announcement', jsonb_build_object(
--      'notices', jsonb_build_array(
--        'FREE SHIPPING on orders above ₹699', ...),
--      'free_shipping_threshold', 699))
--
-- src/components/AnnouncementBar.jsx renders announcement.notices verbatim,
-- so that sentence is on the storefront right now — promising customers
-- something the server no longer does. Shipping is a flat per-method fee:
-- Standard ₹0, Express ₹79, Scheduled ₹49, at every basket size.
--
-- 0001 cannot be edited: it has already run, so changing it would alter
-- history without changing any database. The fix has to be a forward
-- migration over the seeded row.
--
-- SAFETY
--   * Touches exactly one row: site_settings where key = 'announcement'.
--   * Idempotent — re-running changes nothing, and it is already a no-op if
--     an admin has since rewritten the notices by hand.
--   * Admin-authored notices are preserved: only a notice that promises
--     free shipping ABOVE A NUMERIC THRESHOLD is rewritten. Order is kept.
--   * No schema change, no drop, no data loss beyond the retired key.
--   * site_settings.updated_at has no trigger, so it is set explicitly.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Drop the retired setting key.
--
-- Nothing reads it any more (the admin editor no longer writes it and
-- src/lib/settings.js no longer declares it), so leaving it would just
-- invite someone to wire it back up.
--
-- The jsonb_typeof guard matters: `jsonb - text` raises "cannot delete
-- from scalar" if value were ever a JSON scalar rather than an object, and
-- the `?` operator alone would not rule that out (on a JSON string, `?`
-- tests string equality).
-- ------------------------------------------------------------
update public.site_settings
   set value = value - 'free_shipping_threshold',
       updated_at = now()
 where key = 'announcement'
   and jsonb_typeof(value) = 'object'
   and value ? 'free_shipping_threshold';

-- ------------------------------------------------------------
-- 2. Rewrite any notice that promises threshold-based free shipping.
--
-- The pattern is STRUCTURAL, not "free shipping … over … number". It
-- requires the threshold phrase to follow the offer directly:
--
--     free (shipping|delivery)
--       [ (on|for) [all] order[s] ]        <- optional, nothing else allowed
--     (above|over)
--       [ ₹ | Rs[.] | INR ]                <- optional currency marker
--     <digits>
--
-- The gap between the offer and "above/over" is what does the work. A
-- broad `.*over.*[0-9]` would rewrite ordinary marketing copy:
--
--   'Free shipping all over 100 cities'          <- gap is " all "
--   'Free shipping available in over 100 cities' <- gap is " available in "
--
-- Both are preserved here, because the only thing permitted in that gap is
-- an "on/for orders" phrase.
--
--   matches   'FREE SHIPPING on orders above ₹699'   (the 0001 seed)
--             'FREE SHIPPING over ₹699'
--             'Free shipping over Rs. 500'
--             'FREE DELIVERY above 999'
--             'free delivery on orders above INR 1200'
--   ignores   'Free shipping, delivered all over India'
--             'Free shipping all over 100 cities'
--             'Free shipping available in over 100 cities'
--             'Free shipping on selected products'
--             'Free shipping on standard delivery'
--             'Trusted all over Punjab since 2019'
--             'Flat ₹79 express shipping'
--             'FREE STANDARD SHIPPING'
--
-- Note \y, not \b: in PostgreSQL regular expressions \b means BACKSPACE,
-- and \y is the word boundary. The trailing \y on (above|over) is what
-- stops "overnight" from being read as "over".
--
-- The identical pattern appears twice — once to decide whether the row
-- needs rewriting, once to pick the elements to replace. Keep them in sync;
-- scripts/test-migration-0019.mjs asserts that they are identical and
-- exercises every fixture listed above.
-- ------------------------------------------------------------
update public.site_settings
   set value = jsonb_set(
         value,
         '{notices}',
         (
           select coalesce(jsonb_agg(
                    case
                      when notice #>> '{}' ~* '\yfree\s+(shipping|delivery)\y(\s+(on|for)(\s+all)?\s+orders?)?\s+(above|over)\y\s*(₹|rs\.?|inr)?\s*[0-9]'
                        then to_jsonb('FREE STANDARD SHIPPING'::text)
                      else notice
                    end
                    order by ord
                  ), '[]'::jsonb)
           from jsonb_array_elements(value -> 'notices')
                with ordinality as t(notice, ord)
         )
       ),
       updated_at = now()
 where key = 'announcement'
   and jsonb_typeof(value -> 'notices') = 'array'
   and exists (
         select 1
           from jsonb_array_elements(value -> 'notices') as g(notice)
          where notice #>> '{}' ~* '\yfree\s+(shipping|delivery)\y(\s+(on|for)(\s+all)?\s+orders?)?\s+(above|over)\y\s*(₹|rs\.?|inr)?\s*[0-9]'
       );

-- ------------------------------------------------------------
-- VERIFY (read-only — run after applying)
--
--   select jsonb_pretty(value) from public.site_settings
--    where key = 'announcement';
--
-- Expect: no 'free_shipping_threshold' key, no notice quoting a rupee
-- threshold, and every unrelated notice intact and in its original order.
--
-- Eyeball the notices array: if the row happened to contain MORE THAN ONE
-- threshold notice, each becomes 'FREE STANDARD SHIPPING' and the ticker
-- would repeat itself. Delete the surplus entry in Admin → Homepage if so.
-- ------------------------------------------------------------

-- ============================================================
-- ROLLBACK
--
-- This statement rewrites CONTENT. The previous wording is not retained
-- anywhere, so there is no automatic rollback — capture the row first:
--
--   -- BEFORE APPLYING, save this output somewhere durable:
--   select jsonb_pretty(value) from public.site_settings
--    where key = 'announcement';
--
-- To restore, paste the captured JSON back verbatim:
--
--   update public.site_settings
--      set value = '<the captured JSON>'::jsonb,
--          updated_at = now()
--    where key = 'announcement';
--
-- That literal restore is the ONLY reliable rollback. Do not hand-patch a
-- single array index (e.g. '{notices,0}') — the offending notice is only at
-- index 0 in the originally seeded layout, and an admin may have reordered
-- the notices since.
--
-- Rolling back is a business decision, not a technical one: the server
-- charges Express ₹79 / Scheduled ₹49 regardless, so the old copy would be
-- inaccurate again the moment it came back.
-- ============================================================
