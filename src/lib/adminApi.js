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
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${folder}/${cryptoRandomId()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: opts.cacheControl || '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImage(file, folder = 'products') {
  return uploadToBucket('product-images', file, folder);
}

const MAX_HERO_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB — generous local guard; Supabase project limits still apply

export async function uploadHeroVideo(file) {
  if (!file.type?.startsWith('video/')) throw new Error('Please choose a video file (MP4 recommended).');
  if (file.size > MAX_HERO_VIDEO_BYTES) throw new Error(`Video is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Keep it under 100MB.`);
  return uploadToBucket('hero-media', file, 'video', { cacheControl: '31536000' });
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
