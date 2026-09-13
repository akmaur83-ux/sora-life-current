// ============================================================
// SORA LIFE Creator Program — data access
//
// Every call here goes through the normal Supabase client, so RLS is the
// enforcement boundary, not this file:
//   * admin*  functions succeed only for an admin_users member.
//   * my*     functions return ONLY the signed-in creator's own rows
//             (policies scope them to current_creator_id()).
// Hiding a button in the UI is never the protection — the database refuses
// the query for anyone else.
//
// Nothing here can change a commission rate or status from the creator side:
// there is no update policy for creators at all.
// ============================================================
import { supabase } from './supabase.js';
import { normalizeDestination } from './creatorLinkUtils.js';
import { KYC_BUCKET, KYC_KIND_SET, kycDocumentPath, validateKycDocument } from './kycDocuments.js';
import { LEADERBOARD_LIMIT, sanitizeLeaderboard, validateLadder } from './creatorTiers.js';
import { rewardOptionRow, validateRewardOption } from './creatorRewards.js';

// Pure link helpers live in creatorLinkUtils.js so they can be unit-tested
// without a browser/Supabase import. Re-exported here for existing callers.
export {
  normalizeDestination, isSafeDestination, buildTrackingUrl,
  CREATOR_STATUSES, CAMPAIGN_STATUSES, LINK_STATUSES, DESTINATION_TYPES,
} from './creatorLinkUtils.js';

const CREATOR_COLS =
  'id,user_id,creator_code,display_name,legal_name,email,phone,avatar_url,status,' +
  'default_commission_rate,default_attribution_window_days,payout_eligible,notes,joined_at,created_at,updated_at';

// Fields a creator may safely see about themselves — deliberately excludes
// internal notes (admin-only commentary).
const CREATOR_SELF_COLS =
  'id,creator_code,display_name,email,phone,avatar_url,status,' +
  'default_commission_rate,default_attribution_window_days,payout_eligible,joined_at';

const CAMPAIGN_COLS =
  'id,creator_id,name,campaign_code,description,status,start_at,end_at,' +
  'commission_rate_override,attribution_window_days,created_at,updated_at';

const LINK_COLS =
  'id,creator_id,campaign_id,public_code,label,destination_type,destination_path,status,metadata,created_at,updated_at';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
// ADMIN — creators
// ---------------------------------------------------------------
export async function adminListCreators() {
  return unwrap(await supabase.from('creator_partners').select(CREATOR_COLS).order('created_at', { ascending: false })) || [];
}

export async function adminGetCreator(id) {
  return unwrap(await supabase.from('creator_partners').select(CREATOR_COLS).eq('id', id).maybeSingle());
}

/**
 * Create a creator. `creator_code` is deliberately NOT sent: a database
 * trigger generates a unique, collision-safe, non-sequential code server-side.
 */
export async function adminCreateCreator(fields) {
  const row = {
    display_name: String(fields.display_name || '').trim(),
    legal_name: fields.legal_name?.trim() || null,
    email: String(fields.email || '').trim().toLowerCase(),
    phone: fields.phone?.trim() || null,
    avatar_url: fields.avatar_url?.trim() || null,
    status: fields.status || 'pending',
    default_commission_rate: Number(fields.default_commission_rate) || 0,
    default_attribution_window_days: Number(fields.default_attribution_window_days) || 30,
    payout_eligible: !!fields.payout_eligible,
    notes: fields.notes?.trim() || null,
  };
  return unwrap(await supabase.from('creator_partners').insert(row).select(CREATOR_COLS).single());
}

/** Update a creator. creator_code is never included — see changeCreatorCode. */
export async function adminUpdateCreator(id, fields) {
  const row = {};
  for (const k of ['display_name', 'legal_name', 'email', 'phone', 'avatar_url', 'status', 'notes']) {
    if (k in fields) row[k] = typeof fields[k] === 'string' ? (fields[k].trim() || null) : fields[k];
  }
  if ('default_commission_rate' in fields) row.default_commission_rate = Number(fields.default_commission_rate) || 0;
  if ('default_attribution_window_days' in fields) row.default_attribution_window_days = Number(fields.default_attribution_window_days) || 30;
  if ('payout_eligible' in fields) row.payout_eligible = !!fields.payout_eligible;
  if (row.email) row.email = row.email.toLowerCase();
  return unwrap(await supabase.from('creator_partners').update(row).eq('id', id).select(CREATOR_COLS).single());
}

export async function adminSetCreatorStatus(id, status) {
  return unwrap(await supabase.from('creator_partners').update({ status }).eq('id', id).select(CREATOR_COLS).single());
}

/**
 * Change the public code through the audited RPC, which archives the previous
 * code as an alias so historical tracking links keep resolving.
 */
export async function adminChangeCreatorCode(id, newCode) {
  return unwrap(await supabase.rpc('change_creator_code', { p_creator_id: id, p_new_code: newCode }));
}

export async function adminListCodeAliases(creatorId) {
  return unwrap(await supabase.from('creator_code_aliases').select('id,code,retired_at').eq('creator_id', creatorId).order('retired_at', { ascending: false })) || [];
}

// ---------------------------------------------------------------
// ADMIN — campaigns
// ---------------------------------------------------------------
export async function adminListCampaigns(creatorId) {
  let q = supabase.from('creator_campaigns').select(CAMPAIGN_COLS).order('created_at', { ascending: false });
  if (creatorId) q = q.eq('creator_id', creatorId);
  return unwrap(await q) || [];
}

export async function adminCreateCampaign(creatorId, fields) {
  const row = {
    creator_id: creatorId,
    name: String(fields.name || '').trim(),
    campaign_code: (fields.campaign_code || '').trim(),
    description: fields.description?.trim() || null,
    status: fields.status || 'draft',
    start_at: fields.start_at || null,
    end_at: fields.end_at || null,
    commission_rate_override: fields.commission_rate_override === '' || fields.commission_rate_override == null
      ? null : Number(fields.commission_rate_override),
    attribution_window_days: fields.attribution_window_days === '' || fields.attribution_window_days == null
      ? null : Number(fields.attribution_window_days),
  };
  return unwrap(await supabase.from('creator_campaigns').insert(row).select(CAMPAIGN_COLS).single());
}

export async function adminUpdateCampaign(id, fields) {
  const row = {};
  for (const k of ['name', 'description', 'status', 'start_at', 'end_at']) {
    if (k in fields) row[k] = typeof fields[k] === 'string' ? (fields[k].trim() || null) : fields[k];
  }
  if ('commission_rate_override' in fields) {
    row.commission_rate_override = fields.commission_rate_override === '' || fields.commission_rate_override == null
      ? null : Number(fields.commission_rate_override);
  }
  if ('attribution_window_days' in fields) {
    row.attribution_window_days = fields.attribution_window_days === '' || fields.attribution_window_days == null
      ? null : Number(fields.attribution_window_days);
  }
  return unwrap(await supabase.from('creator_campaigns').update(row).eq('id', id).select(CAMPAIGN_COLS).single());
}

// ---------------------------------------------------------------
// ADMIN — tracking links
// ---------------------------------------------------------------
export async function adminListLinks(creatorId) {
  let q = supabase.from('creator_tracking_links').select(LINK_COLS).order('created_at', { ascending: false });
  if (creatorId) q = q.eq('creator_id', creatorId);
  return unwrap(await q) || [];
}

export async function adminCreateLink(creatorId, fields) {
  const row = {
    creator_id: creatorId,
    campaign_id: fields.campaign_id || null,
    label: fields.label?.trim() || null,
    destination_type: fields.destination_type || 'homepage',
    destination_path: normalizeDestination(fields.destination_path, fields.destination_type),
    status: fields.status || 'active',
  };
  return unwrap(await supabase.from('creator_tracking_links').insert(row).select(LINK_COLS).single());
}

export async function adminSetLinkStatus(id, status) {
  return unwrap(await supabase.from('creator_tracking_links').update({ status }).eq('id', id).select(LINK_COLS).single());
}

// ---------------------------------------------------------------
// ADMIN — audit trail
// ---------------------------------------------------------------
export async function adminListAudit({ entityId, limit = 50 } = {}) {
  let q = supabase.from('creator_admin_audit')
    .select('id,admin_user_id,action,entity_type,entity_id,metadata,created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (entityId) q = q.eq('entity_id', entityId);
  return unwrap(await q) || [];
}

/** Attribution events for one creator (counts only — no commission in Part 1). */
export async function adminListAttributionEvents(creatorId, limit = 25) {
  return unwrap(await supabase.from('creator_attribution_events')
    .select('id,event_type,campaign_id,tracking_link_id,matched_code,landing_path,occurred_at,expires_at')
    .eq('creator_id', creatorId)
    .order('occurred_at', { ascending: false })
    .limit(limit)) || [];
}

// ---------------------------------------------------------------
// CREATOR — self-service reads (RLS-scoped to the caller)
// ---------------------------------------------------------------

/** Link this auth account to a matching creator record. Server-side by email. */
export async function claimCreatorAccount() {
  const { data, error } = await supabase.rpc('claim_creator_account');
  if (error) return 'error';
  return data;
}

/** The authenticated user's own id, or null. Read from the persisted session
 *  (no network round-trip). */
async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

/**
 * The signed-in user's OWN creator record, or null.
 *
 * Explicitly scoped to `user_id = auth.uid()` rather than relying on RLS to
 * narrow the result. This matters for ADMIN accounts: the "admin all" read
 * policy would otherwise return every creator, and `.maybeSingle()` would hand
 * back a creator the admin does not own (and error once more than one exists).
 * With the filter:
 *   - a customer with no creator gets null (onboarding state)
 *   - a creator gets only their own row
 *   - an admin who owns no creator gets null (never another creator's record)
 *   - an admin who is also a creator gets only their own row
 * `user_id` is UNIQUE, so at most one row ever matches.
 */
export async function getMyCreator() {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('creator_partners')
    .select(CREATOR_SELF_COLS)
    .eq('user_id', uid)
    .maybeSingle();
  if (error) return null;
  return data;
}

// Campaigns/links are RLS-scoped for a normal creator, but an admin's
// "admin all" policy would return everyone's. Passing the resolved creatorId
// keeps the portal correct for an admin who is also a creator, without
// touching RLS. For a normal creator the filter is simply redundant.
export async function getMyCampaigns(creatorId) {
  let q = supabase.from('creator_campaigns').select(CAMPAIGN_COLS).order('created_at', { ascending: false });
  if (creatorId) q = q.eq('creator_id', creatorId);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

export async function getMyLinks(creatorId) {
  let q = supabase.from('creator_tracking_links').select(LINK_COLS).order('created_at', { ascending: false });
  if (creatorId) q = q.eq('creator_id', creatorId);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

// ---------------------------------------------------------------
// PART 2 — ATTRIBUTION / CONVERSIONS
// Admin reads conversions (admin RLS); creators get safe aggregates only
// (via the my_creator_analytics RPC — never row-level customer data).
// ---------------------------------------------------------------
const CONV_SELECT =
  'id,order_id,order_number,creator_id,campaign_id,tracking_link_id,customer_user_id,matched_code,' +
  'status,currency,gross_item_sales,discounts,tax,shipping,refunded_amount,eligible_sales,eligible_sales_original,' +
  'attributed_at,qualified_at,cancelled_at,refunded_at,' +
  'creator:creator_partners(display_name,creator_code),' +
  'campaign:creator_campaigns(name,campaign_code),' +
  'link:creator_tracking_links(public_code,destination_path)';

export async function adminListConversions({ creatorId, status, limit = 100 } = {}) {
  let q = supabase.from('creator_conversions').select(CONV_SELECT).order('attributed_at', { ascending: false }).limit(limit);
  if (creatorId) q = q.eq('creator_id', creatorId);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function adminGetConversionItems(conversionId) {
  const { data, error } = await supabase.from('creator_conversion_items')
    .select('id,order_item_index,product_id,variant_id,product_name_snapshot,variant_label_snapshot,quantity,unit_price,line_amount,eligible_amount')
    .eq('conversion_id', conversionId)
    .order('order_item_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function adminGetConversionAudit(conversionId) {
  const { data, error } = await supabase.from('creator_conversion_audit')
    .select('id,from_status,to_status,eligible_delta,reason,created_at')
    .eq('conversion_id', conversionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Record a refund/return against an order's conversion (admin only, audited). */
export async function adminRefundConversion(orderId, amount, reason) {
  const { data, error } = await supabase.rpc('admin_refund_conversion', {
    p_order_id: orderId, p_refund_amount: Number(amount) || 0, p_reason: reason || 'refund',
  });
  if (error) throw error;
  return data;
}

/** Safe, non-monetary creator analytics (aggregates only, no customer PII). */
export async function getMyCreatorAnalytics() {
  const { data, error } = await supabase.rpc('my_creator_analytics');
  if (error) return { ok: false, reason: error.message };
  return data || { ok: false };
}

export const CONVERSION_STATUSES = ['pending', 'eligible', 'cancelled', 'refunded', 'reversed', 'self_referral'];

// ---------------------------------------------------------------
// PART 3 — EARNINGS / KYC / PAYOUTS
// All financial writes go through SECURITY DEFINER RPCs; reads are RLS-scoped
// (creators see only their own). No raw PAN/bank/UPI is ever sent back — the
// DB stores masks only.
// ---------------------------------------------------------------

// ---- Creator earnings ----
export async function getMyCreatorEarnings() {
  const { data, error } = await supabase.rpc('my_creator_earnings');
  if (error) return { ok: false, reason: error.message };
  return data || { ok: false };
}

export async function getPayoutConfig() {
  const { data } = await supabase.rpc('creator_payout_config');
  return data || {};
}

// ---- Creator tiers, rewards, leaderboard (0031) ----
// Standing is DERIVED by my_creator_standing() from the ledger every call;
// nothing here is cached or computed client-side.
export async function getMyCreatorStanding() {
  const { data, error } = await supabase.rpc('my_creator_standing');
  if (error) return { ok: false, reason: error.message };
  return data || { ok: false };
}
// Activity for the dashboard charts (0032): buckets for a range, the previous
// period's totals, and per-link performance. Absent RPC → { ok:false }, and
// the charts fall back to a level baseline rather than disappearing.
export async function getMyActivitySeries(range = '7d') {
  const { data, error } = await supabase.rpc('my_creator_activity_series', { p_range: String(range) });
  if (error) return { ok: false, reason: error.message };
  return data || { ok: false };
}
// The creator's own recent click timestamps (RLS-scoped, 0010), newest first.
// Feeds the "New link clicks" line of the activity feed; nothing else.
export async function getMyRecentClicks(limit = 200) {
  const { data, error } = await supabase.from('creator_attribution_events')
    .select('occurred_at').in('event_type', ['click', 'landing'])
    .order('occurred_at', { ascending: false }).limit(limit);
  if (error) return [];
  return (data || []).map((r) => r.occurred_at).filter(Boolean);
}
export async function getMyCreatorRewards() {
  const { data, error } = await supabase.rpc('my_creator_rewards');
  if (error) return { ok: false, reason: error.message };
  return data || { ok: false };
}
// The active reward options at every level — what is on offer at the
// milestones ahead. Readable by any creator (RLS, 0031); nothing personal.
export async function getLevelRewardsCatalog() {
  const { data, error } = await supabase.from('creator_level_rewards')
    .select('id,level,option_index,label,description,reward_type,value')
    .eq('is_active', true).order('level', { ascending: true }).order('option_index', { ascending: true });
  if (error) return [];
  return data || [];
}
export async function claimLevelReward(level, rewardId) {
  const { data, error } = await supabase.rpc('claim_level_reward', { p_level: Number(level), p_reward_id: rewardId });
  if (error) return { ok: false, reason: error.message };
  return data || { ok: false };
}
// PUBLIC: name, rank, level, position — the function returns nothing else,
// and the client re-projects to those four fields regardless.
export async function getCreatorLeaderboard(limit = LEADERBOARD_LIMIT) {
  const { data, error } = await supabase.rpc('creator_leaderboard', { p_limit: Math.min(LEADERBOARD_LIMIT, Math.max(1, Number(limit) || LEADERBOARD_LIMIT)) });
  if (error) return [];
  return sanitizeLeaderboard(data);
}

// ---- Creator KYC ----
const KYC_SELF = 'creator_id,legal_name,pan_masked,identity_status,payout_method,payout_account_holder,payout_account_masked,ifsc_masked,upi_masked,submitted_at,verified_at,verification_notes,pan_document_path,bank_document_path,documents_updated_at';
export async function getMyKyc() {
  const { data, error } = await supabase.from('creator_kyc_profiles').select(KYC_SELF).maybeSingle();
  if (error) return null;
  return data;
}
export async function submitKyc({ legalName, pan, method, accountHolder, accountNumber, ifsc, upi }) {
  const { data, error } = await supabase.rpc('submit_kyc', {
    p_legal_name: legalName || '', p_pan: pan || '', p_method: method || '',
    p_account_holder: accountHolder || '', p_account_number: accountNumber || '',
    p_ifsc: ifsc || '', p_upi: upi || '',
  });
  if (error) return { ok: false, reason: error.message };
  return data;
}

// ---- Creator KYC documents ----
// Bucket kyc-documents is private (0030): the creator can only write under
// their own folder, and the RPC only registers a path that exists there.
// Order matters — validate, upload, then register; the old object is removed
// only after the row points at the new one, so a failed upload never leaves
// the profile pointing at nothing.
const randomId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};
export async function uploadKycDocument({ creatorId, kind, file }) {
  if (!creatorId) return { ok: false, reason: 'not_a_creator' };
  if (!KYC_KIND_SET.has(kind)) return { ok: false, reason: 'bad_kind' };
  let checked;
  try { checked = await validateKycDocument(file); }
  catch (e) { return { ok: false, reason: 'invalid_file', message: e.message }; }

  const path = kycDocumentPath(creatorId, kind, checked.extension, randomId());
  const { error: upErr } = await supabase.storage.from(KYC_BUCKET).upload(path, file, {
    cacheControl: '0',
    upsert: false,
    contentType: checked.mime,
  });
  if (upErr) return { ok: false, reason: 'upload_failed', message: upErr.message };

  const { data, error } = await supabase.rpc('set_kyc_document', { p_kind: kind, p_path: path });
  if (error) {
    // The row was not updated; do not leave an orphan the creator can't see.
    await supabase.storage.from(KYC_BUCKET).remove([path]).catch(() => {});
    return { ok: false, reason: error.message };
  }
  if (!data || data.ok === false) {
    await supabase.storage.from(KYC_BUCKET).remove([path]).catch(() => {});
    return data || { ok: false, reason: 'unknown' };
  }
  if (data.previous_path && data.previous_path !== path) {
    // Best effort: the replaced document is dead weight, but its removal is
    // not what the creator is waiting on.
    await supabase.storage.from(KYC_BUCKET).remove([data.previous_path]).catch(() => {});
  }
  return data;
}

// ---- Creator payouts ----
export async function requestPayout(amount) {
  const { data, error } = await supabase.rpc('request_payout', { p_amount: amount == null ? null : Number(amount) });
  if (error) return { ok: false, reason: error.message };
  return data;
}
export async function getMyPayouts() {
  const { data, error } = await supabase.from('creator_payout_requests')
    .select('id,payout_period,requested_amount,paid_amount,status,requested_at,approved_at,paid_at,payment_reference,rejection_reason')
    .order('requested_at', { ascending: false });
  if (error) return [];
  return data || [];
}

// ---- Admin: KYC ----
const KYC_ADMIN = 'creator_id,legal_name,pan_masked,identity_status,payout_method,payout_account_holder,payout_account_masked,ifsc_masked,upi_masked,verification_notes,submitted_at,verified_at,verified_by,pan_document_path,bank_document_path,documents_updated_at,creator:creator_partners(display_name,creator_code)';
export async function adminListKyc() {
  const { data, error } = await supabase.from('creator_kyc_profiles').select(KYC_ADMIN).order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function adminSetKycStatus(creatorId, status, notes) {
  const { data, error } = await supabase.rpc('admin_set_kyc_status', { p_creator_id: creatorId, p_status: status, p_notes: notes || null });
  if (error) throw error;
  return data;
}
// A KYC document is only ever reached through a signed URL that dies in
// KYC_SIGNED_URL_SECONDS. The bucket is private, so there is no public URL to
// leak — getPublicUrl() would return a link that 400s, and must not be used.
export const KYC_SIGNED_URL_SECONDS = 60;
export async function adminKycDocumentUrl(path) {
  if (!path || typeof path !== 'string') throw new Error('No document on file.');
  const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrl(path, KYC_SIGNED_URL_SECONDS);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Could not sign the document link.');
  return data.signedUrl;
}
export async function adminListKycAudit(creatorId) {
  const { data, error } = await supabase.from('creator_kyc_audit')
    .select('id,actor,from_status,to_status,from_notes,to_notes,metadata,created_at')
    .eq('creator_id', creatorId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}

// ---- Admin: payouts ----
const PAYOUT_ADMIN = 'id,creator_id,payout_period,requested_amount,reserved_amount,paid_amount,status,requested_at,reviewed_at,approved_at,paid_at,payment_reference,payout_method_snapshot,rejection_reason,admin_notes,creator:creator_partners(display_name,creator_code)';
export async function adminListPayouts({ status, creatorId } = {}) {
  let q = supabase.from('creator_payout_requests').select(PAYOUT_ADMIN).order('requested_at', { ascending: false });
  if (status && status !== 'all') q = q.eq('status', status);
  if (creatorId) q = q.eq('creator_id', creatorId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function adminGetPayoutLedger(payoutId) {
  const { data, error } = await supabase.from('creator_commission_ledger')
    .select('id,type,status,amount,commission_rate,eligible_sales,order_id,created_at')
    .eq('payout_id', payoutId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function adminGetPayoutAudit(payoutId) {
  const { data, error } = await supabase.from('creator_payout_audit')
    .select('from_status,to_status,amount,reference,note,created_at')
    .eq('payout_id', payoutId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function adminGetKycForCreator(creatorId) {
  const { data } = await supabase.from('creator_kyc_profiles').select(KYC_ADMIN).eq('creator_id', creatorId).maybeSingle();
  return data;
}
export async function adminReviewPayout(payoutId, action, notes) {
  const { data, error } = await supabase.rpc('admin_review_payout', { p_payout_id: payoutId, p_action: action, p_notes: notes || null });
  if (error) throw error;
  return data;
}
export async function adminMarkPayoutPaid(payoutId, paidAmount, reference, note) {
  const { data, error } = await supabase.rpc('admin_mark_payout_paid', {
    p_payout_id: payoutId, p_paid_amount: Number(paidAmount), p_reference: reference, p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export const KYC_STATUSES = ['not_started', 'pending', 'verified', 'rejected', 'needs_update'];
export const PAYOUT_STATUSES = ['requested', 'under_review', 'approved', 'rejected', 'paid', 'cancelled'];

// ---------------------------------------------------------------
// CUSTOMER SELF-ONBOARDING
//
// The application goes through the apply_as_creator RPC, which derives the
// owner from the verified JWT and sets status/rate server-side. The client
// can only pass display name, an optional link, an optional platform, and the
// terms flag — everything sensitive is decided by the database.
// ---------------------------------------------------------------
export async function applyAsCreator({ displayName, socialUrl, platform, agreed }) {
  const { data, error } = await supabase.rpc('apply_as_creator', {
    p_display_name: displayName || '',
    p_social_url: socialUrl || null,
    p_platform: platform || null,
    p_agreed: !!agreed,
  });
  if (error) return { ok: false, reason: error.message || 'error' };
  return data || { ok: false, reason: 'error' };
}

// ---------------------------------------------------------------
// ADMIN — creator program approval policy (site_settings 'creator_program')
// Admin-only via the site_settings admin policy; not publicly readable.
// ---------------------------------------------------------------
const PROGRAM_DEFAULTS = { auto_approve: false, default_commission_rate: 10, default_attribution_window_days: 30 };

export async function adminGetProgramSettings() {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'creator_program').maybeSingle();
  if (error || !data) return { ...PROGRAM_DEFAULTS };
  return { ...PROGRAM_DEFAULTS, ...(data.value || {}) };
}

export async function adminSetProgramSettings(settings) {
  const value = {
    auto_approve: !!settings.auto_approve,
    default_commission_rate: Number(settings.default_commission_rate) || 0,
    default_attribution_window_days: Number(settings.default_attribution_window_days) || 30,
  };
  const { error } = await supabase.from('site_settings')
    .upsert({ key: 'creator_program', value }, { onConflict: 'key' });
  if (error) throw error;
  return value;
}

// ------------------------------------------------------------
// ADMIN — tiers, rewards, claims, standings, withdrawals (0031)
// ------------------------------------------------------------
const TIER_COLS = 'level,rank_name,threshold,rate,updated_at';
export async function adminGetTierLadder() {
  const [{ data: levels, error }, { data: cfg }] = await Promise.all([
    supabase.from('creator_tier_levels').select(TIER_COLS).order('level', { ascending: true }),
    supabase.rpc('creator_tier_config'),
  ]);
  if (error) throw error;
  return { levels: levels || [], beyond_step: Number(cfg?.beyond_step ?? 25000) };
}
// The ladder is replaced atomically by the RPC, which re-validates; the
// client check is only so a bad ladder is refused with the same reason
// before the round trip.
export async function adminSetTierLadder(levels, beyondStep) {
  const check = validateLadder(levels, beyondStep);
  if (!check.ok) return check;
  const payload = check.levels.map((l) => ({ level: l.level, rank: l.rank, threshold: l.threshold, rate: l.rate }));
  const { data, error } = await supabase.rpc('admin_set_creator_tier_levels', {
    p_levels: payload, p_beyond_step: beyondStep == null || beyondStep === '' ? null : Number(beyondStep),
  });
  if (error) throw error;
  return data;
}

const REWARD_COLS = 'id,level,option_index,label,description,reward_type,value,is_active,created_at,updated_at';
export async function adminListLevelRewards() {
  const { data, error } = await supabase.from('creator_level_rewards').select(REWARD_COLS)
    .order('level', { ascending: true }).order('option_index', { ascending: true });
  if (error) throw error;
  return data || [];
}
// Upsert on the (level, option_index) slot. Keys the editor did not touch are
// ABSENT from the row, so an existing slot keeps them (omit-when-absent).
export async function adminUpsertLevelReward(option) {
  const check = validateRewardOption(option);
  if (!check.ok) return check;
  const row = rewardOptionRow(option);
  const { data, error } = await supabase.from('creator_level_rewards')
    .upsert(row, { onConflict: 'level,option_index' }).select(REWARD_COLS).single();
  if (error) throw error;
  return { ok: true, row: data };
}
export async function adminDeleteLevelReward(id) {
  const { error } = await supabase.from('creator_level_rewards').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}

const CLAIM_COLS = 'id,creator_id,level,reward_id,option_index,label,reward_type,value,status,claimed_at,fulfilled_at,cancelled_at,admin_notes,creator:creator_partners(display_name,creator_code)';
export async function adminListRewardClaims({ status } = {}) {
  let q = supabase.from('creator_reward_claims').select(CLAIM_COLS).order('claimed_at', { ascending: false });
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function adminSetRewardClaimStatus(claimId, status, notes) {
  const { data, error } = await supabase.rpc('admin_set_reward_claim_status', { p_claim_id: claimId, p_status: status, p_notes: notes || null });
  if (error) throw error;
  return data;
}

// Every creator's rank, level, lifetime confirmed sales and commission
// buckets, keyed by creator_id. Admin-only by the function's own check.
export async function adminCreatorStandings() {
  const { data, error } = await supabase.rpc('admin_creator_standings');
  if (error) throw error;
  const map = {};
  for (const r of data || []) if (r?.creator_id) map[r.creator_id] = r;
  return map;
}

export async function adminSetWithdrawalsOpen(open) {
  const { data, error } = await supabase.rpc('admin_set_withdrawals_open', { p_open: !!open });
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// Creator terms (migration 0026)
//
// The document is a public-read site_settings key, so a prospective creator
// can read what they are agreeing to before they have an account. Acceptances
// are written only by the SECURITY DEFINER RPC — never by the client — so the
// creator and the version both come from trusted sources.
// ------------------------------------------------------------

const TERMS_DEFAULTS = { body: '', version: 1, updated_at: null };

/**
 * The published terms. Returns the empty default when the migration has not
 * been applied or nothing has been written yet, so every caller can treat
 * "no terms" as an ordinary state rather than an error.
 */
export async function getCreatorTerms() {
  const { data, error } = await supabase
    .from('site_settings').select('value').eq('key', 'creator_terms').maybeSingle();
  if (error || !data) return { ...TERMS_DEFAULTS };
  return { ...TERMS_DEFAULTS, ...(data.value || {}) };
}

/** True when there is actually something for a creator to read and accept. */
export function termsArePublished(terms) {
  return !!terms && typeof terms.body === 'string' && terms.body.trim().length > 0;
}

/**
 * The signed-in creator's acceptance of a specific version, or null.
 * RLS scopes this to their own rows; an admin would see all of them, so the
 * creator_id filter keeps the portal correct for an admin who is also a
 * creator — the same reasoning as getMyCampaigns.
 */
export async function getMyTermsAcceptance(creatorId, version) {
  if (!creatorId || !version) return null;
  const { data, error } = await supabase
    .from('creator_terms_acceptances')
    .select('id, version, accepted_at, terms_updated_at')
    .eq('creator_id', creatorId)
    .eq('version', version)
    .maybeSingle();
  if (error) return null;
  return data;
}

/**
 * Record acceptance of the CURRENT published version.
 *
 * Takes no version argument on purpose: the RPC reads it from the stored
 * document, so the client cannot claim to have accepted something that was
 * never published. Idempotent — a unique index makes a second call a no-op.
 */
export async function acceptCreatorTerms() {
  const { data, error } = await supabase.rpc('record_creator_terms_acceptance');
  if (error) return { ok: false, reason: error.message };
  return data || { ok: false, reason: 'no_response' };
}
