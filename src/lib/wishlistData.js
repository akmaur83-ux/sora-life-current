// ============================================================
// Wishlist data helpers (browser client).
//
// Same security model as customerData.js:
//   * The normal anon-key browser client only. NEVER the service role.
//   * The caller never supplies user_id. customer_wishlist.user_id defaults
//     to auth.uid() in the database, so inserts send { product_key } alone,
//     and the RLS `with check (auth.uid() = user_id)` re-verifies it server
//     side. A spoofed id is rejected by the policy, not merely ignored.
//   * Cross-user access is impossible: every policy is scoped to auth.uid(),
//     so another customer's rows simply do not exist for this session.
//   * Nothing here logs an email, a user id, or any row content.
//
// Every function is failure-tolerant by contract. The wishlist is a
// convenience, not a transaction: if Supabase is unreachable the storefront
// must keep working on the local list rather than break. Reads therefore
// return [] and writes return a boolean, so the caller can decide whether to
// roll an optimistic update back.
// ============================================================
import { supabase } from './supabase.js';

import { normalizeKey, normalizeKeys } from './wishlistState.js';

export { normalizeKey, normalizeKeys };

const TABLE = 'customer_wishlist';

/** True when there is a signed-in session. Local read, no network. */
async function hasSession() {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session?.user?.id);
  } catch {
    return false;
  }
}

/**
 * This customer's saved product keys, newest first.
 * Returns [] when signed out, on any error, or if migration 0021 has not
 * been applied yet — never throws.
 */
export async function listWishlist() {
  if (!(await hasSession())) return [];
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('product_key')
      .order('created_at', { ascending: false });
    if (error) return [];
    return normalizeKeys((data || []).map((r) => r.product_key));
  } catch {
    return [];
  }
}

/**
 * Save one product. Returns true only when the row is definitely stored.
 *
 * Uses upsert with ignoreDuplicates so re-saving something already saved is
 * a success rather than a primary-key error — the customer's intent ("this
 * should be in my wishlist") is satisfied either way.
 */
export async function addWishlistItem(productKey) {
  const key = normalizeKey(productKey);
  if (!key) return false;
  if (!(await hasSession())) return false;
  try {
    // user_id is omitted on purpose — the column defaults to auth.uid().
    const { error } = await supabase
      .from(TABLE)
      .upsert({ product_key: key }, { onConflict: 'user_id,product_key', ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Remove one product. Returns true when the delete was accepted.
 *
 * No user_id filter is needed or wanted: the delete policy already scopes the
 * statement to auth.uid(), so this can only ever affect the caller's own row.
 */
export async function removeWishlistItem(productKey) {
  const key = normalizeKey(productKey);
  if (!key) return false;
  if (!(await hasSession())) return false;
  try {
    const { error } = await supabase.from(TABLE).delete().eq('product_key', key);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Push a whole set of keys in ONE round trip.
 *
 * Used by the login merge, where the guest list can hold many items. Sending
 * them individually would be N requests and N chances to half-fail; a single
 * duplicate-safe upsert is atomic from the client's point of view and is
 * naturally idempotent, so a StrictMode double-invocation or a retry cannot
 * create duplicate rows.
 *
 * Returns true when the write succeeded (or when there was nothing to send).
 */
export async function mergeWishlist(productKeys) {
  const keys = normalizeKeys(productKeys);
  if (!keys.length) return true;
  if (!(await hasSession())) return false;
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(keys.map((product_key) => ({ product_key })), {
        onConflict: 'user_id,product_key',
        ignoreDuplicates: true,
      });
    return !error;
  } catch {
    return false;
  }
}
