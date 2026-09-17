// ============================================================
// Fashion store — Supabase reads and admin writes.
//
// Since migration 0034 the fashion rows live in the shared catalogue
// tables (catalogue_categories / catalogue_products / catalogue_variants)
// under store = 'fashion'. Every read here filters on that store; every
// write stamps it (fashion.js → fashion*ToRow). The variants embed is
// ALIASED to its old name, `fashion_variants`, so the row shape the rest
// of the fashion code reads (productView, the cart cache) is byte-for-byte
// what the fashion tables returned.
//
// Reads go straight at the tables under RLS (public read where is_active,
// exactly as the wellness categories and variants are read). Writes are
// admin-only and follow the omit-when-absent rule: a caller that does not
// mention a field cannot blank it.
// ============================================================
import { supabase } from './supabase.js';
import { FASHION_STORE, fashionCategoryToRow, fashionProductToRow, fashionVariantToRow } from './fashion.js';

export const CATEGORY_TABLE = 'catalogue_categories';
export const PRODUCT_TABLE = 'catalogue_products';
export const VARIANT_TABLE = 'catalogue_variants';

const PRODUCT_COLUMNS = 'id, name, slug, brand, description, category_id, mrp, sale_price, discount_percent, images, rating, review_count, is_active, is_new, is_bestseller, sort_order, is_demo';
const VARIANT_COLUMNS = 'id, product_id, size, colour, colour_hex, sku, stock, price_override, is_active, sort_order';
/** The embed, under the name the fashion code has always read. */
const PRODUCT_SELECT = `${PRODUCT_COLUMNS}, fashion_variants:${VARIANT_TABLE} (${VARIANT_COLUMNS})`;

export async function getFashionCategories() {
  const { data, error } = await supabase
    .from(CATEGORY_TABLE)
    .select('id, parent_id, name, slug, tagline, image_url, sort_order, is_active')
    .eq('store', FASHION_STORE)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** Every active product with its active variants, in one request. */
export async function getFashionProducts() {
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .select(PRODUCT_SELECT)
    .eq('store', FASHION_STORE)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** The products (with active variants) behind a set of cart lines. */
export async function getFashionProductsByIds(ids) {
  const clean = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!clean.length) return [];
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .select(PRODUCT_SELECT)
    .eq('store', FASHION_STORE)
    .in('id', clean);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getFashionProduct(slug) {
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .select(PRODUCT_SELECT)
    .eq('store', FASHION_STORE)
    .eq('slug', String(slug || ''))
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// ---- Admin ----------------------------------------------------------------------
// Each upsert sends ONLY the keys the caller passed (see fashion.js), plus
// store = 'fashion', which the mapper stamps and the caller cannot omit or
// override. Natural keys: categories on id; products on (store, slug) —
// slugs are unique per store since 0034; variants on product + size + colour.
export async function adminUpsertFashionCategory(input) {
  const row = fashionCategoryToRow(input);
  const { data, error } = await supabase.from(CATEGORY_TABLE).upsert(row, { onConflict: 'id' }).select().single();
  if (error) throw error;
  return data;
}

export async function adminUpsertFashionProduct(input) {
  const row = fashionProductToRow(input);
  const { data, error } = await supabase.from(PRODUCT_TABLE).upsert(row, { onConflict: 'store,slug' }).select().single();
  if (error) throw error;
  return data;
}

export async function adminUpsertFashionVariant(input) {
  const row = fashionVariantToRow(input);
  const { data, error } = await supabase.from(VARIANT_TABLE).upsert(row, { onConflict: 'product_id,size,colour' }).select().single();
  if (error) throw error;
  return data;
}

/** Removes every FASHION demo row: products (variants cascade) and any demo categories. Other stores are untouched. */
export async function adminDeleteFashionDemo() {
  const products = await supabase.from(PRODUCT_TABLE).delete().eq('store', FASHION_STORE).eq('is_demo', true).select('id');
  if (products.error) throw products.error;
  const categories = await supabase.from(CATEGORY_TABLE).delete().eq('store', FASHION_STORE).eq('is_demo', true).select('id');
  if (categories.error) throw categories.error;
  return { products: products.data?.length || 0, categories: categories.data?.length || 0 };
}
