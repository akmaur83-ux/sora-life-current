-- ============================================================
-- SORA LIFE Creator Program — weekly activity series for the portal charts
-- Migration 0032. Additive, idempotent. Apply in the SQL Editor of the
-- project whose breadcrumb reads "sora life". Do not run supabase db push.
--
-- One read-only, creator-scoped RPC. The portal's sparklines need a time
-- series per figure, and the creator cannot read creator_conversions or the
-- ledger directly (0013/0024 — admin-only tables, RPC aggregates only), so
-- the aggregation lives here. Nothing is written; nothing is exposed beyond
-- the caller's own rows, and only as weekly totals.
-- ============================================================
create or replace function public.my_creator_activity_series(p_weeks integer default 12)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_cid uuid;
  v_weeks integer := least(greatest(coalesce(p_weeks, 12), 4), 26);
  v_start timestamptz;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;
  v_start := date_trunc('week', now()) - make_interval(weeks => v_weeks - 1);

  return jsonb_build_object(
    'ok', true,
    'weeks', v_weeks,
    'start', v_start,
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week', to_char(w, 'YYYY-MM-DD'),
        'clicks', (select count(*) from public.creator_attribution_events e
                    where e.creator_id = v_cid and e.event_type in ('click', 'landing')
                      and e.occurred_at >= w and e.occurred_at < w + interval '7 days'),
        'orders', (select count(*) from public.creator_conversions c
                    where c.creator_id = v_cid and c.status in ('pending', 'eligible')
                      and c.attributed_at >= w and c.attributed_at < w + interval '7 days'),
        'products', (select coalesce(sum(ci.quantity), 0) from public.creator_conversion_items ci
                      join public.creator_conversions c on c.id = ci.conversion_id
                     where c.creator_id = v_cid and c.status = 'eligible'
                       and c.attributed_at >= w and c.attributed_at < w + interval '7 days'),
        'sales', (select coalesce(sum(c.eligible_sales), 0) from public.creator_conversions c
                   where c.creator_id = v_cid and c.status = 'eligible'
                     and c.attributed_at >= w and c.attributed_at < w + interval '7 days'),
        'commission', (select coalesce(sum(l.amount), 0) from public.creator_commission_ledger l
                        where l.creator_id = v_cid and l.type = 'commission'
                          and l.created_at >= w and l.created_at < w + interval '7 days')
      ) order by w), '[]'::jsonb)
      from generate_series(v_start, date_trunc('week', now()), interval '7 days') as w
    )
  );
end $$;
revoke all on function public.my_creator_activity_series(integer) from public, anon;
grant execute on function public.my_creator_activity_series(integer) to authenticated;

-- Verify
select 'function my_creator_activity_series' as what, pg_get_function_identity_arguments(oid) as detail
  from pg_proc where pronamespace = 'public'::regnamespace and proname = 'my_creator_activity_series';
