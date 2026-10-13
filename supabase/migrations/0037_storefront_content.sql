-- ============================================================
-- SORA LIFE — storefront content: per-store drafts and published records. Migration 0037.
--
-- The storefront copy and images an admin edits no longer live in the shared
-- `homepage` site setting. Each store has two records:
--
--   storefront_drafts     what the admin is editing. Admin-only. Saved through
--                         admin_save_storefront_draft(), which refuses a save made
--                         against an older version (another tab or admin saved since).
--   storefront_published  what the site shows. Public read. Changed only by
--                         admin_publish_storefront(), which copies a draft the admin
--                         names by its version. The site's build reads these rows and
--                         bakes them into the page, so visitors never fetch them.
--
-- Seeded from today's saved Fashion and Lifestyle storefronts
-- (site_settings.homepage.fashion_storefront / lifestyle_storefront), so the first
-- build after this shows exactly what the site shows now. The homepage record is not
-- changed here; the app stops reading those two keys once the new code is live.
--
-- APPLY THIS BEFORE deploying the code that reads it: the site's build reads
-- storefront_published and fails (leaving the live site as it is) while it is absent.
-- Safe to re-run.
-- ============================================================

do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'is_sora_admin') then
    raise exception 'Migration 0037 needs public.is_sora_admin() from 0010.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Drafts — admin-only, one row per store, version-checked.
-- ------------------------------------------------------------
create table if not exists public.storefront_drafts (
  store       text primary key check (store in ('wellness', 'fashion', 'homeliving', 'grocery', 'lifestyle')),
  content     jsonb not null default '{}'::jsonb
              check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 262144),
  version     integer not null default 1 check (version > 0),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.storefront_drafts enable row level security;
drop policy if exists "storefront_drafts admin read" on public.storefront_drafts;
create policy "storefront_drafts admin read" on public.storefront_drafts
  for select using (public.is_sora_admin());
-- No insert, update or delete policy: a draft changes only through
-- admin_save_storefront_draft(), so every save is version-checked.

-- ------------------------------------------------------------
-- 2. Published — public read, one row per store.
-- ------------------------------------------------------------
create table if not exists public.storefront_published (
  store          text primary key check (store in ('wellness', 'fashion', 'homeliving', 'grocery', 'lifestyle')),
  content        jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 262144),
  draft_version  integer not null check (draft_version > 0),
  published_at   timestamptz not null default now(),
  published_by   uuid
);
alter table public.storefront_published enable row level security;
drop policy if exists "storefront_published public read" on public.storefront_published;
create policy "storefront_published public read" on public.storefront_published
  for select using (true);
-- No write policy: a published record changes only through admin_publish_storefront().

-- ------------------------------------------------------------
-- 3. Save a draft — admin only, refused if the draft moved since it was opened.
-- ------------------------------------------------------------
create or replace function public.admin_save_storefront_draft(p_store text, p_content jsonb, p_expected_version integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version integer;
begin
  if not public.is_sora_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'invalid content: a storefront draft is one JSON object' using errcode = '22023';
  end if;
  update public.storefront_drafts
     set content = p_content, version = version + 1, updated_at = now(), updated_by = auth.uid()
   where store = p_store and version = p_expected_version
  returning version into v_version;
  if v_version is null then
    if not exists (select 1 from public.storefront_drafts where store = p_store) then
      raise exception 'unknown store: %', p_store using errcode = '22023';
    end if;
    raise exception 'stale: this storefront was saved elsewhere since it was opened' using errcode = '40001';
  end if;
  return v_version;
end $$;
revoke all on function public.admin_save_storefront_draft(text, jsonb, integer) from public, anon;
grant execute on function public.admin_save_storefront_draft(text, jsonb, integer) to authenticated;

-- ------------------------------------------------------------
-- 4. Publish — admin only: copies the draft the admin names by its version.
-- ------------------------------------------------------------
create or replace function public.admin_publish_storefront(p_store text, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_content jsonb;
  v_version integer;
  v_at timestamptz := now();
begin
  if not public.is_sora_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select content, version into v_content, v_version
    from public.storefront_drafts where store = p_store for update;
  if not found then
    raise exception 'unknown store: %', p_store using errcode = '22023';
  end if;
  if v_version <> p_expected_version then
    raise exception 'stale: this storefront was saved elsewhere since it was opened' using errcode = '40001';
  end if;
  update public.storefront_published
     set content = v_content, draft_version = v_version, published_at = v_at, published_by = auth.uid()
   where store = p_store;
  return jsonb_build_object('store', p_store, 'version', v_version, 'published_at', v_at);
end $$;
revoke all on function public.admin_publish_storefront(text, integer) from public, anon;
grant execute on function public.admin_publish_storefront(text, integer) to authenticated;

-- ------------------------------------------------------------
-- 5. Seed every store — Fashion and Lifestyle from what the site shows today.
-- ------------------------------------------------------------
insert into public.storefront_drafts (store, content)
select s.store,
       case when jsonb_typeof(h.value -> s.legacy_key) = 'object' then h.value -> s.legacy_key else '{}'::jsonb end
  from (values ('wellness', null), ('fashion', 'fashion_storefront'), ('homeliving', null),
               ('grocery', null), ('lifestyle', 'lifestyle_storefront')) as s(store, legacy_key)
  left join public.site_settings h on h.key = 'homepage'
on conflict (store) do nothing;

insert into public.storefront_published (store, content, draft_version)
select store, content, version from public.storefront_drafts
on conflict (store) do nothing;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
select 'draft rows (expect 5)' as what, count(*)::text as detail from public.storefront_drafts
union all select 'published rows (expect 5)', count(*)::text from public.storefront_published
union all select 'fashion carried over (expect true if it was ever saved)',
                 (select (content <> '{}'::jsonb)::text from public.storefront_published where store = 'fashion')
union all select 'lifestyle carried over (expect true if it was ever saved)',
                 (select (content <> '{}'::jsonb)::text from public.storefront_published where store = 'lifestyle')
union all select 'RLS on both tables (expect 2)', count(*)::text
  from pg_class where relname in ('storefront_drafts', 'storefront_published') and relrowsecurity;
-- ============================================================
