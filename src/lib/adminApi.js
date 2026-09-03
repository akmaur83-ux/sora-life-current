// ============================================================
// Supabase data access — public storefront reads + authenticated
// admin CRUD. Every write here is also enforced server-side by
// Postgres RLS (see supabase/migrations/0001_admin_extensions.sql):
// only a session whose auth.uid() exists in public.admin_users can
// write to products/categories/hero_slides/site_settings/storage.
// This file does not "trust" the client — it's a thin wrapper.
// ============================================================
import { supabase } from './supabase.js';
import { BIOSASH_PRODUCTS } from '../data/biosash.js';
import {
  MediaOperationError, persistUploadedMedia, removeMediaObject, settlePrimaryMedia, commitStagedMedia,
  IMAGE_UPLOAD_TYPES, IMAGE_UPLOAD_MAX_BYTES, validateImageMetadata, validateImageUpload, validateVideoUpload,
} from './productMediaOperations.js';

const DISCOUNT_TIERS = [10, 15, 18, 20];

// The pre-existing `products.stock` column (created before this admin
// system existed) is a boolean "in stock" flag, NOT a quantity — confirmed
// by Postgres rejecting a numeric value with
// `invalid input syntax for type boolean: "40"`. The rest of the app uses
// a numeric stock convention (0 = out, >0 = in stock, used for low-stock
// UI thresholds), so these two helpers are the single conversion boundary:
// DB boolean <-> app numeric. Nothing outside this file needs to know.
const IN_STOCK_QTY = 40; // stand-in quantity used app-side when stock=true

function stockToDbBoolean(appStock) {
  if (typeof appStock === 'boolean') return appStock;
  return Number(appStock) > 0;
}
function stockFromDbValue(dbStock) {
  if (typeof dbStock === 'boolean') return dbStock ? IN_STOCK_QTY : 0;
  return Number(dbStock) > 0 ? IN_STOCK_QTY : 0; // tolerate a numeric column too
}

// ---------------------------------------------------------------
// Mapping: DB row <-> the app's normalized product shape
// ---------------------------------------------------------------
export function dbRowToProduct(row) {
  return {
    dbId: row.id,
    id: row.biosash_id || row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand || row.brand_name || row.manufacturer || null,
    category: row.category,
    categories: [row.category],
    form: row.form || null,
    originalPrice: Number(row.original_price) || 0,
    discountPercent: Number(row.discount_percent) || 0,
    salePrice: row.sale_price != null ? Number(row.sale_price) : null,
    image: row.image_url,
    gallery: row.gallery_urls || [],
    permalink: row.source_url || null,
    rating: Number(row.rating) || 0,
    reviewCount: Number(row.review_count) || 0,
    stock: stockFromDbValue(row.stock),
    inStock: typeof row.stock === 'boolean' ? row.stock : Number(row.stock) > 0,
    description: row.description || '',
    isNew: !!row.is_new,
    isBestseller: !!row.is_bestseller,
    isFeatured: !!row.is_featured,
    sortOrder: Number(row.sort_order) || 0,
    isActive: row.is_active !== false,
    biosashId: row.biosash_id || null,
  };
}

function productToDbRow(p) {
  const discountPercent = Number(p.discountPercent) || 0;
  const originalPrice = Number(p.originalPrice) || 0;
  const row = {
    name: p.name,
    slug: p.slug,
    description: p.description || '',
    category: p.category,
    image_url: p.image || null,
    gallery_urls: p.gallery || [],
    original_price: originalPrice,
    discount_percent: discountPercent,
    sale_price: originalPrice > 0 ? Math.round(originalPrice * (1 - discountPercent / 100)) : 0,
    is_active: p.isActive !== false,
    form: p.form || null,
    stock: stockToDbBoolean(p.inStock !== undefined ? p.inStock : p.stock),
    source_url: p.permalink || null,
    is_new: !!p.isNew,
    is_bestseller: !!p.isBestseller,
    is_featured: !!p.isFeatured,
    rating: Number(p.rating) || 0,
    review_count: Number(p.reviewCount) || 0,
    sort_order: Number(p.sortOrder) || 0,
  };
  if (p.biosashId) row.biosash_id = p.biosashId;
  return row;
}

// ---------------------------------------------------------------
// PUBLIC reads (storefront bootstrap) — no auth required, RLS
// exposes only is_active rows to anonymous sessions.
// ---------------------------------------------------------------
export async function fetchPublicCatalog() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(dbRowToProduct);
}

export async function fetchPublicCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map((c) => ({
    slug: c.slug, name: c.name, tagline: c.tagline || '', blurb: c.blurb || '',
    tone: c.tone || 'forest', icon: 'leaf', image: c.image_url || null,
  }));
}

export async function fetchPublicHeroSlides() {
  const { data, error } = await supabase
    .from('hero_slides')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map((s) => ({
    id: s.id,
    kind: s.kind,
    src: s.kind === 'video' ? s.video_url : s.image_url,
    poster: s.poster_url || undefined,
    kicker: s.kicker || '',
    title: s.title || '',
    sub: s.subtitle || '',
    lede: s.lede || '',
    cta: { label: s.cta_label || 'SHOP NOW', to: s.cta_link || '/shop' },
    position: 'center',
  }));
}

export async function fetchPublicSettings() {
  const { data, error } = await supabase.from('site_settings').select('key, value');
  if (error) throw error;
  const out = {};
  (data || []).forEach((row) => { out[row.key] = row.value; });
  return out;
}

// ---- Storefront theme (admin) ----
// Read is admin-scoped here (admins can read every key via the admin for-all
// policy); the storefront reads the same key via the public-read allowlist.
export async function adminGetTheme() {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'storefront_theme').maybeSingle();
  if (error) return null;
  return data?.value || null;
}

// Writes ONLY through the validating, admin-gated RPC — never a raw table write.
export async function adminSetTheme(theme) {
  const { data, error } = await supabase.rpc('admin_set_storefront_theme', { p_theme: theme });
  if (error) return { ok: false, reason: error.message };
  return data;
}

// ---------------------------------------------------------------
// ADMIN: products
// ---------------------------------------------------------------
export async function adminListProducts() {
  const { data, error } = await supabase.from('products').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(dbRowToProduct);
}

export async function adminCreateProduct(product) {
  const row = productToDbRow(product);
  if (!row.slug) row.slug = slugify(product.name);
  const { data, error } = await supabase.from('products').insert(row).select().single();
  if (error) throw error;
  return dbRowToProduct(data);
}

export async function adminUpdateProduct(dbId, product) {
  const row = productToDbRow(product);
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('products').update(row).eq('id', dbId).select().single();
  if (error) throw error;
  return dbRowToProduct(data);
}

export async function adminSetProductActive(dbId, isActive) {
  const { error } = await supabase.from('products').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', dbId);
  if (error) throw error;
}

export async function adminDeleteProduct(dbId) {
  const { error } = await supabase.from('products').delete().eq('id', dbId);
  if (error) throw error;
}

export async function adminReorderProducts(dbIdsInOrder) {
  await Promise.all(dbIdsInOrder.map((dbId, i) =>
    supabase.from('products').update({ sort_order: i }).eq('id', dbId)
  ));
}

function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * One-time (idempotent) import of the 149 real Biosash products from the
 * bundled biosash.js into Supabase. Runs as the logged-in admin, so it is
 * subject to the same RLS as any other admin write. Upserts on biosash_id,
 * so it's safe to run more than once. Preserves the exact discount-tier
 * assignment already live on the storefront so nothing visibly changes.
 */
export async function adminImportBiosashCatalog(onProgress) {
  const rows = BIOSASH_PRODUCTS.map((p, i) => {
    const originalPrice = Number(p.price) > 0 ? Number(p.price) : 0;
    const idNum = parseInt(String(p.id).replace(/\D/g, ''), 10) || i;
    const discountPercent = originalPrice > 0 ? DISCOUNT_TIERS[idNum % DISCOUNT_TIERS.length] : 0;
    const salePrice = originalPrice > 0 ? Math.round(originalPrice * (1 - discountPercent / 100)) : 0;
    return {
      biosash_id: p.id,
      name: p.name,
      slug: p.slug,
      description: '',
      category: p.category,
      image_url: p.image,
      gallery_urls: p.gallery || [],
      original_price: originalPrice,
      discount_percent: discountPercent,
      sale_price: salePrice,
      is_active: true,
      form: p.form || null,
      stock: !!p.inStock, // boolean "in stock" flag — the DB column is boolean, not a quantity
      source_url: p.permalink || null,
      is_new: false,
      is_bestseller: false,
      is_featured: false,
      rating: p.rating || 0,
      review_count: p.reviewCount || 0,
      sort_order: i,
    };
  });

  const chunkSize = 25;
  let done = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'biosash_id' });
    if (error) throw error;
    done += chunk.length;
    if (onProgress) onProgress(done, rows.length);
  }
  return rows.length;
}

// ---------------------------------------------------------------
// ADMIN: orders
// Payment/order creation stays server-side. The only admin write is the
// narrow 0022 RPC, which validates admin membership in Postgres and can
// update fulfillment columns only.
// ---------------------------------------------------------------
export async function adminListOrders(limit = 100) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function adminUpdateOrderFulfillment(orderId, input, actions = {}) {
  if (!orderId) throw new Error('Order ID is required.');
  const { data, error } = await supabase.rpc('admin_update_order_fulfillment', {
    p_order_id: orderId,
    p_fulfillment_status: input?.fulfillmentStatus ?? null,
    p_carrier_name: input?.carrierName ?? null,
    p_tracking_number: input?.trackingNumber ?? null,
    p_tracking_url: input?.trackingUrl ?? null,
    p_mark_shipped: actions.markShipped === true,
    p_mark_delivered: actions.markDelivered === true,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
// ADMIN: categories
// ---------------------------------------------------------------
export async function adminListCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function adminUpsertCategory(category) {
  const row = {
    slug: category.slug || slugify(category.name),
    name: category.name,
    tagline: category.tagline || '',
    blurb: category.blurb || '',
    image_url: category.image_url || null,
    tone: category.tone || 'forest',
    sort_order: Number(category.sort_order) || 0,
    is_active: category.is_active !== false,
  };
  const { data, error } = await supabase.from('categories').upsert(row, { onConflict: 'slug' }).select().single();
  if (error) throw error;
  return data;
}

export async function adminDeleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

const DEFAULT_CATEGORY_SEED = [
  { slug: 'wellness', name: 'Wellness', tagline: 'Everyday Himalayan wellness', tone: 'forest', blurb: 'Sea-buckthorn health essentials for daily balance and vitality.', sort_order: 0 },
  { slug: 'juices-drinks', name: 'Juices & Drinks', tagline: 'Cold-pressed nutrition', tone: 'lime', blurb: 'Nutritional juices and drinks powered by Himalayan sea buckthorn.', sort_order: 1 },
  { slug: 'supplements', name: 'Supplements', tagline: 'Herbal & Ayurvedic support', tone: 'clay', blurb: 'Ayurvedic and herbal supplements for targeted daily support.', sort_order: 2 },
  { slug: 'skin-care', name: 'Skin Care', tagline: 'Radiance, naturally', tone: 'rose', blurb: 'Serums, creams and cleansers rich in sea-buckthorn oil.', sort_order: 3 },
  { slug: 'hair-care', name: 'Hair Care', tagline: 'Roots to ends', tone: 'plum', blurb: 'Shampoos, oils and treatments for stronger, healthier hair.', sort_order: 4 },
  { slug: 'bath-body', name: 'Bath & Body', tagline: 'Soaps & body rituals', tone: 'teal', blurb: 'Handmade soaps, body oils and washes for nourished skin.', sort_order: 5 },
  { slug: 'mens-care', name: "Men's Care", tagline: 'Grooming essentials', tone: 'moss', blurb: 'Beard, shave and grooming essentials made for men.', sort_order: 6 },
  { slug: 'personal-care', name: 'Personal Care', tagline: 'Hygiene & daily care', tone: 'sky', blurb: 'Everyday hygiene and personal-care essentials.', sort_order: 7 },
];
export async function adminSeedDefaultCategories() {
  const { error } = await supabase.from('categories').upsert(DEFAULT_CATEGORY_SEED, { onConflict: 'slug', ignoreDuplicates: true });
  if (error) throw error;
}

// ---------------------------------------------------------------
// ADMIN: hero slides
// ---------------------------------------------------------------
export async function adminListHeroSlides() {
  const { data, error } = await supabase.from('hero_slides').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function adminUpsertHeroSlide(slide) {
  const row = {
    kind: slide.kind || 'image',
    image_url: slide.image_url || null,
    video_url: slide.video_url || null,
    poster_url: slide.poster_url || null,
    kicker: slide.kicker || '',
    title: slide.title || '',
    subtitle: slide.subtitle || '',
    lede: slide.lede || '',
    cta_label: slide.cta_label || 'SHOP NOW',
    cta_link: slide.cta_link || '/shop',
    sort_order: Number(slide.sort_order) || 0,
    is_active: slide.is_active !== false,
  };
  if (slide.id) {
    const { data, error } = await supabase.from('hero_slides').update(row).eq('id', slide.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('hero_slides').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function adminDeleteHeroSlide(id) {
  const { error } = await supabase.from('hero_slides').delete().eq('id', id);
  if (error) throw error;
}

export async function adminReorderHeroSlides(idsInOrder) {
  await Promise.all(idsInOrder.map((id, i) => supabase.from('hero_slides').update({ sort_order: i }).eq('id', id)));
}

const DEFAULT_HERO_SEED = [
  { kind: 'video', video_url: '/media/hero.mp4', poster_url: '/media/hero-poster.jpg', kicker: 'The Power of', title: 'Sea Buckthorn', subtitle: 'Harvested from the Himalayas. Made for your wellness.', lede: 'Pure nutrition. Natural radiance. Everyday wellness.', cta_label: 'EXPLORE COLLECTION', cta_link: '/category/wellness', sort_order: 0 },
  { kind: 'image', image_url: '/media/hero-slide2.jpg', kicker: 'From the Himalayas', title: "Nature's Orange Gold", subtitle: 'Sun-ripened sea buckthorn, gently cold-pressed.', lede: 'Nutrient-dense wellness, straight from the mountains.', cta_label: 'SHOP JUICES & DRINKS', cta_link: '/category/juices-drinks', sort_order: 1 },
];
export async function adminSeedDefaultHeroSlides() {
  const existing = await adminListHeroSlides();
  if (existing.length > 0) return 0;
  const { error } = await supabase.from('hero_slides').insert(DEFAULT_HERO_SEED);
  if (error) throw error;
  return DEFAULT_HERO_SEED.length;
}

// ---------------------------------------------------------------
// ADMIN: site settings (branding / announcement / homepage / contact)
// ---------------------------------------------------------------
export async function adminGetSetting(key) {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

export async function adminSetSetting(key, value) {
  const { error } = await supabase.from('site_settings').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw error;
}

// ---------------------------------------------------------------
// ADMIN: file upload (Supabase Storage). RLS on storage.objects
// enforces admin-only writes for both buckets — see the migrations.
// ---------------------------------------------------------------
async function uploadToBucket(bucket, file, folder, opts = {}) {
  if (!/^[a-z0-9][a-z0-9/_-]{0,63}$/i.test(folder) || folder.includes('..') || folder.includes('//')) {
    throw new Error('Invalid upload destination.');
  }
  if (!opts.extension || !/^[a-z0-9]{2,5}$/.test(opts.extension)) throw new Error('A validated file type is required.');
  const path = `${folder}/${cryptoRandomId()}.${opts.extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: opts.cacheControl || '3600',
    upsert: false,
    contentType: opts.contentType,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImage(file, folder = 'products') {
  const validated = await validateImageUpload(file);
  return uploadToBucket('product-images', file, folder, { extension: validated.extension, contentType: validated.mime });
}

const MAX_HERO_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB — generous local guard; Supabase project limits still apply

export async function validateHeroVideo(file) {
  return validateVideoUpload(file, { maxBytes: MAX_HERO_VIDEO_BYTES });
}

export async function uploadHeroVideo(file) {
  const validated = await validateHeroVideo(file);
  return uploadToBucket('hero-media', file, 'video', {
    cacheControl: '31536000', extension: validated.extension, contentType: validated.mime,
  });
}

function cryptoRandomId() {
  const secure = globalThis.window?.crypto || globalThis.crypto;
  if (secure?.randomUUID) return secure.randomUUID();
  if (secure?.getRandomValues) {
    const bytes = new Uint8Array(16); secure.getRandomValues(bytes);
    return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Secure random storage naming is unavailable.');
}

/**
 * Public read of active product variants (pack sizes) for the storefront.
 *
 * Returns [] when the table does not exist yet (migration 0006 pending), so
 * the catalogue keeps rendering with base prices instead of failing.
 */
export async function fetchPublicVariants() {
  const { data, error } = await supabase
    .from('product_variants')
    .select('id,product_id,label,size,unit,sku,mrp,sale_price,stock,image_url,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    // 42P01 / PGRST205 = relation not found -> treat as "no variants yet".
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    throw error;
  }
  return (data || []).map((v) => ({
    id: String(v.id),
    productId: v.product_id,
    label: v.label,
    size: v.size != null ? Number(v.size) : null,
    unit: v.unit || null,
    sku: v.sku || null,
    mrp: v.mrp != null ? Number(v.mrp) : null,
    price: v.sale_price != null ? Number(v.sale_price) : (v.mrp != null ? Number(v.mrp) : null),
    stock: v.stock != null ? Number(v.stock) : null,
    image: v.image_url || null,
    sortOrder: v.sort_order ?? 0,
  }));
}

// ---------------------------------------------------------------
// ADMIN: product variants (pack sizes)
//
// These sit ALONGSIDE the base product pricing, never replacing it. A product
// with no variant rows keeps selling at products.sale_price exactly as before;
// variants only add optional per-size pricing on top.
//
// Writes are guarded by the "product_variants admin write" RLS policy, so a
// non-admin session is refused by the database regardless of the UI.
// ---------------------------------------------------------------

/** Every variant of one product, including inactive ones (admin view). */
export async function adminListVariants(productId) {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      throw new Error('The product_variants table does not exist yet. Run supabase/migrations/0006_variants_billing_invoices.sql first.');
    }
    throw error;
  }
  return data || [];
}

/**
 * Map the form's values onto real columns.
 *
 * Blank optional fields become NULL rather than 0 or '' — a variant with no
 * SKU must not claim the empty-string SKU, and a variant with no explicit GST
 * rate must fall through to the configured default rather than assert 0%.
 */
function variantRow(v, productId) {
  const num = (x) => (x === '' || x == null ? null : Number(x));
  const txt = (x) => {
    const t = String(x ?? '').trim();
    return t === '' ? null : t;
  };
  return {
    product_id: productId,
    label: txt(v.label),
    size: num(v.size),
    unit: txt(v.unit),
    sku: txt(v.sku),
    mrp: num(v.mrp),
    sale_price: num(v.sale_price),
    gst_rate: num(v.gst_rate),
    stock: num(v.stock),
    volume_ml: v.unit === 'ml' ? num(v.size) : null,
    weight_grams: v.unit === 'g' ? num(v.size) : null,
    is_active: v.is_active !== false,
    sort_order: num(v.sort_order) ?? 0,
  };
}

export async function adminCreateVariant(productId, v) {
  const { data, error } = await supabase
    .from('product_variants')
    .insert(variantRow(v, productId))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function adminUpdateVariant(id, productId, v) {
  const { data, error } = await supabase
    .from('product_variants')
    .update(variantRow(v, productId))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Activate / deactivate without losing the row or its price history. */
export async function adminSetVariantActive(id, isActive) {
  const { error } = await supabase
    .from('product_variants')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
}

export async function adminDeleteVariant(id) {
  const { error } = await supabase.from('product_variants').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------
// PRODUCT MEDIA (multi-image gallery) — migration 0016.
//
// Reads are public (RLS: select using true). Writes are admin-only and also
// enforced server-side by RLS (is_sora_admin) + the single-primary trigger.
// The storefront never writes here; only the admin editor and the server
// importer do. Storage paths are always generated (cryptoRandomId), never
// taken from client input, so no arbitrary path can be written.
// ---------------------------------------------------------------
export const MEDIA_ALLOWED_TYPES = Object.keys(IMAGE_UPLOAD_TYPES);
export const MEDIA_MAX_BYTES = IMAGE_UPLOAD_MAX_BYTES; // 8MB per product image

export function validateMediaFile(file) {
  validateImageMetadata(file, { allowedTypes: MEDIA_ALLOWED_TYPES, maxBytes: MEDIA_MAX_BYTES });
  return true;
}

function dbMediaToApp(row) {
  return {
    id: row.id,
    productId: row.product_id,
    storagePath: row.storage_path || null,
    url: row.public_url,
    alt: row.alt_text || '',
    sortOrder: Number(row.sort_order) || 0,
    isPrimary: !!row.is_primary,
  };
}

// Upload one image into the product-images bucket and return BOTH the generated
// storage path (kept on the media row so the object can be deleted later) and
// its public URL. The path is server-side-random — never client-controlled.
export async function uploadProductMediaFile(file) {
  const validated = await validateImageUpload(file, { allowedTypes: MEDIA_ALLOWED_TYPES, maxBytes: MEDIA_MAX_BYTES });
  const path = `products/${cryptoRandomId()}.${validated.extension}`;
  try {
    const { error } = await supabase.storage.from('product-images').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: validated.mime,
    });
    if (error) throw error;
  } catch (error) {
    // Upload can have committed even if its response was lost.
    await removeMediaObject(path, removeProductMediaObject);
    throw error;
  }
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return { storagePath: path, publicUrl: data.publicUrl };
}

// Public: every product's media (storefront bootstrap), primary-first.
export async function fetchPublicProductMedia() {
  const { data, error } = await supabase
    .from('product_media')
    .select('id,product_id,public_url,alt_text,sort_order,is_primary')
    .order('product_id', { ascending: true })
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data || []).map(dbMediaToApp);
}

// Admin: media for one product (uses the public-read policy; ordered for editing).
export async function adminListProductMedia(productId) {
  const { data, error } = await supabase
    .from('product_media')
    .select('*')
    .eq('product_id', productId)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(dbMediaToApp);
}

export async function adminAddProductMedia({ productId, storagePath = null, publicUrl, altText = '', sortOrder = 0, isPrimary = false }) {
  if (!productId) throw new Error('A product id is required to attach media.');
  if (!publicUrl) throw new Error('An image URL is required.');
  const row = {
    product_id: productId,
    storage_path: storagePath,
    public_url: publicUrl,
    alt_text: altText || '',
    sort_order: sortOrder,
    is_primary: isPrimary,
  };
  const { data, error } = await supabase.from('product_media').insert(row).select().single();
  if (error) throw error;
  return dbMediaToApp(data);
}

// Every mutation is scoped by BOTH id AND product_id, so an id belonging to a
// different product can never be reordered/updated/deleted/replaced by mistake
// (a mismatched pair matches zero rows). Defence-in-depth on top of admin RLS.
export async function adminUpdateProductMedia(productId, id, patch) {
  const row = {};
  if (patch.altText !== undefined) row.alt_text = patch.altText;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  const { data, error } = await supabase.from('product_media').update(row)
    .eq('id', id).eq('product_id', productId).select().single();
  if (error) throw error;
  return dbMediaToApp(data);
}

// Low-level selection used only by the checked synchronization operation.
// The DB trigger atomically demotes the other rows for this product.
async function selectPrimaryMediaRow(productId, id) {
  const { data, error } = await supabase.from('product_media').update({ is_primary: true })
    .eq('id', id).eq('product_id', productId).select().single();
  if (error) throw error;
  if (!data?.is_primary) throw new Error('Primary selection was not confirmed.');
  return dbMediaToApp(data);
}

async function removeProductMediaObject(path) {
  const bucket = supabase.storage.from('product-images');
  const { data, error } = await bucket.remove([path]);
  if (error) throw error;
  if (Array.isArray(data) && data.some((object) => object.name === path)) return;
  const { error: infoError } = await bucket.info(path);
  if (Number(infoError?.status) === 404 || (Number(infoError?.status) === 400 && infoError?.code === 'NoSuchKey')) return;
  throw new Error('Storage deletion was not confirmed.');
}

async function findProductMediaByPath(productId, path) {
  const { data, error } = await supabase.from('product_media').select('*')
    .eq('product_id', productId).eq('storage_path', path).maybeSingle();
  if (error) throw error;
  return data ? dbMediaToApp(data) : null;
}

function productMediaOperations(productId) {
  return {
    list: () => adminListProductMedia(productId),
    select: (id) => selectPrimaryMediaRow(productId, id),
    sync: (url) => adminSyncPrimaryToProduct(productId, url),
    upload: uploadProductMediaFile,
    add: (row) => adminAddProductMedia({ ...row, productId }),
    find: (path) => findProductMediaByPath(productId, path),
    remove: removeProductMediaObject,
  };
}

export async function adminEnsurePrimaryMedia(productId, preferredId = null) {
  const state = await settlePrimaryMedia(productMediaOperations(productId), preferredId);
  if (!state.ok) throw new MediaOperationError(state.primaryError ? 'primary' : 'sync',
    [state.primaryError, state.syncError].filter(Boolean).join(' '), state);
  return state;
}

export async function adminSetPrimaryMedia(productId, id) {
  return (await adminEnsurePrimaryMedia(productId, id)).primary;
}

// Used by both new-product staging and live multi-upload. Per-file failures
// are retained; primary/sync failures are reported separately, never swallowed.
export async function adminCommitStagedProductMedia(productId, items) {
  return commitStagedMedia(items, productMediaOperations(productId));
}

export async function adminReorderProductMedia(productId, idsInOrder) {
  const results = await Promise.all(idsInOrder.map((id, i) =>
    supabase.from('product_media').update({ sort_order: i }).eq('id', id).eq('product_id', productId)
  ));
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;
}

// Delete a media row and, if we host the object, remove it from storage too.
// Existing products' seeded primary rows have storage_path=null (bundled /img
// or a pre-existing URL) so nothing is ever deleted from storage for those.
export async function adminDeleteProductMedia(productId, id) {
  const { data: existing, error: readError } = await supabase.from('product_media')
    .select('storage_path').eq('id', id).eq('product_id', productId).maybeSingle();
  if (readError) throw readError;
  if (!existing) return false; // id does not belong to this product — no-op
  const { error } = await supabase.from('product_media').delete().eq('id', id).eq('product_id', productId);
  if (error) throw error;
  const path = existing?.storage_path;
  // Still synchronize the auto-promoted primary if object cleanup fails.
  let cleanupError;
  if (path) { try { await removeMediaObject(path, removeProductMediaObject); } catch (e) { cleanupError = e; } }
  try { await adminEnsurePrimaryMedia(productId); }
  catch (error) {
    if (cleanupError) { error.cleanupPending = cleanupError.cleanupPending; error.message += ' ' + cleanupError.message; }
    throw error;
  }
  if (cleanupError) throw cleanupError;
  return true;
}

// Replace the image on an existing row: upload the new file, point the row at
// it, then remove the old hosted object and synchronize the actual primary.
export async function adminReplaceProductMedia(productId, id, file) {
  const { data: existing, error: readError } = await supabase.from('product_media')
    .select('storage_path').eq('id', id).eq('product_id', productId).maybeSingle();
  if (readError) throw readError;
  if (!existing) throw new Error('That image no longer belongs to this product.');
  const { storagePath, publicUrl } = await uploadProductMediaFile(file);
  const row = await persistUploadedMedia({ storagePath }, async () => {
    const { data, error } = await supabase.from('product_media')
      .update({ storage_path: storagePath, public_url: publicUrl })
      .eq('id', id).eq('product_id', productId).select().single();
    if (error) throw error;
    return dbMediaToApp(data);
  }, (path) => findProductMediaByPath(productId, path), removeProductMediaObject);
  const old = existing?.storage_path;
  let cleanupError;
  if (old && old !== storagePath) { try { await removeMediaObject(old, removeProductMediaObject); } catch (e) { cleanupError = e; } }
  try { await adminEnsurePrimaryMedia(productId); }
  catch (error) {
    if (cleanupError) { error.cleanupPending = cleanupError.cleanupPending; error.message += ' ' + cleanupError.message; }
    throw error;
  }
  if (cleanupError) throw cleanupError;
  return row;
}

// Keep products.image_url in sync with the current primary so the grid,
// search, cart, wishlist and passport (which read product.image) stay correct.
export async function adminSyncPrimaryToProduct(dbId, primaryUrl) {
  if (!dbId) throw new Error('A product id is required to synchronize media.');
  const url = primaryUrl || null;
  const { data, error } = await supabase.from('products')
    .update({ image_url: url, updated_at: new Date().toISOString() }).eq('id', dbId).select('id,image_url').single();
  if (error) throw new Error('Product image synchronization failed: ' + error.message);
  if (!data || data.image_url !== url) throw new Error('Product image synchronization was not confirmed.');
}

// ---- Media importer (server endpoint /api/admin/import-media, admin only) ----
// The admin's Supabase access token proves admin identity to the server, which
// does the SSRF-safe fetch + copy into our storage. Discover never copies;
// import copies only the explicitly selected URLs.
async function adminAuthHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminDiscoverMedia(url) {
  const headers = { 'Content-Type': 'application/json', ...(await adminAuthHeader()) };
  const res = await fetch('/api/admin/import-media', { method: 'POST', headers, body: JSON.stringify({ action: 'discover', url }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Discover failed (${res.status}).`);
  return data; // { source, images: [{url, host}] }
}

export async function adminImportMedia(productId, urls) {
  const headers = { 'Content-Type': 'application/json', ...(await adminAuthHeader()) };
  const res = await fetch('/api/admin/import-media', { method: 'POST', headers, body: JSON.stringify({ action: 'import', productId, urls }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const error = new Error(data.error || `Import failed (${res.status}).`);
    error.details = data; // retain partial results; never blindly re-import them
    throw error;
  }
  return data; // { imported: [...], skipped: [...] }
}

// ---------------------------------------------------------------
// PROMOTIONS  (migration 0017) — marketing posters / offer cards.
//
// DISPLAY LAYER ONLY. A promotion's coupon_code is a string the storefront
// shows and lets the customer copy; it is never resolved against
// public.coupons here and no promotion changes any price, cart total or
// order. Writes are additionally gated by the "promotions admin all" RLS
// policy, so a non-admin session is refused by the database.
// ---------------------------------------------------------------
const PROMO_PLACEMENTS = ['home', 'pdp', 'cart'];
const PROMO_TYPES = ['poster', 'offer'];
const PROMO_THEMES = ['forest', 'cream', 'orange', 'dark', 'minimal'];
const PROMO_MISSING = 'The promotions table does not exist yet. Run supabase/migrations/0017_promotions.sql in the Supabase SQL editor first.';

function isMissingPromotions(error) {
  return error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST106');
}

/**
 * Public read for the storefront bootstrap. Active promotions only; the
 * date-window filter is enforced by RLS and re-checked client-side.
 *
 * Returns NULL when the table has not been migrated yet ("not provisioned",
 * an unknown state) and [] when the table exists but holds no live rows
 * ("the store genuinely has no promotions"). main.jsx applies an array and
 * skips null, so an empty table correctly clears the list while a missing
 * table leaves the starting list alone — which is [] on any deployed host,
 * so nothing is shown either way before the migration runs.
 */
export async function fetchPublicPromotions() {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    if (isMissingPromotions(error)) return null;
    throw error;
  }
  return data || [];
}

/** Every promotion, including drafts / scheduled / expired (admin view). */
export async function adminListPromotions() {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingPromotions(error)) throw new Error(PROMO_MISSING);
    throw error;
  }
  return data || [];
}

// Mirrors the promotions_cta_url_chk DB constraint so an admin gets a clear
// message instead of a raw Postgres check-constraint violation. NULL / '' |
// internal absolute path ("/shop") | absolute https URL only.
function safeAdminCtaUrl(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s === '') return null;
  if (/\s/.test(s)) throw new Error('CTA link cannot contain spaces or line breaks.');
  if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, 500);
  if (/^https:\/\//i.test(s)) return s.slice(0, 500);
  throw new Error('CTA link must be an internal path starting with "/" or an absolute https:// URL.');
}

function promotionRow(p) {
  const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const nullable = (v, max) => { const s = clean(v, max); return s === '' ? null : s; };
  const placements = Array.isArray(p.placements)
    ? [...new Set(p.placements.filter((x) => PROMO_PLACEMENTS.includes(x)))]
    : [];
  return {
    type: PROMO_TYPES.includes(p.type) ? p.type : 'poster',
    title: clean(p.title, 160),
    subtitle: clean(p.subtitle, 320),
    coupon_code: p.coupon_code ? clean(p.coupon_code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '') || null : null,
    cta_text: clean(p.cta_text, 60),
    cta_url: safeAdminCtaUrl(p.cta_url),
    badge_text: clean(p.badge_text, 40),
    image_url: nullable(p.image_url, 1000),
    theme_variant: PROMO_THEMES.includes(p.theme_variant) ? p.theme_variant : 'forest',
    text_align: p.text_align === 'center' ? 'center' : 'left',
    placements,
    is_active: p.is_active !== false,
    starts_at: p.starts_at || null,
    ends_at: p.ends_at || null,
    sort_order: Number(p.sort_order) || 0,
  };
}

/** Only canonical public URLs generated by this client's promo-media bucket. */
export function promoImageStoragePath(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl || /[\s\\%?#]/.test(imageUrl)) return null;
  try {
    const base = new URL(supabase.storage.from('promo-media').getPublicUrl('').data.publicUrl);
    const url = new URL(imageUrl);
    const rawPath = imageUrl.match(/^https?:\/\/[^/]+(\/.*)$/)?.[1];
    const prefix = '/storage/v1/object/public/promo-media/';
    if (!['https:', 'http:'].includes(base.protocol) || base.pathname !== prefix
      || url.origin !== base.origin || url.username || url.password
      || url.search || url.hash || rawPath !== url.pathname || !rawPath.startsWith(prefix)) return null;
    const path = rawPath.slice(prefix.length);
    // The uploader uses ASCII UUID filenames. Reject encoded/ambiguous paths
    // rather than normalizing them into a different object or bucket.
    if (!path || path.split('/').some((s) => !/^[A-Za-z0-9._-]+$/.test(s) || s === '.' || s === '..')) return null;
    return path;
  } catch { return null; }
}

async function readPromotionImage(id) {
  const { data, error } = await supabase.from('promotions').select('id,image_url').eq('id', id).single();
  if (error) throw error;
  if (!data) throw new Error('Promotion could not be read. Reload before retrying.');
  return data;
}

function matchingPromotionImage(query, imageUrl) {
  return imageUrl == null ? query.is('image_url', null) : query.eq('image_url', imageUrl);
}

function referencesSamePromoImage(previousUrl, nextUrl) {
  // Comparison only: URL aliases may preserve a reference, but NEVER authorize
  // deletion. Destructive paths must still pass promoImageStoragePath.
  try {
    const previous = new URL(previousUrl), next = new URL(nextUrl);
    return previous.origin === next.origin
      && decodeURIComponent(previous.pathname) === decodeURIComponent(next.pathname);
  } catch { return false; }
}

async function removePromotionImage(imageUrl, promotionId) {
  const path = promoImageStoragePath(imageUrl);
  if (!path) return false; // External / other-bucket / unproven URLs are never deleted.
  try {
    // An admin may reuse a URL. Preserve an object still used by another promotion.
    const { data: references, error: referenceError } = await supabase.from('promotions')
      .select('id').eq('image_url', imageUrl).neq('id', promotionId).limit(1);
    if (referenceError) throw referenceError;
    if (!Array.isArray(references)) throw new Error('Could not confirm other image references.');
    if (references.length) return false;
    const bucket = supabase.storage.from('promo-media');
    const { error } = await bucket.remove([path]);
    if (error) throw error;
    // A Storage DELETE can return an empty success under RLS. Confirm absence;
    // authorization, bucket errors and an unreadable result are not proof.
    const { data: remaining, error: infoError } = await bucket.info(path);
    const status = Number(infoError?.status || infoError?.statusCode);
    const absent = !remaining && [400, 404].includes(status)
      && (infoError?.code === 'NoSuchKey'
        || (!infoError?.code && /^object not found\.?$/i.test(infoError?.message || '')));
    if (!absent) throw infoError || new Error('Storage object removal was not confirmed.');
    return true;
  } catch (cause) {
    const error = new Error(`Image cleanup unresolved for promo-media/${path}: ${cause.message || String(cause)}`);
    error.cause = cause;
    error.cleanupPending = [path];
    throw error;
  }
}

export async function adminUpsertPromotion(p) {
  const row = promotionRow(p);
  try {
    if (p.id) {
      const previous = await readPromotionImage(p.id);
      const { data, error } = await matchingPromotionImage(
        supabase.from('promotions').update(row).eq('id', p.id), previous.image_url,
      ).select().single();
      if (error) throw error;
      if (!data || data.image_url !== row.image_url) throw new Error('Promotion update could not be confirmed. Reload before retrying; the previous image was not removed.');
      if (previous.image_url !== data.image_url && !referencesSamePromoImage(previous.image_url, data.image_url)) {
        try { await removePromotionImage(previous.image_url, p.id); }
        catch (cleanupError) {
          // The new image has already been saved. Keep that success distinct
          // from the unresolved old-object cleanup; never imply a rolled-back save.
          cleanupError.message = `Promotion saved, but the previous image needs cleanup. ${cleanupError.message}`;
          cleanupError.savedPromotion = data;
          throw cleanupError;
        }
      }
      return data;
    }
    const { data, error } = await supabase.from('promotions').insert(row).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    if (isMissingPromotions(error)) throw new Error(PROMO_MISSING);
    throw error;
  }
}

export async function adminSetPromotionActive(id, isActive) {
  const { error } = await supabase.from('promotions').update({ is_active: !!isActive }).eq('id', id);
  if (error) { if (isMissingPromotions(error)) throw new Error(PROMO_MISSING); throw error; }
}

export async function adminDeletePromotion(id) {
  let imageRemoved = false;
  try {
    const previous = await readPromotionImage(id);
    imageRemoved = await removePromotionImage(previous.image_url, id);
    const { data, error } = await matchingPromotionImage(
      supabase.from('promotions').delete().eq('id', id), previous.image_url,
    ).select('id').single();
    if (error) throw error;
    if (!data) throw new Error('Promotion row deletion could not be confirmed.');
  } catch (cause) {
    const detail = isMissingPromotions(cause) ? PROMO_MISSING : cause.message || String(cause);
    const error = new Error(imageRemoved
      ? `The promo image was removed, but promotion row deletion could not be confirmed. Reload before retrying. ${detail}`
      : `Promotion deletion stopped. ${detail}`);
    error.cause = cause;
    error.imageRemoved = imageRemoved;
    if (cause.cleanupPending) error.cleanupPending = cause.cleanupPending;
    throw error;
  }
}

export async function adminReorderPromotions(idsInOrder) {
  await Promise.all(idsInOrder.map((id, i) =>
    supabase.from('promotions').update({ sort_order: i }).eq('id', id)
  ));
}

const PROMO_IMAGE_MAX_BYTES = 6 * 1024 * 1024; // 6MB — posters should be light

/** Upload a poster / offer image into the dedicated promo-media bucket. */
export async function uploadPromoImage(file) {
  const validated = await validateImageUpload(file, { allowedTypes: MEDIA_ALLOWED_TYPES, maxBytes: PROMO_IMAGE_MAX_BYTES });
  const path = `promo/${cryptoRandomId()}.${validated.extension}`;
  const { error } = await supabase.storage.from('promo-media').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: validated.mime,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('promo-media').getPublicUrl(path);
  return data.publicUrl;
}
