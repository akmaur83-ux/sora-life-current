import { supabase } from './supabase.js';
import { uploadImage } from './adminApi.js';
import { safeVisualUrl } from './homepageAppearance.js';
import { requireCatalogueStore, catalogueProductPayload, catalogueCategoryPayload, catalogueVariantPayload, assertCataloguePublishable } from './storeCatalogueAdmin.js';

// Uses existing admin RLS. No service credentials, schema changes or wellness writes.
const PRODUCT_SELECT = '*, variants:catalogue_variants (*), media:catalogue_product_media (*)';
async function result(query) {
  const { data, error } = await query;
  if (error) throw error;
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
export const listStoreCategories = (store) => allRows('catalogue_categories', store);
export const listStoreProducts = (store) => allRows('catalogue_products', store, PRODUCT_SELECT);
export async function getStoreProduct(store, id) {
  requireCatalogueStore(store);
  const row = await result(supabase.from('catalogue_products').select(PRODUCT_SELECT).eq('store', store).eq('id', id).single());
  if (!row) throw new Error('Product not found in this store.');
  return row;
}
export async function saveStoreProduct(store, id, input) {
  requireCatalogueStore(store);
  const categories = await listStoreCategories(store);
  const row = catalogueProductPayload(input, categories);
  // First create a draft; images/variants can then be saved against its real id.
  if (!id) return result(supabase.from('catalogue_products').insert({ ...row, store, is_active: false }).select().single());
  if (row.is_active) assertCataloguePublishable(store, await getStoreProduct(store, id));
  return result(supabase.from('catalogue_products').update(row).eq('store', store).eq('id', id).select().single());
}
export async function saveStoreCategory(store, id, input) {
  requireCatalogueStore(store);
  const categories = await listStoreCategories(store);
  if (id && !categories.some((row) => row.id === id)) throw new Error('Category not found in this store.');
  const row = catalogueCategoryPayload(input, categories, id);
  const query = id ? supabase.from('catalogue_categories').update(row).eq('store', store).eq('id', id)
    : supabase.from('catalogue_categories').insert({ ...row, store });
  return result(query.select().single());
}
export async function saveStoreVariant(store, productId, id, input) {
  requireCatalogueStore(store);
  const row = catalogueVariantPayload(input, store);
  const product = await getStoreProduct(store, productId);
  if (id && !(product.variants || []).some((v) => v.id === id)) throw new Error('Variant not found on this product.');
  const query = id ? supabase.from('catalogue_variants').update(row).eq('store', store).eq('product_id', productId).eq('id', id)
    : supabase.from('catalogue_variants').insert({ ...row, store, product_id: productId });
  return result(query.select().single());
}
export async function uploadStoreImage(store, file) {
  requireCatalogueStore(store);
  return uploadImage(file, `catalogue/${store}`);
}
export async function saveStoreMedia(store, productId, id, input) {
  requireCatalogueStore(store);
  const public_url = safeVisualUrl(input.public_url);
  if (!public_url) throw new Error('Enter a public HTTPS image URL or a local image path.');
  const product = await getStoreProduct(store, productId);
  if (id && !(product.media || []).some((m) => m.id === id)) throw new Error('Image not found on this product.');
  if (id && product.media.find((m) => m.id === id)?.is_primary && input.is_primary !== true) throw new Error('Choose another gallery image as primary before clearing this one.');
  const sort_order = Number(input.sort_order ?? 0);
  if (!Number.isInteger(sort_order) || sort_order < -2147483648 || sort_order > 2147483647) throw new Error('Image order must be a whole number.');
  const row = { public_url, alt_text: String(input.alt_text || '').trim(), sort_order, is_primary: input.is_primary === true || !(product.media || []).length };
  const query = id ? supabase.from('catalogue_product_media').update(row).eq('product_id', productId).eq('id', id)
    : supabase.from('catalogue_product_media').insert({ ...row, product_id: productId });
  // Existing media trigger updates images[] for both storefronts. Never write the cache directly.
  return result(query.select().single());
}
export async function removeStoreMedia(store, productId, id) {
  const product = await getStoreProduct(store, productId);
  if (!(product.media || []).some((m) => m.id === id)) throw new Error('Image not found on this product.');
  if (product.is_active && product.media.length < 2) throw new Error('Keep one image on a published product, or save it as a draft first.');
  // Detach only; never delete an original Storage object.
  await result(supabase.from('catalogue_product_media').delete().eq('product_id', productId).eq('id', id).select('id').single());
}
