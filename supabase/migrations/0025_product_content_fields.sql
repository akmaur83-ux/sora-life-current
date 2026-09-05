-- ============================================================
-- SORA LIFE — product content fields
-- Run once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: every statement is IF NOT EXISTS.
--
-- The PDP was rebuilt to display brand, benefits, ingredients, how-to-use,
-- specifications and claims. None of those columns exist, so the page has
-- nothing to render: today 25 of 164 products carry a description, 4 carry a
-- rating, and no product carries a brand.
--
-- Additive only. NO existing column is altered, renamed or dropped, and NO
-- row is modified. In particular this does not touch original_price,
-- sale_price or discount_percent — the known Bioradiance price mismatch is a
-- data problem and is deliberately left alone here.
--
-- Every column is NULLABLE with NO DEFAULT, on purpose. A default of '[]'
-- would make "nobody has written content yet" indistinguishable from "this
-- product genuinely has no benefits", and the PDP's whole contract is that a
-- section with no data leaves no trace. NULL means unknown; the ingest script
-- and the admin panel are what turn it into content.
-- ============================================================

-- ---------- 1. content columns ----------

-- Marketplace signal. Sora Life carries many labels and the PDP leads with
-- whose product this is; there is currently no column to read that from.
alter table public.products add column if not exists brand text;

-- [{ "title": "...", "description": "...", "icon": "..." }]
alter table public.products add column if not exists benefits jsonb;

-- [{ "name": "...", "description": "...", "image_url": "..." }]
alter table public.products add column if not exists ingredients jsonb;

-- [{ "step": 1, "text": "..." }]
alter table public.products add column if not exists how_to_use jsonb;

-- { "Shelf life": "24 months", "Country of origin": "India", ... }
alter table public.products add column if not exists specifications jsonb;

-- ["Paraben Free", "Dermatologically Tested"] — short badge strings only.
alter table public.products add column if not exists key_claims jsonb;

-- "200ml". DISPLAYED, never parsed for pricing. `form` already holds the pack
-- label the catalogue shipped with; this is the net quantity as printed on the
-- pack, which is not always the same string.
alter table public.products add column if not exists net_content text;

-- Provenance, so a later re-ingest can tell its own writes from an admin's:
-- 'biosash' | 'manual'. Free text rather than an enum so adding a third
-- source later is not another migration.
alter table public.products add column if not exists content_source text;

alter table public.products add column if not exists content_updated_at timestamptz;

-- Lets the ingest script and the admin coverage view find unfilled products
-- without a sequential scan once the catalogue grows past a few hundred rows.
create index if not exists products_content_source_idx
  on public.products (content_source);

-- Self-documenting for anyone reading the schema rather than this file.
comment on column public.products.brand is
  'Marketplace brand label shown above the product name on the PDP. NULL = unknown.';
comment on column public.products.benefits is
  'jsonb array of { title, description?, icon? }. NULL = not yet authored.';
comment on column public.products.ingredients is
  'jsonb array of { name, description?, image_url? }. NULL = not yet authored.';
comment on column public.products.how_to_use is
  'jsonb array of { step, text }. NULL = not yet authored.';
comment on column public.products.specifications is
  'jsonb object of key/value pairs. NULL = not yet authored.';
comment on column public.products.key_claims is
  'jsonb array of short badge strings. NULL = not yet authored.';
comment on column public.products.net_content is
  'Net quantity as printed on the pack, e.g. "200ml". Display only, never parsed.';
comment on column public.products.content_source is
  'Provenance of the content columns: biosash | manual.';

-- ---------- 2. RLS ----------
--
-- Deliberately empty.
--
-- Row-level security in Postgres is per ROW, not per column: a policy on
-- public.products already governs every column the table has and every column
-- it will ever gain. These nine columns are therefore covered by whatever
-- policy governs `is_active`, `sale_price` and `description` today, with no
-- further statement — which is exactly the "public product fields, admin-only
-- writes" behaviour asked for.
--
-- Writing a fresh policy here would be the opposite of mirroring the existing
-- one: it would REPLACE the live policy with this file's guess at it, and a
-- guess that is subtly wider than what is deployed is how a table quietly
-- becomes writable. The documented project pattern (0001, on categories) is:
--
--   using (is_active = true or exists (
--     select 1 from public.admin_users a where a.user_id = auth.uid()))
--
-- Before applying this migration, confirm public.products already matches that
-- shape. Run in the SQL editor — read-only, changes nothing:
--
--   select relrowsecurity as rls_enabled
--     from pg_class where oid = 'public.products'::regclass;
--
--   select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr,
--          pg_get_expr(polwithcheck, polrelid) as check_expr
--     from pg_policy where polrelid = 'public.products'::regclass;
--
-- If rls_enabled is false, or no admin-gated write policy comes back, STOP and
-- fix that first: it is a pre-existing hole this migration would inherit, not
-- one it creates, and it wants its own change with its own review.
