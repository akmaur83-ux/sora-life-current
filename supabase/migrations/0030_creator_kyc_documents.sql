-- ============================================================
-- 0030 — CREATOR KYC: RE-CHECK AT PAYOUT, AUDIT TRAIL, DOCUMENT UPLOAD
--
-- Three things, in the order they matter.
--
--   1. KYC is re-checked when an admin APPROVES a payout and again when one
--      is MARKED PAID. request_payout checked it at request time only;
--      verification revoked in between let a payout proceed.
--   2. Every change to a creator's KYC status, notes or verifier is recorded
--      in creator_kyc_audit — who, what, when, why — by a trigger, so the
--      admin RPC, a creator's resubmission and a direct admin table write
--      are all captured. admin_set_kyc_status used to overwrite
--      verification_notes and verified_by in place.
--   3. A PRIVATE bucket for KYC documents, with RLS: a creator writes and
--      reads only under their own creator id; an admin reads everything;
--      nobody else, and never publicly. The profile records which document
--      is on file for PAN and for bank proof.
--
-- Payout disbursement and commission calculation are untouched. The two
-- payout functions below are 0023's text with ONE guard each spliced in;
-- the generator that produced this file diffs them against 0023.
-- ============================================================

-- ------------------------------------------------------------
-- 1. One definition of "is this creator verified right now"
-- ------------------------------------------------------------
create or replace function public.creator_kyc_status(p_creator_id uuid)
returns text language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select identity_status from public.creator_kyc_profiles where creator_id = p_creator_id),
    'not_started'
  );
$$;
revoke all on function public.creator_kyc_status(uuid) from public, anon;
grant execute on function public.creator_kyc_status(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Payout functions: 0023 verbatim + the KYC guard
-- ------------------------------------------------------------
create or replace function public.admin_review_payout(
  p_payout_id uuid, p_action text, p_notes text
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v public.creator_payout_requests%rowtype; v_to text; v_kyc text;
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

  -- KYC RE-CHECK AT APPROVAL. request_payout verified the creator at request
  -- time; verification can be revoked between then and now (rejected,
  -- needs_update, or the row gone). An approval is a commitment to pay, so
  -- it is refused unless the creator is verified RIGHT NOW. Review, reject
  -- and cancel do not move money and are not gated.
  if v_to = 'approved' then
    v_kyc := public.creator_kyc_status(v.creator_id);
    if v_kyc <> 'verified' then
      return jsonb_build_object('ok', false, 'reason', 'kyc_required', 'kyc_status', v_kyc);
    end if;
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
  v_kyc text;
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

  -- KYC RE-CHECK AT MARK-PAID. Approval already re-checked, but approval and
  -- payment are separate admin actions, possibly days apart. The payout is
  -- not finalised for a creator whose verification was revoked in between.
  v_kyc := public.creator_kyc_status(v.creator_id);
  if v_kyc <> 'verified' then
    return jsonb_build_object('ok', false, 'reason', 'kyc_required', 'kyc_status', v_kyc);
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
revoke all on function public.admin_review_payout(uuid, text, text) from public, anon;
grant execute on function public.admin_review_payout(uuid, text, text) to authenticated, service_role;
revoke all on function public.admin_mark_payout_paid(uuid, numeric, text, text) from public, anon;
grant execute on function public.admin_mark_payout_paid(uuid, numeric, text, text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Audit trail — the creator_conversion_audit shape
-- ------------------------------------------------------------
create table if not exists public.creator_kyc_audit (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.creator_partners(id) on delete cascade,
  actor        uuid,              -- auth.uid() of whoever made the change
  from_status  text,
  to_status    text,
  from_notes   text,
  to_notes     text,              -- the reason, as the admin typed it
  from_verified_by uuid,
  to_verified_by   uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists creator_kyc_audit_creator_ix
  on public.creator_kyc_audit (creator_id, created_at desc);

alter table public.creator_kyc_audit enable row level security;
drop policy if exists "kyc audit admin read" on public.creator_kyc_audit;
create policy "kyc audit admin read"
  on public.creator_kyc_audit for select using (public.is_sora_admin());
-- Written only by the trigger below (definer). No client role may write it.
revoke insert, update, delete, truncate on table public.creator_kyc_audit from anon, authenticated;
grant select on table public.creator_kyc_audit to authenticated;

-- A trigger rather than an insert inside admin_set_kyc_status: the RPC is
-- one of three paths that can change these columns (submit_kyc moves the
-- status to pending; "kyc admin all" lets an admin write the table directly),
-- and an audit that only sees one of them is not an audit.
create or replace function public.creator_kyc_audit_row()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.identity_status is not distinct from old.identity_status
     and new.verification_notes is not distinct from old.verification_notes
     and new.verified_by is not distinct from old.verified_by
     and new.pan_document_path is not distinct from old.pan_document_path
     and new.bank_document_path is not distinct from old.bank_document_path then
    return new;
  end if;
  insert into public.creator_kyc_audit (
    creator_id, actor, from_status, to_status, from_notes, to_notes,
    from_verified_by, to_verified_by, metadata
  ) values (
    new.creator_id, auth.uid(),
    case when tg_op = 'UPDATE' then old.identity_status end, new.identity_status,
    case when tg_op = 'UPDATE' then old.verification_notes end, new.verification_notes,
    case when tg_op = 'UPDATE' then old.verified_by end, new.verified_by,
    jsonb_build_object(
      'op', tg_op,
      'pan_document', new.pan_document_path is not null,
      'bank_document', new.bank_document_path is not null,
      'documents_changed', tg_op = 'INSERT'
        or new.pan_document_path is distinct from old.pan_document_path
        or new.bank_document_path is distinct from old.bank_document_path
    )
  );
  return new;
end $$;

-- ------------------------------------------------------------
-- 4. Documents on the profile
-- ------------------------------------------------------------
alter table public.creator_kyc_profiles add column if not exists pan_document_path  text;
alter table public.creator_kyc_profiles add column if not exists bank_document_path text;
alter table public.creator_kyc_profiles add column if not exists documents_updated_at timestamptz;

drop trigger if exists creator_kyc_audit_trg on public.creator_kyc_profiles;
create trigger creator_kyc_audit_trg
  after insert or update on public.creator_kyc_profiles
  for each row execute function public.creator_kyc_audit_row();

-- ------------------------------------------------------------
-- 5. The bucket: PRIVATE. The three existing buckets are public and are
--    not reused.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents', 'kyc-documents', false,
  5242880,                                                  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object names are <creator_id>/<kind>/<uuid>.<ext>. The first folder is the
-- creator's own id, resolved from auth.uid() by current_creator_id(); a
-- creator can therefore only ever address their own prefix.
drop policy if exists "kyc-documents creator insert" on storage.objects;
create policy "kyc-documents creator insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = public.current_creator_id()::text
  );

drop policy if exists "kyc-documents creator read" on storage.objects;
create policy "kyc-documents creator read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = public.current_creator_id()::text
  );

-- A creator may remove their OWN superseded upload (the portal deletes the
-- previous object after a replacement is recorded). Never anyone else's.
drop policy if exists "kyc-documents creator delete" on storage.objects;
create policy "kyc-documents creator delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = public.current_creator_id()::text
  );

-- Admins read every document — that is the review. They never write one.
drop policy if exists "kyc-documents admin read" on storage.objects;
create policy "kyc-documents admin read"
  on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and public.is_sora_admin());

-- There is deliberately NO public read policy and NO update policy.

-- ------------------------------------------------------------
-- 6. Recording an uploaded document. Definer, creator-only. The object must
--    already exist in the bucket under the creator's prefix — a path cannot
--    be recorded that was not uploaded, or that belongs to someone else.
-- ------------------------------------------------------------
create or replace function public.set_kyc_document(p_kind text, p_path text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_cid uuid; v_prefix text; v_status text; v_previous text;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;
  if p_kind not in ('pan', 'bank') then return jsonb_build_object('ok', false, 'reason', 'bad_kind'); end if;

  v_prefix := v_cid::text || '/' || p_kind || '/';
  if p_path is null or left(p_path, length(v_prefix)) <> v_prefix
     or p_path !~ ('^' || v_cid::text || '/' || p_kind || '/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp|pdf)$') then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;
  if not exists (
    select 1 from storage.objects where bucket_id = 'kyc-documents' and name = p_path
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_uploaded');
  end if;

  select identity_status,
         case p_kind when 'pan' then pan_document_path else bank_document_path end
    into v_status, v_previous
  from public.creator_kyc_profiles where creator_id = v_cid;

  -- A profile row may not exist yet if the creator uploads before filling the
  -- form; create it in 'not_started' so the document has somewhere to live.
  insert into public.creator_kyc_profiles (creator_id, identity_status)
  values (v_cid, 'not_started')
  on conflict (creator_id) do nothing;

  update public.creator_kyc_profiles set
    pan_document_path  = case when p_kind = 'pan'  then p_path else pan_document_path end,
    bank_document_path = case when p_kind = 'bank' then p_path else bank_document_path end,
    documents_updated_at = now(),
    -- A changed document on a VERIFIED profile needs a fresh review: the
    -- verification was of the old document. Other states are left as they
    -- are; submit_kyc moves them to pending.
    identity_status = case when identity_status = 'verified' then 'pending' else identity_status end
  where creator_id = v_cid;

  return jsonb_build_object('ok', true, 'kind', p_kind, 'path', p_path,
    'previous_path', v_previous,
    'identity_status', (select identity_status from public.creator_kyc_profiles where creator_id = v_cid));
end $$;
revoke all on function public.set_kyc_document(text, text) from public, anon;
grant execute on function public.set_kyc_document(text, text) to authenticated;

-- ------------------------------------------------------------
-- Verification. Expect: 2 functions changed, the audit table, 3 columns,
-- the bucket (public = false), and 4 policies.
-- ------------------------------------------------------------
select 'bucket' as kind, id as name, public::text as detail from storage.buckets where id = 'kyc-documents'
union all
select 'policy', policyname, cmd from pg_policies where schemaname = 'storage' and policyname like 'kyc-documents%'
union all
select 'column', column_name, data_type from information_schema.columns
  where table_schema = 'public' and table_name = 'creator_kyc_profiles'
    and column_name in ('pan_document_path', 'bank_document_path', 'documents_updated_at')
union all
select 'table', table_name, 'audit' from information_schema.tables
  where table_schema = 'public' and table_name = 'creator_kyc_audit'
union all
select 'trigger', tgname, 'on creator_kyc_profiles' from pg_trigger where tgname = 'creator_kyc_audit_trg'
union all
select 'function', proname, 'kyc guard' from pg_proc
  where proname in ('creator_kyc_status', 'set_kyc_document')
    and pronamespace = 'public'::regnamespace
order by kind, name;
