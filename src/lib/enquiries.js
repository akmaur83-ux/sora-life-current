import { supabase } from './supabase.js';

// ============================================================
// Enquiries (owner, 2026-11-20: more features, round 11) — what visitors ask through
// the site's own forms, into 0047_enquiries.sql:
//   * partner — sell on SORA (/sell);  * bulk — corporate / bulk gifting (/sell#bulk);
//   * request — a product a search did not find.
// Checked here the way the table checks it, so a visitor sees what to fix before
// sending. Only the admin reads them (Admin → Enquiries).
// ============================================================
export const ENQUIRY_KINDS = Object.freeze({ partner: 'Sell on SORA', bulk: 'Bulk / corporate gifting', request: 'Product request' });
const LIMITS = { name: 80, business: 120, city: 60, website: 200, query: 120, message: 1000 };
const tidy = (v, max) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t ? t.slice(0, max) : null; };

/**
 * The row to send, or { error } in plain words. Phone: Indian 10 digits (an optional
 * +91/0 in front is dropped), or any 7–16 digits with + and spaces. Partner and bulk
 * enquiries need a phone or an email to reply to; a product request needs only the
 * product. Pure.
 */
export function cleanEnquiry(kind, f = {}) {
  if (!ENQUIRY_KINDS[kind]) return { error: 'Unknown form.' };
  const row = { kind };
  for (const [k, max] of Object.entries(LIMITS)) row[k] = k === 'message' ? (String(f[k] ?? '').trim().slice(0, max) || null) : tidy(f[k], max);
  let phone = String(f.phone ?? '').replace(/[\s-]/g, '');
  if (/^(\+91|0)?[6-9]\d{9}$/.test(phone)) phone = phone.slice(-10);
  if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) return { error: 'Please check the phone number.' };
  row.phone = phone || null;
  const email = String(f.email ?? '').trim();
  if (email && (email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) return { error: 'Please check the email address.' };
  row.email = email || null;
  row.store = ['wellness', 'fashion', 'homeliving'].includes(f.store) ? f.store : null;
  if (kind === 'request') {
    if (!row.query) return { error: 'Tell us what you are looking for.' };
  } else {
    if (!row.name) return { error: 'Please add your name.' };
    if (!row.phone && !row.email) return { error: 'Add a phone number or an email so we can reply.' };
    if (kind === 'partner' && !row.business) return { error: 'Please add your brand or business name.' };
  }
  return { row };
}

/** Sends a checked enquiry. A filled-in honeypot (bots) is accepted silently and dropped. → { ok } or { error }. */
export async function sendEnquiry(kind, fields, client = supabase) {
  if (String(fields?.company_url || '').trim()) return { ok: true };
  const { row, error } = cleanEnquiry(kind, fields);
  if (error) return { error };
  if (!client) return { error: 'Could not send right now. Please try again.' };
  const res = await client.from('enquiries').insert(row);
  return res.error ? { error: 'Could not send right now. Please try again.' } : { ok: true };
}
