import { supabase } from './supabase.js';

// ============================================================
// Product reviews (migration 0041): customers write, an admin approves, the
// product page shows the approved ones. Public reads never see user_id (it is
// not granted); a customer may write one review per product, which starts
// 'pending'. Nothing here invents a rating: no reviews, no stars.
// ============================================================
export const REVIEW_COLUMNS = 'id, product_key, rating, title, body, author_name, created_at';

/** '<store>:<id>' — the key one product's reviews share, in every store. */
export const reviewKey = (store, id) => `${store}:${String(id)}`;

/** The approved reviews, newest first; a read that fails is none. */
export async function fetchApprovedReviews(key, client = supabase) {
  if (!client || !key) return [];
  const { data, error } = await client.from('product_reviews').select(REVIEW_COLUMNS)
    .eq('product_key', key).eq('status', 'approved').order('created_at', { ascending: false }).limit(200);
  return error || !Array.isArray(data) ? [] : data;
}

/** Average, count and the share at each star, from approved reviews only. */
export function reviewSummary(reviews = []) {
  const n = reviews.length;
  const counts = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const r of reviews) { const k = Math.min(5, Math.max(1, Number(r.rating) || 0)); counts[k - 1] += 1; sum += k; }
  return { count: n, average: n ? Math.round((sum / n) * 10) / 10 : 0, bars: [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: counts[s - 1], pct: n ? Math.round((counts[s - 1] / n) * 100) : 0 })) };
}

/** Validates and sends one review; it waits for an admin. Returns { ok, message }. */
export async function submitReview({ key, rating, title, body, authorName }, client = supabase) {
  const r = Number(rating);
  const text = String(body || '').trim(); const name = String(authorName || '').trim(); const head = String(title || '').trim();
  if (!(r >= 1 && r <= 5)) return { ok: false, message: 'Choose a star rating.' };
  if (text.length < 10) return { ok: false, message: 'Write at least 10 characters.' };
  if (text.length > 2000) return { ok: false, message: 'Keep the review under 2,000 characters.' };
  if (!name || name.length > 60) return { ok: false, message: 'Add the name to show with your review.' };
  if (head.length > 120) return { ok: false, message: 'Keep the title under 120 characters.' };
  const { error } = await client.from('product_reviews').insert({ product_key: key, rating: r, title: head || null, body: text, author_name: name });
  if (!error) return { ok: true, message: 'Thank you. Your review will appear once it has been checked.' };
  if (error.code === '23505') return { ok: false, message: 'You have already reviewed this product.' };
  return { ok: false, message: 'Your review could not be sent. Please try again.' };
}

// ---- admin ----
export async function fetchReviewsForAdmin(status = 'pending', client = supabase) {
  const { data, error } = await client.from('product_reviews').select(REVIEW_COLUMNS + ', status')
    .eq('status', status).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return data || [];
}
export async function setReviewStatus(id, status, client = supabase) {
  const { error } = await client.from('product_reviews').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
