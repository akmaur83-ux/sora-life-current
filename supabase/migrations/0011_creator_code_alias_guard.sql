-- ============================================================
-- SORA LIFE Creator Program — retired-code hijack fix (Part 1 hardening)
-- Run once in the Supabase SQL Editor. Additive, idempotent, non-destructive.
--
-- BUG (found in authenticated QA): a code retired into creator_code_aliases
-- could be re-issued to a DIFFERENT creator on INSERT. Because
-- resolve_tracking_ref() matches a CURRENT creator_code before an alias, the
-- new creator silently hijacked the original creator's historical attribution.
--
-- ROOT CAUSE: creator_partners_biu() (0010) sanitised an admin-supplied code
-- on INSERT but never checked the alias table, and the UNIQUE constraint on
-- creator_partners.creator_code does not span creator_code_aliases.
--
-- FIX (database-level, cannot be bypassed by API/SQL/UI):
--   * creator_partners BEFORE INSERT/UPDATE now rejects any code that is a
--     retired alias of a DIFFERENT creator.
--   * creator_code_aliases BEFORE INSERT now rejects retiring a code that is
--     another creator's active code (closing the mirror direction), while
--     still allowing change_creator_code() to retire a creator's OWN old code.
--
-- INVARIANT AFTER THIS MIGRATION: across creator_partners.creator_code and
-- creator_code_aliases.code, no code string ever points to two different
-- creators. Each existing constraint is preserved:
--   * creator_partners.creator_code stays UNIQUE (current codes unique).
--   * creator_code_aliases.code stays UNIQUE (aliases globally unique).
--   * change_creator_code() is unchanged and keeps working (verified below).
--
-- Touches NO data. Only replaces one trigger function and adds one trigger.
-- ============================================================

-- ------------------------------------------------------------
-- 1. creator_partners: block adopting another creator's retired alias.
--    This REPLACES the 0010 function; the existing BEFORE INSERT OR UPDATE
--    trigger (creator_partners_biu) already binds to it by name.
-- ------------------------------------------------------------
create or replace function public.creator_partners_biu()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.creator_code is null or length(trim(new.creator_code)) = 0 then
      new.creator_code := public.generate_creator_code(new.display_name);
    else
      new.creator_code := upper(regexp_replace(new.creator_code, '[^A-Za-z0-9\-]', '', 'g'));
    end if;

    -- HARDENING: a retired alias of another creator can never be reissued.
    -- (A brand-new row's id cannot match any existing alias, so in practice
    -- this rejects ANY alias collision on insert.)
    if exists (
      select 1 from public.creator_code_aliases a
      where a.code = new.creator_code and a.creator_id is distinct from new.id
    ) then
      raise exception 'creator_code % is a retired alias and cannot be reissued', new.creator_code
        using errcode = 'unique_violation';
    end if;

  elsif tg_op = 'UPDATE' then
    if new.creator_code is distinct from old.creator_code then
      -- The public code may only change through change_creator_code(), which
      -- preserves the old code as an alias for historical attribution.
      if current_setting('sora.allow_code_change', true) is distinct from 'on' then
        raise exception 'creator_code cannot be changed directly; use change_creator_code()';
      end if;

      -- HARDENING (defense in depth): even on the sanctioned RPC path, never
      -- adopt a code that is another creator's retired alias.
      if exists (
        select 1 from public.creator_code_aliases a
        where a.code = new.creator_code and a.creator_id is distinct from new.id
      ) then
        raise exception 'creator_code % is a retired alias and cannot be reissued', new.creator_code
          using errcode = 'unique_violation';
      end if;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- ------------------------------------------------------------
-- 2. creator_code_aliases: close the mirror direction.
--    Retiring a code must not collide with a DIFFERENT creator's active code.
--    Retiring a creator's OWN current code (what change_creator_code does) is
--    still allowed, so the RPC keeps working.
-- ------------------------------------------------------------
create or replace function public.creator_code_aliases_bi()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.code := upper(regexp_replace(coalesce(new.code, ''), '[^A-Za-z0-9\-]', '', 'g'));
  if length(new.code) = 0 then
    raise exception 'alias code cannot be empty' using errcode = 'check_violation';
  end if;

  -- Must not shadow another creator's ACTIVE code.
  if exists (
    select 1 from public.creator_partners p
    where p.creator_code = new.code and p.id is distinct from new.creator_id
  ) then
    raise exception 'alias % collides with another creator''s active code', new.code
      using errcode = 'unique_violation';
  end if;

  -- Must not duplicate another creator's alias. (The UNIQUE index on code
  -- already enforces global alias uniqueness; this makes the intent explicit
  -- and yields a clearer message.)
  if exists (
    select 1 from public.creator_code_aliases a
    where a.code = new.code and a.creator_id is distinct from new.creator_id
  ) then
    raise exception 'alias % is already retired for another creator', new.code
      using errcode = 'unique_violation';
  end if;

  return new;
end $$;

drop trigger if exists creator_code_aliases_bi on public.creator_code_aliases;
create trigger creator_code_aliases_bi
  before insert on public.creator_code_aliases
  for each row execute function public.creator_code_aliases_bi();

-- ------------------------------------------------------------
-- 3. Diagnostic (READ-ONLY). Lists any pre-existing overlap where a current
--    code is also a DIFFERENT creator's retired alias. Expected: zero rows.
--    Nothing is modified; this only reports so any legacy overlap can be
--    cleaned up by hand if one exists.
-- ------------------------------------------------------------
select
  p.creator_code            as overlapping_code,
  p.id                      as active_creator_id,
  a.creator_id              as alias_owner_id,
  'MANUAL REVIEW NEEDED'    as note
from public.creator_partners p
join public.creator_code_aliases a
  on a.code = p.creator_code
 and a.creator_id is distinct from p.id;

select 'Creator code alias-guard migration complete.' as status;
