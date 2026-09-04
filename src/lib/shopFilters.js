export const SHOP_SORTS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'new', label: 'Newest' },
];

export const PRICE_BANDS = [
  { id: 'under-500', label: 'Under ₹500', min: 0, maxExclusive: 500 },
  { id: '500-999', label: '₹500–₹999', min: 500, maxExclusive: 1000 },
  { id: '1000-1999', label: '₹1,000–₹1,999', min: 1000, maxExclusive: 2000 },
  { id: '2000-4999', label: '₹2,000–₹4,999', min: 2000, maxExclusive: 5000 },
  { id: '5000-plus', label: '₹5,000 & above', min: 5000, maxExclusive: Infinity },
];

const SORT_IDS = new Set(SHOP_SORTS.map((item) => item.id));
const HIGHLIGHT_IDS = new Set(['new', 'sale', 'bestseller']);
const PRICE_IDS = new Set(PRICE_BANDS.map((item) => item.id));

function values(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function validValues(value, allowed) {
  return [...new Set(values(value).filter((item) => allowed.has(item)))];
}

export function normalizedShopSort(value) {
  // `featured` was the old ID for this same stable/curated ordering.
  if (value === 'featured') return 'recommended';
  return SORT_IDS.has(value) ? value : 'recommended';
}

export function readShopUrlState(searchParams, categorySlugs = []) {
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(searchParams || '');
  const allowedCategories = new Set(categorySlugs);
  const price = params.get('price');
  return {
    q: (params.get('q') || '').trim(),
    sort: normalizedShopSort(params.get('sort') || ''),
    categories: validValues(params.get('category'), allowedCategories),
    highlights: validValues(params.get('filter'), HIGHLIGHT_IDS),
    inStock: params.get('stock') === '1',
    priceBand: PRICE_IDS.has(price) ? price : null,
  };
}

function setList(params, key, list) {
  if (Array.isArray(list) && list.length) params.set(key, [...new Set(list)].join(','));
  else params.delete(key);
}

export function updateShopUrlState(searchParams, patch) {
  const params = new URLSearchParams(searchParams);
  const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
  if (has('q')) {
    const q = String(patch.q || '').trim();
    if (q) params.set('q', q); else params.delete('q');
  }
  if (has('sort')) {
    const sort = normalizedShopSort(patch.sort);
    if (sort === 'recommended') params.delete('sort'); else params.set('sort', sort);
  }
  if (has('categories')) setList(params, 'category', patch.categories);
  if (has('highlights')) setList(params, 'filter', patch.highlights);
  if (has('inStock')) {
    if (patch.inStock) params.set('stock', '1'); else params.delete('stock');
  }
  if (has('priceBand')) {
    if (PRICE_IDS.has(patch.priceBand)) params.set('price', patch.priceBand);
    else params.delete('price');
  }
  return params;
}

export function productMatchesHighlight(product, highlight) {
  if (highlight === 'new') return product?.isNew === true;
  if (highlight === 'bestseller') return product?.isBestseller === true;
  if (highlight === 'sale') {
    return product?.onSale === true || Number(product?.discountPct) > 0;
  }
  return true;
}

export function productMatchesPriceBand(product, bandId) {
  if (!bandId) return true;
  const band = PRICE_BANDS.find((item) => item.id === bandId);
  if (!band) return true;
  const price = Number(product?.price);
  return Number.isFinite(price) && price >= band.min && price < band.maxExclusive;
}
