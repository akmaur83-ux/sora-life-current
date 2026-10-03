import { buildTree, validatePlacement } from './fashion.js';
import { safeVisualUrl } from './homepageAppearance.js';

export const CATALOGUE_STORES = { fashion: 'Fashion', homeliving: 'Home & Living' };
export function requireCatalogueStore(store) {
  if (!Object.hasOwn(CATALOGUE_STORES, store)) throw new Error('Choose Fashion or Home & Living.');
  return store;
}
const text = (value) => String(value ?? '').trim();
export const catalogueSlug = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function slug(value, name) {
  const result = text(value) || catalogueSlug(name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(result)) throw new Error('Use lowercase letters, numbers and hyphens in the slug.');
  return result;
}
function number(value, label, { integer = false, optional = false, min = 0, max = 99999999.99 } = {}) {
  if (optional && (value == null || text(value) === '')) return null;
  const n = Number(value);
  if (value == null || text(value) === '' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`${label} must be a valid ${integer ? 'whole number' : 'amount'} between ${min} and ${max}.`);
  return n;
}
export function categoryOptions(categories) {
  const tree = buildTree(categories);
  return tree.list.map((row) => ({ ...row, label: tree.ancestors(row.id).map((item) => item.name).join(' / ') }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
export function catalogueProductPayload(input, categories) {
  const name = text(input.name);
  if (!name) throw new Error('Enter a product name.');
  const category = categories.find((row) => row.id === input.category_id);
  if (!category) throw new Error('Choose a category in this store.');
  if (input.is_active && buildTree(categories).ancestors(category.id).some((row) => !row.is_active)) throw new Error('Activate this category and its parent categories before publishing.');
  const mrp = number(input.mrp, 'MRP', { min: 0.01 });
  const sale_price = number(input.sale_price, 'Selling price', { optional: true, min: 0.01, max: mrp });
  const sku = text(input.sku) || null;
  if (sku && !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(sku)) throw new Error('SKU must be 1–64 letters, numbers, dots, slashes, hyphens or underscores.');
  return {
    name, slug: slug(input.slug, name), category_id: category.id, brand: text(input.brand), description: text(input.description),
    mrp, sale_price, sku, net_content: text(input.net_content) || null,
    stock: number(input.stock ?? 0, 'Stock', { integer: true, max: 2147483647 }),
    sort_order: number(input.sort_order ?? 0, 'Display order', { integer: true, min: -2147483648, max: 2147483647 }),
    is_active: input.is_active === true, is_new: input.is_new === true, is_bestseller: input.is_bestseller === true,
  };
}
export function catalogueCategoryPayload(input, categories, id = null) {
  const name = text(input.name);
  if (!name) throw new Error('Enter a category name.');
  const parent_id = input.parent_id || null;
  if (parent_id && !categories.some((row) => row.id === parent_id)) throw new Error('Choose a parent category in this store.');
  const placement = validatePlacement(categories, { id, parentId: parent_id });
  if (!placement.ok) throw new Error('Categories allow up to three levels and cannot contain a circular parent.');
  const image_url = text(input.image_url) ? safeVisualUrl(input.image_url) : null;
  if (text(input.image_url) && !image_url) throw new Error('Enter a public HTTPS image URL or a local image path.');
  return { name, slug: slug(input.slug, name), parent_id, tagline: text(input.tagline), image_url,
    sort_order: number(input.sort_order ?? 0, 'Display order', { integer: true, min: -2147483648, max: 2147483647 }), is_active: input.is_active !== false };
}
export function catalogueVariantPayload(input, store) {
  requireCatalogueStore(store);
  const size = text(input.size), colour = text(input.colour);
  if (!size || (store === 'fashion' && !colour)) throw new Error('Enter a size and, for Fashion, a colour. Use “One size” / “Default” for a single option.');
  const colour_hex = text(input.colour_hex) || null;
  if (colour_hex && !/^#[0-9a-f]{6}$/i.test(colour_hex)) throw new Error('Colour hex must look like #123ABC.');
  return { size, colour, colour_hex, sku: text(input.sku) || null,
    stock: number(input.stock, 'Variant stock', { integer: true, max: 2147483647 }),
    price_override: number(input.price_override, 'Variant price', { optional: true, min: 0.01 }),
    is_active: input.is_active !== false,
    sort_order: number(input.sort_order ?? 0, 'Display order', { integer: true, min: -2147483648, max: 2147483647 }) };
}
export function assertCataloguePublishable(store, product) {
  requireCatalogueStore(store);
  if (!(product.images || []).some((url) => safeVisualUrl(url))) throw new Error('Add a product image before publishing.');
  if (store === 'fashion' && !(product.variants || []).some((row) => row.is_active !== false)) throw new Error('Add at least one active size/colour variant with stock before publishing. Zero stock is allowed for sold-out products.');
}
export function catalogueProductHref(store, slug) {
  requireCatalogueStore(store);
  return `/${store}/p/${encodeURIComponent(slug)}`;
}
