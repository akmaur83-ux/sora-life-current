import { supabase } from './supabase.js';
import { uploadImage } from './adminApi.js';
import { safeVisualUrl } from './homepageAppearance.js';
import {
  requireCatalogueStore, catalogueProductPayload, catalogueCategoryPayload, catalogueVariantPayload, assertCataloguePublishable,
  CatalogueInputError, CatalogueStaleWriteError, CatalogueRefusedError, catalogueWriteError,
} from './storeCatalogueAdmin.js';

// Uses existing admin RLS. No service credentials, schema changes or wellness writes.
const PRODUCT_SELECT = '*, variants:catalogue_variants (*), media:catalogue_product_media (*)';
async function result(query, kind) {
  const { data, error } = await query;
  if (error) throw catalogueWriteError(error, kind);
  return data;
}
async function allRows(table, store, select = '*') {
  requireCatalogueStore(store);
  const rows = [];
  for (let start = 0; ; start += 500) {
    const page = await result(supabase.from(table).select(select).eq('store', store)
      .order('sort_order', { ascending: true }).order('id', { ascending: true }).range(start, start + 499));
    rows.push(...(page || []));
    if (!page || page.length < 500) return rows;
  }
}

/**
 * UPDATE one row only if it is still the version the editor read.
 *
 * `expectedUpdatedAt` becomes an equality filter, so a row that moved since
 * matches nothing and nothing is written. Zero rows then has three possible
 * causes, and the admin needs to know which: the row is gone, the row moved
 * (someone else saved), or the row is unchanged — which means row-level
 * security filtered the UPDATE out, i.e. this session is not an admin.
 */
async function guardedUpdate(table, filters, row, expectedUpdatedAt, kind) {
  if (!expectedUpdatedAt) {
    throw new CatalogueStaleWriteError(`Reload this ${kind} before saving: the editor did not record which version it opened.`);
  }
  let query = supabase.from(table).update(row);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  // `.select()` without `.single()`: zero rows is the expected result of a
  // lost race, and must not surface as a generic "no rows" error.
  const data = await result(query.eq('updated_at', expectedUpdatedAt).select(), kind);
  if (data?.length) return data[0];
  let check = supabase.from(table).select('id, updated_at');
  for (const [key, value] of Object.entries(filters)) check = check.eq(key, value);
  const current = await result(check.maybeSingle());
  if (!current) throw new CatalogueStaleWriteError(`This ${kind} could not be found — it may have been deleted while you were editing. Nothing was saved.`);
  if (current.updated_at !== expectedUpdatedAt) {
    throw new CatalogueStaleWriteError(`This ${kind} was changed elsewhere after you opened it. Nothing was saved — reload to see the current version, then reapply your changes.`);
  }
  throw new CatalogueRefusedError(`The database refused to save this ${kind}: this account is not a catalogue admin. Sign in again with an admin account.`);
}

/** Refuse a product slug or SKU another product in this store already holds, before the database does. */
async function assertProductKeysFree(store, id, row) {
  const errors = {};
  for (const field of ['slug', 'sku']) {
    if (!row[field]) continue;
    let query = supabase.from('catalogue_products').select('id').eq('store', store).eq(field, row[field]);
    if (id) query = query.neq('id', id);
    const taken = await result(query.limit(1));
    if (taken?.length) errors[field] = `Another product in this store already uses this ${field === 'slug' ? 'slug' : 'SKU'}.`;
  }
  if (Object.keys(errors).length) throw new CatalogueInputError(errors);
}

/** Variant SKUs are unique across EVERY store (the 0033 constraint), so the check is not store-scoped. */
async function assertVariantSkuFree(id, sku) {
  if (!sku) return;
  let query = supabase.from('catalogue_variants').select('id, store').eq('sku', sku);
  if (id) query = query.neq('id', id);
  const taken = await result(query.limit(1));
  if (taken?.length) {
    throw new CatalogueInputError({ sku: `This SKU is already used by another variant${taken[0].store ? ` (${taken[0].store} store)` : ''}. Variant SKUs are unique across every store.` });
  }
}

export const listStoreCategories = (store) => allRows('catalogue_categories', store);
export const listStoreProducts = (store) => allRows('catalogue_products', store, PRODUCT_SELECT);
export async function getStoreProduct(store, id) {
  requireCatalogueStore(store);
  const row = await result(supabase.from('catalogue_products').select(PRODUCT_SELECT).eq('store', store).eq('id', id).maybeSingle());
  // A save path that re-reads the product finds it gone: say so, as a stale write — nothing was saved.
  if (!row) throw new CatalogueStaleWriteError('This product could not be found in this store — it may have been deleted. Nothing was saved.');
  return row;
}
/**
 * Create a draft (no id) or update a product. An update must carry the
 * updated_at the editor loaded; it is refused, not applied, if the row moved.
 */
export async function saveStoreProduct(store, id, input, expectedUpdatedAt = null) {
  requireCatalogueStore(store);
  const categories = await listStoreCategories(store);
  const row = catalogueProductPayload(input, categories);
  await assertProductKeysFree(store, id, row);
  // First create a draft; images/variants can then be saved against its real id.
  if (!id) return result(supabase.from('catalogue_products').insert({ ...row, store, is_active: false }).select().single(), 'product');
  if (row.is_active) assertCataloguePublishable(store, await getStoreProduct(store, id));
  return guardedUpdate('catalogue_products', { store, id }, row, expectedUpdatedAt, 'product');
}
export async function saveStoreCategory(store, id, input, expectedUpdatedAt = null) {
  requireCatalogueStore(store);
  const categories = await listStoreCategories(store);
  if (id && !categories.some((row) => row.id === id)) throw new Error('Category not found in this store.');
  const row = catalogueCategoryPayload(input, categories, id);
  if (id) return guardedUpdate('catalogue_categories', { store, id }, row, expectedUpdatedAt, 'category');
  return result(supabase.from('catalogue_categories').insert({ ...row, store }).select().single(), 'category');
}
export async function saveStoreVariant(store, productId, id, input, expectedUpdatedAt = null) {
  requireCatalogueStore(store);
  const product = await getStoreProduct(store, productId);
  if (id && !(product.variants || []).some((v) => v.id === id)) throw new Error('Variant not found on this product.');
  const row = catalogueVariantPayload({ ...input, id }, store, product.variants || []);
  await assertVariantSkuFree(id, row.sku);
  if (id) return guardedUpdate('catalogue_variants', { store, product_id: productId, id }, row, expectedUpdatedAt, 'variant');
  return result(supabase.from('catalogue_variants').insert({ ...row, store, product_id: productId }).select().single(), 'variant');
}
export async function uploadStoreImage(store, file) {
  requireCatalogueStore(store);
  return uploadImage(file, `catalogue/${store}`);
}
export async function saveStoreMedia(store, productId, id, input) {
  requireCatalogueStore(store);
  const public_url = safeVisualUrl(input.public_url);
  if (!public_url) throw new CatalogueInputError({ public_url: 'Enter a public HTTPS image URL or a local image path.' });
  const product = await getStoreProduct(store, productId);
  if (id && !(product.media || []).some((m) => m.id === id)) throw new Error('Image not found on this product.');
  if (id && product.media.find((m) => m.id === id)?.is_primary && input.is_primary !== true) throw new Error('Choose another gallery image as primary before clearing this one.');
  const sort_order = Number(input.sort_order ?? 0);
  if (!Number.isInteger(sort_order) || sort_order < -2147483648 || sort_order > 2147483647) throw new CatalogueInputError({ sort_order: 'Image order must be a whole number.' });
  const row = { public_url, alt_text: String(input.alt_text || '').trim(), sort_order, is_primary: input.is_primary === true || !(product.media || []).length };
  const query = id ? supabase.from('catalogue_product_media').update(row).eq('product_id', productId).eq('id', id)
    : supabase.from('catalogue_product_media').insert({ ...row, product_id: productId });
  // Existing media trigger updates images[] for both storefronts. Never write the cache directly.
  return result(query.select().single(), 'image');
}
export async function removeStoreMedia(store, productId, id) {
  const product = await getStoreProduct(store, productId);
  if (!(product.media || []).some((m) => m.id === id)) throw new Error('Image not found on this product.');
  if (product.is_active && product.media.length < 2) throw new Error('Keep one image on a published product, or save it as a draft first.');
  // Detach only; never delete an original Storage object.
  await result(supabase.from('catalogue_product_media').delete().eq('product_id', productId).eq('id', id).select('id').single(), 'image');
}
