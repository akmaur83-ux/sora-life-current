-- ============================================================
-- SORA LIFE — truthful order fulfillment + tracking foundation
--
-- Additive and backwards-compatible. Existing orders keep NULL fulfillment
-- fields and remain valid. Payment, price, coupon, delivery-fee and invoice
-- columns are not changed.
--
-- Customer visibility continues to use the existing row-level policies:
--   * "orders customer read" exposes only orders.user_id = auth.uid()
--   * "orders admin read" exposes orders only to SORA LIFE admins
-- No browser role receives INSERT/UPDATE/DELETE on orders. Admin fulfillment
-- writes go through the narrow SECURITY DEFINER function below, which checks
-- public.is_sora_admin() and updates only the six fulfillment columns.
-- ============================================================

alter table public.orders
  add column if not exists fulfillment_status text,
  add column if not exists carrier_name text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_fulfillment_status_check'
  ) then
    alter table public.orders add constraint orders_fulfillment_status_check
      check (
        fulfillment_status is null
        or fulfillment_status in ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_carrier_name_check'
  ) then
    alter table public.orders add constraint orders_carrier_name_check
      check (
        carrier_name is null
        or (
          carrier_name = btrim(carrier_name)
          and char_length(carrier_name) between 1 and 120
          and carrier_name !~ '[[:cntrl:]]'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_tracking_number_check'
  ) then
    alter table public.orders add constraint orders_tracking_number_check
      check (
        tracking_number is null
        or (
          tracking_number = btrim(tracking_number)
          and char_length(tracking_number) between 1 and 160
          and tracking_number !~ '[[:cntrl:]]'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_tracking_url_check'
  ) then
    alter table public.orders add constraint orders_tracking_url_check
      check (
        tracking_url is null
        or (
          tracking_url = btrim(tracking_url)
          and char_length(tracking_url) between 1 and 2048
          -- Public DNS hostname only: no credentials, IP literals, ambiguous
          -- numeric/octal hosts, localhost/single-label hosts or custom ports.
          and tracking_url ~ '^https://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?([/?#][^[:space:]]*)?$'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_fulfillment_dates_check'
  ) then
    alter table public.orders add constraint orders_fulfillment_dates_check
      check (shipped_at is null or delivered_at is null or delivered_at >= shipped_at);
  end if;
end $$;

create or replace function public.admin_update_order_fulfillment(
  p_order_id uuid,
  p_fulfillment_status text,
  p_carrier_name text default null,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_mark_shipped boolean default false,
  p_mark_delivered boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := nullif(lower(btrim(p_fulfillment_status)), '');
  v_carrier text := nullif(btrim(p_carrier_name), '');
  v_tracking_number text := nullif(btrim(p_tracking_number), '');
  v_tracking_url text := nullif(btrim(p_tracking_url), '');
  v_order public.orders%rowtype;
begin
  if not public.is_sora_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_order_id is null then
    raise exception 'order id is required' using errcode = '22023';
  end if;
  if v_status is not null and v_status not in ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled') then
    raise exception 'invalid fulfillment status' using errcode = '22023';
  end if;
  if v_carrier is not null and (char_length(v_carrier) > 120 or v_carrier ~ '[[:cntrl:]]') then
    raise exception 'carrier name is too long' using errcode = '22023';
  end if;
  if v_tracking_number is not null and (char_length(v_tracking_number) > 160 or v_tracking_number ~ '[[:cntrl:]]') then
    raise exception 'tracking number is too long' using errcode = '22023';
  end if;
  if v_tracking_url is not null and (
    char_length(v_tracking_url) > 2048
    or v_tracking_url !~ '^https://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?([/?#][^[:space:]]*)?$'
  ) then
    raise exception 'tracking URL must be a valid HTTPS URL' using errcode = '22023';
  end if;

  if coalesce(p_mark_delivered, false) then
    v_status := 'delivered';
  elsif coalesce(p_mark_shipped, false) then
    v_status := 'shipped';
  end if;

  update public.orders
  set fulfillment_status = v_status,
      carrier_name = v_carrier,
      tracking_number = v_tracking_number,
      tracking_url = v_tracking_url,
      shipped_at = case
        when coalesce(p_mark_shipped, false) then coalesce(shipped_at, now())
        else shipped_at
      end,
      delivered_at = case
        when coalesce(p_mark_delivered, false) then coalesce(delivered_at, now())
        else delivered_at
      end,
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_order.id,
    'fulfillment_status', v_order.fulfillment_status,
    'carrier_name', v_order.carrier_name,
    'tracking_number', v_order.tracking_number,
    'tracking_url', v_order.tracking_url,
    'shipped_at', v_order.shipped_at,
    'delivered_at', v_order.delivered_at,
    'updated_at', v_order.updated_at
  );
end $$;

revoke all on function public.admin_update_order_fulfillment(uuid, text, text, text, text, boolean, boolean)
  from public, anon, service_role;
grant execute on function public.admin_update_order_fulfillment(uuid, text, text, text, text, boolean, boolean)
  to authenticated;

-- Defense in depth: customers and anonymous visitors retain SELECT-only
-- access granted by existing policies and cannot write order rows directly.
revoke insert, update, delete on public.orders from anon, authenticated;

select 'Order fulfillment foundation (0022) ready.' as status;
