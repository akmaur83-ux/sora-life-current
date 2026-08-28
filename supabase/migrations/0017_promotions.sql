-- ============================================================
-- SORA LIFE — promotions / posters / offer cards  (migration 0017)
-- Run ONCE in the Supabase SQL Editor. Idempotent + additive.
--
-- A MARKETING / DISPLAY layer only. A promotion's `coupon_code` is a string
-- the storefront shows and lets the customer copy — it is NOT a checkout
-- coupon. The real discount engine (public.coupons + consume_coupon, from
-- migrations 0006/0009) is untouched by this migration and is unaffected.
-- Nothing here reads or writes pricing, cart totals, orders or Razorpay.
--
-- Reuses the standard admin gate public.is_sora_admin() (migration 0010) and
-- the hero-media storage-bucket pattern (migration 0002). No product-media
-- table is touched.
--
-- Hardening (this revision):
--   * cta_url has a DB-level CHECK: NULL/'' | internal absolute path "/..."
--     | absolute "https://..." only. javascript:, data:, "//", http:// and
--     every other scheme are rejected by the database, on top of the
--     client/render sanitisation in src/lib/promotions.js.
--   * Table privileges are explicit and deterministic: SELECT to anon +
--     authenticated; anon INSERT/UPDATE/DELETE explicitly revoked. All
--     writes remain gated by RLS + public.is_sora_admin().
-- ============================================================

-- ---------- 1. table ----------
create table if not exists public.promotions (
  id            uuid primary key default gen_random_uuid(),
  -- 'poster'  = large image/graphic-led card or banner
  -- 'offer'   = compact icon + title + short copy + code
  type          text not null default 'poster' check (type in ('poster', 'offer')),
  title         text not null default '',
  subtitle      text not null default '',
  -- Display / copy only. Never resolved against public.coupons here.
  coupon_code   text,
  cta_text      text not null default '',
  -- Internal path ("/shop") or absolute https URL. Validated in the app layer.
  cta_url       text,
  badge_text    text not null default '',
  -- Poster image / offer icon image. A resolvable URL WE serve (promo-media
  -- bucket public URL) or a local /media|/img path. No third-party hotlink.
  image_url     text,
  -- Safe visual presets, mapped to SORA tokens in src/styles/promotions.css.
  theme_variant text not null default 'forest'
                check (theme_variant in ('forest', 'cream', 'orange', 'dark', 'minimal')),
  text_align    text not null default 'left' check (text_align in ('left', 'center')),
  -- Which storefront surfaces this promotion may appear on. Subset of
  -- {home, pdp, cart}; empty array = configured but shown nowhere.
  placements    text[] not null default '{}'::text[],
  is_active     boolean not null default true,
  starts_at     timestamptz,
  ends_at       timestamptz,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Guard the placements array to the three known surfaces (defence in depth;
-- the app also filters). NULL/empty allowed.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promotions_placements_chk') then
    alter table public.promotions
      add constraint promotions_placements_chk
      check (placements <@ array['home', 'pdp', 'cart']::text[]);
  end if;
end $$;

-- End must not precede start when both are set.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promotions_window_chk') then
    alter table public.promotions
      add constraint promotions_window_chk
      check (starts_at is null or ends_at is null or ends_at >= starts_at);
  end if;
end $$;

-- CTA target must be safe: nothing, an INTERNAL absolute path ("/shop"), or an
-- ABSOLUTE https URL. Everything else — javascript:, data:, protocol-relative
-- "//host", plain http://, mailto:/tel:/ftp:, and any string containing
-- whitespace or control characters — is rejected by the database itself.
-- This is defence in depth: src/lib/promotions.js already drops unsafe values
-- before render, and the admin form only writes what an admin typed.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promotions_cta_url_chk') then
    alter table public.promotions
      add constraint promotions_cta_url_chk
      check (
        cta_url is null
        or cta_url = ''
        or (cta_url ~ '^/[^[:space:][:cntrl:]]*$' and cta_url !~ '^//')
        or cta_url ~* '^https://[^[:space:][:cntrl:]]+$'
      );
  end if;
end $$;

create index if not exists promotions_active_sort_idx on public.promotions (is_active, sort_order);
create index if not exists promotions_placements_gin_idx on public.promotions using gin (placements);

-- ---------- 2. updated_at trigger ----------
create or replace function public.promotions_touch_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_promotions_touch on public.promotions;
create trigger trg_promotions_touch
  before update on public.promotions
  for each row execute function public.promotions_touch_updated_at();

-- ---------- 3. RLS ----------
alter table public.promotions enable row level security;

-- PUBLIC read: only ACTIVE promotions that are inside their date window.
-- (Policies are OR'd, so the admin policy below still lets an admin read
--  drafts / scheduled / expired rows.)
drop policy if exists "promotions public read" on public.promotions;
create policy "promotions public read"
  on public.promotions for select
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

-- ADMIN: full CRUD. No anonymous or authenticated-non-admin writes.
drop policy if exists "promotions admin all" on public.promotions;
create policy "promotions admin all"
  on public.promotions for all
  using (public.is_sora_admin())
  with check (public.is_sora_admin());

-- ---------- 3b. deterministic table privileges ----------
-- Do not rely on Supabase default privileges. RLS still filters every row;
-- these grants make the privilege picture explicit:
--   * anon + authenticated may SELECT (RLS narrows anon/non-admin to
--     active, in-window rows; admins additionally see drafts via the policy).
--   * anon may NOT write. INSERT/UPDATE/DELETE are revoked from anon here and
--     were never granted by any policy.
--   * authenticated keeps table-level write privilege (as every other admin
--     table does) but each write is still gated by the is_sora_admin() policy
--     above, so a signed-in non-admin is refused by the database.
--   * service_role (server API) is unaffected.
revoke insert, update, delete on public.promotions from anon;
grant select on public.promotions to anon, authenticated;

-- ---------- 4. promo-media storage bucket ----------
-- Separate from product-images / hero-media so promo art is isolated.
-- Guarantees (mirrors the hero-media pattern, migration 0002):
--   * PUBLIC READ  — anyone (anon or signed-in) can view promo images; the
--     bucket is also public=true so the getPublicUrl() links resolve.
--   * ADMIN WRITE  — only a session whose auth.uid() is in admin_users
--     (public.is_sora_admin()) can INSERT / UPDATE / DELETE objects here.
--   * NO ANON WRITE — anon has no auth.uid(), is_sora_admin() is false, and
--     no other policy grants write on this bucket, so every anon write is
--     denied by storage.objects RLS.
insert into storage.buckets (id, name, public)
values ('promo-media', 'promo-media', true)
on conflict (id) do nothing;

drop policy if exists "promo-media public read" on storage.objects;
create policy "promo-media public read"
  on storage.objects for select
  using (bucket_id = 'promo-media');

drop policy if exists "promo-media admin write" on storage.objects;
create policy "promo-media admin write"
  on storage.objects for all
  using (bucket_id = 'promo-media' and public.is_sora_admin())
  with check (bucket_id = 'promo-media' and public.is_sora_admin());

-- ---------- 5. (optional) example rows ----------
-- Intentionally NOT seeded: promotions are marketing copy the store owner
-- should author. The storefront shows a small set of local SAMPLE promotions
-- (src/data/promotions.js) only when this table is unreachable — never once
-- it exists. An empty promotions table renders no promo sections.

-- ---------- done ----------
select 'Migration 0017 complete: promotions table + promo-media bucket ready.' as status;
