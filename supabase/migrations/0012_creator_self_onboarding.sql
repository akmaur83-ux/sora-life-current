-- ============================================================
-- SORA LIFE Creator Program — customer self-onboarding (Part 1)
-- Run once in the Supabase SQL Editor. Additive, idempotent, non-destructive.
--
-- Lets an EXISTING authenticated customer apply to become a creator using
-- their existing account (auth.uid()). No second auth system, no second
-- account, no new creator tables — it writes to creator_partners from 0010.
--
-- Invariant preserved from 0010: creator_partners.user_id is UNIQUE, so one
-- authenticated account maps to AT MOST ONE creator. This migration adds the
-- application path and an admin-configurable approval policy. It creates NO
-- commission/earnings/payout objects (those are Part 2/3).
-- ============================================================

-- 1. Minimal application metadata (optional social link + platform + consent).
--    A single jsonb column keeps this additive — no schema churn later.
alter table public.creator_partners
  add column if not exists application jsonb;

-- 2. Admin-configurable approval policy. Stored in site_settings, which is
--    admin-writable and (per 0009) NOT publicly readable for non-whitelisted
--    keys — so 'creator_program' is admin-only. The onboarding RPC below reads
--    it as SECURITY DEFINER; customers never see or set it.
insert into public.site_settings (key, value)
values ('creator_program', jsonb_build_object(
  'auto_approve', false,                    -- applications start 'pending'
  'default_commission_rate', 10,
  'default_attribution_window_days', 30
))
on conflict (key) do nothing;

-- 3. apply_as_creator(): the ONLY way a customer becomes a creator.
--
-- Identity (user_id, email) comes from the VERIFIED JWT — never from input.
-- The client cannot choose creatorId, userId, commissionRate or status: those
-- are all derived server-side. A client may only pass display name, an
-- optional social link, an optional platform, and the terms-agreement flag.
create or replace function public.apply_as_creator(
  p_display_name text,
  p_social_url   text,
  p_platform     text,
  p_agreed       boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text := auth.email();
  v_cfg    jsonb;
  v_auto   boolean;
  v_rate   numeric;
  v_window integer;
  v_status text;
  v_id     uuid;
  v_code   text;
  v_social text := nullif(left(trim(coalesce(p_social_url, '')), 300), '');
  v_plat   text := nullif(left(trim(coalesce(p_platform, '')), 120), '');
  v_name   text := left(trim(coalesce(p_display_name, '')), 120);
begin
  if v_uid is null or v_email is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_agreed is not true then
    return jsonb_build_object('ok', false, 'reason', 'terms_not_accepted');
  end if;
  if length(v_name) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'display_name_required');
  end if;

  -- Never a second creator for the same auth account.
  if exists (select 1 from public.creator_partners where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_creator');
  end if;

  -- If an admin pre-created an UNCLAIMED record for this email, link it rather
  -- than duplicate. Its admin-set status/rate are preserved.
  select id into v_id
  from public.creator_partners
  where lower(email) = lower(v_email) and user_id is null
  limit 1;

  if v_id is not null then
    update public.creator_partners
      set user_id = v_uid,
          application = coalesce(application, '{}'::jsonb)
            || jsonb_build_object('social_url', v_social, 'platform', v_plat,
                                  'agreed_at', now(), 'source', 'self_claim')
      where id = v_id
      returning creator_code, status into v_code, v_status;
    return jsonb_build_object('ok', true, 'linked', true, 'creator_code', v_code, 'status', v_status);
  end if;

  -- Fresh application. Approval policy decides the starting status; the rate
  -- and window come from config, NOT from the client.
  select value into v_cfg from public.site_settings where key = 'creator_program';
  v_auto   := coalesce((v_cfg->>'auto_approve')::boolean, false);
  v_rate   := coalesce((v_cfg->>'default_commission_rate')::numeric, 10);
  v_window := coalesce((v_cfg->>'default_attribution_window_days')::integer, 30);
  v_status := case when v_auto then 'active' else 'pending' end;

  insert into public.creator_partners (
    user_id, display_name, email, status,
    default_commission_rate, default_attribution_window_days,
    application
  ) values (
    v_uid, v_name, v_email, v_status,
    v_rate, v_window,
    jsonb_build_object('social_url', v_social, 'platform', v_plat,
                       'agreed_at', now(), 'source', 'self_apply')
  )
  returning id, creator_code, status into v_id, v_code, v_status;

  return jsonb_build_object('ok', true, 'linked', false, 'creator_code', v_code, 'status', v_status);
exception
  -- Belt-and-suspenders against a race on the UNIQUE(user_id) constraint.
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_creator');
end $$;

-- Callable by any signed-in user (the is-authenticated check is inside).
revoke all on function public.apply_as_creator(text, text, text, boolean) from public, anon;
grant execute on function public.apply_as_creator(text, text, text, boolean) to authenticated;

select 'Creator self-onboarding migration complete.' as status;
