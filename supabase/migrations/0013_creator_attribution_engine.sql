-- ============================================================
-- SORA LIFE Creator Program — Part 2: Sales Attribution Engine
-- Run once in the Supabase SQL Editor. Additive, idempotent, non-destructive.
--
-- Records, server-side and auditably, the full chain:
--   creator link -> attribution -> order -> order item -> eligible sales
-- It does NOT compute commission, earnings, or payouts (that is Part 3), and
-- it changes NO pricing/checkout/payment/invoice logic. It only READS the
-- server-authoritative order the checkout already produced and snapshots the
-- commissionable base.
--
-- Reuses Part 1 tables (creator_partners / _campaigns / _tracking_links /
-- _attribution_events / _code_aliases). Adds three tables + a small audit log
-- + resolver/recorder functions. Model: LAST-CLICK, window-bounded.
--
-- ------------------------------------------------------------
-- ELIGIBLE-SALES FORMULA (documented; computed server-side in JS from the
-- order the server already priced, then snapshotted here — never recomputed
-- from client input):
--
--   For each order line L (order.items[]):
--     coupon_share_L   = itemTotal>0 ? couponDiscount * L.line_total/itemTotal : 0
--     goods_after_coupon_L = L.line_total - coupon_share_L
--     eligible_L       = coalesce(L.taxable_value, goods_after_coupon_L)
--                        -- taxable_value is already net of GST AND coupon
--   Conversion totals:
--     gross_item_sales = sum(L.line_total)        (selling price, post product-
--                                                  discount, pre-coupon, tax-incl)
--     discounts        = billing.couponDiscount   (order-level reduction)
--     tax              = sum(L.tax_amount)         (GST inside product lines)
--     shipping         = billing.shipping          (EXCLUDED from eligible)
--     eligible_sales   = sum(eligible_L)           (product revenue, net of
--                                                   coupon and tax; excludes
--                                                   shipping, fees)
--   Refunds reduce eligible_sales via refunded_amount; the original snapshot
--   is preserved (gross_item_sales stays; eligible_sales is the current base).
-- ------------------------------------------------------------

-- ============================================================
-- 1. creator_attributions  — the CURRENT last-click state per visitor/customer
--    (a materialised pointer over the immutable creator_attribution_events log)
-- ============================================================
create table if not exists public.creator_attributions (
  id                uuid primary key default gen_random_uuid(),
  visitor_id        text,
  user_id           uuid references auth.users(id) on delete set null,
  creator_id        uuid not null references public.creator_partners(id) on delete cascade,
  campaign_id       uuid references public.creator_campaigns(id) on delete set null,
  tracking_link_id  uuid references public.creator_tracking_links(id) on delete set null,
  matched_code      text,
  attribution_model text not null default 'last_click'
                      check (attribution_model in ('last_click','first_click')),
  status            text not null default 'active'
                      check (status in ('active','expired','superseded')),
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- One current attribution per browser, and one per signed-in user.
create unique index if not exists creator_attr_visitor_uk on public.creator_attributions (visitor_id) where visitor_id is not null;
create unique index if not exists creator_attr_user_uk    on public.creator_attributions (user_id) where user_id is not null;
create index if not exists creator_attr_creator_ix  on public.creator_attributions (creator_id);
create index if not exists creator_attr_expires_ix  on public.creator_attributions (expires_at);

-- ============================================================
-- 2. creator_conversions  — ONE immutable attributed-sale record per order
-- ============================================================
create table if not exists public.creator_conversions (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  order_number       text,
  creator_id         uuid not null references public.creator_partners(id) on delete restrict,
  campaign_id        uuid references public.creator_campaigns(id) on delete set null,
  tracking_link_id   uuid references public.creator_tracking_links(id) on delete set null,
  attribution_id     uuid,                       -- the creator_attributions row that won
  customer_user_id   uuid references auth.users(id) on delete set null,
  matched_code       text,
  attribution_model  text not null default 'last_click',
  attribution_window_days integer,
  status             text not null default 'pending'
                       check (status in ('pending','eligible','cancelled','refunded','reversed','self_referral')),
  -- Money snapshot (server-authoritative; INR rupees).
  currency           text not null default 'INR',
  gross_item_sales   numeric(12,2) not null default 0,
  discounts          numeric(12,2) not null default 0,
  tax                numeric(12,2) not null default 0,
  shipping           numeric(12,2) not null default 0,
  refunded_amount    numeric(12,2) not null default 0,
  eligible_sales     numeric(12,2) not null default 0,   -- CURRENT eligible base
  eligible_sales_original numeric(12,2) not null default 0,
  attributed_at      timestamptz not null default now(),
  qualified_at       timestamptz,               -- when it became 'eligible' (paid)
  cancelled_at       timestamptz,
  refunded_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- IDEMPOTENCY: at most one conversion per order.
  constraint creator_conversions_order_uk unique (order_id)
);
create index if not exists creator_conv_creator_ix   on public.creator_conversions (creator_id, status);
create index if not exists creator_conv_campaign_ix  on public.creator_conversions (campaign_id);
create index if not exists creator_conv_link_ix      on public.creator_conversions (tracking_link_id);
create index if not exists creator_conv_status_ix    on public.creator_conversions (status);
create index if not exists creator_conv_attrib_ix    on public.creator_conversions (attributed_at desc);

-- ============================================================
-- 3. creator_conversion_items  — product/variant level snapshot
-- ============================================================
create table if not exists public.creator_conversion_items (
  id                    uuid primary key default gen_random_uuid(),
  conversion_id         uuid not null references public.creator_conversions(id) on delete cascade,
  order_item_index      integer,                 -- position in order.items[]
  product_id            text,
  variant_id            text,
  product_name_snapshot text,
  variant_label_snapshot text,
  quantity              integer not null default 0,
  unit_price            numeric(12,2) not null default 0,
  line_amount           numeric(12,2) not null default 0,   -- line_total (selling price)
  eligible_amount       numeric(12,2) not null default 0,   -- per-line commissionable base
  created_at            timestamptz not null default now()
);
create index if not exists creator_conv_items_conv_ix on public.creator_conversion_items (conversion_id);
create index if not exists creator_conv_items_prod_ix on public.creator_conversion_items (product_id);

-- ============================================================
-- 4. creator_conversion_audit  — immutable state-transition trail
-- ============================================================
create table if not exists public.creator_conversion_audit (
  id             uuid primary key default gen_random_uuid(),
  conversion_id  uuid references public.creator_conversions(id) on delete cascade,
  order_id       uuid,
  from_status    text,
  to_status      text,
  eligible_delta numeric(12,2),
  reason         text,
  actor          uuid,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists creator_conv_audit_conv_ix on public.creator_conversion_audit (conversion_id, created_at desc);

-- keep updated_at fresh
drop trigger if exists creator_attributions_touch on public.creator_attributions;
create trigger creator_attributions_touch before update on public.creator_attributions
  for each row execute function public.sora_touch_updated_at();
drop trigger if exists creator_conversions_touch on public.creator_conversions;
create trigger creator_conversions_touch before update on public.creator_conversions
  for each row execute function public.sora_touch_updated_at();

-- ============================================================
-- 5. Extend Part-1 record_attribution_event to ALSO maintain the last-click
--    pointer in creator_attributions. Behaviour/return value is unchanged; a
--    materialised last-click row is upserted per visitor and per user so the
--    order hook can resolve attribution cheaply. (Additive — does not rebuild
--    Part 1.)
-- ============================================================
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
declare v jsonb; v_id uuid; v_window int; v_exp timestamptz;
begin
  if p_event_type is null or p_event_type not in ('click','landing','signup','campaign_attribution') then
    return jsonb_build_object('ok', false, 'reason', 'bad_event_type');
  end if;

  v := public.resolve_tracking_ref(p_ref, p_campaign);
  if not (v->>'ok')::boolean then return v; end if;

  v_window := coalesce((v->>'attribution_window_days')::int, 30);
  v_exp := now() + make_interval(days => v_window);

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
    v_exp
  ) returning id into v_id;

  -- LAST-CLICK pointer: newest valid click wins. Upsert per visitor and, when
  -- known, per user. A later different creator supersedes the earlier one; the
  -- event log above preserves the full history.
  if nullif(left(coalesce(p_visitor_id,''),64),'') is not null then
    insert into public.creator_attributions (visitor_id, user_id, creator_id, campaign_id, tracking_link_id, matched_code, attribution_model, status, expires_at)
    values (left(p_visitor_id,64), p_user_id, (v->>'creator_id')::uuid, nullif(v->>'campaign_id','')::uuid, nullif(v->>'tracking_link_id','')::uuid, v->>'matched_code', 'last_click', 'active', v_exp)
    on conflict (visitor_id) where visitor_id is not null do update
      set creator_id = excluded.creator_id, campaign_id = excluded.campaign_id,
          tracking_link_id = excluded.tracking_link_id, matched_code = excluded.matched_code,
          user_id = coalesce(excluded.user_id, public.creator_attributions.user_id),
          last_seen_at = now(), expires_at = excluded.expires_at, status = 'active';
  end if;

  if p_user_id is not null then
    insert into public.creator_attributions (user_id, visitor_id, creator_id, campaign_id, tracking_link_id, matched_code, attribution_model, status, expires_at)
    values (p_user_id, left(coalesce(p_visitor_id,''),64), (v->>'creator_id')::uuid, nullif(v->>'campaign_id','')::uuid, nullif(v->>'tracking_link_id','')::uuid, v->>'matched_code', 'last_click', 'active', v_exp)
    on conflict (user_id) where user_id is not null do update
      set creator_id = excluded.creator_id, campaign_id = excluded.campaign_id,
          tracking_link_id = excluded.tracking_link_id, matched_code = excluded.matched_code,
          visitor_id = coalesce(excluded.visitor_id, public.creator_attributions.visitor_id),
          last_seen_at = now(), expires_at = excluded.expires_at, status = 'active';
  end if;

  return jsonb_build_object(
    'ok', true, 'attribution_id', v_id,
    'creator_code', v->>'creator_code', 'display_name', v->>'display_name',
    'campaign_code', v->>'campaign_code', 'campaign_name', v->>'campaign_name',
    'attribution_window_days', v_window
  );
end $$;
revoke all on function public.record_attribution_event(text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_attribution_event(text, text, text, text, uuid, text) to service_role;

-- ============================================================
-- 6. resolve_attribution_for_order — the LAST-CLICK resolver (validated)
--    Returns the winning attribution for a (user_id, visitor_id), re-checking
--    creator status, campaign window, link validity and expiry at order time.
-- ============================================================
create or replace function public.resolve_attribution_for_order(p_visitor_id text, p_user_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare a public.creator_attributions%rowtype; c public.creator_partners%rowtype;
        cmp public.creator_campaigns%rowtype; lnk public.creator_tracking_links%rowtype;
begin
  -- Prefer the signed-in user's pointer; fall back to the browser's visitor id.
  if p_user_id is not null then
    select * into a from public.creator_attributions where user_id = p_user_id order by last_seen_at desc limit 1;
  end if;
  if a.id is null and nullif(left(coalesce(p_visitor_id,''),64),'') is not null then
    select * into a from public.creator_attributions where visitor_id = left(p_visitor_id,64) order by last_seen_at desc limit 1;
  end if;
  if a.id is null then return jsonb_build_object('ok', false, 'reason', 'no_attribution'); end if;

  if a.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;

  select * into c from public.creator_partners where id = a.creator_id;
  if c.id is null then return jsonb_build_object('ok', false, 'reason', 'creator_missing'); end if;
  if c.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'creator_' || c.status); end if;

  if a.campaign_id is not null then
    select * into cmp from public.creator_campaigns where id = a.campaign_id;
    if cmp.id is not null then
      if cmp.status not in ('active','paused','ended') then null; end if;
      -- A campaign that has ENDED still lets an in-window prior click convert
      -- (historical), but a paused campaign does not attribute new conversions.
      if cmp.status = 'paused' then return jsonb_build_object('ok', false, 'reason', 'campaign_paused'); end if;
    end if;
  end if;

  if a.tracking_link_id is not null then
    select * into lnk from public.creator_tracking_links where id = a.tracking_link_id;
    if lnk.id is not null and lnk.status <> 'active' then
      return jsonb_build_object('ok', false, 'reason', 'link_inactive');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'attribution_id', a.id,
    'creator_id', a.creator_id,
    'creator_user_id', c.user_id,
    'campaign_id', a.campaign_id,
    'tracking_link_id', a.tracking_link_id,
    'matched_code', a.matched_code,
    'attribution_model', a.attribution_model,
    'attribution_window_days', c.default_attribution_window_days
  );
end $$;
revoke all on function public.resolve_attribution_for_order(text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_attribution_for_order(text, uuid) to service_role;

-- ============================================================
-- 7. record_conversion — create the immutable conversion + items (idempotent)
--    Server passes the AUTHORITATIVE totals it computed (never the browser).
--    creator identity comes from the server-side resolver, never from input.
-- ============================================================
create or replace function public.record_conversion(
  p_order_id     uuid,
  p_order_number text,
  p_visitor_id   text,
  p_user_id      uuid,
  p_totals       jsonb,       -- { gross_item_sales, discounts, tax, shipping, eligible_sales }
  p_items        jsonb        -- [ { order_item_index, product_id, variant_id, product_name, variant_label, quantity, unit_price, line_amount, eligible_amount } ]
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v jsonb; v_conv_id uuid; v_elig numeric; it jsonb; v_self boolean;
begin
  -- Idempotency: one conversion per order.
  select id into v_conv_id from public.creator_conversions where order_id = p_order_id;
  if v_conv_id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'conversion_id', v_conv_id);
  end if;

  v := public.resolve_attribution_for_order(p_visitor_id, p_user_id);
  if not (v->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'reason', v->>'reason');
  end if;

  v_elig := coalesce((p_totals->>'eligible_sales')::numeric, 0);

  -- SELF-REFERRAL: a creator buying through their own link is recorded for
  -- audit but is NOT commissionable (eligible 0, status self_referral).
  v_self := (v->>'creator_user_id') is not null and p_user_id is not null
            and (v->>'creator_user_id')::uuid = p_user_id;

  insert into public.creator_conversions (
    order_id, order_number, creator_id, campaign_id, tracking_link_id, attribution_id,
    customer_user_id, matched_code, attribution_model, attribution_window_days,
    status, gross_item_sales, discounts, tax, shipping, eligible_sales, eligible_sales_original
  ) values (
    p_order_id, p_order_number,
    (v->>'creator_id')::uuid,
    nullif(v->>'campaign_id','')::uuid,
    nullif(v->>'tracking_link_id','')::uuid,
    nullif(v->>'attribution_id','')::uuid,
    p_user_id, v->>'matched_code', v->>'attribution_model',
    (v->>'attribution_window_days')::int,
    case when v_self then 'self_referral' else 'pending' end,
    coalesce((p_totals->>'gross_item_sales')::numeric,0),
    coalesce((p_totals->>'discounts')::numeric,0),
    coalesce((p_totals->>'tax')::numeric,0),
    coalesce((p_totals->>'shipping')::numeric,0),
    case when v_self then 0 else v_elig end,
    case when v_self then 0 else v_elig end
  )
  on conflict (order_id) do nothing
  returning id into v_conv_id;

  if v_conv_id is null then
    select id into v_conv_id from public.creator_conversions where order_id = p_order_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'conversion_id', v_conv_id);
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.creator_conversion_items (
      conversion_id, order_item_index, product_id, variant_id,
      product_name_snapshot, variant_label_snapshot, quantity, unit_price, line_amount, eligible_amount
    ) values (
      v_conv_id,
      (it->>'order_item_index')::int,
      it->>'product_id', it->>'variant_id',
      it->>'product_name', it->>'variant_label',
      coalesce((it->>'quantity')::int,0),
      coalesce((it->>'unit_price')::numeric,0),
      coalesce((it->>'line_amount')::numeric,0),
      case when v_self then 0 else coalesce((it->>'eligible_amount')::numeric,0) end
    );
  end loop;

  insert into public.creator_conversion_audit (conversion_id, order_id, from_status, to_status, eligible_delta, reason)
  values (v_conv_id, p_order_id, null, case when v_self then 'self_referral' else 'pending' end, case when v_self then 0 else v_elig end, 'conversion_created');

  return jsonb_build_object('ok', true, 'duplicate', false, 'conversion_id', v_conv_id,
    'status', case when v_self then 'self_referral' else 'pending' end, 'self_referral', v_self);
end $$;
revoke all on function public.record_conversion(uuid, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_conversion(uuid, text, text, uuid, jsonb, jsonb) to service_role;

-- ============================================================
-- 8. set_conversion_status — safe state transitions (paid->eligible, etc.)
--    Idempotent. Never revives a self_referral or a cancelled conversion.
-- ============================================================
create or replace function public.set_conversion_status(p_order_id uuid, p_status text, p_reason text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v public.creator_conversions%rowtype;
begin
  if p_status not in ('eligible','cancelled','reversed') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;
  select * into v from public.creator_conversions where order_id = p_order_id;
  if v.id is null then return jsonb_build_object('ok', false, 'reason', 'no_conversion'); end if;
  if v.status = 'self_referral' then return jsonb_build_object('ok', true, 'noop', 'self_referral'); end if;
  if v.status = p_status then return jsonb_build_object('ok', true, 'noop', 'already_'||p_status); end if;
  -- terminal states are not re-opened by a later paid signal
  if v.status in ('cancelled','reversed','refunded') and p_status = 'eligible' then
    return jsonb_build_object('ok', true, 'noop', 'terminal');
  end if;

  update public.creator_conversions
    set status = p_status,
        qualified_at = case when p_status='eligible' then now() else qualified_at end,
        cancelled_at = case when p_status in ('cancelled','reversed') then now() else cancelled_at end
    where id = v.id;

  insert into public.creator_conversion_audit (conversion_id, order_id, from_status, to_status, reason)
  values (v.id, p_order_id, v.status, p_status, coalesce(p_reason, p_status));

  return jsonb_build_object('ok', true, 'from', v.status, 'to', p_status);
end $$;
revoke all on function public.set_conversion_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_conversion_status(uuid, text, text) to service_role;

-- ============================================================
-- 9. admin_refund_conversion — reduce eligible on refund/return (admin only)
-- ============================================================
create or replace function public.admin_refund_conversion(p_order_id uuid, p_refund_amount numeric, p_reason text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v public.creator_conversions%rowtype; v_new_refunded numeric; v_new_elig numeric;
begin
  if not public.is_sora_admin() then raise exception 'admin only'; end if;
  select * into v from public.creator_conversions where order_id = p_order_id;
  if v.id is null then return jsonb_build_object('ok', false, 'reason', 'no_conversion'); end if;

  v_new_refunded := least(v.eligible_sales_original, greatest(0, v.refunded_amount + coalesce(p_refund_amount,0)));
  v_new_elig := greatest(0, round(v.eligible_sales_original - v_new_refunded, 2));

  update public.creator_conversions
    set refunded_amount = v_new_refunded,
        eligible_sales = v_new_elig,
        status = case when v_new_elig = 0 then 'refunded' else status end,
        refunded_at = now()
    where id = v.id;

  insert into public.creator_conversion_audit (conversion_id, order_id, from_status, to_status, eligible_delta, reason, actor, metadata)
  values (v.id, p_order_id, v.status, case when v_new_elig=0 then 'refunded' else v.status end,
          -(coalesce(p_refund_amount,0)), coalesce(p_reason,'refund'), auth.uid(),
          jsonb_build_object('refunded_amount', v_new_refunded, 'eligible_sales', v_new_elig));

  return jsonb_build_object('ok', true, 'refunded_amount', v_new_refunded, 'eligible_sales', v_new_elig);
end $$;
revoke all on function public.admin_refund_conversion(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.admin_refund_conversion(uuid, numeric, text) to authenticated, service_role;

-- ============================================================
-- 10. Creator analytics (SAFE, non-monetary aggregates, NO customer PII)
-- ============================================================
create or replace function public.my_creator_analytics()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_cid uuid; v jsonb;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;

  select jsonb_build_object(
    'ok', true,
    'clicks', (select count(*) from public.creator_attribution_events e where e.creator_id = v_cid and e.event_type in ('click','landing')),
    'attributed_orders', (select count(*) from public.creator_conversions c where c.creator_id = v_cid and c.status in ('pending','eligible')),
    'eligible_orders', (select count(*) from public.creator_conversions c where c.creator_id = v_cid and c.status = 'eligible'),
    'products_sold', (select coalesce(sum(ci.quantity),0) from public.creator_conversion_items ci join public.creator_conversions c on c.id = ci.conversion_id where c.creator_id = v_cid and c.status = 'eligible'),
    'attributed_sales', (select coalesce(sum(c.eligible_sales),0) from public.creator_conversions c where c.creator_id = v_cid and c.status = 'eligible'),
    'top_products', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select ci.product_name_snapshot as name, sum(ci.quantity) as qty, sum(ci.eligible_amount) as sales
        from public.creator_conversion_items ci join public.creator_conversions c on c.id = ci.conversion_id
        where c.creator_id = v_cid and c.status = 'eligible'
        group by ci.product_name_snapshot order by sales desc limit 10
      ) t
    )
  ) into v;
  return v;
end $$;
revoke all on function public.my_creator_analytics() from public, anon;
grant execute on function public.my_creator_analytics() to authenticated, service_role;

-- ============================================================
-- 11. RLS
--   Admin: full read on all attribution/conversion tables (+ audit).
--   Creator: read own creator_attributions only. NO direct read on
--            conversions/items (they carry order_id + customer_user_id) — the
--            creator sees aggregates via my_creator_analytics() only.
--   Customer / anon: nothing. All writes are service-role/definer only.
-- ============================================================
alter table public.creator_attributions       enable row level security;
alter table public.creator_conversions         enable row level security;
alter table public.creator_conversion_items    enable row level security;
alter table public.creator_conversion_audit    enable row level security;

drop policy if exists "creator_attributions admin all" on public.creator_attributions;
create policy "creator_attributions admin all" on public.creator_attributions
  for all using (public.is_sora_admin()) with check (public.is_sora_admin());
drop policy if exists "creator_attributions self read" on public.creator_attributions;
create policy "creator_attributions self read" on public.creator_attributions
  for select using (creator_id = public.current_creator_id());

drop policy if exists "creator_conversions admin read" on public.creator_conversions;
create policy "creator_conversions admin read" on public.creator_conversions
  for select using (public.is_sora_admin());
drop policy if exists "creator_conv_items admin read" on public.creator_conversion_items;
create policy "creator_conv_items admin read" on public.creator_conversion_items
  for select using (public.is_sora_admin());
drop policy if exists "creator_conv_audit admin read" on public.creator_conversion_audit;
create policy "creator_conv_audit admin read" on public.creator_conversion_audit
  for select using (public.is_sora_admin());

select 'Creator attribution engine (Part 2) migration complete.' as status;
