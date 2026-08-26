// ============================================================
// Customer profile + saved-address data helpers (browser client).
//
// These run entirely through the normal, anon-key Supabase browser client
// under the signed-in customer's session. Row ownership is enforced by RLS
// (see supabase/migrations/0005_customer_profiles_addresses.sql):
//
//   profiles            — self read/insert/update, keyed on id = auth.uid()
//   customer_addresses  — self read/insert/update/delete, user_id = auth.uid()
//
// Security invariants held here:
//   * No service-role key — ever. Only the shared browser client.
//   * The caller NEVER supplies user_id / id. Ownership is derived from the
//     Supabase session (writes) and re-enforced by RLS + `with check` on the
//     server. customer_addresses.user_id defaults to auth.uid() in the DB, so
//     inserts don't send it at all.
//   * Cross-user access is impossible: RLS scopes every read/write to
//     auth.uid(); a foreign or guessed id simply matches zero rows.
//
// Errors are thrown with a `.code` so Account/Checkout can branch on them:
//   AUTH_REQUIRED | BAD_REQUEST | NOT_FOUND  (plus raw Supabase errors).
// ============================================================
import { supabase } from './supabase.js';

// ---------- errors ----------
function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}
const authRequired = () => err('AUTH_REQUIRED', 'Please sign in to continue.');
const badRequest = (m) => err('BAD_REQUEST', m);
const notFound = (m) => err('NOT_FOUND', m);

// ---------- session helpers (local, no network) ----------
async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}
async function requireUserId() {
  const uid = await currentUserId();
  if (!uid) throw authRequired();
  return uid;
}

// ---------- field whitelists (prevent id/user_id injection) ----------
function str(v) {
  return v == null ? null : String(v);
}

// Maps the camelCase fields Account/Checkout use to the snake_case columns.
// Deliberately excludes id, user_id, is_default, created_at, updated_at, so a
// caller can never smuggle ownership or default state through these helpers.
function pickAddressColumns(fields = {}) {
  const map = {
    label: 'label',
    firstName: 'first_name',
    lastName: 'last_name',
    phone: 'phone',
    address: 'address',
    apartment: 'apartment',
    landmark: 'landmark',
    city: 'city',
    state: 'state',
    pin: 'pin',
  };
  const row = {};
  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) row[col] = str(fields[key]);
  }
  return row;
}

const nowIso = () => new Date().toISOString();

// ============================================================
// PROFILE
// ============================================================

/**
 * The signed-in customer's profile row, or null if unauthenticated or not yet
 * created. RLS returns only the caller's own row (id = auth.uid()).
 */
export async function getProfile() {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone, created_at, updated_at')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Create or update the caller's own profile (name/phone). `id` is taken from
 * the session — never from the caller — and re-checked by RLS `with check
 * (id = auth.uid())`. Only the fields actually passed are written, so partial
 * updates don't clobber existing values. Email is intentionally NOT handled
 * here (it lives in auth.users; changing it is a separate confirmed flow).
 */
export async function upsertProfile(fields = {}) {
  const uid = await requireUserId();
  const row = { id: uid, updated_at: nowIso() };
  if (fields.firstName !== undefined) row.first_name = str(fields.firstName);
  if (fields.lastName !== undefined) row.last_name = str(fields.lastName);
  if (fields.phone !== undefined) row.phone = str(fields.phone);
  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select('id, first_name, last_name, phone, created_at, updated_at')
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// ============================================================
// ADDRESSES
// ============================================================

/**
 * The caller's saved addresses, default first then newest. Returns [] when
 * unauthenticated. RLS scopes the result to auth.uid() — no user_id filter is
 * needed and none is trusted for security.
 */
export async function listAddresses() {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Insert a new address for the caller. user_id is NOT sent — the DB default
 * auth.uid() + RLS `with check` set and enforce ownership. If `fields.isDefault`
 * is true, the row is inserted non-default and then promoted via
 * setDefaultAddress(), so the partial unique index is never violated.
 */
export async function createAddress(fields = {}) {
  await requireUserId();
  const wantDefault = fields.isDefault === true;
  const row = pickAddressColumns(fields);
  row.is_default = false; // never insert a second default directly
  const { data, error } = await supabase
    .from('customer_addresses')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  if (wantDefault) return setDefaultAddress(data.id);
  return data;
}

/**
 * Update one of the caller's addresses by id. RLS makes a foreign/guessed id
 * match zero rows (→ NOT_FOUND), so this is IDOR-safe. is_default is not
 * changed here — use setDefaultAddress() so the unique-default invariant is
 * always maintained in one place.
 */
export async function updateAddress(id, fields = {}) {
  await requireUserId();
  if (!id) throw badRequest('Missing address id.');
  const patch = pickAddressColumns(fields);
  patch.updated_at = nowIso();
  const { data, error } = await supabase
    .from('customer_addresses')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound('Address not found.');
  return data;
}

/**
 * Delete one of the caller's addresses by id. RLS scopes the delete to the
 * owner; a foreign/guessed id deletes nothing (→ NOT_FOUND). Returns the
 * deleted row so the caller can tell whether it was the default and pick a
 * replacement if desired.
 */
export async function deleteAddress(id) {
  await requireUserId();
  if (!id) throw badRequest('Missing address id.');
  const { data, error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound('Address not found.');
  return data;
}

/**
 * Make one address the caller's sole default, safely w.r.t. the partial unique
 * index `customer_addresses_one_default_idx (user_id) where is_default`:
 *   1. Verify the target exists and is owned (RLS-scoped) BEFORE mutating, so a
 *      wrong/foreign id can never clear the user's existing default.
 *   2. Clear every OTHER default (frees the unique slot). RLS keeps this to the
 *      caller's own rows.
 *   3. Set the target as default.
 * At no single statement are two of the caller's rows default at once.
 */
export async function setDefaultAddress(id) {
  await requireUserId();
  if (!id) throw badRequest('Missing address id.');

  // 1) ownership/existence check — no mutation yet
  const { data: target, error: findErr } = await supabase
    .from('customer_addresses')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!target) throw notFound('Address not found.');

  // 2) clear any other default (RLS scopes to the caller)
  const { error: unsetErr } = await supabase
    .from('customer_addresses')
    .update({ is_default: false, updated_at: nowIso() })
    .eq('is_default', true)
    .neq('id', id);
  if (unsetErr) throw unsetErr;

  // 3) set the requested address as the sole default
  const { data, error: setErr } = await supabase
    .from('customer_addresses')
    .update({ is_default: true, updated_at: nowIso() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (setErr) throw setErr;
  if (!data) throw notFound('Address not found.');
  return data;
}
