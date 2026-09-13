-- ============================================================
-- SORA LIFE Creator Program — activity series for the portal dashboard
-- Migration 0032 (supersedes the earlier unapplied draft of the same number).
-- Additive, idempotent. Apply in the SQL Editor of the project whose
-- breadcrumb reads "sora life". Do not run supabase db push.
--
-- One read-only, creator-scoped RPC feeding the dashboard's Performance
-- Overview (7D / 30D / 90D / 1Y / All), the stat-card sparklines and trends,
-- and the Top Performing Campaigns table. The creator cannot read
-- creator_conversions or the ledger directly (0013/0024), so the aggregation
-- lives here. Nothing is written; nothing leaves the caller's own rows, and
-- only as bucketed totals.
--
--   range   buckets                  previous period
--   7d      7 days                   the 7 days before
--   30d     30 days                  the 30 days before
--   90d     13 weeks                 the 13 weeks before
--   1y      12 months                the 12 months before
--   all     months since joined      none
-- ============================================================
create or replace function public.my_creator_activity_series(p_range text default '90d')
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_cid uuid;
  v_range text := lower(coalesce(p_range, '90d'));
  v_unit text; v_step interval; v_n integer;
  v_start timestamptz; v_end timestamptz; v_prev_start timestamptz;
  v_joined timestamptz;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;
  if v_range not in ('7d', '30d', '90d', '1y', 'all') then v_range := '90d'; end if;

  select joined_at into v_joined from public.creator_partners where id = v_cid;

  case v_range
    when '7d'  then v_unit := 'day';   v_step := interval '1 day';   v_n := 7;
    when '30d' then v_unit := 'day';   v_step := interval '1 day';   v_n := 30;
    when '90d' then v_unit := 'week';  v_step := interval '7 days';  v_n := 13;
    when '1y'  then v_unit := 'month'; v_step := interval '1 month'; v_n := 12;
    else            v_unit := 'month'; v_step := interval '1 month';
                    v_n := least(greatest(1 + (extract(year from age(now(), coalesce(v_joined, now()))) * 12
                                              + extract(month from age(now(), coalesce(v_joined, now()))))::int, 1), 36);
  end case;

  v_end := date_trunc(v_unit, now()) + v_step;              -- exclusive
  v_start := date_trunc(v_unit, now()) - (v_n - 1) * v_step;
  v_prev_start := v_start - v_n * v_step;

  return jsonb_build_object(
    'ok', true,
    'range', v_range, 'unit', v_unit, 'buckets', v_n,
    'start', v_start, 'end', v_end,
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'at', to_char(b, 'YYYY-MM-DD'),
        'clicks', (select count(*) from public.creator_attribution_events e
                    where e.creator_id = v_cid and e.event_type in ('click', 'landing')
                      and e.occurred_at >= b and e.occurred_at < b + v_step),
        'orders', (select count(*) from public.creator_conversions c
                    where c.creator_id = v_cid and c.status in ('pending', 'eligible')
                      and c.attributed_at >= b and c.attributed_at < b + v_step),
        'products', (select coalesce(sum(ci.quantity), 0) from public.creator_conversion_items ci
                      join public.creator_conversions c on c.id = ci.conversion_id
                     where c.creator_id = v_cid and c.status = 'eligible'
                       and c.attributed_at >= b and c.attributed_at < b + v_step),
        'sales', (select coalesce(sum(c.eligible_sales), 0) from public.creator_conversions c
                   where c.creator_id = v_cid and c.status = 'eligible'
                     and c.attributed_at >= b and c.attributed_at < b + v_step),
        'commission', (select coalesce(sum(l.amount), 0) from public.creator_commission_ledger l
                        where l.creator_id = v_cid and l.type = 'commission'
                          and l.created_at >= b and l.created_at < b + v_step)
      ) order by b), '[]'::jsonb)
      from generate_series(v_start, v_end - v_step, v_step) as b
    ),
    -- Totals of the same-length window immediately before, for the trend
    -- arrows. Null for 'all' — there is no "before all time".
    'previous', case when v_range = 'all' then null else jsonb_build_object(
      'clicks', (select count(*) from public.creator_attribution_events e where e.creator_id = v_cid and e.event_type in ('click', 'landing') and e.occurred_at >= v_prev_start and e.occurred_at < v_start),
      'orders', (select count(*) from public.creator_conversions c where c.creator_id = v_cid and c.status in ('pending', 'eligible') and c.attributed_at >= v_prev_start and c.attributed_at < v_start),
      'products', (select coalesce(sum(ci.quantity), 0) from public.creator_conversion_items ci join public.creator_conversions c on c.id = ci.conversion_id where c.creator_id = v_cid and c.status = 'eligible' and c.attributed_at >= v_prev_start and c.attributed_at < v_start),
      'sales', (select coalesce(sum(c.eligible_sales), 0) from public.creator_conversions c where c.creator_id = v_cid and c.status = 'eligible' and c.attributed_at >= v_prev_start and c.attributed_at < v_start),
      'commission', (select coalesce(sum(l.amount), 0) from public.creator_commission_ledger l where l.creator_id = v_cid and l.type = 'commission' and l.created_at >= v_prev_start and l.created_at < v_start)
    ) end,
    -- Per-link performance, all time. The default code has no tracking link,
    -- so those events and conversions group under a null link.
    'links', (
      select coalesce(jsonb_agg(row order by (row->>'sales')::numeric desc, (row->>'clicks')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'link_id', k.link_id,
          'label', coalesce(tl.label, cp.name, case when k.link_id is null then 'Default link' else tl.public_code end),
          'campaign', cp.name,
          'clicks', (select count(*) from public.creator_attribution_events e where e.creator_id = v_cid and e.event_type in ('click', 'landing') and e.tracking_link_id is not distinct from k.link_id),
          'orders', (select count(*) from public.creator_conversions c where c.creator_id = v_cid and c.status in ('pending', 'eligible') and c.tracking_link_id is not distinct from k.link_id),
          'sales', (select coalesce(sum(c.eligible_sales), 0) from public.creator_conversions c where c.creator_id = v_cid and c.status = 'eligible' and c.tracking_link_id is not distinct from k.link_id),
          'commission', (select coalesce(sum(l.amount), 0) from public.creator_commission_ledger l join public.creator_conversions c on c.id = l.conversion_id where l.creator_id = v_cid and l.type = 'commission' and c.tracking_link_id is not distinct from k.link_id)
        ) as row
        from (
          select null::uuid as link_id
          union
          select id from public.creator_tracking_links where creator_id = v_cid
        ) k
        left join public.creator_tracking_links tl on tl.id = k.link_id
        left join public.creator_campaigns cp on cp.id = tl.campaign_id
      ) rows
    )
  );
end $$;
revoke all on function public.my_creator_activity_series(text) from public, anon;
grant execute on function public.my_creator_activity_series(text) to authenticated;

-- The earlier draft (integer argument) never shipped; remove it if it exists.
drop function if exists public.my_creator_activity_series(integer);

-- Verify
select 'function my_creator_activity_series' as what, pg_get_function_identity_arguments(oid) as detail
  from pg_proc where pronamespace = 'public'::regnamespace and proname = 'my_creator_activity_series';
