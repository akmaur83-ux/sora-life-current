-- ============================================================
-- 0021 — Customer wishlist (cross-device).
--
-- Run ONCE in the Supabase SQL Editor (Project -> SQL Editor -> New query),
-- the same way every migration in this project is applied. Additive and
-- idempotent; safe to re-run.
--
-- STATUS: NOT APPLIED TO PRODUCTION.
--
-- WHY THIS EXISTS
--
-- The wishlist has only ever been a localStorage array (sora.store.v1), so
-- it does not survive a device change and cannot belong to an account. This
-- gives a signed-in customer somewhere real to keep it. Anonymous shoppers
-- keep using the local list and never touch this table.
--
-- WHAT product_key IS
--
-- The storefront's own product key, exactly as the catalogue exposes it:
-- `biosash_id || id` (see src/data/products.js, which builds productById
-- from p.id). It is deliberately TEXT and deliberately has NO foreign key
-- to public.products:
--
--   * the catalogue key is biosash_id for imported products and the numeric
--     row id for admin-created ones, so no single FK column matches both;
--   * a customer's saved item must survive a product being temporarily
--     deactivated, re-imported, or absent from the in-memory catalogue.
--     A cascading FK would silently delete saved items on a catalogue
--     rebuild, which is data loss the customer never asked for.
--
-- Invalid keys are prevented by the constraints below rather than by an FK.
-- ============================================================

create table if not exists public.customer_wishlist (
  -- Defaulted from the session, NEVER from the browser payload. The client
  -- inserts { product_key } only; auth.uid() fills this in, and the RLS
  -- with-check below re-verifies it. A client that tries to send someone
  -- else's user_id is rejected by the policy, not merely ignored.
  user_id      uuid not null default auth.uid()
                 references auth.users(id) on delete cascade,

  -- Trimmed, non-empty, and bounded. 64 is comfortably above every key the
  -- catalogue produces (biosash ids look like 'b1152'; admin ids are short
  -- integers) while stopping the column being used as free storage.
  product_key  text not null
                 check (product_key = btrim(product_key))
                 check (length(product_key) between 1 and 64),

  created_at   timestamptz not null default now(),

  -- One row per product per customer. This is what makes the login merge
  -- idempotent: a re-run collides instead of duplicating, so the client can
  -- upsert the whole guest list without checking what is already there.
  primary key (user_id, product_key)
);

-- The only access pattern is "this customer's wishlist, newest first". The
-- primary key already covers lookups by user_id, so this index exists purely
-- for the ordering.
create index if not exists customer_wishlist_user_created_idx
  on public.customer_wishlist (user_id, created_at desc);

comment on table public.customer_wishlist is
  'Per-customer saved products. product_key is the storefront catalogue key (biosash_id || id), intentionally not FK-bound to products so a saved item survives catalogue changes.';

alter table public.customer_wishlist enable row level security;

-- ------------------------------------------------------------
-- POLICIES
--
-- Three policies, all scoped to auth.uid(), all for `authenticated` only.
-- There is deliberately NO policy for anon (guests keep a local list and
-- never reach this table) and NO update policy (a wishlist row has nothing
-- mutable — a change is an insert or a delete).
--
-- The insert policy is `with check` rather than `using`: `using` is not
-- evaluated for INSERT, so a policy written that way would accept a row
-- carrying another user's id. This is the clause that makes user_id
-- unspoofable even though the column has a default.
-- ------------------------------------------------------------
drop policy if exists "customer_wishlist self read" on public.customer_wishlist;
create policy "customer_wishlist self read"
  on public.customer_wishlist for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "customer_wishlist self insert" on public.customer_wishlist;
create policy "customer_wishlist self insert"
  on public.customer_wishlist for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "customer_wishlist self delete" on public.customer_wishlist;
create policy "customer_wishlist self delete"
  on public.customer_wishlist for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- VERIFY (read-only -- run after applying)
--
-- 1. Columns and defaults.
--
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'customer_wishlist'
--    order by ordinal_position;
--   -- expect: user_id uuid NO auth.uid(); product_key text NO (null);
--   --         created_at timestamptz NO now()
--
-- 2. Composite primary key.
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.customer_wishlist'::regclass and contype = 'p';
--   -- expect PRIMARY KEY (user_id, product_key)
--
-- 3. Check constraints and the auth.users FK.
--
--   select conname, contype, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.customer_wishlist'::regclass
--    order by contype;
--   -- expect the two product_key checks and
--   --   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
--
-- 4. RLS enabled.
--
--   select relrowsecurity from pg_class
--    where oid = 'public.customer_wishlist'::regclass;   -- expect true
--
-- 5. Exactly three policies, authenticated-only, all auth.uid()-scoped.
--
--   select policyname, cmd, roles, qual, with_check
--     from pg_policies
--    where schemaname = 'public' and tablename = 'customer_wishlist'
--    order by cmd;
--   -- expect SELECT/INSERT/DELETE, roles = {authenticated}
--   -- INSERT must show with_check = (auth.uid() = user_id)
--   -- STOP if any policy names anon, or if an UPDATE policy exists.
--
-- 6. Anonymous access is impossible.
--
--   curl -s "$SUPABASE_URL/rest/v1/customer_wishlist?select=product_key" \
--        -H "apikey: <publishable key>"
--   -- expect [] or a permission error -- never rows.
--
-- 7. TWO-USER ISOLATION (do NOT run against production).
--
--    Run on a staging project, or after this migration on a project with two
--    disposable test accounts. Do not create users by hand in production and
--    do not use a real customer's id.
--
--    As user A (signed in through the app, anon key + A's JWT):
--      insert into public.customer_wishlist (product_key) values ('b1152');
--      select * from public.customer_wishlist;      -- expect exactly A's row
--
--    As user B (same browser, after signing out and in as B):
--      select * from public.customer_wishlist;      -- expect ZERO rows
--      delete from public.customer_wishlist
--       where product_key = 'b1152';                -- expect 0 rows affected
--      insert into public.customer_wishlist (user_id, product_key)
--           values ('<A user id>', 'b9999');
--      -- expect: new row violates row-level security policy
--
--    That last statement is the important one: it proves the with-check
--    clause blocks a spoofed user_id rather than silently accepting it.
-- ============================================================

-- ============================================================
-- ROLLBACK
--
--   drop table if exists public.customer_wishlist;
--
-- Destroys every saved wishlist. Export first if any rows exist:
--   select user_id, product_key, created_at
--     from public.customer_wishlist order by user_id, created_at;
--
-- The application degrades safely without the table: listWishlist() returns
-- an empty array and the sync is skipped, so signed-in customers fall back
-- to the local guest wishlist exactly as they behave today. Nothing in the
-- storefront blocks on this table existing.
-- ============================================================
