-- ============================================================
-- SORA LIFE — Creator Programme terms & conditions
-- Run once in the Supabase SQL Editor. Safe to re-run: every statement is
-- IF NOT EXISTS / ON CONFLICT DO NOTHING / CREATE OR REPLACE.
--
-- Adds an admin-authored terms document and a record of who accepted which
-- version. Additive only:
--   * no existing table is altered,
--   * no existing function is changed — apply_as_creator() is untouched,
--   * nothing in the earnings, payout or settlement path is involved.
--
-- The document SHIPS EMPTY. Seeding legal copy is not this migration's job;
-- the admin writes it in the panel.
-- ============================================================

-- ---------- 1. the document ----------
--
-- site_settings, matching how every other single-record admin document is
-- stored (branding, announcement, storefront_theme, creator_program).
--
-- `version` is an integer the admin bumps when the terms change materially.
-- It is what an acceptance points at, so it must be stable: editing a typo
-- without bumping it deliberately does NOT invalidate existing acceptances,
-- and that is the admin's call to make, not a side effect of saving.
insert into public.site_settings (key, value)
values ('creator_terms', jsonb_build_object(
  'body', '',                 -- markdown, authored in the admin panel
  'version', 1,
  'updated_at', null          -- set on first save; null means "never published"
))
on conflict (key) do nothing;

-- ---------- 2. public read ----------
--
-- Replaces the allowlist from 0015, adding 'creator_terms'. Every key that was
-- readable before stays readable — this policy is REPLACED wholesale, so the
-- full list has to be restated, and dropping one here would silently break the
-- storefront.
--
-- Terms are readable by anyone on purpose: a prospective creator has to be
-- able to read what they are agreeing to before they have an account, and the
-- document is public-facing legal text either way. 'creator_program' stays
-- OUT — commission rates and the auto-approve flag are operational config.
drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read"
  on public.site_settings for select
  using (key in ('branding', 'announcement', 'contact', 'homepage', 'storefront_theme', 'creator_terms'));

-- ---------- 3. acceptances ----------
create table if not exists public.creator_terms_acceptances (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creator_partners(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete set null,
  version          integer not null,
  -- The document's updated_at at the moment of acceptance. Version alone says
  -- which terms were agreed to; this says which revision of that version was
  -- on screen, which is what you actually want when someone disputes it.
  terms_updated_at timestamptz,
  accepted_at      timestamptz not null default now()
);

-- One acceptance per creator per version. Makes the RPC idempotent: a creator
-- who clicks accept twice does not produce two rows, and a re-render cannot
-- manufacture a second acceptance.
create unique index if not exists creator_terms_acceptances_creator_version_key
  on public.creator_terms_acceptances (creator_id, version);

alter table public.creator_terms_acceptances enable row level security;

-- A creator reads their own acceptances; an admin reads all of them.
drop policy if exists "creator_terms_acceptances read" on public.creator_terms_acceptances;
create policy "creator_terms_acceptances read"
  on public.creator_terms_acceptances for select
  using (
    exists (select 1 from public.creator_partners c
             where c.id = creator_id and c.user_id = auth.uid())
    or exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE policy at all, deliberately.
--
-- With RLS on and no write policy, no client role can write this table by any
-- route. Acceptances are created ONLY through the SECURITY DEFINER function
-- below, which derives the creator from the verified JWT and the version from
-- the stored document — so a client cannot claim to have accepted a version
-- that was never published, on behalf of a creator that is not theirs.
-- This mirrors 0024's rule that financial rows are written by RPC only.

-- ---------- 4. record an acceptance ----------
--
-- Takes NO arguments on purpose. Both facts that matter — who is accepting and
-- what they are accepting — come from trusted sources: auth.uid() and the
-- stored document. A p_version parameter would be a client-supplied claim.
create or replace function public.record_creator_terms_acceptance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_creator uuid;
  v_cfg     jsonb;
  v_version integer;
  v_updated timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select id into v_creator from public.creator_partners where user_id = v_uid limit 1;
  if v_creator is null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_creator');
  end if;

  select value into v_cfg from public.site_settings where key = 'creator_terms';
  v_version := coalesce((v_cfg->>'version')::integer, 1);
  v_updated := nullif(v_cfg->>'updated_at', '')::timestamptz;

  -- Nothing to accept until the admin has actually published something.
  if coalesce(btrim(v_cfg->>'body'), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'terms_not_published');
  end if;

  insert into public.creator_terms_acceptances (creator_id, user_id, version, terms_updated_at)
  values (v_creator, v_uid, v_version, v_updated)
  on conflict (creator_id, version) do nothing;

  return jsonb_build_object('ok', true, 'version', v_version, 'accepted_at', now());
end $$;

revoke all on function public.record_creator_terms_acceptance() from public, anon;
grant execute on function public.record_creator_terms_acceptance() to authenticated;

select 'Creator terms migration complete.' as status;
