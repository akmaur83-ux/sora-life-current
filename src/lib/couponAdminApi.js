// ============================================================
// COUPONS — ADMIN DATA ACCESS
//
// Admin CRUD only. The storefront never reaches these: it goes through
// /api/coupons/eligible and /api/coupons/quote, because coupons has no public
// read policy and must not get one. A customer who can select the table can
// enumerate every code in it — migration 0006 says so in as many words.
//
// Writes rely on the "coupons admin write" policy added in 0028. Before that
// the table had a read policy and nothing else, so this editor could list
// coupons and then silently fail to save one.
//
// The rules — what makes a draft valid, what its ticket will say, which state
// it is in — live in couponRules.js, with no supabase import, so the tests can
// execute them directly.
// ============================================================
import { supabase } from './supabase.js';
import { couponRow, validateCouponDraft } from './couponRules.js';

const COUPON_MISSING = 'The coupons table is not available. Run supabase/migrations/0028_coupon_system.sql in the Supabase SQL editor first.';

/** The table itself is absent. */
function isMissingCoupons(error) {
  return Boolean(error) && ['42P01', 'PGRST205', 'PGRST106'].includes(error.code);
}

/** 0028 has not been applied, so the columns it adds are absent. */
function isMissing0028(error) {
  return Boolean(error) && ['42703', 'PGRST204'].includes(error.code);
}

/** Newest first: an admin is usually looking for what they just made. */
export async function adminListCoupons() {
  const { data, error } = await supabase
    .from('coupons').select('*').order('created_at', { ascending: false });
  if (error) {
    if (isMissingCoupons(error) || isMissing0028(error)) throw new Error(COUPON_MISSING);
    throw error;
  }
  return data || [];
}

/**
 * The redemption ledger for one coupon, newest first.
 *
 * The count shown in the list comes from coupons.used_count, which
 * consume_coupon() maintains under its row lock. These are the rows behind
 * that number — if the two ever disagree, the rows are the truth.
 */
export async function adminListCouponRedemptions(couponId, limit = 100) {
  if (!couponId) return [];
  const { data, error } = await supabase
    .from('coupon_redemptions')
    .select('id, order_number, user_id, created_at')
    .eq('coupon_id', couponId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingCoupons(error)) return [];
    throw error;
  }
  return data || [];
}

export async function adminSaveCoupon(draft) {
  const errors = validateCouponDraft(draft);
  if (errors.length) throw new Error(errors[0]);
  const row = couponRow(draft);

  const query = draft.id
    ? supabase.from('coupons').update(row).eq('id', draft.id)
    : supabase.from('coupons').insert(row);

  const { data, error } = await query.select().single();
  if (error) {
    if (isMissingCoupons(error) || isMissing0028(error)) throw new Error(COUPON_MISSING);
    // The unique index on code, from 0006. Worth naming: the fix is "pick a
    // different code", not "try again".
    if (error.code === '23505') throw new Error(`The code ${row.code} is already in use.`);
    throw error;
  }
  return data;
}

/**
 * Enable/disable only.
 *
 * Deliberately separate from the full save, so the list's toggle cannot
 * rewrite anything else about a coupon — switching one off must never be able
 * to change its terms as a side effect.
 */
export async function adminSetCouponActive(id, isActive) {
  const { error } = await supabase.from('coupons').update({ is_active: !!isActive }).eq('id', id);
  if (error) {
    if (isMissingCoupons(error)) throw new Error(COUPON_MISSING);
    throw error;
  }
}

/**
 * Delete a coupon — refused once it has been redeemed.
 *
 * coupon_redemptions references coupon_id, so deleting a used coupon either
 * fails on the constraint or orphans a ledger that sits behind real orders.
 * Switching it off achieves everything deletion would and keeps the history.
 */
export async function adminDeleteCoupon(id) {
  const { data: used, error: countError } = await supabase
    .from('coupon_redemptions').select('id').eq('coupon_id', id).limit(1);
  if (countError && !isMissingCoupons(countError)) throw countError;
  if (used && used.length) {
    throw new Error('This coupon has been redeemed, so it cannot be deleted. Switch it off instead — the redemption history stays with the orders.');
  }
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) {
    if (isMissingCoupons(error)) throw new Error(COUPON_MISSING);
    throw error;
  }
}
