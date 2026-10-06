import { supabase } from './supabase.js';
import { uploadImage } from './adminApi.js';
import { safeVisualUrl } from './homepageAppearance.js';
import { compressToWebp } from './storeCatalogueImage.js';
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

/**
 * Write one row with no version check (reorder, primary, detach — each states
 * its own intent and is safe to repeat), and still explain zero rows: the row
 * is gone, or row-level security filtered the write out.
 */
async function writeOne(query, table, filters, kind) {
  const data = await result(query.select('id'), kind);
  if (data?.length) return data[0];
  let check = supabase.from(table).select('id');
  for (const [key, value] of Object.entries(filters)) check = check.eq(key, value);
  const current = await result(check.maybeSingle());
  if (!current) throw new CatalogueStaleWriteError(`This ${kind} was already removed — reload to see the current gallery. Nothing was saved.`);
  throw new CatalogueRefusedError(`The database refused to change this ${kind}: this account is not a catalogue admin. Sign in again with an admin account.`);
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
// ---- Images ---------------------------------------------------------------------
// Every catalogue upload is converted to a WebP under 150 KB in the browser
// first (storeCatalogueImage.js), then stored through the same admin-only
// path every product image uses: uploadImage → the product-images bucket,
// whose storage policy admits admin_users members only.
const BUCKET_PREFIX = '/storage/v1/object/public/product-images/';
/** The object path inside product-images, recorded on the media row so a later clean-up can find the file. */
export function storagePathOf(url) {
  const at = String(url || '').indexOf(BUCKET_PREFIX);
  if (at < 0) return null;
  const path = decodeURIComponent(String(url).slice(at + BUCKET_PREFIX.length).split('?')[0]);
  return /^[A-Za-z0-9/_.-]+$/.test(path) && !path.includes('..') ? path : null;
}
export async function uploadStoreImageFile(store, file) {
  requireCatalogueStore(store);
  const webp = await compressToWebp(file);
  const url = await uploadImage(webp.file, `catalogue/${store}`);
  return { url, storage_path: storagePathOf(url), bytes: webp.bytes, width: webp.width, height: webp.height };
}
/** One image (a category picture, or the add-by-URL form's upload): the WebP's public URL. */
export async function uploadStoreImage(store, file) {
  return (await uploadStoreImageFile(store, file)).url;
}
/**
 * Add several images to a product's gallery, one at a time. A file that fails
 * (unreadable, cannot fit 150 KB, upload refused) is reported and the rest go
 * on. The first image a product ever gets becomes its primary.
 * onProgress(index, { name, status: converting|uploading|added|failed, bytes?, error? })
 */
export async function addStoreImages(store, productId, files, onProgress = () => {}) {
  requireCatalogueStore(store);
  const results = [];
  for (const [index, file] of [...files].entries()) {
    const report = (status, extra = {}) => onProgress(index, { name: file?.name || `Image ${index + 1}`, status, ...extra });
    try {
      report('converting');
      const webp = await compressToWebp(file);
      report('uploading', { bytes: webp.bytes });
      const public_url = await uploadImage(webp.file, `catalogue/${store}`);
      const product = await getStoreProduct(store, productId);      // re-read: order and primary as they are now
      const media = product.media || [];
      const row = {
        product_id: productId, public_url, storage_path: storagePathOf(public_url), alt_text: product.name,
        sort_order: media.length ? Math.max(...media.map((m) => Number(m.sort_order) || 0)) + 1 : 0,
        is_primary: !media.length,
      };
      await result(supabase.from('catalogue_product_media').insert(row).select().single(), 'image');
      report('added', { bytes: webp.bytes });
      results.push({ name: file?.name, ok: true, bytes: webp.bytes });
    } catch (error) {
      report('failed', { error: error.message });
      results.push({ name: file?.name, ok: false, error: error.message });
    }
  }
  return results;
}
/** Put the gallery in this order (sort_order 0…n-1). The ids must be exactly the product's images. */
export async function reorderStoreMedia(store, productId, orderedIds) {
  const product = await getStoreProduct(store, productId);
  const media = product.media || [];
  if (orderedIds.length !== media.length || !media.every((m) => orderedIds.includes(m.id))) {
    throw new CatalogueStaleWriteError('The gallery changed while you were reordering it. Nothing was saved — reload and try again.');
  }
  for (const [index, id] of orderedIds.entries()) {
    if (Number(media.find((m) => m.id === id).sort_order) === index) continue;
    await writeOne(supabase.from('catalogue_product_media').update({ sort_order: index }).eq('product_id', productId).eq('id', id), 'catalogue_product_media', { product_id: productId, id }, 'image');
  }
}
/** Make one image the primary; the 0034 trigger demotes the others. */
export async function setStoreMediaPrimary(store, productId, id) {
  const product = await getStoreProduct(store, productId);
  if (!(product.media || []).some((m) => m.id === id)) throw new CatalogueStaleWriteError('That image is no longer on this product. Reload to see the current gallery.');
  await writeOne(supabase.from('catalogue_product_media').update({ is_primary: true }).eq('product_id', productId).eq('id', id), 'catalogue_product_media', { product_id: productId, id }, 'image');
}
/** Change an image's alt text, refused if the image changed since it was read. */
export async function saveStoreMediaAlt(store, productId, id, altText, expectedUpdatedAt) {
  const product = await getStoreProduct(store, productId);
  if (!(product.media || []).some((m) => m.id === id)) throw new CatalogueStaleWriteError('That image is no longer on this product. Reload to see the current gallery.');
  const alt_text = String(altText || '').trim();
  if (alt_text.length > 300) throw new CatalogueInputError({ alt_text: 'Keep alt text under 300 characters.' });
  return guardedUpdate('catalogue_product_media', { product_id: productId, id }, { alt_text }, expectedUpdatedAt, 'image');
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
  await writeOne(supabase.from('catalogue_product_media').delete().eq('product_id', productId).eq('id', id), 'catalogue_product_media', { product_id: productId, id }, 'image');
}
