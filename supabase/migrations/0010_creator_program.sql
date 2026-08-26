-- ============================================================
-- SORA LIFE Creator Program — Part 1 (foundation)
-- Run once in the Supabase SQL Editor. Additive and idempotent.
--
-- Adds creator management, campaigns, tracking links, an attribution
-- FOUNDATION and an admin audit trail. Creates ONLY new tables/functions:
-- no existing table, policy, price, order or payment path is touched.
--
-- Deliberately NOT in this phase (Part 2/3): commission calculation, order
-- attribution, earnings, withdrawals, payouts. The schema is shaped so those
-- can be added without migrating any of the columns below.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Shared helpers
-- ------------------------------------------------------------

-- Unambiguous alphabet: no I/O/0/1, so codes survive being read aloud,
-- handwritten or printed on packaging.
create or replace function public.sora_token(n int)
returns text language plpgsql volatile
set search_path = public, pg_temp
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result   text := '';
  i int;
begin
  for i in 1..greatest(n, 1) loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end $$;

-- Admin test, as a SECURITY DEFINER helper so RLS policies below never
-- recurse through admin_users' own RLS.
create or replace function public.is_sora_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;
grant execute on function public.is_sora_admin() to anon, authenticated, service_role;

create or replace function public.sora_touch_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------------------
-- 1. creator_partners
--
-- user_id links a creator to an existing Supabase auth account. It is NULL
-- until the creator claims the account (see claim_creator_account below), so
-- an admin can onboard a creator before they ever sign in. A normal customer
-- never becomes a creator implicitly — a matching creator row must exist.
-- ------------------------------------------------------------
create table if not exists public.creator_partners (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid unique references auth.users(id) on delete set null,
  creator_code                    text not null unique,
  display_name                    text not null,
  legal_name                      text,
  email                           text not null,
  phone                           text,
  avatar_url                      text,
  status                          text not null default 'pending'
                                    check (status in ('pending','active','paused','suspended','archived')),
  default_commission_rate         numeric(5,2) not null default 0
                                    check (default_commission_rate >= 0 and default_commission_rate <= 100),
  default_attribution_window_days integer not null default 30
                                    check (default_attribution_window_days between 1 and 365),
  payout_eligible                 boolean not null default false,
  notes                           text,
  joined_at                       timestamptz not null default now(),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create unique index if not exists creator_partners_email_key
  on public.creator_partners (lower(email));
create index if not exists creator_partners_status_idx on public.creator_partners (status);

-- Retired public codes. Kept forever so historical attribution that used an
-- old code still resolves to the right creator.
create table if not exists public.creator_code_aliases (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_partners(id) on delete cascade,
  code       text not null unique,
  retired_at timestamptz not null default now()
);
create index if not exists creator_code_aliases_creator_idx on public.creator_code_aliases (creator_id);

-- Server-side code generation. The client never supplies a code on insert;
-- if it tries, the trigger still normalises and de-duplicates it.
create or replace function public.generate_creator_code(p_display_name text)
returns text language plpgsql volatile
set search_path = public, pg_temp
as $$
declare
  base      text;
  candidate text;
  tries     int := 0;
begin
  base := upper(regexp_replace(coalesce(split_part(trim(p_display_name), ' ', 1), ''), '[^A-Za-z0-9]', '', 'g'));
  base := substr(base, 1, 12);
  if length(base) < 3 then base := 'CREATOR'; end if;

  candidate := 'SORA-' || base;
  loop
    exit when not exists (select 1 from public.creator_partners where creator_code = candidate)
          and not exists (select 1 from public.creator_code_aliases where code = candidate);
    tries := tries + 1;
    -- Not sequential: a random suffix from the unambiguous alphabet.
    candidate := 'SORA-' || base || public.sora_token(case when tries < 4 then 2 else 4 end);
    if tries > 40 then
      candidate := 'SORA-' || public.sora_token(8);
    end if;
  end loop;
  return candidate;
end $$;

create or replace function public.creator_partners_biu()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.creator_code is null or length(trim(new.creator_code)) = 0 then
      new.creator_code := public.generate_creator_code(new.display_name);
    else
      new.creator_code := upper(regexp_replace(new.creator_code, '[^A-Za-z0-9\-]', '', 'g'));
    end if;
  elsif tg_op = 'UPDATE' then
    -- The public code may only change through change_creator_code(), which
    -- preserves the old code as an alias for historical attribution.
    if new.creator_code is distinct from old.creator_code
       and current_setting('sora.allow_code_change', true) is distinct from 'on' then
      raise exception 'creator_code cannot be changed directly; use change_creator_code()';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists creator_partners_biu on public.creator_partners;
create trigger creator_partners_biu
  before insert or update on public.creator_partners
  for each row execute function public.creator_partners_biu();

-- ------------------------------------------------------------
-- 2. creator_campaigns
-- ------------------------------------------------------------
create table if not exists public.creator_campaigns (
  id                       uuid primary key default gen_random_uuid(),
  creator_id               uuid not null references public.creator_partners(id) on delete cascade,
  name                     text not null,
  campaign_code            text not null,
  description              text,
  status                   text not null default 'draft'
                             check (status in ('draft','active','paused','ended')),
  start_at                 timestamptz,
  end_at                   timestamptz,
  commission_rate_override numeric(5,2)
                             check (commission_rate_override is null
                                    or (commission_rate_override >= 0 and commission_rate_override <= 100)),
  attribution_window_days  integer
                             check (attribution_window_days is null
                                    or attribution_window_days between 1 and 365),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- A campaign cannot end before it starts.
  constraint creator_campaigns_dates_chk check (end_at is null or start_at is null or end_at >= start_at)
);

create unique index if not exists creator_campaigns_code_key
  on public.creator_campaigns (creator_id, upper(campaign_code));
create index if not exists creator_campaigns_creator_idx on public.creator_campaigns (creator_id, status);

create or replace function public.creator_campaigns_biu()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.campaign_code := upper(regexp_replace(coalesce(new.campaign_code, ''), '[^A-Za-z0-9\-]', '', 'g'));
  if length(new.campaign_code) = 0 then
    new.campaign_code := 'CMP-' || public.sora_token(5);
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end $$;

drop trigger if exists creator_campaigns_biu on public.creator_campaigns;
create trigger creator_campaigns_biu
  before insert or update on public.creator_campaigns
  for each row execute function public.creator_campaigns_biu();

-- ------------------------------------------------------------
-- 3. creator_tracking_links
--
-- destination_path is an INTERNAL path only. The check constraint refuses
-- absolute URLs, protocol-relative URLs and javascript:, so a tracking link
-- can never become an open redirect to an attacker's site.
-- ------------------------------------------------------------
create table if not exists public.creator_tracking_links (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creator_partners(id) on delete cascade,
  campaign_id      uuid references public.creator_campaigns(id) on delete set null,
  public_code      text not null unique,
  label            text,
  destination_type text not null default 'homepage'
                     check (destination_type in ('homepage','product','category','custom')),
  destination_path text not null default '/',
  status           text not null default 'active'
                     check (status in ('active','paused','archived')),
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint creator_tracking_links_dest_chk check (
    destination_path ~ '^/'                -- must be an internal, root-relative path
    and destination_path !~ '^//'          -- not protocol-relative (//evil.com)
    and destination_path !~ '://'          -- not an absolute URL
    and destination_path !~* 'javascript:' -- not a script URL
    and length(destination_path) <= 300
  )
);

create index if not exists creator_tracking_links_creator_idx on public.creator_tracking_links (creator_id, status);
create index if not exists creator_tracking_links_campaign_idx on public.creator_tracking_links (campaign_id);

-- Every link gets its own stable identifier (TRK-XXXXXX) so campaign-level
-- analytics is possible later even when several links share a creator code.
create or replace function public.creator_tracking_links_biu()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare tries int := 0; candidate text;
begin
  if tg_op = 'INSERT' then
    if new.public_code is null or length(trim(new.public_code)) = 0 then
      loop
        candidate := 'TRK-' || public.sora_token(6);
        exit when not exists (select 1 from public.creator_tracking_links where public_code = candidate);
        tries := tries + 1;
        if tries > 40 then candidate := 'TRK-' || public.sora_token(10); exit; end if;
      end loop;
      new.public_code := candidate;
    else
      new.public_code := upper(regexp_replace(new.public_code, '[^A-Za-z0-9\-]', '', 'g'));
    end if;
    -- A link must belong to a campaign of the SAME creator.
    if new.campaign_id is not null and not exists (
      select 1 from public.creator_campaigns c
      where c.id = new.campaign_id and c.creator_id = new.creator_id
    ) then
      raise exception 'campaign does not belong to this creator';
    end if;
  else
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists creator_tracking_links_biu on public.creator_tracking_links;
create trigger creator_tracking_links_biu
  before insert or update on public.creator_tracking_links
  for each row execute function public.creator_tracking_links_biu();

-- ------------------------------------------------------------
-- 4. creator_attribution_events  (FOUNDATION ONLY)
--
-- Records that a visit/signup happened under a creator's link. It does NOT
-- attribute any sale and carries no commission. Part 2 will read these rows
-- (last-click first: newest non-expired row for a visitor) to connect
-- visitor -> signup -> cart -> order.
--
-- Privacy: no fingerprinting, no IP, no user-agent. `visitor_id` is a random
-- id the browser generates for itself and can clear at any time.
-- ------------------------------------------------------------
create table if not exists public.creator_attribution_events (
  id                uuid primary key default gen_random_uuid(),
  event_type        text not null
                      check (event_type in ('click','landing','signup','campaign_attribution')),
  tracking_link_id  uuid references public.creator_tracking_links(id) on delete set null,
  creator_id        uuid not null references public.creator_partners(id) on delete cascade,
  campaign_id       uuid references public.creator_campaigns(id) on delete set null,
  visitor_id        text,
  user_id           uuid references auth.users(id) on delete set null,
  -- Which public code the visitor actually arrived with (may be a retired
  -- alias). Kept for auditability of how the link resolved.
  matched_code      text,
  landing_path      text,
  attribution_model text not null default 'last_click'
                      check (attribution_model in ('last_click','first_click')),
  occurred_at       timestamptz not null default now(),
  expires_at        timestamptz not null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists creator_attr_visitor_idx  on public.creator_attribution_events (visitor_id, occurred_at desc);
create index if not exists creator_attr_user_idx     on public.creator_attribution_events (user_id, occurred_at desc);
create index if not exists creator_attr_creator_idx  on public.creator_attribution_events (creator_id, occurred_at desc);
create index if not exists creator_attr_campaign_idx on public.creator_attribution_events (campaign_id, occurred_at desc);
create index if not exists creator_attr_expiry_idx   on public.creator_attribution_events (expires_at);

-- ------------------------------------------------------------
-- 5. creator_admin_audit
-- ------------------------------------------------------------
create table if not exists public.creator_admin_audit (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists creator_admin_audit_entity_idx on public.creator_admin_audit (entity_type, entity_id, created_at desc);
create index if not exists creator_admin_audit_created_idx on public.creator_admin_audit (created_at desc);

-- Audit trigger. Records only safe, non-secret metadata (status/name/code),
-- never contact details or notes.
create or replace function public.creator_audit_trigger()
returns trigger language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action text;
  v_meta   jsonb := '{}'::jsonb;
  v_id     uuid;
begin
  if tg_op = 'INSERT' then
    v_action := tg_argv[0] || '_created';
    v_id := new.id;
  elsif tg_op = 'UPDATE' then
    v_action := tg_argv[0] || '_updated';
    v_id := new.id;
    if to_jsonb(new) ? 'status' and new.status is distinct from old.status then
      v_action := tg_argv[0] || '_status_changed';
      v_meta := v_meta || jsonb_build_object('from', old.status, 'to', new.status);
    end if;
  else
    v_action := tg_argv[0] || '_deleted';
    v_id := old.id;
  end if;

  if tg_argv[0] = 'creator' then
    v_meta := v_meta || jsonb_build_object('creator_code', coalesce(new.creator_code, old.creator_code),
                                           'display_name', coalesce(new.display_name, old.display_name));
  elsif tg_argv[0] = 'campaign' then
    v_meta := v_meta || jsonb_build_object('campaign_code', coalesce(new.campaign_code, old.campaign_code),
                                           'name', coalesce(new.name, old.name));
  elsif tg_argv[0] = 'tracking_link' then
    v_meta := v_meta || jsonb_build_object('public_code', coalesce(new.public_code, old.public_code),
                                           'destination_path', coalesce(new.destination_path, old.destination_path));
  end if;

  insert into public.creator_admin_audit (admin_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_action, tg_argv[0], v_id, v_meta);

  return coalesce(new, old);
end $$;

drop trigger if exists creator_partners_audit on public.creator_partners;
create trigger creator_partners_audit after insert or update or delete on public.creator_partners
  for each row execute function public.creator_audit_trigger('creator');

drop trigger if exists creator_campaigns_audit on public.creator_campaigns;
create trigger creator_campaigns_audit after insert or update or delete on public.creator_campaigns
  for each row execute function public.creator_audit_trigger('campaign');

drop trigger if exists creator_tracking_links_audit on public.creator_tracking_links;
create trigger creator_tracking_links_audit after insert or update or delete on public.creator_tracking_links
  for each row execute function public.creator_audit_trigger('tracking_link');

-- ------------------------------------------------------------
-- 6. Ownership helper + account claiming
-- ------------------------------------------------------------

-- The caller's own creator id, or NULL. SECURITY DEFINER so RLS policies on
-- child tables can use it without recursing through creator_partners' RLS.
create or replace function public.current_creator_id()
returns uuid language sql stable security definer
set search_path = public, pg_temp
as $$
  select id from public.creator_partners
   where user_id = auth.uid()
   limit 1;
$$;
grant execute on function public.current_creator_id() to authenticated, service_role;

-- Link the signed-in auth account to a creator record whose email matches.
-- The email comes from the VERIFIED JWT (auth.email()), never from input, and
-- only an unclaimed row can be linked. A customer with no matching creator
-- row gets 'no_match' and remains a plain customer.
create or replace function public.claim_creator_account()
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_email text := auth.email(); v_id uuid;
begin
  if v_uid is null or v_email is null then return 'not_authenticated'; end if;

  if exists (select 1 from public.creator_partners where user_id = v_uid) then
    return 'already_linked';
  end if;

  select id into v_id from public.creator_partners
   where lower(email) = lower(v_email) and user_id is null
   limit 1;

  if v_id is null then return 'no_match'; end if;

  update public.creator_partners set user_id = v_uid where id = v_id;
  return 'linked';
end $$;
revoke all on function public.claim_creator_account() from public, anon;
grant execute on function public.claim_creator_account() to authenticated;

-- Admin-only public-code change that preserves the old code as an alias.
create or replace function public.change_creator_code(p_creator_id uuid, p_new_code text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_old text; v_new text;
begin
  if not public.is_sora_admin() then raise exception 'admin only'; end if;

  v_new := upper(regexp_replace(coalesce(p_new_code, ''), '[^A-Za-z0-9\-]', '', 'g'));
  if length(v_new) < 4 then raise exception 'code too short'; end if;

  select creator_code into v_old from public.creator_partners where id = p_creator_id;
  if v_old is null then raise exception 'creator not found'; end if;
  if v_old = v_new then return v_new; end if;

  if exists (select 1 from public.creator_partners where creator_code = v_new)
     or exists (select 1 from public.creator_code_aliases where code = v_new) then
    raise exception 'code already in use';
  end if;

  -- Preserve the retired code so historical links keep resolving.
  insert into public.creator_code_aliases (creator_id, code) values (p_creator_id, v_old)
    on conflict (code) do nothing;

  perform set_config('sora.allow_code_change', 'on', true);
  update public.creator_partners set creator_code = v_new where id = p_creator_id;
  perform set_config('sora.allow_code_change', 'off', true);

  return v_new;
end $$;
-- Granted to authenticated because the admin UI runs in the browser with the
-- admin's own JWT; the is_sora_admin() check INSIDE the function is what
-- actually gates it, so a normal customer calling this gets 'admin only'.
revoke all on function public.change_creator_code(uuid, text) from public, anon;
grant execute on function public.change_creator_code(uuid, text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Attribution resolution (SERVER ONLY)
--
-- The browser sends a PUBLIC code. This resolves it to internal ids and
-- validates status/window. Internal ids are never accepted from the client.
-- Returns a jsonb verdict; records nothing.
-- ------------------------------------------------------------
create or replace function public.resolve_tracking_ref(p_ref text, p_campaign text default null)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_ref      text := upper(regexp_replace(coalesce(p_ref, ''), '[^A-Za-z0-9\-]', '', 'g'));
  v_cmp      text := upper(regexp_replace(coalesce(p_campaign, ''), '[^A-Za-z0-9\-]', '', 'g'));
  v_link     public.creator_tracking_links%rowtype;
  v_creator  public.creator_partners%rowtype;
  v_campaign public.creator_campaigns%rowtype;
  v_window   int;
begin
  if length(v_ref) = 0 then return jsonb_build_object('ok', false, 'reason', 'missing_ref'); end if;

  -- A ref may be a tracking-link code (TRK-...), a live creator code, or a
  -- retired alias. Tracking-link codes win because they are the most specific.
  select * into v_link from public.creator_tracking_links where public_code = v_ref limit 1;

  if found then
    if v_link.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'link_inactive'); end if;
    select * into v_creator from public.creator_partners where id = v_link.creator_id;
    if v_link.campaign_id is not null then
      select * into v_campaign from public.creator_campaigns where id = v_link.campaign_id;
    end if;
  else
    select * into v_creator from public.creator_partners where creator_code = v_ref limit 1;
    if not found then
      select cp.* into v_creator from public.creator_code_aliases a
        join public.creator_partners cp on cp.id = a.creator_id
       where a.code = v_ref limit 1;
    end if;
    if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_ref'); end if;

    if length(v_cmp) > 0 then
      select * into v_campaign from public.creator_campaigns
       where creator_id = v_creator.id and upper(campaign_code) = v_cmp limit 1;
      if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_campaign'); end if;
    end if;
  end if;

  -- Only an ACTIVE creator may attract attribution.
  if v_creator.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'creator_' || v_creator.status);
  end if;

  if v_campaign.id is not null then
    if v_campaign.status <> 'active' then
      return jsonb_build_object('ok', false, 'reason', 'campaign_' || v_campaign.status);
    end if;
    if v_campaign.start_at is not null and v_campaign.start_at > now() then
      return jsonb_build_object('ok', false, 'reason', 'campaign_not_started');
    end if;
    if v_campaign.end_at is not null and v_campaign.end_at < now() then
      return jsonb_build_object('ok', false, 'reason', 'campaign_expired');
    end if;
  end if;

  v_window := coalesce(v_campaign.attribution_window_days, v_creator.default_attribution_window_days, 30);

  return jsonb_build_object(
    'ok', true,
    'creator_id', v_creator.id,
    'creator_code', v_creator.creator_code,
    'display_name', v_creator.display_name,
    'campaign_id', v_campaign.id,
    'campaign_code', v_campaign.campaign_code,
    'campaign_name', v_campaign.name,
    'tracking_link_id', v_link.id,
    'matched_code', v_ref,
    'attribution_window_days', v_window
  );
end $$;
revoke all on function public.resolve_tracking_ref(text, text) from public, anon, authenticated;
grant execute on function public.resolve_tracking_ref(text, text) to service_role;

-- Record an attribution event. Service-role only: the browser can never
-- insert an event, so it cannot fabricate creator/campaign ids.
create or replace function public.record_attribution_event(
  p_ref          text,
  p_campaign     text,
  p_event_type   text,
  p_visitor_id   text,
  p_user_id      uuid,
  p_landing_path text
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v jsonb; v_id uuid; v_window int;
begin
  if p_event_type is null or p_event_type not in ('click','landing','signup','campaign_attribution') then
    return jsonb_build_object('ok', false, 'reason', 'bad_event_type');
  end if;

  v := public.resolve_tracking_ref(p_ref, p_campaign);
  if not (v->>'ok')::boolean then return v; end if;

  v_window := coalesce((v->>'attribution_window_days')::int, 30);

  insert into public.creator_attribution_events (
    event_type, tracking_link_id, creator_id, campaign_id, visitor_id, user_id,
    matched_code, landing_path, expires_at
  ) values (
    p_event_type,
    nullif(v->>'tracking_link_id','')::uuid,
    (v->>'creator_id')::uuid,
    nullif(v->>'campaign_id','')::uuid,
    left(coalesce(p_visitor_id, ''), 64),
    p_user_id,
    v->>'matched_code',
    left(coalesce(p_landing_path, ''), 300),
    now() + make_interval(days => v_window)
  ) returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'attribution_id', v_id,
    'creator_code', v->>'creator_code',
    'display_name', v->>'display_name',
    'campaign_code', v->>'campaign_code',
    'campaign_name', v->>'campaign_name',
    'attribution_window_days', v_window
  );
end $$;
revoke all on function public.record_attribution_event(text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_attribution_event(text, text, text, text, uuid, text) to service_role;

-- ------------------------------------------------------------
-- 8. RLS
--
-- Admin  : full management of creators/campaigns/links; read audit + events.
-- Creator: READ-ONLY on their own profile/campaigns/links/events.
--          No update policy anywhere -> a creator can never change their own
--          commission rate, status, code or ids.
-- Customer / anonymous: nothing at all.
-- Writes to attribution events: service-role only (no policy grants it).
-- ------------------------------------------------------------
alter table public.creator_partners           enable row level security;
alter table public.creator_code_aliases       enable row level security;
alter table public.creator_campaigns          enable row level security;
alter table public.creator_tracking_links     enable row level security;
alter table public.creator_attribution_events enable row level security;
alter table public.creator_admin_audit        enable row level security;

-- creator_partners
drop policy if exists "creator_partners admin all" on public.creator_partners;
create policy "creator_partners admin all" on public.creator_partners
  for all using (public.is_sora_admin()) with check (public.is_sora_admin());

drop policy if exists "creator_partners self read" on public.creator_partners;
create policy "creator_partners self read" on public.creator_partners
  for select using (user_id = auth.uid());

-- creator_code_aliases
drop policy if exists "creator_aliases admin all" on public.creator_code_aliases;
create policy "creator_aliases admin all" on public.creator_code_aliases
  for all using (public.is_sora_admin()) with check (public.is_sora_admin());

drop policy if exists "creator_aliases self read" on public.creator_code_aliases;
create policy "creator_aliases self read" on public.creator_code_aliases
  for select using (creator_id = public.current_creator_id());

-- creator_campaigns
drop policy if exists "creator_campaigns admin all" on public.creator_campaigns;
create policy "creator_campaigns admin all" on public.creator_campaigns
  for all using (public.is_sora_admin()) with check (public.is_sora_admin());

drop policy if exists "creator_campaigns self read" on public.creator_campaigns;
create policy "creator_campaigns self read" on public.creator_campaigns
  for select using (creator_id = public.current_creator_id());

-- creator_tracking_links
drop policy if exists "creator_links admin all" on public.creator_tracking_links;
create policy "creator_links admin all" on public.creator_tracking_links
  for all using (public.is_sora_admin()) with check (public.is_sora_admin());

drop policy if exists "creator_links self read" on public.creator_tracking_links;
create policy "creator_links self read" on public.creator_tracking_links
  for select using (creator_id = public.current_creator_id());

-- creator_attribution_events  (read-only for admin + owning creator)
drop policy if exists "creator_events admin read" on public.creator_attribution_events;
create policy "creator_events admin read" on public.creator_attribution_events
  for select using (public.is_sora_admin());

drop policy if exists "creator_events self read" on public.creator_attribution_events;
create policy "creator_events self read" on public.creator_attribution_events
  for select using (creator_id = public.current_creator_id());

-- creator_admin_audit (admin read only; written by SECURITY DEFINER trigger)
drop policy if exists "creator_audit admin read" on public.creator_admin_audit;
create policy "creator_audit admin read" on public.creator_admin_audit
  for select using (public.is_sora_admin());

select 'Creator Program Part 1 migration complete.' as status;
