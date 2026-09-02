-- ============================================================
-- 0020 — Newsletter subscribers.
--
-- Run ONCE in the Supabase SQL Editor (Project -> SQL Editor -> New query),
-- the same way every migration in this project is applied. Additive and
-- idempotent; safe to re-run.
--
-- STATUS: NOT APPLIED TO PRODUCTION.
--
-- WHY THIS EXISTS
--
-- The newsletter form previously flipped a local useState and told the
-- visitor "You're in. Check your inbox for your welcome code." Nothing was
-- stored and no code existed. This gives the form somewhere real to write,
-- so success can mean what it says.
--
-- ACCESS MODEL
--
-- RLS is on and there is NO policy for anon or authenticated. Nothing in the
-- browser can read or write this table. The only writer is the server route
-- api/newsletter/subscribe.js, which uses the service-role key and applies
-- the same IP rate limiting as checkout. That matters: an email list is
-- exactly the kind of table that must not be readable by the public key, and
-- an insert-only anon policy would still let a bot enumerate collisions
-- through error codes.
-- ============================================================

create table if not exists public.newsletter_subscribers (
  id           uuid primary key default gen_random_uuid(),

  -- Stored already normalised (trimmed + lowercased) by the API, and the
  -- constraint below REQUIRES that rather than trusting it: without it a
  -- writer that forgot to normalise would insert 'A@b.com' alongside
  -- 'a@b.com' and the unique index would happily allow both. Length is
  -- bounded here too, independently of the API's own cap.
  email        text not null
                 check (email = lower(btrim(email)))
                 check (length(email) between 3 and 254),

  status       text not null default 'subscribed'
                 check (status in ('subscribed', 'unsubscribed')),

  -- Free text, so it is bounded. The API only ever writes a short constant,
  -- but the column should not be a place to park unbounded input.
  source       text check (source is null or length(source) <= 64),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unsubscribed_at timestamptz
);

-- A PLAIN unique index on the column, deliberately not a functional index on
-- lower(email): PostgREST infers the ON CONFLICT target for
-- `Prefer: resolution=merge-duplicates` from a unique constraint over the
-- inserted COLUMNS, and would not match an expression index — which would
-- turn a re-subscribe back into the 409 this is meant to prevent. The check
-- constraint above is what guarantees the stored value is already lowercase,
-- so a plain index is sufficient.
create unique index if not exists newsletter_subscribers_email_uniq
  on public.newsletter_subscribers (email);

create index if not exists newsletter_subscribers_created_idx
  on public.newsletter_subscribers (created_at desc);

comment on table public.newsletter_subscribers is
  'Newsletter signups. Written only by the service-role API route; no anon/authenticated policy exists.';

alter table public.newsletter_subscribers enable row level security;

-- Deliberately no policy for anon/authenticated. Admin read is granted so
-- the list is reachable from the admin app if a screen is ever built for it;
-- is_sora_admin() is defined in migration 0010.
--
-- This migration's only dependencies are that function and the built-in
-- gen_random_uuid(). It does not reference orders, site_settings, or
-- anything introduced by 0018/0019, so its ordering relative to those is
-- irrelevant.
drop policy if exists "newsletter admin read" on public.newsletter_subscribers;
create policy "newsletter admin read"
  on public.newsletter_subscribers for select
  using (public.is_sora_admin());

-- ============================================================
-- VERIFY (read-only -- run after applying)
--
-- 1. Table exists with the expected columns and defaults.
--
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'newsletter_subscribers'
--    order by ordinal_position;
--   -- expect: id uuid NO gen_random_uuid(); email text NO (null);
--   --         status text NO 'subscribed'::text; source text YES;
--   --         created_at/updated_at timestamptz NO now();
--   --         unsubscribed_at timestamptz YES
--
-- 2. RLS is enabled.
--
--   select relrowsecurity, relforcerowsecurity
--     from pg_class
--    where oid = 'public.newsletter_subscribers'::regclass;
--   -- expect relrowsecurity = true
--
-- 3. Exactly one policy, and it is admin-only SELECT.
--    (The view column is policyname -- pg_policy.polname is the catalog.)
--
--   select policyname, cmd, roles, qual
--     from pg_policies
--    where schemaname = 'public' and tablename = 'newsletter_subscribers';
--   -- expect exactly one row: "newsletter admin read", cmd = SELECT.
--   -- If any row appears with cmd INSERT/UPDATE/DELETE, or a policy names
--   -- anon/authenticated, STOP -- the table is writable from the browser.
--
-- 4. Unique email index exists.
--
--   select indexname, indexdef from pg_indexes
--    where schemaname = 'public' and tablename = 'newsletter_subscribers';
--   -- expect newsletter_subscribers_email_uniq to be UNIQUE on (email)
--
-- 5. Constraints are in place.
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.newsletter_subscribers'::regclass
--      and contype = 'c';
--   -- expect checks for: lowercase/trimmed email, email length,
--   --                    status in (subscribed, unsubscribed), source length
--
-- 6. The public (publishable) key cannot read the table.
--
--   curl -s "$SUPABASE_URL/rest/v1/newsletter_subscribers?select=email" \
--        -H "apikey: <publishable key>"
--   -- expect [] or a permission error -- never rows.
--
-- 7. OPTIONAL round-trip, using a reserved test address.
--    example.com is reserved by RFC 2606 and can never belong to a real
--    customer, so this cannot touch anyone's data. Run all three together.
--
--   insert into public.newsletter_subscribers (email, source)
--        values ('migration-check@example.com', 'post_apply_check');
--
--   -- re-running the same address must NOT raise; it must collide:
--   insert into public.newsletter_subscribers (email, source)
--        values ('migration-check@example.com', 'post_apply_check')
--   on conflict (email) do update set updated_at = now();
--
--   select email, status, source, created_at = updated_at as untouched
--     from public.newsletter_subscribers
--    where email = 'migration-check@example.com';
--   -- expect one row, status 'subscribed', untouched = false after the
--   -- second statement (created_at preserved, updated_at moved).
--
--   -- these must all FAIL, proving the constraints bite:
--   insert into public.newsletter_subscribers (email) values ('NOT@Lower.com');
--   insert into public.newsletter_subscribers (email) values ('  padded@example.com  ');
--   insert into public.newsletter_subscribers (email) values ('ab');
--   insert into public.newsletter_subscribers (email, status)
--        values ('x@example.com', 'bogus-status');
--
--   -- clean up (leaves the table empty again):
--   delete from public.newsletter_subscribers
--    where email = 'migration-check@example.com';
-- ============================================================

-- ============================================================
-- ROLLBACK
--
--   drop table if exists public.newsletter_subscribers;
--
-- Destroys collected signups. Export first if any exist:
--   select email, created_at from public.newsletter_subscribers
--    order by created_at;
--
-- The application degrades safely without the table: the API route reports
-- a generic failure and the form does NOT show success, which is the
-- behaviour this migration exists to guarantee.
-- ============================================================
