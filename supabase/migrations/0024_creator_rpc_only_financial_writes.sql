-- ============================================================
-- 0024 — Close the direct-table write path on creator KYC and conversions.
--
-- Run ONCE in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Grants only: no schema change, no data change, fully idempotent.
--
-- STATUS: NOT APPLIED TO PRODUCTION.
--
-- WHY THIS EXISTS
--
-- 0023 closed this class on the three payout tables. The same hole is still
-- open on two tables that decide whether money is created at all.
--
-- Both have an RLS policy of the form
--   create policy "... admin all" ... for all using (is_sora_admin())
-- and Supabase grants authenticated full DML on public tables by default.
-- So any session holding an admin JWT — including one obtained through a
-- stolen token or a script running in an admin's browser — can bypass the
-- guarded RPCs entirely:
--
--   update public.creator_kyc_profiles set identity_status = 'verified' ...
--     -- skips admin_set_kyc_status(): no verified_by, no verification_notes,
--        no audit, and immediately satisfies the KYC gate in request_payout.
--
--   update public.creator_conversions set status = 'eligible' ...
--     -- MINTS COMMISSION. creator_conversion_commission_sync() fires on the
--        transition into 'eligible' and writes a creator_commission_ledger
--        row. This is the single most valuable write in the system and it
--        was reachable without going through record_conversion() or
--        set_conversion_status().
--
-- Creators were never able to do either of these: every creator-facing
-- policy on these tables is SELECT-only (0013, 0014). This migration is
-- about removing the unaudited ADMIN bypass, so the RPCs — which write the
-- audit trail — become the only way in.
--
-- WHAT IS DELIBERATELY *NOT* REVOKED
--
--   public.creator_partners
--   public.creator_campaigns
--   public.creator_tracking_links
--
-- The admin app writes these directly today (adminCreateCreator,
-- adminUpdateCreator, adminSetCreatorStatus, campaign and link management in
-- src/lib/creatorApi.js). Revoking them would break Admin -> Creators with no
-- RPC to replace it. creator_partners.default_commission_rate is a genuine
-- financial field and remains admin-writable; moving it behind an audited
-- RPC is a follow-up, not a grant change. See the report accompanying this
-- migration.
-- ============================================================

-- SELECT stays: both tables are read by the creator portal and the admin app
-- through RLS, which already scopes rows to the caller.
revoke insert, update, delete, truncate on table public.creator_kyc_profiles   from anon, authenticated;
revoke insert, update, delete, truncate on table public.creator_conversions    from anon, authenticated;
revoke insert, update, delete, truncate on table public.creator_conversion_items from anon, authenticated;
revoke insert, update, delete, truncate on table public.creator_conversion_audit from anon, authenticated;
revoke insert, update, delete, truncate on table public.creator_attribution_events from anon, authenticated;

grant select on table public.creator_kyc_profiles     to authenticated;
grant select on table public.creator_conversions      to authenticated;
grant select on table public.creator_conversion_items to authenticated;
grant select on table public.creator_conversion_audit to authenticated;
grant select on table public.creator_attribution_events to authenticated;

-- The SECURITY DEFINER RPCs run as the function owner and are unaffected by
-- the revokes above. Re-asserted here so the only mutation path is explicit.
grant execute on function public.submit_kyc(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_kyc_status(uuid, text, text)               to authenticated, service_role;

-- ============================================================
-- VERIFY (read-only -- run after applying)
--
-- 1. Browser roles hold SELECT and nothing else.
--
--   select table_name, grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public'
--      and table_name in ('creator_kyc_profiles','creator_conversions',
--                         'creator_conversion_items','creator_conversion_audit',
--                         'creator_attribution_events')
--      and grantee in ('anon','authenticated')
--    order by table_name, grantee, privilege_type;
--   -- expect SELECT rows only. Any INSERT/UPDATE/DELETE row means the
--   -- revoke did not take.
--
-- 2. The tables the admin app still writes are untouched.
--
--   select table_name, grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public'
--      and table_name in ('creator_partners','creator_campaigns','creator_tracking_links')
--      and grantee = 'authenticated'
--    order by table_name, privilege_type;
--   -- expect INSERT/SELECT/UPDATE to still be present, or Admin -> Creators
--   -- will start failing.
--
-- 3. The guarded RPCs are still callable.
--
--   select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as callable
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('submit_kyc','admin_set_kyc_status','record_conversion',
--                        'set_conversion_status','request_payout',
--                        'admin_review_payout','admin_mark_payout_paid');
--   -- expect callable = true for each
--
-- 4. Commission can no longer be minted by a direct write. As an admin in
--    the SQL Editor you bypass RLS and grants, so test this from the APP
--    (an admin session using the anon key), not here:
--
--      update public.creator_conversions set status = 'eligible' where id = '<id>';
--    -- expect: permission denied for table creator_conversions
-- ============================================================

-- ============================================================
-- ROLLBACK
--
--   grant insert, update, delete on table public.creator_kyc_profiles       to authenticated;
--   grant insert, update, delete on table public.creator_conversions        to authenticated;
--   grant insert, update, delete on table public.creator_conversion_items   to authenticated;
--   grant insert, update, delete on table public.creator_conversion_audit   to authenticated;
--   grant insert, update, delete on table public.creator_attribution_events to authenticated;
--
-- Restores the previous (weaker) state. No data is affected either way, so
-- this is reversible at any time with no loss.
-- ============================================================

select 'Creator RPC-only financial write hardening complete.' as status;
