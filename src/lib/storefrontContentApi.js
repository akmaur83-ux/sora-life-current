import { supabase } from './supabase.js';

// ============================================================
// Admin side of the storefront content (migration 0037): read the drafts and
// what is published, save a draft against the version the editor opened, and
// publish through the server, which starts the site's rebuild.
//
// Every write is an admin-checked database function or the admin-checked
// /api/admin/publish-storefront route; this module holds no secret. The deploy
// hook that rebuilds the site is known only to that server route.
// ============================================================

/** The draft moved since the editor opened it: nothing was saved. */
export class StorefrontStaleError extends Error {
  constructor(message) { super(message); this.name = 'StorefrontStaleError'; this.isStaleWrite = true; }
}

/** { drafts: { store: { content, version, updated_at } }, published: { store: { draft_version, published_at } } } */
export async function adminLoadStorefronts() {
  const [drafts, published] = await Promise.all([
    supabase.from('storefront_drafts').select('store, content, version, updated_at'),
    supabase.from('storefront_published').select('store, draft_version, published_at'),
  ]);
  if (drafts.error) throw drafts.error;
  if (published.error) throw published.error;
  if (!drafts.data?.length) throw new Error('No storefront drafts are readable. Sign in with an admin account; if you are one, migration 0037 has not been applied yet.');
  return {
    drafts: Object.fromEntries(drafts.data.map((row) => [row.store, row])),
    published: Object.fromEntries((published.data || []).map((row) => [row.store, row])),
  };
}

/** Save a draft; resolves with its new version. Refused (StorefrontStaleError) if it moved since `expectedVersion`. */
export async function adminSaveStorefrontDraft(store, content, expectedVersion) {
  const { data, error } = await supabase.rpc('admin_save_storefront_draft', { p_store: store, p_content: content, p_expected_version: expectedVersion });
  if (error) {
    const message = String(error.message || '');
    if (/^stale/.test(message)) throw new StorefrontStaleError('This storefront was saved elsewhere since you opened it. Nothing was saved — reload to see that version, then reapply your changes.');
    if (/admin only/.test(message) || error.code === '42501') throw new Error('The database refused the save: this account is not an admin.');
    throw error;
  }
  return Number(data);
}

/** Publish a saved draft (by its version) and start the rebuild. Resolves with { version, publishedAt }. */
export async function publishStorefront(store, version, { fetchImpl = globalThis.fetch } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Your admin session has ended. Sign in again, then publish.');
  let response;
  try {
    response = await fetchImpl('/api/admin/publish-storefront', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store, version }),
    });
  } catch {
    throw new Error('Publishing could not reach the server. Nothing was changed; try again.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    const error = new Error(body.error || `Publishing failed (HTTP ${response.status}).`);
    if (response.status === 409) error.isStaleWrite = true;
    throw error;
  }
  return body;
}
