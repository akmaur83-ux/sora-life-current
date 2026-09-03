// Pure, deterministic Homepage merchandising selectors.
//
// Every item returned here comes from the hydrated catalogue/category data.
// The selector never creates prices, discounts, ratings, brands or categories;
// sections whose supporting data does not exist simply receive an empty list.

function eligibleProduct(product) {
  return Boolean(
    product && product.id != null && product.slug && product.name &&
    product.isActive !== false && Number(product.stock) > 0
  );
}

function stableProducts(list) {
  return [...list].sort((a, b) =>
    (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
    String(a.id).localeCompare(String(b.id))
  );
}

function distinct(primary, fallback, limit, excluded = new Set()) {
  const result = [];
  const seen = new Set(excluded);
  for (const product of [...primary, ...fallback]) {
    if (!eligibleProduct(product) || seen.has(product.id)) continue;
    seen.add(product.id);
    result.push(product);
    if (result.length === limit) break;
  }
  return result;
}

// Avoid filling a discovery rail with one category when a broad catalogue is
// available. Category order and product order remain deterministic.
function categoryBalanced(list, limit) {
  const groups = new Map();
  for (const product of list) {
    const key = product.category || 'uncategorized';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }
  const output = [];
  let row = 0;
  while (output.length < limit) {
    let added = false;
    for (const products of groups.values()) {
      if (products[row]) {
        output.push(products[row]);
        added = true;
        if (output.length === limit) break;
      }
    }
    if (!added) break;
    row += 1;
  }
  return output;
}

// A broad fallback hero must not silently become a single-brand or
// single-category takeover. Prefer real, imaged products across categories;
// when two candidates represent the same category, brand diversity breaks the
// tie. The output remains stable for the same hydrated catalogue.
export function selectMarketplaceHeroProducts(productList, limit = 6) {
  const available = stableProducts((Array.isArray(productList) ? productList : [])
    .filter((product) => eligibleProduct(product) && product.image));
  const preferred = [
    ...available.filter((product) => product.isFeatured),
    ...available.filter((product) => product.isNew),
    ...available,
  ];
  const unique = distinct(preferred, available, available.length);
  const balanced = categoryBalanced(unique, Math.max(0, limit));

  if (balanced.length <= 1) return balanced;

  const result = [];
  const remaining = [...balanced];
  const brands = new Set();
  while (remaining.length && result.length < limit) {
    const nextIndex = remaining.findIndex((product) => {
      const brand = productBrandName(product);
      return brand && !brands.has(brand.toLocaleLowerCase());
    });
    const [next] = remaining.splice(nextIndex >= 0 ? nextIndex : 0, 1);
    result.push(next);
    const brand = productBrandName(next);
    if (brand) brands.add(brand.toLocaleLowerCase());
  }
  return result;
}

function cleanBrand(value) {
  const brand = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return brand && brand.length <= 60 ? brand : '';
}

export function productBrandName(product) {
  const explicit = cleanBrand(product?.brand || product?.brandName || product?.manufacturer);
  if (explicit) return explicit;

  // These two names are only inferred when they are literally present in the
  // catalogue record (name/category) or its existing source URL.
  const evidence = `${product?.name || ''} ${product?.category || ''}`;
  if (/\bmom[\s-]*trust\b/i.test(evidence)) return 'Mom Trust';
  try {
    const host = new URL(product?.permalink || '').hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'biosash.com' || host.endsWith('.biosash.com')) return 'Biosash';
    if (/^mom-?trust\./.test(host) || host.includes('momtrust')) return 'Mom Trust';
  } catch {
    // Missing/relative source URLs carry no usable brand evidence.
  }
  return '';
}

export function selectHomeMerchandising(productList, categoryList) {
  const available = stableProducts((Array.isArray(productList) ? productList : []).filter(eligibleProduct));
  const categories = (Array.isArray(categoryList) ? categoryList : [])
    .filter((category) => category?.slug && category?.name);

  const featured = available.filter((product) => product.isFeatured);
  const discounted = available.filter((product) => product.onSale || Number(product.discountPct) > 0);
  const trending = categoryBalanced(distinct(featured, discounted, Math.min(8, available.length)), 8);
  const trendingFilled = distinct(trending, categoryBalanced(available, 8), Math.min(8, available.length));

  const trendingIds = new Set(trendingFilled.map((product) => product.id));
  const newProducts = available.filter((product) => product.isNew);
  const discover = distinct(newProducts, [...available].reverse(), 5, trendingIds);
  const discoverFilled = discover.length >= 4 ? discover : distinct(discover, available, 5);

  const flaggedPopular = available.filter((product) => product.isBestseller);
  const popularIsVerified = flaggedPopular.length >= 4;
  const priorIds = new Set([...trendingFilled, ...discoverFilled].map((product) => product.id));
  const popular = popularIsVerified
    ? distinct(flaggedPopular, [], 8)
    : distinct(categoryBalanced(available, 8), available, 8, priorIds);
  const popularFilled = popular.length >= 4 ? popular : distinct(popular, available, 8);

  const brandMap = new Map();
  for (const product of available) {
    const name = productBrandName(product);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (!brandMap.has(key)) brandMap.set(key, { name, products: [] });
    brandMap.get(key).products.push(product);
  }
  const brands = [...brandMap.values()]
    .sort((a, b) => b.products.length - a.products.length || a.name.localeCompare(b.name))
    .slice(0, 4);

  const collections = categories.map((category) => ({
    category,
    products: available.filter((product) =>
      (product.categories || [product.category]).includes(category.slug)
    ).slice(0, 4),
  })).filter((collection) => collection.products.length > 0).slice(0, 4);

  const momCategory = categories.find((category) => /mom[\s-]*trust/i.test(`${category.slug} ${category.name}`));
  const momProducts = available.filter((product) =>
    productBrandName(product) === 'Mom Trust' ||
    (momCategory && (product.categories || [product.category]).includes(momCategory.slug))
  ).slice(0, 6);

  return {
    available,
    trending: trendingFilled,
    discover: discoverFilled,
    discoverLink: newProducts.length ? '/shop?filter=new' : '/shop',
    popular: popularFilled,
    popularTitle: popularIsVerified ? 'Bestsellers' : 'Worth discovering',
    popularEyebrow: popularIsVerified ? 'Catalogue favourites' : 'Across the marketplace',
    brands,
    collections,
    momCategory,
    momProducts,
  };
}
