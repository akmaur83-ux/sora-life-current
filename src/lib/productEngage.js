import { supabase } from './supabase.js';

// ============================================================
// Product questions and stock alerts (migration 0042; owner, 2026-11-08: more
// features). Same key as reviews: '<store>:<id>'.
//
//   questions   a signed-in customer asks; an admin answers and publishes; the
//               product page shows published ones (never who asked, beyond the
//               name they chose).
//   alerts      "Notify me when it is back" on an out-of-stock product: an email
//               and the size/colour wanted, readable only by an admin.
// ============================================================
export const QUESTION_COLUMNS = 'id, product_key, question, author_name, answer, status, created_at, answered_at, helpful';
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

export async function fetchPublishedQuestions(key, client = supabase) {
  if (!client || !key) return [];
  const { data, error } = await client.from('product_questions').select(QUESTION_COLUMNS)
    .eq('product_key', key).eq('status', 'published').order('answered_at', { ascending: false }).limit(50);
  return error || !Array.isArray(data) ? [] : data;
}

export async function submitQuestion({ key, question, authorName }, client = supabase) {
  const q = String(question || '').trim(); const name = String(authorName || '').trim();
  if (q.length < 10) return { ok: false, message: 'Write at least 10 characters.' };
  if (q.length > 500) return { ok: false, message: 'Keep the question under 500 characters.' };
  if (!name || name.length > 60) return { ok: false, message: 'Add the name to show with your question.' };
  const { error } = await client.from('product_questions').insert({ product_key: key, question: q, author_name: name });
  return error
    ? { ok: false, message: 'Your question could not be sent. Please try again.' }
    : { ok: true, message: 'Thank you. We will answer it here, usually within a day.' };
}

export async function requestStockAlert({ key, name, choice, email }, client = supabase) {
  const e = String(email || '').trim();
  if (!EMAIL.test(e) || e.length > 254) return { ok: false, message: 'Enter a valid email address.' };
  const { error } = await client.from('stock_alerts').insert({ product_key: key, product_name: String(name || '').slice(0, 200) || 'Product', choice: String(choice || '').slice(0, 80), email: e });
  if (!error) return { ok: true, message: 'Done. We will email you when it is back in stock.' };
  if (error.code === '23505') return { ok: true, message: 'You are already on the list for this one.' };
  return { ok: false, message: 'That did not go through. Please try again.' };
}

// ---- admin ----
export async function fetchQuestionsForAdmin(status = 'pending', client = supabase) {
  const { data, error } = await client.from('product_questions').select(QUESTION_COLUMNS)
    .eq('status', status).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return data || [];
}
export async function answerQuestion(id, answer, client = supabase) {
  const a = String(answer || '').trim();
  if (!a) throw new Error('Write an answer first.');
  const { error } = await client.from('product_questions').update({ answer: a, status: 'published', answered_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
export async function rejectQuestion(id, client = supabase) {
  const { error } = await client.from('product_questions').update({ status: 'rejected' }).eq('id', id);
  if (error) throw error;
}
export async function fetchStockAlerts(open = true, client = supabase) {
  let q = client.from('stock_alerts').select('id, product_key, product_name, choice, email, created_at, notified_at').order('created_at', { ascending: false }).limit(500);
  q = open ? q.is('notified_at', null) : q.not('notified_at', 'is', null);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function markAlertsNotified(ids, client = supabase) {
  const { error } = await client.from('stock_alerts').update({ notified_at: new Date().toISOString() }).in('id', ids);
  if (error) throw error;
}

/** Open alerts grouped by product and choice, most wanted first. */
export function groupAlerts(rows = []) {
  const m = new Map();
  for (const r of rows) {
    const k = `${r.product_key}|${r.choice}`;
    if (!m.has(k)) m.set(k, { key: k, product_key: r.product_key, product_name: r.product_name, choice: r.choice, rows: [] });
    m.get(k).rows.push(r);
  }
  return [...m.values()].sort((a, b) => b.rows.length - a.rows.length);
}

/** Where a product_key's page lives, for the admin's links. */
export function productHref(key) {
  const [store, id] = String(key || '').split(':');
  if (store === 'wellness') return `/admin/products/${id}/edit`;
  if (store === 'fashion' || store === 'homeliving') return `/admin/store-catalogue/${store}/${id}`;
  return '';
}

// ---- "Was this answer helpful?" (2026-11-13, owner feature 37) --------------------------
// One vote per question per browser (kept here); the count lives on the question (0043).
const VOTED_KEY = 'sora.qa.helpful.v1';
export const votedQuestions = () => { try { const v = JSON.parse(window.localStorage.getItem(VOTED_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
export async function voteHelpful(id, client = supabase) {
  const voted = votedQuestions();
  if (!id || voted.includes(id)) return null;
  try { window.localStorage.setItem(VOTED_KEY, JSON.stringify([...voted, id].slice(-200))); } catch { /* storage off */ }
  const { data, error } = await client.rpc('vote_question_helpful', { qid: id });
  return error ? null : Number(data);
}
