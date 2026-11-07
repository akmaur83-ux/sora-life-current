import { productBrandName } from './homeMerchandising.js';

// ============================================================
// The Biosash range on the wellness homepage: Biosash's own products from the
// wellness catalogue (148 of the 194 live ones on 2026-11-07), in the order the
// catalogue already puts them in, twelve at most.
//
// A product is Biosash's when productBrandName says so — its brand field, or a
// source page on biosash.com — the same rule the homepage's brand rows use.
// Only what can be bought right now: in stock, with a verified price and a page
// to link to. Never padded; none, and the section renders nothing.
// ============================================================
export const BIOSASH_RANGE_LIMIT = 12;

/** The section's built-in content (Storefronts → Wellness); an empty link is the shop. */
export const BIOSASH_SECTION = Object.freeze({ hidden: false, title: 'The Biosash Range', more: 'View All', link: '' });

const isBiosash = (product) => productBrandName(product).toLowerCase() === 'biosash';

/** The cards: { key, name, href, price, image, whole }, the catalogue's order kept. Packshots, so drawn whole. */
export function selectBiosashRange(list = [], limit = BIOSASH_RANGE_LIMIT) {
  const items = [];
  for (const p of Array.isArray(list) ? list : []) {
    if (items.length >= limit) break;
    if (!p?.slug || !(Number(p.stock) > 0) || !p.priceVerified || !(Number(p.price) > 0) || !isBiosash(p)) continue;
    items.push({
      key: `wellness-${p.id}`, name: String(p.name || '').trim(), href: `/product/${p.slug}`,
      price: Number(p.price), image: p.image || null, whole: true,
    });
  }
  return items;
}
