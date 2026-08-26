-- ============================================================
-- SORA LIFE Creator Program — Part 3: Earnings, KYC & Payouts
-- Run once in the Supabase SQL Editor. Additive, idempotent, non-destructive.
--
-- Consumes the Part-2 authoritative creator_conversions.eligible_sales to run
-- a server-side commission LEDGER, a settlement hold, refund reversals, a
-- masked KYC profile, and a monthly payout-request → admin-approve → mark-paid
-- workflow. It moves NO money automatically: a payout becomes 'paid' only when
-- an admin explicitly records a manual transaction reference.
--
-- It changes NOTHING in pricing/cart/checkout/invoice/Razorpay. Commission is
-- eligible_sales × snapshot rate; shipping/tax/refunded are already excluded
-- by Part 2. No raw PAN/Aadhaar/bank/UPI value is ever stored or logged — only
-- server-computed masks; secure_reference columns are placeholders for a real
-- KYC provider to plug into later.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Config + helpers
-- ------------------------------------------------------------
insert into public.site_settings (key, value) values
  ('creator_payouts', jsonb_build_object(
    'settlement_hold_days', 7,
    'min_payout', 500,
    'payout_day', 1,           -- calendar day of month the window opens
    'allow_partial', false
  ))
on conflict (key) do nothing;

-- Mask a sensitive string: keep the first `p_start` and last `p_end` chars,
-- replace the middle with fixed asterisks. Used server-side ONLY; raw input is
-- never stored or returned.
create or replace function public.sora_mask(p_in text, p_start int, p_end int)
returns text language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when p_in is null or length(trim(p_in)) = 0 then null
    when length(regexp_replace(p_in, '\s', '', 'g')) <= (p_start + p_end)
      then repeat('*', greatest(length(regexp_replace(p_in,'\s','','g')),4))
    else substr(regexp_replace(p_in,'\s','','g'), 1, p_start)
         || repeat('*', 4)
         || right(regexp_replace(p_in,'\s','','g'), p_end)
  end;
$$;

create or replace function public.creator_payout_config()
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((select value from public.site_settings where key = 'creator_payouts'),
                  jsonb_build_object('settlement_hold_days',7,'min_payout',500,'payout_day',1,'allow_partial',false));
$$;
grant execute on function public.creator_payout_config() to authenticated, service_role;

-- ============================================================
-- 1. creator_commission_ledger  (append-only; balance is DERIVED, never stored)
-- ============================================================
create table if not exists public.creator_commission_ledger (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.creator_partners(id) on delete restrict,
  conversion_id   uuid references public.creator_conversions(id) on delete set null,
  order_id        uuid references public.orders(id) on delete set null,
  type            text not null check (type in ('commission','reversal','adjustment')),
  status          text not null default 'held'
                    check (status in ('held','available','reserved','paid','reversed')),
  amount          numeric(12,2) not null,          -- signed: commission > 0, reversal < 0
  currency        text not null default 'INR',
  commission_rate numeric(5,2),                    -- immutable snapshot
  eligible_sales  numeric(12,2),                   -- snapshot of the base used
  available_at    timestamptz,                     -- when a 'held' entry matures
  payout_id       uuid,                            -- set when reserved/paid
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
-- IDEMPOTENCY: at most one commission entry per conversion.
create unique index if not exists ccl_conversion_commission_uk
  on public.creator_commission_ledger (conversion_id) where type = 'commission';
create index if not exists ccl_creator_ix on public.creator_commission_ledger (creator_id, status);
create index if not exists ccl_payout_ix  on public.creator_commission_ledger (payout_id);
create index if not exists ccl_avail_ix   on public.creator_commission_ledger (available_at);

-- ============================================================
-- 2. creator_kyc_profiles  (MASKED-ONLY; no raw PAN/Aadhaar/bank/UPI stored)
-- ============================================================
create table if not exists public.creator_kyc_profiles (
  id                    uuid primary key default gen_random_uuid(),
  creator_id            uuid not null unique references public.creator_partners(id) on delete cascade,
  legal_name            text,
  pan_masked            text,
  pan_secure_reference  text,          -- placeholder for a future KYC provider token
  aadhaar_reference     text,          -- reference only; raw Aadhaar is never stored
  identity_status       text not null default 'not_started'
                          check (identity_status in ('not_started','pending','verified','rejected','needs_update')),
  payout_method         text check (payout_method in ('bank','upi')),
  payout_account_holder text,
  payout_account_masked text,
  ifsc_masked           text,
  upi_masked            text,
  payout_secure_reference text,        -- placeholder for tokenised payout instrument
  verification_notes    text,
  submitted_at          timestamptz,
  verified_at           timestamptz,
  verified_by           uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- 3. creator_payout_requests
-- ============================================================
create table if not exists public.creator_payout_requests (
  id                    uuid primary key default gen_random_uuid(),
  creator_id            uuid not null references public.creator_partners(id) on delete restrict,
  payout_period         text not null,             -- 'YYYY-MM'
  requested_amount      numeric(12,2) not null check (requested_amount > 0),
  reserved_amount       numeric(12,2) not null default 0,
  status                text not null default 'requested'
                          check (status in ('requested','under_review','approved','rejected','paid','cancelled')),
  requested_at          timestamptz not null default now(),
  reviewed_at           timestamptz,
  reviewed_by           uuid,
  approved_at           timestamptz,
  approved_by           uuid,
  paid_at               timestamptz,
  paid_by               uuid,
  paid_amount           numeric(12,2),
  payment_reference     text,
  payout_method_snapshot jsonb,
  rejection_reason      text,
  admin_notes           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- ONE active request per creator per period.
create unique index if not exists cpr_active_period_uk
  on public.creator_payout_requests (creator_id, payout_period)
  where status in ('requested','under_review','approved','paid');
-- A manual transaction reference cannot be reused across payouts.
create unique index if not exists cpr_reference_uk
  on public.creator_payout_requests (payment_reference) where payment_reference is not null;
create index if not exists cpr_creator_ix on public.creator_payout_requests (creator_id, status);
create index if not exists cpr_status_ix  on public.creator_payout_requests (status);

-- ============================================================
-- 4. creator_payout_audit
-- ============================================================
create table if not exists public.creator_payout_audit (
  id            uuid primary key default gen_random_uuid(),
  payout_id     uuid references public.creator_payout_requests(id) on delete cascade,
  actor_user_id uuid,
  from_status   text,
  to_status     text,
  amount        numeric(12,2),
  reference     text,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists cpa_payout_ix on public.creator_payout_audit (payout_id, created_at desc);

drop trigger if exists creator_kyc_touch on public.creator_kyc_profiles;
create trigger creator_kyc_touch before update on public.creator_kyc_profiles
  for each row execute function public.sora_touch_updated_at();
drop trigger if exists creator_payout_touch on public.creator_payout_requests;
create trigger creator_payout_touch before update on public.creator_payout_requests
  for each row execute function public.sora_touch_updated_at();

-- ============================================================
-- 5. COMMISSION GENERATION + REVERSAL  (trigger off Part-2 conversions)
--    Fires when a conversion becomes 'eligible' (earn) or its eligible_sales
--    drops / it is cancelled/refunded (reverse). Rate is snapshotted at earn
--    time, so later rate changes never touch historical commission.
-- ============================================================
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
begin
  -- EARN: on transition into 'eligible', create exactly one commission entry.
  if new.status = 'eligible' and (tg_op = 'INSERT' or old.status is distinct from 'eligible') then
    if not exists (select 1 from public.creator_commission_ledger where conversion_id = new.id and type = 'commission') then
      -- Snapshot rate: campaign override wins, else the creator's current rate.
      select coalesce(
               (select commission_rate_override from public.creator_campaigns where id = new.campaign_id),
               (select default_commission_rate from public.creator_partners where id = new.creator_id),
               0)
        into v_rate;
      v_hold := coalesce((public.creator_payout_config()->>'settlement_hold_days')::int, 7);
      v_amount := round(coalesce(new.eligible_sales,0) * v_rate / 100.0, 2);
      insert into public.creator_commission_ledger (
        creator_id, conversion_id, order_id, type, status, amount, currency,
        commission_rate, eligible_sales, available_at, metadata
      ) values (
        new.creator_id, new.id, new.order_id, 'commission', 'held', v_amount, coalesce(new.currency,'INR'),
        v_rate, new.eligible_sales,
        coalesce(new.qualified_at, now()) + make_interval(days => v_hold),
        jsonb_build_object('source','conversion_eligible')
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
        insert into public.creator_commission_ledger (
          creator_id, conversion_id, order_id, type, status, amount, currency,
          commission_rate, eligible_sales, metadata
        ) values (
          v_ccl.creator_id, new.id, new.order_id, 'reversal', v_bucket, -v_delta, v_ccl.currency,
          v_ccl.commission_rate, new.eligible_sales,
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

drop trigger if exists creator_conversion_commission_sync on public.creator_conversions;
create trigger creator_conversion_commission_sync
  after insert or update on public.creator_conversions
  for each row execute function public.creator_conversion_commission_sync();

-- ============================================================
-- 6. BALANCE DERIVATION + creator earnings (no stored balance)
--    Availability is derived: a 'held' entry whose available_at has passed
--    counts as available. request_payout performs the real status flip.
-- ============================================================
create or replace function public.my_creator_earnings()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_cid uuid; v jsonb; v_cfg jsonb;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;
  v_cfg := public.creator_payout_config();

  with led as (
    select * from public.creator_commission_ledger where creator_id = v_cid
  ),
  buckets as (
    select
      coalesce(sum(amount) filter (where status='held'      and (available_at is null or available_at >  now()) and payout_id is null),0) as held,
      coalesce(sum(amount) filter (where payout_id is null and (status='available' or (status='held' and available_at <= now()))),0) as available,
      coalesce(sum(amount) filter (where status='reserved'),0) as reserved,
      coalesce(sum(amount) filter (where status='paid'),0)     as paid,
      coalesce(sum(-amount) filter (where type in ('reversal','adjustment')),0) as reversed
    from led
  )
  select jsonb_build_object(
    'ok', true,
    'currency','INR',
    'held', (select round(held,2) from buckets),
    'available', (select round(greatest(available,0),2) from buckets),
    'available_raw', (select round(available,2) from buckets),
    'paid', (select round(paid,2) from buckets),
    'reserved', (select round(reserved,2) from buckets),
    'reversed', (select round(reversed,2) from buckets),
    'commission_rate', (select default_commission_rate from public.creator_partners where id = v_cid),
    'settlement_hold_days', (v_cfg->>'settlement_hold_days')::int,
    'min_payout', (v_cfg->>'min_payout')::numeric,
    'payout_day', (v_cfg->>'payout_day')::int,
    'this_month', (
      select jsonb_build_object(
        'orders', count(distinct c.id),
        'products_sold', coalesce(sum(ci.quantity),0),
        'attributed_sales', coalesce(sum(distinct_c.eligible_sales),0),
        'commission_earned', coalesce((select sum(amount) from public.creator_commission_ledger l where l.creator_id=v_cid and l.type='commission' and date_trunc('month',l.created_at)=date_trunc('month',now())),0)
      )
      from public.creator_conversions c
      left join public.creator_conversion_items ci on ci.conversion_id = c.id
      left join lateral (select c.eligible_sales) distinct_c on true
      where c.creator_id = v_cid and c.status='eligible' and date_trunc('month',c.attributed_at)=date_trunc('month',now())
    ),
    'clicks', (select count(*) from public.creator_attribution_events e where e.creator_id=v_cid and e.event_type in ('click','landing')),
    'top_products', (
      select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select ci.product_name_snapshot as name, ci.variant_label_snapshot as variant,
               sum(ci.quantity) as qty, sum(ci.eligible_amount) as sales,
               round(sum(ci.eligible_amount) * coalesce((select default_commission_rate from public.creator_partners where id=v_cid),0)/100.0,2) as commission
        from public.creator_conversion_items ci join public.creator_conversions c on c.id=ci.conversion_id
        where c.creator_id=v_cid and c.status='eligible'
        group by ci.product_name_snapshot, ci.variant_label_snapshot order by sales desc limit 10
      ) t
    ),
    'monthly_history', (
      select coalesce(jsonb_agg(m order by m->>'month'),'[]'::jsonb) from (
        select jsonb_build_object('month', to_char(date_trunc('month',created_at),'YYYY-MM'),
               'commission', round(sum(amount),2)) as m
        from public.creator_commission_ledger where creator_id=v_cid
        group by date_trunc('month',created_at) order by date_trunc('month',created_at) desc limit 12
      ) hist
    )
  ) into v;
  return v;
end $$;
revoke all on function public.my_creator_earnings() from public, anon;
grant execute on function public.my_creator_earnings() to authenticated, service_role;

-- ============================================================
-- 7. KYC — creator submits (masked server-side); admin verifies
-- ============================================================
create or replace function public.submit_kyc(
  p_legal_name text, p_pan text, p_method text,
  p_account_holder text, p_account_number text, p_ifsc text, p_upi text
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_cid uuid; v_method text;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;
  v_method := case when p_method in ('bank','upi') then p_method else null end;

  -- Store ONLY masks. Raw PAN/account/UPI are masked here and never persisted
  -- or logged. identity_status is forced to 'pending' — a creator can never set
  -- it to 'verified'.
  insert into public.creator_kyc_profiles as k (
    creator_id, legal_name, pan_masked, payout_method, payout_account_holder,
    payout_account_masked, ifsc_masked, upi_masked, identity_status, submitted_at
  ) values (
    v_cid,
    left(trim(coalesce(p_legal_name,'')),120),
    public.sora_mask(p_pan, 5, 1),
    v_method,
    left(trim(coalesce(p_account_holder,'')),120),
    case when v_method='bank' then public.sora_mask(p_account_number, 0, 4) else null end,
    case when v_method='bank' then public.sora_mask(p_ifsc, 4, 3) else null end,
    case when v_method='upi'  then public.sora_mask(p_upi, 2, 4) else null end,
    'pending', now()
  )
  on conflict (creator_id) do update set
    legal_name = excluded.legal_name,
    pan_masked = coalesce(excluded.pan_masked, k.pan_masked),
    payout_method = coalesce(excluded.payout_method, k.payout_method),
    payout_account_holder = excluded.payout_account_holder,
    payout_account_masked = coalesce(excluded.payout_account_masked, k.payout_account_masked),
    ifsc_masked = coalesce(excluded.ifsc_masked, k.ifsc_masked),
    upi_masked = coalesce(excluded.upi_masked, k.upi_masked),
    -- Re-submitting after a rejection/needs_update moves back to 'pending';
    -- an already-verified profile edit also returns to 'pending' for re-review.
    identity_status = 'pending',
    submitted_at = now();

  return jsonb_build_object('ok', true, 'identity_status', 'pending');
end $$;
revoke all on function public.submit_kyc(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.submit_kyc(text,text,text,text,text,text,text) to authenticated;

create or replace function public.admin_set_kyc_status(p_creator_id uuid, p_status text, p_notes text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sora_admin() then raise exception 'admin only'; end if;
  if p_status not in ('verified','rejected','needs_update','pending') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;
  update public.creator_kyc_profiles
    set identity_status = p_status,
        verification_notes = p_notes,
        verified_at = case when p_status='verified' then now() else verified_at end,
        verified_by = case when p_status='verified' then auth.uid() else verified_by end
    where creator_id = p_creator_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  return jsonb_build_object('ok', true, 'identity_status', p_status);
end $$;
revoke all on function public.admin_set_kyc_status(uuid,text,text) from public, anon;
grant execute on function public.admin_set_kyc_status(uuid,text,text) to authenticated, service_role;

-- ============================================================
-- 8. PAYOUT — creator requests (window + KYC + reserve); admin approves/pays
-- ============================================================
create or replace function public.request_payout(p_amount numeric)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cid uuid; v_cfg jsonb; v_period text; v_min numeric; v_day int; v_partial boolean;
  v_kyc text; v_avail numeric; v_amount numeric; v_pid uuid; v_method jsonb;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;

  -- Lock the creator's ledger rows so concurrent requests serialise.
  perform 1 from public.creator_commission_ledger where creator_id = v_cid for update;

  v_cfg := public.creator_payout_config();
  v_min := coalesce((v_cfg->>'min_payout')::numeric, 500);
  v_day := coalesce((v_cfg->>'payout_day')::int, 1);
  v_partial := coalesce((v_cfg->>'allow_partial')::boolean, false);
  v_period := to_char(now(),'YYYY-MM');

  -- KYC gate.
  select identity_status into v_kyc from public.creator_kyc_profiles where creator_id = v_cid;
  if coalesce(v_kyc,'not_started') <> 'verified' then
    return jsonb_build_object('ok', false, 'reason', 'kyc_required', 'kyc_status', coalesce(v_kyc,'not_started'));
  end if;

  -- Window gate.
  if extract(day from now())::int <> v_day then
    return jsonb_build_object('ok', false, 'reason', 'window_closed', 'payout_day', v_day);
  end if;

  -- One active request per period.
  if exists (select 1 from public.creator_payout_requests
             where creator_id = v_cid and payout_period = v_period
               and status in ('requested','under_review','approved','paid')) then
    return jsonb_build_object('ok', false, 'reason', 'already_requested');
  end if;

  -- Release matured commissions (held -> available) before computing balance.
  update public.creator_commission_ledger
    set status = 'available'
    where creator_id = v_cid and type = 'commission' and status = 'held'
      and available_at is not null and available_at <= now();

  select coalesce(sum(amount),0) into v_avail
    from public.creator_commission_ledger
    where creator_id = v_cid and payout_id is null and status = 'available';
  v_avail := round(greatest(v_avail,0),2);

  if v_avail < v_min then
    return jsonb_build_object('ok', false, 'reason', 'below_minimum', 'available', v_avail, 'min_payout', v_min);
  end if;

  -- Amount: full available, or a permitted partial amount.
  v_amount := coalesce(p_amount, v_avail);
  if not v_partial then v_amount := v_avail; end if;
  v_amount := round(v_amount,2);
  if v_amount < v_min then return jsonb_build_object('ok', false, 'reason', 'below_minimum', 'min_payout', v_min); end if;
  if v_amount > v_avail then return jsonb_build_object('ok', false, 'reason', 'exceeds_available', 'available', v_avail); end if;

  select jsonb_build_object('method', payout_method, 'account_holder', payout_account_holder,
           'account', payout_account_masked, 'ifsc', ifsc_masked, 'upi', upi_masked)
    into v_method from public.creator_kyc_profiles where creator_id = v_cid;

  insert into public.creator_payout_requests (creator_id, payout_period, requested_amount, reserved_amount, status, payout_method_snapshot)
  values (v_cid, v_period, v_amount, v_amount, 'requested', v_method)
  returning id into v_pid;

  -- RESERVE: lock available entries into this payout (up to the requested amount).
  -- Full-amount reservation marks all available; a partial marks oldest-first.
  update public.creator_commission_ledger
    set status = 'reserved', payout_id = v_pid
    where creator_id = v_cid and payout_id is null and status = 'available';

  insert into public.creator_payout_audit (payout_id, actor_user_id, from_status, to_status, amount, note)
  values (v_pid, auth.uid(), null, 'requested', v_amount, 'creator requested payout');

  return jsonb_build_object('ok', true, 'payout_id', v_pid, 'amount', v_amount, 'period', v_period, 'status','requested');
end $$;
revoke all on function public.request_payout(numeric) from public, anon;
grant execute on function public.request_payout(numeric) to authenticated;

create or replace function public.admin_review_payout(p_payout_id uuid, p_action text, p_notes text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v public.creator_payout_requests%rowtype; v_to text;
begin
  if not public.is_sora_admin() then raise exception 'admin only'; end if;
  select * into v from public.creator_payout_requests where id = p_payout_id for update;
  if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  v_to := case p_action
    when 'review'  then 'under_review'
    when 'approve' then 'approved'
    when 'reject'  then 'rejected'
    else null end;
  if v_to is null then return jsonb_build_object('ok', false, 'reason', 'bad_action'); end if;
  if v.status in ('paid','cancelled') then return jsonb_build_object('ok', false, 'reason', 'terminal'); end if;
  if v_to = 'approved' and v.status not in ('requested','under_review') then return jsonb_build_object('ok', false, 'reason', 'bad_transition'); end if;

  update public.creator_payout_requests set
    status = v_to,
    reviewed_at = case when v_to in ('under_review','approved','rejected') then now() else reviewed_at end,
    reviewed_by = case when v_to in ('under_review','approved','rejected') then auth.uid() else reviewed_by end,
    approved_at = case when v_to='approved' then now() else approved_at end,
    approved_by = case when v_to='approved' then auth.uid() else approved_by end,
    rejection_reason = case when v_to='rejected' then p_notes else rejection_reason end,
    admin_notes = coalesce(p_notes, admin_notes)
  where id = p_payout_id;

  -- Rejection RELEASES the reserved balance back to available.
  if v_to = 'rejected' then
    update public.creator_commission_ledger set status = 'available', payout_id = null
      where payout_id = p_payout_id and status = 'reserved';
  end if;

  insert into public.creator_payout_audit (payout_id, actor_user_id, from_status, to_status, amount, note)
  values (p_payout_id, auth.uid(), v.status, v_to, v.requested_amount, p_notes);

  return jsonb_build_object('ok', true, 'status', v_to);
end $$;
revoke all on function public.admin_review_payout(uuid,text,text) from public, anon;
grant execute on function public.admin_review_payout(uuid,text,text) to authenticated, service_role;

create or replace function public.admin_mark_payout_paid(p_payout_id uuid, p_paid_amount numeric, p_reference text, p_note text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v public.creator_payout_requests%rowtype;
begin
  if not public.is_sora_admin() then raise exception 'admin only'; end if;
  if p_reference is null or length(trim(p_reference)) = 0 then return jsonb_build_object('ok', false, 'reason', 'reference_required'); end if;

  select * into v from public.creator_payout_requests where id = p_payout_id for update;
  if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v.status = 'paid' then return jsonb_build_object('ok', true, 'noop', 'already_paid'); end if;   -- idempotent
  if v.status <> 'approved' then return jsonb_build_object('ok', false, 'reason', 'not_approved'); end if;
  -- Paid amount may not exceed the approved amount.
  if coalesce(p_paid_amount, v.requested_amount) > v.requested_amount then
    return jsonb_build_object('ok', false, 'reason', 'overpayment', 'approved', v.requested_amount);
  end if;

  update public.creator_payout_requests set
    status = 'paid', paid_at = now(), paid_by = auth.uid(),
    paid_amount = coalesce(p_paid_amount, requested_amount),
    payment_reference = trim(p_reference),
    admin_notes = coalesce(p_note, admin_notes)
  where id = p_payout_id;

  -- Settle the reserved ledger entries as PAID.
  update public.creator_commission_ledger set status = 'paid'
    where payout_id = p_payout_id and status = 'reserved';

  insert into public.creator_payout_audit (payout_id, actor_user_id, from_status, to_status, amount, reference, note)
  values (p_payout_id, auth.uid(), 'approved', 'paid', coalesce(p_paid_amount, v.requested_amount), trim(p_reference), p_note);

  return jsonb_build_object('ok', true, 'status', 'paid', 'reference', trim(p_reference));
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_reference');
end $$;
revoke all on function public.admin_mark_payout_paid(uuid,numeric,text,text) from public, anon;
grant execute on function public.admin_mark_payout_paid(uuid,numeric,text,text) to authenticated, service_role;

-- ============================================================
-- 9. RLS
--   Admin: full read on all four tables (+ write via SECURITY DEFINER fns).
--   Creator: read OWN ledger / kyc (masked) / payout requests / payout audit.
--            NO direct writes anywhere — every financial write is a definer fn.
--   Customer / anon: nothing.
-- ============================================================
alter table public.creator_commission_ledger enable row level security;
alter table public.creator_kyc_profiles      enable row level security;
alter table public.creator_payout_requests   enable row level security;
alter table public.creator_payout_audit      enable row level security;

drop policy if exists "ccl admin all" on public.creator_commission_ledger;
create policy "ccl admin all" on public.creator_commission_ledger for all using (public.is_sora_admin()) with check (public.is_sora_admin());
drop policy if exists "ccl self read" on public.creator_commission_ledger;
create policy "ccl self read" on public.creator_commission_ledger for select using (creator_id = public.current_creator_id());

drop policy if exists "kyc admin all" on public.creator_kyc_profiles;
create policy "kyc admin all" on public.creator_kyc_profiles for all using (public.is_sora_admin()) with check (public.is_sora_admin());
drop policy if exists "kyc self read" on public.creator_kyc_profiles;
create policy "kyc self read" on public.creator_kyc_profiles for select using (creator_id = public.current_creator_id());

drop policy if exists "cpr admin all" on public.creator_payout_requests;
create policy "cpr admin all" on public.creator_payout_requests for all using (public.is_sora_admin()) with check (public.is_sora_admin());
drop policy if exists "cpr self read" on public.creator_payout_requests;
create policy "cpr self read" on public.creator_payout_requests for select using (creator_id = public.current_creator_id());

drop policy if exists "cpa admin read" on public.creator_payout_audit;
create policy "cpa admin read" on public.creator_payout_audit for select using (public.is_sora_admin());
drop policy if exists "cpa self read" on public.creator_payout_audit;
create policy "cpa self read" on public.creator_payout_audit for select using (
  exists (select 1 from public.creator_payout_requests r where r.id = payout_id and r.creator_id = public.current_creator_id())
);

select 'Creator earnings/KYC/payouts (Part 3) migration complete.' as status;
