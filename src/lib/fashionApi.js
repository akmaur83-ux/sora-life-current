// ============================================================
// Fashion store — Supabase reads and admin writes.
//
// Reads go straight at the tables under RLS (public read where is_active,
// exactly as the wellness categories and variants are read). Writes are
// admin-only and follow the omit-when-absent rule: a caller that does not
// mention a field cannot blank it.
// ============================================================
import { supabase } from './supabase.js';
import { fashionCategoryToRow, fashionProductToRow, fashionVariantToRow } from './fashion.js';

const PRODUCT_COLUMNS = 'id, name, slug, brand, description, category_id, mrp, sale_price, discount_percent, images, rating, review_count, is_active, is_new, is_bestseller, sort_order, is_demo';
const VARIANT_COLUMNS = 'id, product_id, size, colour, colour_hex, sku, stock, price_override, is_active, sort_order';

export async function getFashionCategories() {
  const { data, error } = await supabase
    .from('fashion_categories')
    .select('id, parent_id, name, slug, tagline, image_url, sort_order, is_active')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** Every active product with its active variants, in one request. */
export async function getFashionProducts() {
  const { data, error } = await supabase
    .from('fashion_products')
    .select(`${PRODUCT_COLUMNS}, fashion_variants (${VARIANT_COLUMNS})`)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getFashionProduct(slug) {
  const { data, error } = await supabase
    .from('fashion_products')
    .select(`${PRODUCT_COLUMNS}, fashion_variants (${VARIANT_COLUMNS})`)
    .eq('slug', String(slug || ''))
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// ---- Admin ----------------------------------------------------------------------
// Each upsert sends ONLY the keys the caller passed (see fashion.js). Slug is
// the natural key for categories within a parent and for products; variants
// conflict on product + size + colour.
export async function adminUpsertFashionCategory(input) {
  const row = fashionCategoryToRow(input);
  const { data, error } = await supabase.from('fashion_categories').upsert(row, { onConflict: 'id' }).select().single();
  if (error) throw error;
  return data;
}

export async function adminUpsertFashionProduct(input) {
  const row = fashionProductToRow(input);
  const { data, error } = await supabase.from('fashion_products').upsert(row, { onConflict: 'slug' }).select().single();
  if (error) throw error;
  return data;
}

export async function adminUpsertFashionVariant(input) {
  const row = fashionVariantToRow(input);
  const { data, error } = await supabase.from('fashion_variants').upsert(row, { onConflict: 'product_id,size,colour' }).select().single();
  if (error) throw error;
  return data;
}

/** Removes every demo row: products (variants cascade) and any demo categories. */
export async function adminDeleteFashionDemo() {
  const products = await supabase.from('fashion_products').delete().eq('is_demo', true).select('id');
  if (products.error) throw products.error;
  const categories = await supabase.from('fashion_categories').delete().eq('is_demo', true).select('id');
  if (categories.error) throw categories.error;
  return { products: products.data?.length || 0, categories: categories.data?.length || 0 };
}
