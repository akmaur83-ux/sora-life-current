-- ============================================================
-- SORA LIFE Creator Program — tiers, rewards, leaderboard, withdrawals gate
-- Migration 0031. Additive, idempotent. Apply in the SQL Editor of the
-- project whose breadcrumb reads "sora life". Do not run supabase db push.
--
-- EXTENDS the existing ledger; nothing here computes commission a second way.
--
--   1. Tier ladder (creator_tier_levels + site_settings.creator_tiers) — the
--      rate a NEW commission row snapshots. Historical rows are untouched.
--   2. creator_conversion_commission_sync(): rate source becomes the tier rate
--      (campaign override still wins; the creator's per-row default rate is a
--      floor), and available_at is no longer "payment + hold" but
--      "delivery + hold" — null until the order is marked delivered.
--   3. Orders trigger: delivered_at schedules confirmation; a 'cancelled'
--      fulfilment cancels the conversion, which reverses the commission
--      through the trigger that already exists.
--   4. Reversal-during-hold fix: a reversal now carries the commission's
--      available_at, and request_payout matures both types together.
--   5. Rewards (definitions + claims) and their RPCs.
--   6. Leaderboard: a definer function returning name/rank/level only.
--   7. Withdrawals gate: creator_payouts.withdrawals_open (default false).
-- ============================================================

-- ------------------------------------------------------------
-- 0. Config
-- ------------------------------------------------------------
-- Withdrawals are CLOSED by default. Only the key is added; every other value
-- in creator_payouts is left exactly as it is.
update public.site_settings
   set value = value || jsonb_build_object('withdrawals_open', false)
 where key = 'creator_payouts' and not (value ? 'withdrawals_open');
insert into public.site_settings (key, value) values
  ('creator_payouts', jsonb_build_object(
    'settlement_hold_days', 7, 'min_payout', 500, 'payout_day', 1,
    'allow_partial', false, 'withdrawals_open', false))
on conflict (key) do nothing;

-- Beyond the top configured level: a new level every beyond_step rupees, at
-- the top level's rate. Admin-editable through admin_set_creator_tier_levels.
insert into public.site_settings (key, value) values
  ('creator_tiers', jsonb_build_object('beyond_step', 25000))
on conflict (key) do nothing;

create or replace function public.creator_tier_config()
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((select value from public.site_settings where key = 'creator_tiers'),
                  jsonb_build_object('beyond_step', 25000));
$$;
revoke all on function public.creator_tier_config() from public, anon;
grant execute on function public.creator_tier_config() to authenticated, service_role;

-- One-click toggle for the admin. jsonb_set touches only this key.
create or replace function public.admin_set_withdrawals_open(p_open boolean)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sora_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  insert into public.site_settings (key, value)
  values ('creator_payouts', jsonb_build_object(
    'settlement_hold_days', 7, 'min_payout', 500, 'payout_day', 1,
    'allow_partial', false, 'withdrawals_open', coalesce(p_open, false)))
  on conflict (key) do update
    set value = public.site_settings.value || jsonb_build_object('withdrawals_open', coalesce(p_open, false));
  return jsonb_build_object('ok', true, 'withdrawals_open', coalesce(p_open, false));
end $$;
revoke all on function public.admin_set_withdrawals_open(boolean) from public, anon;
grant execute on function public.admin_set_withdrawals_open(boolean) to authenticated;

-- ------------------------------------------------------------
-- 1. Tier ladder
-- ------------------------------------------------------------
create table if not exists public.creator_tier_levels (
  level       integer primary key check (level >= 1),
  rank_name   text not null check (length(btrim(rank_name)) between 1 and 40),
  threshold   numeric(12,2) not null check (threshold >= 0),
  rate        numeric(5,2) not null check (rate >= 0 and rate <= 100),
  updated_at  timestamptz not null default now()
);
alter table public.creator_tier_levels enable row level security;

-- Seed the ladder from the brief. on conflict do nothing: re-running never
-- overwrites an admin's edits.
insert into public.creator_tier_levels (level, rank_name, threshold, rate) values
  ( 1, 'Rise',     0,      10),
  ( 2, 'Rise',     10000,  11),
  ( 3, 'Premium',  25000,  12),
  ( 4, 'Premium',  50000,  13),
  ( 5, 'Elite',    75000,  14),
  ( 6, 'Elite',    100000, 15),
  ( 7, 'Royale',   125000, 16),
  ( 8, 'Royale',   150000, 17),
  ( 9, 'Prime',    200000, 18),
  (10, 'Prime',    250000, 19),
  (11, 'Supreme',  300000, 21),
  (12, 'Supreme',  350000, 22),
  (13, 'Crown',    400000, 23),
  (14, 'Crown',    500000, 25)
on conflict (level) do nothing;

-- Creators and admins read the ladder; nobody writes it directly. The only
-- write path is admin_set_creator_tier_levels(), which validates it ascends.
drop policy if exists "tier levels creator read" on public.creator_tier_levels;
create policy "tier levels creator read" on public.creator_tier_levels
  for select to authenticated
  using (public.is_sora_admin() or public.current_creator_id() is not null);
revoke insert, update, delete, truncate on table public.creator_tier_levels from anon, authenticated;
grant select on table public.creator_tier_levels to authenticated;

-- The tier for a given confirmed-sales figure. Exactly on a threshold counts
-- as reached (threshold <= sales). Above the top configured level the level
-- keeps climbing every beyond_step rupees at the top rate.
create or replace function public.creator_tier_for_sales(p_sales numeric)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_sales numeric := greatest(coalesce(p_sales, 0), 0);
  r public.creator_tier_levels%rowtype; v_top public.creator_tier_levels%rowtype;
  v_next public.creator_tier_levels%rowtype; v_step numeric; v_n integer;
begin
  select * into r
    from public.creator_tier_levels where threshold <= v_sales
   order by level desc limit 1;
  if r.level is null then
    -- Ladder does not start at 0 (or is empty): everyone below the first
    -- rung sits on it at its rate, and progress points at the first rung.
    select * into r
      from public.creator_tier_levels order by level asc limit 1;
    if r.level is null then
      return jsonb_build_object('level', 1, 'rank', 'Rise', 'rate', 10, 'threshold', 0,
        'next_level', null, 'next_threshold', null, 'next_rate', null, 'configured', false);
    end if;
    return jsonb_build_object('level', r.level, 'rank', r.rank_name, 'rate', r.rate, 'threshold', 0,
      'next_level', r.level, 'next_threshold', r.threshold, 'next_rate', r.rate, 'configured', true);
  end if;

  select * into v_top
    from public.creator_tier_levels order by level desc limit 1;

  if r.level = v_top.level then
    v_step := coalesce((public.creator_tier_config()->>'beyond_step')::numeric, 0);
    if v_step > 0 then
      v_n := floor((v_sales - v_top.threshold) / v_step);
      return jsonb_build_object(
        'level', v_top.level + v_n, 'rank', v_top.rank_name, 'rate', v_top.rate,
        'threshold', v_top.threshold + v_n * v_step,
        'next_level', v_top.level + v_n + 1,
        'next_threshold', v_top.threshold + (v_n + 1) * v_step,
        'next_rate', v_top.rate, 'configured', true);
    end if;
    return jsonb_build_object('level', r.level, 'rank', r.rank_name, 'rate', r.rate, 'threshold', r.threshold,
      'next_level', null, 'next_threshold', null, 'next_rate', null, 'configured', true);
  end if;

  select * into v_next
    from public.creator_tier_levels where level > r.level order by level asc limit 1;
  return jsonb_build_object('level', r.level, 'rank', r.rank_name, 'rate', r.rate, 'threshold', r.threshold,
    'next_level', v_next.level, 'next_threshold', v_next.threshold, 'next_rate', v_next.rate, 'configured', true);
end $$;
revoke all on function public.creator_tier_for_sales(numeric) from public, anon;
grant execute on function public.creator_tier_for_sales(numeric) to authenticated, service_role;

-- Replace the whole ladder atomically. Validation: contiguous levels from 1,
-- first threshold 0, thresholds strictly ascending, rates non-decreasing,
-- rank names non-empty.
create or replace function public.admin_set_creator_tier_levels(p_levels jsonb, p_beyond_step numeric)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  it jsonb; i integer := 0; v_prev_threshold numeric := -1; v_prev_rate numeric := -1;
  v_level integer; v_threshold numeric; v_rate numeric; v_rank text;
begin
  if not public.is_sora_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_levels is null or jsonb_typeof(p_levels) <> 'array' or jsonb_array_length(p_levels) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;
  if p_beyond_step is not null and (p_beyond_step::text in ('NaN','Infinity','-Infinity') or p_beyond_step < 0) then
    return jsonb_build_object('ok', false, 'reason', 'bad_beyond_step');
  end if;

  for it in select * from jsonb_array_elements(p_levels) loop
    i := i + 1;
    v_level := coalesce((it->>'level')::integer, i);
    v_rank := btrim(coalesce(it->>'rank', it->>'rank_name', ''));
    v_threshold := (it->>'threshold')::numeric;
    v_rate := (it->>'rate')::numeric;
    if v_level is distinct from i then
      return jsonb_build_object('ok', false, 'reason', 'levels_not_contiguous', 'at', i);
    end if;
    if v_rank = '' or length(v_rank) > 40 then
      return jsonb_build_object('ok', false, 'reason', 'bad_rank', 'at', i);
    end if;
    if v_threshold is null or v_threshold::text in ('NaN','Infinity','-Infinity') or v_threshold < 0 then
      return jsonb_build_object('ok', false, 'reason', 'bad_threshold', 'at', i);
    end if;
    if i = 1 and v_threshold <> 0 then
      return jsonb_build_object('ok', false, 'reason', 'first_threshold_not_zero');
    end if;
    if v_threshold <= v_prev_threshold then
      return jsonb_build_object('ok', false, 'reason', 'thresholds_not_ascending', 'at', i);
    end if;
    if v_rate is null or v_rate::text in ('NaN','Infinity','-Infinity') or v_rate < 0 or v_rate > 100 then
      return jsonb_build_object('ok', false, 'reason', 'bad_rate', 'at', i);
    end if;
    if v_rate < v_prev_rate then
      return jsonb_build_object('ok', false, 'reason', 'rates_not_ascending', 'at', i);
    end if;
    v_prev_threshold := v_threshold; v_prev_rate := v_rate;
  end loop;

  delete from public.creator_tier_levels;
  i := 0;
  for it in select * from jsonb_array_elements(p_levels) loop
    i := i + 1;
    insert into public.creator_tier_levels (level, rank_name, threshold, rate)
    values (i, btrim(coalesce(it->>'rank', it->>'rank_name')), round((it->>'threshold')::numeric, 2), round((it->>'rate')::numeric, 2));
  end loop;

  if p_beyond_step is not null then
    insert into public.site_settings (key, value) values ('creator_tiers', jsonb_build_object('beyond_step', p_beyond_step))
    on conflict (key) do update set value = public.site_settings.value || jsonb_build_object('beyond_step', p_beyond_step);
  end if;

  return jsonb_build_object('ok', true, 'levels', i,
    'beyond_step', (public.creator_tier_config()->>'beyond_step')::numeric);
end $$;
revoke all on function public.admin_set_creator_tier_levels(jsonb, numeric) from public, anon;
grant execute on function public.admin_set_creator_tier_levels(jsonb, numeric) to authenticated;

-- ------------------------------------------------------------
-- 2. Confirmed sales (never stored — always derived from the ledger)
--
-- A sale is CONFIRMED when its conversion is still eligible (not cancelled,
-- refunded or reversed) and the commission row it produced has matured:
-- available_at is set and has passed. Partial refunds reduce eligible_sales,
-- so the figure is always the post-refund amount.
-- ------------------------------------------------------------
create or replace function public.creator_confirmed_sales_rows(p_creator_id uuid)
returns table (conversion_id uuid, eligible_sales numeric, confirmed_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select c.id, c.eligible_sales, l.available_at
    from public.creator_conversions c
    join public.creator_commission_ledger l
      on l.conversion_id = c.id and l.type = 'commission'
   where c.creator_id = p_creator_id
     and c.status = 'eligible'
     and l.status in ('held', 'available', 'reserved', 'paid')
     and l.available_at is not null and l.available_at <= now();
$$;
revoke all on function public.creator_confirmed_sales_rows(uuid) from public, anon, authenticated;

create or replace function public.creator_confirmed_sales_total(p_creator_id uuid)
returns numeric language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(eligible_sales), 0) from public.creator_confirmed_sales_rows(p_creator_id);
$$;
revoke all on function public.creator_confirmed_sales_total(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Commission generation: tier rate, delivery-based maturity, reversal fix.
--    This is the 0014 trigger function with three changes, each marked 0031.
-- ------------------------------------------------------------
create or replace function public.creator_conversion_commission_sync()
returns trigger language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_rate   numeric;
  v_amount numeric;
  v_hold   int;
  v_ccl    public.creator_commission_ledger%rowtype;
  v_bucket text;
  v_delta  numeric;
  v_tier   jsonb;
  v_lifetime numeric;
  v_delivered timestamptz;
begin
  -- EARN: on transition into 'eligible', create exactly one commission entry.
  if new.status = 'eligible' and (tg_op = 'INSERT' or old.status is distinct from 'eligible') then
    if not exists (select 1 from public.creator_commission_ledger where conversion_id = new.id and type = 'commission') then
      -- 0031 RATE: the tier the creator has EARNED on confirmed lifetime sales
      -- at this moment. Snapshotted on the row; a later tier change never
      -- touches it. A campaign override still wins outright; the creator's
      -- default_commission_rate acts as a floor so a negotiated rate above
      -- the ladder is honoured.
      v_lifetime := public.creator_confirmed_sales_total(new.creator_id);
      v_tier := public.creator_tier_for_sales(v_lifetime);
      select coalesce(
               (select commission_rate_override from public.creator_campaigns where id = new.campaign_id),
               greatest(coalesce((v_tier->>'rate')::numeric, 0),
                        coalesce((select default_commission_rate from public.creator_partners where id = new.creator_id), 0)),
               0)
        into v_rate;
      v_hold := coalesce((public.creator_payout_config()->>'settlement_hold_days')::int, 7);
      v_amount := round(coalesce(new.eligible_sales,0) * v_rate / 100.0, 2);
      -- 0031 MATURITY: confirmation is hold days after DELIVERY, so the row
      -- has no available_at until the order is marked delivered (the orders
      -- trigger below fills it in). An order already delivered gets it now.
      select delivered_at into v_delivered from public.orders where id = new.order_id;
      insert into public.creator_commission_ledger (
        creator_id, conversion_id, order_id, type, status, amount, currency,
        commission_rate, eligible_sales, available_at, metadata
      ) values (
        new.creator_id, new.id, new.order_id, 'commission', 'held', v_amount, coalesce(new.currency,'INR'),
        v_rate, new.eligible_sales,
        case when v_delivered is not null then v_delivered + make_interval(days => v_hold) else null end,
        jsonb_build_object('source','conversion_eligible',
          'tier_level', (v_tier->>'level')::int, 'tier_rank', v_tier->>'rank', 'tier_rate', (v_tier->>'rate')::numeric,
          'lifetime_confirmed_sales_at_earn', v_lifetime)
      );
    end if;
  end if;

  -- REVERSE: eligible_sales dropped (refund/partial) on a conversion that has a
  -- commission. Reverse the delta at the ORIGINAL snapshot rate, into the same
  -- bucket the money currently sits in (held/available); if already reserved or
  -- paid, book the reversal as an available debt (offsets future earnings).
  if tg_op = 'UPDATE' and coalesce(new.eligible_sales,0) < coalesce(old.eligible_sales,0) then
    select * into v_ccl from public.creator_commission_ledger where conversion_id = new.id and type = 'commission';
    if found then
      v_delta := round((coalesce(old.eligible_sales,0) - coalesce(new.eligible_sales,0)) * coalesce(v_ccl.commission_rate,0) / 100.0, 2);
      if v_delta > 0 then
        v_bucket := case when v_ccl.status in ('held') then 'held' else 'available' end;
        -- 0031: a held reversal matures WITH its commission. Without this it
        -- had no available_at, never left 'held', and was never deducted.
        insert into public.creator_commission_ledger (
          creator_id, conversion_id, order_id, type, status, amount, currency,
          commission_rate, eligible_sales, available_at, metadata
        ) values (
          v_ccl.creator_id, new.id, new.order_id, 'reversal', v_bucket, -v_delta, v_ccl.currency,
          v_ccl.commission_rate, new.eligible_sales,
          case when v_bucket = 'held' then v_ccl.available_at else null end,
          jsonb_build_object('reason','conversion_refund','from_eligible',old.eligible_sales,'to_eligible',new.eligible_sales)
        );
      end if;
    end if;
  end if;

  -- Full cancel/reversal that wasn't a numeric drop: mark commission reversed.
  if tg_op = 'UPDATE' and new.status in ('cancelled','reversed') and old.status not in ('cancelled','reversed') then
    update public.creator_commission_ledger
      set status = 'reversed'
      where conversion_id = new.id and type = 'commission' and status in ('held','available');
  end if;

  return new;
end $$;
-- The trigger itself (0014) is unchanged; the function body above replaces it in place.

-- Repair: held reversals that predate 0031 and carry no available_at inherit
-- their commission's. Rows already matured become deductible immediately.
update public.creator_commission_ledger r
   set available_at = c.available_at
  from public.creator_commission_ledger c
 where c.conversion_id = r.conversion_id and c.type = 'commission'
   and r.type = 'reversal' and r.status = 'held' and r.available_at is null
   and c.available_at is not null;

-- ------------------------------------------------------------
-- 4. Orders → commission: delivery starts the clock; cancellation reverses.
-- ------------------------------------------------------------
create or replace function public.creator_order_fulfillment_sync()
returns trigger language plpgsql
security definer set search_path = public, pg_temp
as $$
declare v_hold int; v_conv public.creator_conversions%rowtype;
begin
  if tg_op <> 'UPDATE' then return new; end if;

  -- DELIVERED: every unmatured, unreserved row for this order (commission and
  -- any held reversal) matures hold days after delivery.
  if new.delivered_at is not null and new.delivered_at is distinct from old.delivered_at then
    v_hold := coalesce((public.creator_payout_config()->>'settlement_hold_days')::int, 7);
    update public.creator_commission_ledger
       set available_at = new.delivered_at + make_interval(days => v_hold)
     where order_id = new.id and status = 'held' and payout_id is null
       and type in ('commission', 'reversal');
  end if;

  -- CANCELLED (fulfilment): the sale will not complete. Same terminal
  -- transition set_conversion_status() performs for a failed payment; the
  -- commission trigger then marks the commission reversed. Terminal on
  -- purpose — matches the existing rule that a cancelled conversion is
  -- never revived by a later signal.
  if new.fulfillment_status = 'cancelled' and old.fulfillment_status is distinct from 'cancelled' then
    select * into v_conv from public.creator_conversions where order_id = new.id;
    if v_conv.id is not null and v_conv.status in ('pending', 'eligible') then
      update public.creator_conversions
         set status = 'cancelled', cancelled_at = now()
       where id = v_conv.id;
      insert into public.creator_conversion_audit (conversion_id, order_id, from_status, to_status, reason, actor)
      values (v_conv.id, new.id, v_conv.status, 'cancelled', 'fulfillment_cancelled', auth.uid());
    end if;
  end if;

  return new;
end $$;
drop trigger if exists creator_order_fulfillment_sync on public.orders;
create trigger creator_order_fulfillment_sync
  after update of delivered_at, fulfillment_status on public.orders
  for each row execute function public.creator_order_fulfillment_sync();

-- ------------------------------------------------------------
-- 5. Rewards
-- ------------------------------------------------------------
create table if not exists public.creator_level_rewards (
  id           uuid primary key default gen_random_uuid(),
  level        integer not null check (level >= 1),
  option_index integer not null check (option_index between 1 and 3),
  label        text not null check (length(btrim(label)) between 1 and 120),
  description  text,
  reward_type  text not null check (reward_type in ('product', 'cash', 'other')),
  value        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint creator_level_rewards_slot_uk unique (level, option_index)
);
alter table public.creator_level_rewards enable row level security;
drop trigger if exists creator_level_rewards_touch on public.creator_level_rewards;
create trigger creator_level_rewards_touch before update on public.creator_level_rewards
  for each row execute function public.sora_touch_updated_at();

-- Creators see active options; admins see everything and write (same shape
-- as "coupons admin write" in 0028).
drop policy if exists "level rewards creator read" on public.creator_level_rewards;
create policy "level rewards creator read" on public.creator_level_rewards
  for select to authenticated
  using (public.is_sora_admin() or (is_active and public.current_creator_id() is not null));
drop policy if exists "level rewards admin write" on public.creator_level_rewards;
create policy "level rewards admin write" on public.creator_level_rewards
  for all to authenticated
  using (public.is_sora_admin()) with check (public.is_sora_admin());
grant select, insert, update, delete on table public.creator_level_rewards to authenticated;

create table if not exists public.creator_reward_claims (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.creator_partners(id) on delete cascade,
  level         integer not null check (level >= 1),
  reward_id     uuid references public.creator_level_rewards(id) on delete set null,
  -- Snapshots: an admin editing the definition later must not rewrite history.
  option_index  integer not null,
  label         text not null,
  reward_type   text not null,
  value         text,
  status        text not null default 'pending'
                  check (status in ('pending', 'fulfilled', 'cancelled')),
  claimed_at    timestamptz not null default now(),
  fulfilled_at  timestamptz,
  cancelled_at  timestamptz,
  admin_notes   text,
  updated_at    timestamptz not null default now(),
  -- Exactly one claim per creator per level, whatever its status.
  constraint creator_reward_claims_level_uk unique (creator_id, level)
);
create index if not exists creator_reward_claims_status_ix on public.creator_reward_claims (status, claimed_at desc);
alter table public.creator_reward_claims enable row level security;
drop trigger if exists creator_reward_claims_touch on public.creator_reward_claims;
create trigger creator_reward_claims_touch before update on public.creator_reward_claims
  for each row execute function public.sora_touch_updated_at();

drop policy if exists "reward claims self read" on public.creator_reward_claims;
create policy "reward claims self read" on public.creator_reward_claims
  for select to authenticated
  using (creator_id = public.current_creator_id());
drop policy if exists "reward claims admin read" on public.creator_reward_claims;
create policy "reward claims admin read" on public.creator_reward_claims
  for select to authenticated
  using (public.is_sora_admin());
-- Writes go through the two RPCs below only (0024 pattern).
revoke insert, update, delete, truncate on table public.creator_reward_claims from anon, authenticated;
grant select on table public.creator_reward_claims to authenticated;

-- The creator picks ONE of the level's options, once. Irreversible from the
-- creator's side; only an admin can cancel.
create or replace function public.claim_level_reward(p_level integer, p_reward_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_cid uuid; v_tier jsonb; v_reward public.creator_level_rewards%rowtype; v_claim_id uuid;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;
  if p_level is null or p_level < 1 then return jsonb_build_object('ok', false, 'reason', 'bad_level'); end if;

  v_tier := public.creator_tier_for_sales(public.creator_confirmed_sales_total(v_cid));
  if (v_tier->>'level')::int < p_level then
    return jsonb_build_object('ok', false, 'reason', 'level_locked', 'level', (v_tier->>'level')::int);
  end if;

  select * into v_reward from public.creator_level_rewards where id = p_reward_id;
  if v_reward.id is null or v_reward.level <> p_level or not v_reward.is_active then
    return jsonb_build_object('ok', false, 'reason', 'bad_reward');
  end if;

  if exists (select 1 from public.creator_reward_claims where creator_id = v_cid and level = p_level) then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  begin
    insert into public.creator_reward_claims (
      creator_id, level, reward_id, option_index, label, reward_type, value
    ) values (
      v_cid, p_level, v_reward.id, v_reward.option_index, v_reward.label, v_reward.reward_type, v_reward.value
    ) returning id into v_claim_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end;

  return jsonb_build_object('ok', true, 'claim_id', v_claim_id, 'level', p_level, 'label', v_reward.label);
end $$;
revoke all on function public.claim_level_reward(integer, uuid) from public, anon;
grant execute on function public.claim_level_reward(integer, uuid) to authenticated;

create or replace function public.admin_set_reward_claim_status(p_claim_id uuid, p_status text, p_notes text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v public.creator_reward_claims%rowtype;
begin
  if not public.is_sora_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_status not in ('fulfilled', 'cancelled') then return jsonb_build_object('ok', false, 'reason', 'bad_status'); end if;
  select * into v from public.creator_reward_claims where id = p_claim_id for update;
  if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v.status = p_status then return jsonb_build_object('ok', true, 'noop', 'already_' || p_status); end if;
  if v.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'terminal', 'status', v.status); end if;
  update public.creator_reward_claims
     set status = p_status,
         fulfilled_at = case when p_status = 'fulfilled' then now() else fulfilled_at end,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         admin_notes = coalesce(p_notes, admin_notes)
   where id = v.id;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;
revoke all on function public.admin_set_reward_claim_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_reward_claim_status(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- 6. Leaderboard (definer function; the tables stay closed)
--
-- Confirmed lifetime sales per creator, ranked descending, ties broken by
-- who reached their current level first. Internal rows carry the figures;
-- the PUBLIC function projects name, rank and level and nothing else.
-- ------------------------------------------------------------
create or replace function public.creator_leaderboard_rows()
returns table (creator_id uuid, rank_position bigint, lifetime numeric, level integer, rank_name text, reached_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with confirmed as (
    select c.creator_id, c.id as conversion_id, c.eligible_sales, l.available_at as confirmed_at
      from public.creator_conversions c
      join public.creator_commission_ledger l on l.conversion_id = c.id and l.type = 'commission'
      join public.creator_partners p on p.id = c.creator_id
     where c.status = 'eligible'
       and l.status in ('held', 'available', 'reserved', 'paid')
       and l.available_at is not null and l.available_at <= now()
       and p.status not in ('suspended', 'archived')
  ),
  totals as (
    select creator_id, sum(eligible_sales) as lifetime
      from confirmed group by creator_id having sum(eligible_sales) > 0
  ),
  tiered as (
    select t.creator_id, t.lifetime,
           (tj.tier->>'level')::int as level, tj.tier->>'rank' as rank_name, (tj.tier->>'threshold')::numeric as threshold
      from totals t cross join lateral public.creator_tier_for_sales(t.lifetime) as tj(tier)
  ),
  running as (
    select creator_id, confirmed_at,
           sum(eligible_sales) over (partition by creator_id order by confirmed_at, conversion_id rows unbounded preceding) as running_total
      from confirmed
  ),
  reached as (
    select r.creator_id, min(r.confirmed_at) as reached_at
      from running r join tiered t on t.creator_id = r.creator_id
     where r.running_total >= t.threshold
     group by r.creator_id
  )
  select t.creator_id,
         row_number() over (order by t.lifetime desc, re.reached_at asc nulls last, t.creator_id) as rank_position,
         t.lifetime, t.level, t.rank_name, re.reached_at
    from tiered t left join reached re on re.creator_id = t.creator_id
   order by rank_position;
$$;
revoke all on function public.creator_leaderboard_rows() from public, anon, authenticated;

-- PUBLIC. Name, rank, level, rank_position. No sales, no earnings, no ids.
-- ("position" is a col_name_keyword and cannot name a function column.)
create or replace function public.creator_leaderboard(p_limit integer default 100)
returns table (rank_position integer, display_name text, rank_name text, level integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select r.rank_position::int, p.display_name, r.rank_name, r.level
    from public.creator_leaderboard_rows() r
    join public.creator_partners p on p.id = r.creator_id
   order by r.rank_position
   limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;
grant execute on function public.creator_leaderboard(integer) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Creator standing (portal) and admin standings
-- ------------------------------------------------------------
create or replace function public.my_creator_standing()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_cid uuid; v_lifetime numeric; v_tier jsonb; v_pos bigint; v_total bigint;
  v_pending_commission numeric; v_confirmed_commission numeric; v_pending_sales numeric;
  v_open boolean;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;

  v_lifetime := public.creator_confirmed_sales_total(v_cid);
  v_tier := public.creator_tier_for_sales(v_lifetime);

  select rank_position, (select count(*) from public.creator_leaderboard_rows())
    into v_pos, v_total
    from public.creator_leaderboard_rows() where creator_id = v_cid;

  -- Pending: rows that have not matured. Confirmed: rows that have, in any
  -- later bucket. Both are net of reversals sitting in the same bucket.
  select coalesce(sum(amount) filter (where status = 'held' and (available_at is null or available_at > now())), 0),
         coalesce(sum(amount) filter (where status in ('available', 'reserved', 'paid')
                                          or (status = 'held' and available_at is not null and available_at <= now())), 0)
    into v_pending_commission, v_confirmed_commission
    from public.creator_commission_ledger where creator_id = v_cid;

  select coalesce(sum(c.eligible_sales), 0) into v_pending_sales
    from public.creator_conversions c
    join public.creator_commission_ledger l on l.conversion_id = c.id and l.type = 'commission'
   where c.creator_id = v_cid and c.status = 'eligible' and l.status = 'held'
     and (l.available_at is null or l.available_at > now());

  v_open := coalesce((public.creator_payout_config()->>'withdrawals_open')::boolean, false);

  return jsonb_build_object(
    'ok', true,
    'level', (v_tier->>'level')::int, 'rank', v_tier->>'rank', 'rate', (v_tier->>'rate')::numeric,
    'threshold', (v_tier->>'threshold')::numeric,
    'next_level', (v_tier->>'next_level')::int, 'next_threshold', (v_tier->>'next_threshold')::numeric,
    'next_rate', (v_tier->>'next_rate')::numeric,
    'lifetime_confirmed_sales', round(v_lifetime, 2),
    'pending_sales', round(v_pending_sales, 2),
    'pending_commission', round(v_pending_commission, 2),
    'confirmed_commission', round(v_confirmed_commission, 2),
    'leaderboard_position', v_pos, 'leaderboard_total', coalesce(v_total, 0),
    'withdrawals_open', v_open,
    'ladder', (select coalesce(jsonb_agg(jsonb_build_object('level', level, 'rank', rank_name, 'threshold', threshold, 'rate', rate) order by level), '[]'::jsonb)
                 from public.creator_tier_levels),
    'beyond_step', (public.creator_tier_config()->>'beyond_step')::numeric
  );
end $$;
revoke all on function public.my_creator_standing() from public, anon;
grant execute on function public.my_creator_standing() to authenticated;

-- Levels the creator has reached that carry rewards, with what was claimed.
-- A level with no active option is simply absent — nothing to prompt.
create or replace function public.my_creator_rewards()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_cid uuid; v_level int;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;
  v_level := (public.creator_tier_for_sales(public.creator_confirmed_sales_total(v_cid))->>'level')::int;

  return jsonb_build_object(
    'ok', true, 'level', v_level,
    'claims', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'level', level, 'label', label, 'reward_type', reward_type, 'value', value,
               'status', status, 'claimed_at', claimed_at, 'fulfilled_at', fulfilled_at, 'cancelled_at', cancelled_at)
               order by level desc), '[]'::jsonb)
        from public.creator_reward_claims where creator_id = v_cid),
    'claimable', (
      select coalesce(jsonb_agg(jsonb_build_object('level', lv.level, 'rank', lv.rank_name, 'options', lv.options) order by lv.level), '[]'::jsonb)
        from (
          select r.level, tl.rank_name,
                 jsonb_agg(jsonb_build_object('id', r.id, 'option_index', r.option_index, 'label', r.label,
                   'description', r.description, 'reward_type', r.reward_type, 'value', r.value) order by r.option_index) as options
            from public.creator_level_rewards r
            left join public.creator_tier_levels tl on tl.level = r.level
           where r.is_active and r.level <= v_level
             and not exists (select 1 from public.creator_reward_claims c where c.creator_id = v_cid and c.level = r.level)
           group by r.level, tl.rank_name
        ) lv)
  );
end $$;
revoke all on function public.my_creator_rewards() from public, anon;
grant execute on function public.my_creator_rewards() to authenticated;

-- Admin: every creator's standing in one call (rank, level, lifetime,
-- pending and confirmed commission). Figures are admin-only by construction.
create or replace function public.admin_creator_standings()
returns table (
  creator_id uuid, level integer, rank_name text, rate numeric, lifetime_confirmed_sales numeric,
  pending_commission numeric, confirmed_commission numeric, leaderboard_position bigint
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sora_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
    with per_creator as (
      select p.id as cid, public.creator_confirmed_sales_total(p.id) as lifetime from public.creator_partners p
    ),
    money as (
      select l.creator_id as cid,
             coalesce(sum(l.amount) filter (where l.status = 'held' and (l.available_at is null or l.available_at > now())), 0) as pending,
             coalesce(sum(l.amount) filter (where l.status in ('available', 'reserved', 'paid')
                                                or (l.status = 'held' and l.available_at is not null and l.available_at <= now())), 0) as confirmed
        from public.creator_commission_ledger l group by l.creator_id
    )
    select pc.cid, (tj.tier->>'level')::int, tj.tier->>'rank', (tj.tier->>'rate')::numeric, round(pc.lifetime, 2),
           round(coalesce(m.pending, 0), 2), round(coalesce(m.confirmed, 0), 2), lb.rank_position
      from per_creator pc
      cross join lateral public.creator_tier_for_sales(pc.lifetime) as tj(tier)
      left join money m on m.cid = pc.cid
      left join public.creator_leaderboard_rows() lb on lb.creator_id = pc.cid;
end $$;
revoke all on function public.admin_creator_standings() from public, anon;
grant execute on function public.admin_creator_standings() to authenticated;

-- ------------------------------------------------------------
-- 8. request_payout — 0023 verbatim + the withdrawals gate + reversal maturity
-- ------------------------------------------------------------
create or replace function public.request_payout(p_amount numeric)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cid uuid; v_cfg jsonb; v_period text; v_min numeric; v_day int;
  v_kyc text; v_avail numeric; v_amount numeric; v_pid uuid; v_method jsonb;
  v_reserved numeric;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;

  -- WITHDRAWALS GATE (0031). Commission accrues regardless; the request itself
  -- is refused while the programme's tax registration is incomplete. The flag
  -- lives in site_settings.creator_payouts and defaults to closed.
  if not coalesce((public.creator_payout_config()->>'withdrawals_open')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'withdrawals_closed');
  end if;

  -- A creator row always exists for v_cid. This stable row serialises even when
  -- the creator has no ledger rows, so concurrent requests cannot overspend.
  perform 1 from public.creator_partners where id = v_cid for update;
  perform 1 from public.creator_commission_ledger where creator_id = v_cid for update;

  v_cfg := public.creator_payout_config();
  v_min := coalesce((v_cfg->>'min_payout')::numeric, 500);
  v_day := coalesce((v_cfg->>'payout_day')::int, 1);
  v_period := to_char(now(), 'YYYY-MM');

  select identity_status into v_kyc
  from public.creator_kyc_profiles where creator_id = v_cid;
  if coalesce(v_kyc, 'not_started') <> 'verified' then
    return jsonb_build_object('ok', false, 'reason', 'kyc_required', 'kyc_status', coalesce(v_kyc, 'not_started'));
  end if;

  if extract(day from now())::int <> v_day then
    return jsonb_build_object('ok', false, 'reason', 'window_closed', 'payout_day', v_day);
  end if;

  if exists (
    select 1 from public.creator_payout_requests
    where creator_id = v_cid and payout_period = v_period
      and status in ('requested', 'under_review', 'approved', 'paid')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_requested');
  end if;

  -- 0031: a reversal booked during the hold matures WITH its commission (it
  -- carries the same available_at), so a refund during the hold is deducted
  -- from the very first payout instead of sitting in 'held' forever.
  update public.creator_commission_ledger
  set status = 'available'
  where creator_id = v_cid and type in ('commission', 'reversal') and status = 'held'
    and available_at is not null and available_at <= now();

  select round(greatest(coalesce(sum(amount), 0), 0), 2) into v_avail
  from public.creator_commission_ledger
  where creator_id = v_cid and payout_id is null and status = 'available';

  -- Nothing to pay out. This must be checked INDEPENDENTLY of v_min, because
  -- min_payout is admin-editable through site_settings and can legitimately
  -- be 0. With min_payout = 0 and a zero (or refund-negative, clamped) balance
  -- the old ordering fell through to an insert of requested_amount = 0, which
  -- violates the cpr requested_amount > 0 check and aborts the call with a raw
  -- constraint error instead of a handled reason.
  if v_avail <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_balance', 'available', v_avail);
  end if;

  if v_avail < v_min then
    return jsonb_build_object('ok', false, 'reason', 'below_minimum', 'available', v_avail, 'min_payout', v_min);
  end if;

  -- The current ledger has row-level reservation, not amount allocations. A
  -- partial request cannot therefore be represented safely. Require the full
  -- cleared balance and leave all state untouched if a different amount arrives.
  if p_amount is not null then
    if p_amount::text in ('NaN', 'Infinity', '-Infinity') or p_amount <= 0 then
      return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
    end if;
    if round(p_amount, 2) <> v_avail then
      return jsonb_build_object('ok', false, 'reason', 'full_balance_required', 'available', v_avail);
    end if;
  end if;
  v_amount := v_avail;

  select jsonb_build_object(
    'method', payout_method,
    'account_holder', payout_account_holder,
    'account', payout_account_masked,
    'ifsc', ifsc_masked,
    'upi', upi_masked
  ) into v_method
  from public.creator_kyc_profiles where creator_id = v_cid;

  insert into public.creator_payout_requests (
    creator_id, payout_period, requested_amount, reserved_amount,
    status, payout_method_snapshot
  ) values (
    v_cid, v_period, v_amount, v_amount, 'requested', v_method
  ) returning id into v_pid;

  update public.creator_commission_ledger
  set status = 'reserved', payout_id = v_pid
  where creator_id = v_cid and payout_id is null and status = 'available';

  select round(coalesce(sum(amount), 0), 2) into v_reserved
  from public.creator_commission_ledger
  where payout_id = v_pid and status = 'reserved';

  -- A concurrent ledger change can only cause the transaction to abort; it can
  -- never create an under-backed payout. PostgreSQL rolls back the whole call.
  if v_reserved <> v_amount then
    raise exception 'payout reservation mismatch' using errcode = '40001';
  end if;

  insert into public.creator_payout_audit (
    payout_id, actor_user_id, from_status, to_status, amount, note
  ) values (
    v_pid, auth.uid(), null, 'requested', v_amount, 'creator requested full cleared balance'
  );

  return jsonb_build_object(
    'ok', true, 'payout_id', v_pid, 'amount', v_amount,
    'period', v_period, 'status', 'requested'
  );
end $$;
revoke all on function public.request_payout(numeric) from public, anon;
grant execute on function public.request_payout(numeric) to authenticated;

-- ------------------------------------------------------------
-- 9. Verify
-- ------------------------------------------------------------
select 'tier_levels' as what, count(*)::text as detail from public.creator_tier_levels
union all
select 'withdrawals_open', coalesce(public.creator_payout_config()->>'withdrawals_open', 'MISSING')
union all
select 'beyond_step', coalesce(public.creator_tier_config()->>'beyond_step', 'MISSING')
union all
select 'function ' || proname, pg_get_function_identity_arguments(oid)
  from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('creator_tier_for_sales','admin_set_creator_tier_levels','creator_confirmed_sales_total',
                   'creator_order_fulfillment_sync','claim_level_reward','admin_set_reward_claim_status',
                   'creator_leaderboard','my_creator_standing','my_creator_rewards','admin_creator_standings',
                   'admin_set_withdrawals_open','request_payout')
union all
select 'trigger ' || tgname, tgrelid::regclass::text from pg_trigger
 where tgname in ('creator_order_fulfillment_sync', 'creator_conversion_commission_sync') and not tgisinternal
union all
select 'policy ' || policyname, tablename::text from pg_policies
 where tablename in ('creator_tier_levels', 'creator_level_rewards', 'creator_reward_claims')
union all
select 'tier(0)', public.creator_tier_for_sales(0)->>'level' || ' @ ' || (public.creator_tier_for_sales(0)->>'rate')
union all
select 'tier(25000)', public.creator_tier_for_sales(25000)->>'level' || ' @ ' || (public.creator_tier_for_sales(25000)->>'rate')
union all
select 'tier(525000)', public.creator_tier_for_sales(525000)->>'level' || ' @ ' || (public.creator_tier_for_sales(525000)->>'rate')
union all
select 'leaderboard rows', count(*)::text from public.creator_leaderboard(100);
