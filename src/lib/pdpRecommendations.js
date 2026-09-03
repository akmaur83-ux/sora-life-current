import { isPurchasable } from '../data/products.js';
import { productBrandName } from './homeMerchandising.js';

function productKey(product) {
  return String(product?.id ?? product?.slug ?? '');
}

function categoriesFor(product) {
  const values = product?.categories?.length ? product.categories : [product?.category];
  return new Set(values.filter(Boolean));
}

function recommendationEligible(product) {
  return Boolean(
    product && product.slug && product.isActive !== false &&
    Number(product.stock) > 0 && isPurchasable(product)
  );
}

/**
 * Deterministic PDP recommendations from the real catalogue only:
 * shared category, then shared evidenced brand, then catalogue order.
 */
export function selectPdpRecommendations(current, catalogue, limit = 12) {
  if (!current || !Array.isArray(catalogue) || limit <= 0) return [];

  const currentKey = productKey(current);
  const currentCategories = categoriesFor(current);
  const currentBrand = productBrandName(current).toLocaleLowerCase();
  const candidates = catalogue.filter((product) => (
    recommendationEligible(product) &&
    productKey(product) !== currentKey &&
    product.slug !== current.slug
  ));

  const sameCategory = candidates.filter((product) => (
    [...categoriesFor(product)].some((category) => currentCategories.has(category))
  ));
  const sameBrand = currentBrand
    ? candidates.filter((product) => productBrandName(product).toLocaleLowerCase() === currentBrand)
    : [];

  const result = [];
  const seen = new Set();
  for (const product of [...sameCategory, ...sameBrand, ...candidates]) {
    const key = productKey(product);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(product);
    if (result.length >= limit) break;
  }
  return result;
}
