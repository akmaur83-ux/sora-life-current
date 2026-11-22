-- ============================================================
-- SORA LIFE Creator Program — Creator Game v1 (owner, 2026-11-22)
-- Migration 0050. Additive, idempotent. Touches NO commission, ledger,
-- payout or KYC logic: every function here only READS those tables,
-- except claim_vanity_code, which changes the creator's own public code
-- through the same sanctioned path as change_creator_code (old code kept
-- as an alias, so every link already shared keeps attributing).
--
--   1. 'mystery' reward type (a hamper whose contents are a surprise; its
--      minimum value is stated up front in `value`). Seeded INACTIVE —
--      the owner switches each one on in Admin › Creator tiers.
--   2. my_creator_game(): badges, Bharat Yatra map, streak, monthly season
--      and league, Wrapped stats, recent sales for the cha-ching, vanity
--      eligibility, products the creator "discovered".
--   3. claim_vanity_code(): Elite rank (level 5) and above pick their code.
--   4. product_discoverer(): the first creator who sold a product (public
--      display name only, the same field the public leaderboard shows).
--
-- What counts: a conversion with status 'eligible' — paid, not a
-- self-referral, not cancelled/refunded. Money-sized badges (₹10k Club,
-- Lakhpati) use CONFIRMED sales (past the hold), as the tiers do. Nothing
-- here ever counts a click or a share.
-- Customer privacy: only a state name leaves this file — never a name,
-- email, phone, address, pin or city name (cities are returned as a count).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Mystery hamper reward type
-- ------------------------------------------------------------
do $$
declare v_con text;
begin
  select conname into v_con from pg_constraint
   where conrelid = 'public.creator_level_rewards'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%reward_type%';
  if v_con is not null then
    execute format('alter table public.creator_level_rewards drop constraint %I', v_con);
  end if;
  alter table public.creator_level_rewards
    add constraint creator_level_rewards_reward_type_check
    check (reward_type in ('product', 'cash', 'other', 'mystery'));
end $$;

-- One inactive hamper per level from 2 up (option 1), only where the level
-- has no option 1 yet. Values scale with the level; the owner edits or
-- switches them on — nothing is promised to a creator until then.
insert into public.creator_level_rewards (level, option_index, label, description, reward_type, value, is_active)
select l.level, 1, 'Mystery hamper',
       'A box of SORA picks chosen for you. What’s inside is a surprise; its value is not.',
       'mystery',
       '₹' || to_char(case when l.level <= 4 then 500 when l.level <= 8 then 1500 when l.level <= 12 then 3000 else 5000 end, 'FM9,99,999') || '+ of products',
       false
  from public.creator_tier_levels l
 where l.level >= 2
   and not exists (select 1 from public.creator_level_rewards r where r.level = l.level and r.option_index = 1);

create index if not exists creator_conversion_items_product_ix on public.creator_conversion_items (product_id);
create index if not exists creator_conversions_creator_status_ix on public.creator_conversions (creator_id, status);

-- ------------------------------------------------------------
-- Helpers (internal)
-- ------------------------------------------------------------
-- The moment a sale counts, in India time.
create or replace function public.creator_game_sale_at(c public.creator_conversions)
returns timestamp language sql stable
set search_path = public, pg_temp
as $$ select (coalesce(c.qualified_at, c.created_at) at time zone 'Asia/Kolkata') $$;
revoke all on function public.creator_game_sale_at(public.creator_conversions) from public, anon, authenticated;

-- League by lifetime level: Kaansa 1–3, Chandi 4–6, Sona 7–10, Heera 11+.
create or replace function public.creator_game_league(p_level integer)
returns text language sql immutable
set search_path = public, pg_temp
as $$
  select case when coalesce(p_level, 1) <= 3 then 'kaansa'
              when p_level <= 6 then 'chandi'
              when p_level <= 10 then 'sona'
              else 'heera' end
$$;
revoke all on function public.creator_game_league(integer) from public, anon, authenticated;

-- One month of a creator's game numbers (Wrapped + season points).
create or replace function public.creator_game_month(p_cid uuid, p_month date)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  with s as (
    select c.*, public.creator_game_sale_at(c) as at
      from public.creator_conversions c
     where c.creator_id = p_cid and c.status = 'eligible'
       and public.creator_game_sale_at(c) >= p_month::timestamp
       and public.creator_game_sale_at(c) < (p_month + interval '1 month')::timestamp
  ),
  top as (
    select i.product_name_snapshot as name, sum(i.quantity) as qty
      from s join public.creator_conversion_items i on i.conversion_id = s.id
     group by i.product_name_snapshot
     order by sum(i.quantity) desc, i.product_name_snapshot
     limit 1
  ),
  day as (
    select at::date as d, count(*) as n from s group by at::date order by count(*) desc, at::date limit 1
  )
  select jsonb_build_object(
    'month', to_char(p_month, 'YYYY-MM'),
    'sales', (select count(*) from s),
    'points', (select coalesce(floor(sum(eligible_sales) / 10), 0)::int from s),
    'states', (select count(distinct lower(btrim(o.customer->>'state')))
                 from s join public.orders o on o.id = s.order_id
                where coalesce(btrim(o.customer->>'state'), '') <> ''),
    'cities', (select count(distinct lower(btrim(o.customer->>'city')))
                 from s join public.orders o on o.id = s.order_id
                where coalesce(btrim(o.customer->>'city'), '') <> ''),
    'top_product', (select name from top),
    'best_day', (select jsonb_build_object('date', d, 'sales', n) from day)
  );
$$;
revoke all on function public.creator_game_month(uuid, date) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2. my_creator_game()
-- ------------------------------------------------------------
create or replace function public.my_creator_game()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_cid uuid; v_code text;
  v_confirmed numeric; v_tier jsonb; v_level int; v_league text;
  v_now timestamp := (now() at time zone 'Asia/Kolkata');
  v_month date := date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date;
  v_sales int; v_states int; v_weekend int; v_repeat boolean; v_discovered jsonb;
  v_streak int := 0; v_best int := 0; v_this_week bigint; v_last_alias timestamptz;
  v_map jsonb; v_recent jsonb; v_members jsonb; v_badges jsonb;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;
  select creator_code into v_code from public.creator_partners where id = v_cid;

  v_confirmed := public.creator_confirmed_sales_total(v_cid);
  v_tier := public.creator_tier_for_sales(v_confirmed);
  v_level := coalesce((v_tier->>'level')::int, 1);
  v_league := public.creator_game_league(v_level);

  select count(*),
         count(*) filter (where extract(isodow from public.creator_game_sale_at(c)) in (6, 7))
    into v_sales, v_weekend
    from public.creator_conversions c where c.creator_id = v_cid and c.status = 'eligible';

  -- Bharat Yatra: orders per state (state name only).
  select coalesce(jsonb_agg(jsonb_build_object('state', st, 'orders', n) order by n desc, st), '[]'::jsonb), count(*)
    into v_map, v_states
    from (select btrim(o.customer->>'state') as st, count(*) as n
            from public.creator_conversions c join public.orders o on o.id = c.order_id
           where c.creator_id = v_cid and c.status = 'eligible'
             and coalesce(btrim(o.customer->>'state'), '') <> ''
           group by btrim(o.customer->>'state')) x;

  -- "Bharosa": one customer came back through this creator.
  select exists (
    select 1 from public.creator_conversions c
     where c.creator_id = v_cid and c.status = 'eligible' and c.customer_user_id is not null
     group by c.customer_user_id having count(*) >= 2
  ) into v_repeat;

  -- Products this creator sold first (among all creators).
  select coalesce(jsonb_agg(name order by name), '[]'::jsonb) into v_discovered
    from (select distinct on (i.product_id) i.product_id, i.product_name_snapshot as name, c.creator_id
            from public.creator_conversion_items i
            join public.creator_conversions c on c.id = i.conversion_id
            join public.creator_partners p on p.id = c.creator_id
           where c.status = 'eligible' and p.status = 'active'
             and i.product_id in (select i2.product_id from public.creator_conversion_items i2
                                    join public.creator_conversions c2 on c2.id = i2.conversion_id
                                   where c2.creator_id = v_cid and c2.status = 'eligible')
           order by i.product_id, coalesce(c.qualified_at, c.created_at), c.id) f
   where f.creator_id = v_cid;

  -- Weekly streak (India weeks, Monday start). The current week has not
  -- broken a streak until it is over.
  v_this_week := floor(extract(epoch from date_trunc('week', v_now)) / 604800);
  with w as (
    select distinct floor(extract(epoch from date_trunc('week', public.creator_game_sale_at(c))) / 604800)::bigint as wk
      from public.creator_conversions c where c.creator_id = v_cid and c.status = 'eligible'
  ), isl as (
    select wk, wk - row_number() over (order by wk) as g from w
  ), runs as (
    select min(wk) as a, max(wk) as b, count(*) as n from isl group by g
  )
  select coalesce(max(n), 0),
         coalesce(max(n) filter (where b >= v_this_week - 1), 0)
    into v_best, v_streak
    from runs;

  -- Recent sales for the cha-ching (state only; commission is the creator's own figure).
  select coalesce(jsonb_agg(r order by r->>'at' desc), '[]'::jsonb) into v_recent
    from (
      select jsonb_build_object(
               'id', c.id,
               'at', coalesce(c.qualified_at, c.created_at),
               'state', nullif(btrim(o.customer->>'state'), ''),
               'product', (select i.product_name_snapshot from public.creator_conversion_items i
                            where i.conversion_id = c.id order by i.line_amount desc nulls last, i.order_item_index limit 1),
               'items', (select coalesce(sum(i.quantity), 0) from public.creator_conversion_items i where i.conversion_id = c.id),
               'commission', (select round(coalesce(sum(l.amount), 0), 2) from public.creator_commission_ledger l
                               where l.conversion_id = c.id and l.type = 'commission')
             ) as r
        from public.creator_conversions c
        left join public.orders o on o.id = c.order_id
       where c.creator_id = v_cid and c.status = 'eligible'
       order by coalesce(c.qualified_at, c.created_at) desc
       limit 20
    ) x;

  -- Season: this month, inside the creator's league. Points = ₹10 of sales.
  with m as (
    select p.id, p.display_name,
           public.creator_game_league(coalesce((public.creator_tier_for_sales(public.creator_confirmed_sales_total(p.id))->>'level')::int, 1)) as league
      from public.creator_partners p
     where p.status = 'active' or p.id = v_cid
  ), pts as (
    select m.id, m.display_name,
           coalesce((select floor(sum(c.eligible_sales) / 10) from public.creator_conversions c
                      where c.creator_id = m.id and c.status = 'eligible'
                        and public.creator_game_sale_at(c) >= v_month::timestamp), 0)::int as points
      from m where m.league = v_league
  ), ranked as (
    select id, display_name, points, row_number() over (order by points desc, display_name, id) as pos from pts
  )
  select coalesce(jsonb_agg(jsonb_build_object('pos', pos, 'name', display_name, 'points', points, 'me', id = v_cid) order by pos), '[]'::jsonb)
    into v_members
    from ranked
   where pos <= 10 or id = v_cid;

  select max(retired_at) into v_last_alias from public.creator_code_aliases where creator_id = v_cid;

  v_badges := jsonb_build_array(
    jsonb_build_object('id', 'first_sale',   'progress', least(v_sales, 1),   'target', 1),
    jsonb_build_object('id', 'ten_sales',    'progress', least(v_sales, 10),  'target', 10),
    jsonb_build_object('id', 'fifty_sales',  'progress', least(v_sales, 50),  'target', 50),
    jsonb_build_object('id', 'club_10k',     'progress', least(floor(v_confirmed), 10000),  'target', 10000),
    jsonb_build_object('id', 'lakhpati',     'progress', least(floor(v_confirmed), 100000), 'target', 100000),
    jsonb_build_object('id', 'states_5',     'progress', least(v_states, 5),  'target', 5),
    jsonb_build_object('id', 'states_10',    'progress', least(v_states, 10), 'target', 10),
    jsonb_build_object('id', 'weekend',      'progress', least(v_weekend, 5), 'target', 5),
    jsonb_build_object('id', 'streak_4',     'progress', least(v_best, 4),    'target', 4),
    jsonb_build_object('id', 'repeat',       'progress', case when v_repeat then 1 else 0 end, 'target', 1),
    jsonb_build_object('id', 'discoverer',   'progress', least(jsonb_array_length(v_discovered), 1), 'target', 1)
  );

  return jsonb_build_object(
    'ok', true,
    'level', v_level, 'rank', v_tier->>'rank',
    'sales', v_sales, 'confirmed_sales', round(v_confirmed, 2),
    'badges', v_badges,
    'map', v_map, 'states', v_states,
    'streak', jsonb_build_object('current', v_streak, 'best', v_best),
    'recent', v_recent,
    'season', jsonb_build_object(
      'month', to_char(v_month, 'YYYY-MM'),
      'ends_at', ((v_month + interval '1 month')::timestamp at time zone 'Asia/Kolkata'),
      'league', v_league,
      'members', v_members
    ),
    'wrapped', jsonb_build_object(
      'this', public.creator_game_month(v_cid, v_month),
      'last', public.creator_game_month(v_cid, (v_month - interval '1 month')::date)
    ),
    'discovered', v_discovered,
    'vanity', jsonb_build_object(
      'code', v_code,
      'min_level', 5,
      'eligible', v_level >= 5,
      'next_change_at', case when v_last_alias is not null and v_last_alias > now() - interval '30 days'
                             then v_last_alias + interval '30 days' end
    )
  );
end $$;
revoke all on function public.my_creator_game() from public, anon;
grant execute on function public.my_creator_game() to authenticated;

-- ------------------------------------------------------------
-- 3. claim_vanity_code(): Elite (level 5) and up choose their code.
-- ------------------------------------------------------------
create or replace function public.claim_vanity_code(p_code text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cid uuid; v_old text; v_new text; v_level int; v_last timestamptz; v_status text;
  v_bad text[] := array['FUCK','SHIT','PORN','SEX','CHUTIYA','MADARCHOD','BEHENCHOD','BHENCHOD',
                        'GAANDU','GANDU','RANDI','LAUDA','BHOSDI','HARAMI','KAMINA'];
  v_reserved text[] := array['ADMIN','SUPPORT','OFFICIAL','STAFF','REFUND','HELPDESK','TEST'];
  w text;
begin
  v_cid := public.current_creator_id();
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_a_creator'); end if;
  select creator_code, status into v_old, v_status from public.creator_partners where id = v_cid;
  if v_status is distinct from 'active' then return jsonb_build_object('ok', false, 'reason', 'not_active'); end if;

  v_level := coalesce((public.creator_tier_for_sales(public.creator_confirmed_sales_total(v_cid))->>'level')::int, 1);
  if v_level < 5 then return jsonb_build_object('ok', false, 'reason', 'level_locked', 'min_level', 5); end if;

  v_new := upper(btrim(coalesce(p_code, '')));
  if v_new !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' or length(v_new) < 4 or length(v_new) > 16 or v_new !~ '[A-Z]' then
    return jsonb_build_object('ok', false, 'reason', 'bad_format');
  end if;
  if v_new = v_old then return jsonb_build_object('ok', true, 'code', v_new, 'noop', true); end if;

  foreach w in array v_bad loop
    if position(w in replace(v_new, '-', '')) > 0 then return jsonb_build_object('ok', false, 'reason', 'not_allowed'); end if;
  end loop;
  foreach w in array v_reserved loop
    if position(w in replace(v_new, '-', '')) > 0 then return jsonb_build_object('ok', false, 'reason', 'reserved'); end if;
  end loop;
  if replace(v_new, '-', '') in ('SORA', 'SORALIFE', 'SORALIFESTYLE') then
    return jsonb_build_object('ok', false, 'reason', 'reserved');
  end if;

  select max(retired_at) into v_last from public.creator_code_aliases where creator_id = v_cid;
  if v_last is not null and v_last > now() - interval '30 days' then
    return jsonb_build_object('ok', false, 'reason', 'cooldown', 'next_change_at', v_last + interval '30 days');
  end if;

  if exists (select 1 from public.creator_partners where creator_code = v_new)
     or exists (select 1 from public.creator_code_aliases where code = v_new)
     or exists (select 1 from public.coupons where upper(code) = v_new) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;

  -- Same path as change_creator_code(): keep the old code so shared links still attribute.
  insert into public.creator_code_aliases (creator_id, code) values (v_cid, v_old)
    on conflict (code) do nothing;
  perform set_config('sora.allow_code_change', 'on', true);
  update public.creator_partners set creator_code = v_new where id = v_cid;
  perform set_config('sora.allow_code_change', 'off', true);

  return jsonb_build_object('ok', true, 'code', v_new, 'old_code', v_old);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'taken');
end $$;
revoke all on function public.claim_vanity_code(text) from public, anon;
grant execute on function public.claim_vanity_code(text) to authenticated;

-- ------------------------------------------------------------
-- 4. product_discoverer(): "First sold by …" on a product page.
-- ------------------------------------------------------------
create or replace function public.product_discoverer(p_product_id text)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('name', p.display_name)
    from public.creator_conversion_items i
    join public.creator_conversions c on c.id = i.conversion_id
    join public.creator_partners p on p.id = c.creator_id
   where i.product_id = p_product_id and c.status = 'eligible' and p.status = 'active'
     and coalesce(btrim(p.display_name), '') <> ''
   order by coalesce(c.qualified_at, c.created_at), c.id
   limit 1
$$;
revoke all on function public.product_discoverer(text) from public;
grant execute on function public.product_discoverer(text) to anon, authenticated, service_role;
