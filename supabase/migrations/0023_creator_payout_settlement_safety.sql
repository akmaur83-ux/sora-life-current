-- ============================================================
-- SORA LIFE Creator payouts — settlement safety
-- Local migration only. Do not apply automatically.
--
-- The original payout functions reserved every available ledger row even when
-- a partial amount was requested, then marked every reserved row paid when an
-- admin recorded any amount up to the request. Until ledger allocations exist,
-- the safe invariant is one request = one exact, fully reserved settlement.
-- Money still moves manually outside the application.
-- ============================================================

-- Enforce sane values for all new/updated payout rows without making this
-- migration fail on an unknown historical row. Existing data can be audited
-- before the constraint is validated separately.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.creator_payout_requests'::regclass
      and conname = 'cpr_paid_amount_bounds_ck'
  ) then
    alter table public.creator_payout_requests
      add constraint cpr_paid_amount_bounds_ck check (
        paid_amount is null or (
          paid_amount::text not in ('NaN', 'Infinity', '-Infinity')
          and paid_amount > 0
          and paid_amount <= requested_amount
        )
      ) not valid;
  end if;
end $$;

-- Repair the only terminal states that must never retain a reservation.
update public.creator_commission_ledger l
set status = 'available', payout_id = null
from public.creator_payout_requests p
where p.id = l.payout_id
  and p.status in ('rejected', 'cancelled')
  and l.status = 'reserved';

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

  update public.creator_commission_ledger
  set status = 'available'
  where creator_id = v_cid and type = 'commission' and status = 'held'
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

create or replace function public.admin_review_payout(
  p_payout_id uuid, p_action text, p_notes text
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v public.creator_payout_requests%rowtype; v_to text;
begin
  if not public.is_sora_admin() then raise exception 'admin only'; end if;

  select * into v from public.creator_payout_requests
  where id = p_payout_id for update;
  if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  v_to := case p_action
    when 'review' then 'under_review'
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    when 'cancel' then 'cancelled'
    else null
  end;
  if v_to is null then return jsonb_build_object('ok', false, 'reason', 'bad_action'); end if;
  if v.status = v_to then
    return jsonb_build_object('ok', true, 'noop', 'already_' || v_to, 'status', v_to);
  end if;
  if v.status in ('paid', 'rejected', 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'terminal');
  end if;

  if (v_to = 'under_review' and v.status <> 'requested')
    or (v_to = 'approved' and v.status not in ('requested', 'under_review'))
    or (v_to in ('rejected', 'cancelled') and v.status not in ('requested', 'under_review', 'approved')) then
    return jsonb_build_object('ok', false, 'reason', 'bad_transition');
  end if;

  update public.creator_payout_requests set
    status = v_to,
    reviewed_at = case when v_to in ('under_review', 'approved', 'rejected', 'cancelled') then now() else reviewed_at end,
    reviewed_by = case when v_to in ('under_review', 'approved', 'rejected', 'cancelled') then auth.uid() else reviewed_by end,
    approved_at = case when v_to = 'approved' then now() else approved_at end,
    approved_by = case when v_to = 'approved' then auth.uid() else approved_by end,
    rejection_reason = case when v_to = 'rejected' then p_notes else rejection_reason end,
    admin_notes = coalesce(p_notes, admin_notes)
  where id = p_payout_id;

  if v_to in ('rejected', 'cancelled') then
    update public.creator_commission_ledger
    set status = 'available', payout_id = null
    where payout_id = p_payout_id and status = 'reserved';
  end if;

  insert into public.creator_payout_audit (
    payout_id, actor_user_id, from_status, to_status, amount, note
  ) values (
    p_payout_id, auth.uid(), v.status, v_to, v.requested_amount, p_notes
  );

  return jsonb_build_object('ok', true, 'status', v_to);
end $$;
revoke all on function public.admin_review_payout(uuid, text, text) from public, anon;
grant execute on function public.admin_review_payout(uuid, text, text) to authenticated, service_role;

create or replace function public.admin_mark_payout_paid(
  p_payout_id uuid, p_paid_amount numeric, p_reference text, p_note text
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v public.creator_payout_requests%rowtype;
  v_paid numeric;
  v_reserved numeric;
begin
  if not public.is_sora_admin() then raise exception 'admin only'; end if;
  if p_reference is null or length(trim(p_reference)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'reference_required');
  end if;
  if p_paid_amount is null or p_paid_amount::text in ('NaN', 'Infinity', '-Infinity') or p_paid_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;
  v_paid := round(p_paid_amount, 2);

  select * into v from public.creator_payout_requests
  where id = p_payout_id for update;
  if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  if v.status = 'paid' then
    if v.paid_amount = v_paid and v.payment_reference = trim(p_reference) then
      return jsonb_build_object('ok', true, 'noop', 'already_paid');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'already_paid_mismatch');
  end if;
  if v.status <> 'approved' then
    return jsonb_build_object('ok', false, 'reason', 'not_approved');
  end if;

  -- Finalisation is exact. An underpayment is not recorded as a fully paid
  -- payout, and an overpayment is never allowed.
  if v_paid <> round(v.requested_amount, 2) then
    return jsonb_build_object(
      'ok', false, 'reason', 'exact_amount_required',
      'approved', v.requested_amount
    );
  end if;

  perform 1 from public.creator_commission_ledger
  where payout_id = p_payout_id and status = 'reserved' for update;
  select round(coalesce(sum(amount), 0), 2) into v_reserved
  from public.creator_commission_ledger
  where payout_id = p_payout_id and status = 'reserved';

  if v_reserved <> v_paid or round(v.reserved_amount, 2) <> v_paid then
    return jsonb_build_object(
      'ok', false, 'reason', 'reservation_mismatch',
      'reserved', v_reserved, 'approved', v.requested_amount
    );
  end if;

  update public.creator_commission_ledger
  set status = 'paid'
  where payout_id = p_payout_id and status = 'reserved';

  update public.creator_payout_requests set
    status = 'paid',
    paid_at = now(),
    paid_by = auth.uid(),
    paid_amount = v_paid,
    payment_reference = trim(p_reference),
    admin_notes = coalesce(p_note, admin_notes)
  where id = p_payout_id;

  insert into public.creator_payout_audit (
    payout_id, actor_user_id, from_status, to_status, amount, reference, note
  ) values (
    p_payout_id, auth.uid(), 'approved', 'paid', v_paid, trim(p_reference), p_note
  );

  return jsonb_build_object(
    'ok', true, 'status', 'paid', 'amount', v_paid,
    'reference', trim(p_reference)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_reference');
end $$;
revoke all on function public.admin_mark_payout_paid(uuid, numeric, text, text) from public, anon;
grant execute on function public.admin_mark_payout_paid(uuid, numeric, text, text) to authenticated, service_role;

-- Authenticated clients read through RLS and mutate only through the guarded
-- SECURITY DEFINER functions above. This closes the admin-client direct-table
-- path that could otherwise bypass the transition and reservation invariants.
revoke insert, update, delete, truncate on table public.creator_commission_ledger from anon, authenticated;
revoke insert, update, delete, truncate on table public.creator_payout_requests from anon, authenticated;
revoke insert, update, delete, truncate on table public.creator_payout_audit from anon, authenticated;
grant select on table public.creator_commission_ledger to authenticated;
grant select on table public.creator_payout_requests to authenticated;
grant select on table public.creator_payout_audit to authenticated;

select 'Creator payout settlement safety migration complete.' as status;
