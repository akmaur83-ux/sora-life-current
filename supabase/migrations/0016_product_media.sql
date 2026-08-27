-- ============================================================
-- SORA LIFE — product media (multi-image gallery) migration 0016
-- Run once in the Supabase SQL Editor. Idempotent + additive.
--
-- Moves product imagery out of the two hard-coded columns
-- (products.image_url = single primary, products.gallery_urls = a bare
-- text[] of hotlinked URLs) into a proper per-image metadata table with
-- ordering, alt text and a single enforced primary. Nothing existing is
-- deleted: image_url / gallery_urls are left exactly as they are, and one
-- primary media row is SEEDED from each product's current image_url so the
-- storefront keeps rendering identically the moment the code ships.
--
-- Reuses the existing public "product-images" bucket + its admin-only
-- storage RLS (migration 0001). No new bucket, no pricing/commerce change.
-- ============================================================

-- ---------- 1. table ----------
create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  -- FK to the products surrogate id (numeric). bigint is FK-compatible with
  -- an int4/int8 identity PK. Cascade so deleting a product removes its media
  -- rows (the storage objects are cleaned up by the admin UI / importer).
  product_id bigint not null references public.products(id) on delete cascade,
  -- Path INSIDE the product-images bucket for images WE host. NULL for legacy
  -- rows seeded from an already-hosted URL (bundled /img/… or an existing
  -- storage URL) that we did not upload through this table.
  storage_path text,
  -- Always a resolvable URL that WE serve (storage public URL or a local
  -- /img/… path). A raw third-party hotlink is never stored here.
  public_url text not null,
  alt_text text not null default '',
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No arbitrary client-controlled storage paths: reject traversal and anything
-- outside a conservative charset. NULL (legacy/hosted-elsewhere) is allowed.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_media_storage_path_chk') then
    alter table public.product_media
      add constraint product_media_storage_path_chk
      check (storage_path is null or (storage_path !~ '\.\.' and storage_path ~ '^[A-Za-z0-9/_.\-]+$'));
  end if;
end $$;

create index if not exists product_media_product_idx on public.product_media (product_id, sort_order);
-- At most ONE primary per product, enforced by the database itself.
create unique index if not exists product_media_one_primary_idx
  on public.product_media (product_id) where is_primary;

-- ---------- 2. single-primary + updated_at trigger ----------
-- BEFORE ins/upd: stamp updated_at, and when a row is being made primary,
-- demote every other image of the same product first so the partial unique
-- index never collides. Demoting sets is_primary=false, which re-fires this
-- trigger on those rows but does nothing (the IF only acts when NEW is
-- primary), so there is no recursion.
create or replace function public.product_media_enforce_primary()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if new.is_primary then
    update public.product_media
       set is_primary = false, updated_at = now()
     where product_id = new.product_id
       and id <> new.id
       and is_primary = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_media_primary on public.product_media;
create trigger trg_product_media_primary
  before insert or update on public.product_media
  for each row execute function public.product_media_enforce_primary();

-- AFTER delete: if the primary was removed, promote the next image (lowest
-- sort_order) so a product is never left without a primary.
create or replace function public.product_media_promote_after_delete()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.is_primary then
    update public.product_media
       set is_primary = true, updated_at = now()
     where id = (
       select id from public.product_media
        where product_id = old.product_id
        order by sort_order asc, created_at asc
        limit 1
     );
  end if;
  return old;
end;
$$;

drop trigger if exists trg_product_media_promote on public.product_media;
create trigger trg_product_media_promote
  after delete on public.product_media
  for each row execute function public.product_media_promote_after_delete();

-- ---------- 3. RLS ----------
alter table public.product_media enable row level security;

-- Customers/creators can READ product media (the images are public anyway).
drop policy if exists "product_media public read" on public.product_media;
create policy "product_media public read"
  on public.product_media for select
  using (true);

-- Only an admin (auth.uid() in admin_users, via is_sora_admin) may write.
-- Customers and creators are denied all INSERT/UPDATE/DELETE.
drop policy if exists "product_media admin write" on public.product_media;
create policy "product_media admin write"
  on public.product_media for all
  using (public.is_sora_admin())
  with check (public.is_sora_admin());

-- ---------- 4. seed one primary row per product from image_url ----------
-- Backward compatibility: every product with a current primary image gets a
-- matching primary media row. Skipped for any product that already has media
-- (so re-running never duplicates and never clobbers admin edits).
insert into public.product_media (product_id, storage_path, public_url, alt_text, sort_order, is_primary)
select p.id, null, p.image_url, coalesce(nullif(p.name, ''), 'Product image'), 0, true
from public.products p
where p.image_url is not null
  and p.image_url <> ''
  and not exists (select 1 from public.product_media m where m.product_id = p.id);

-- ---------- done ----------
select 'Migration 0016 complete: product_media ready ('
  || (select count(*) from public.product_media)::text || ' rows).' as status;
