import { SlidingRail } from './HomeCategoryRails.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { selectBiosashRange, BIOSASH_SECTION } from '../lib/biosashRange.js';
import { products } from '../data/products.js';

// ============================================================
// The Biosash range on the wellness homepage (owner, 2026-11-07): Biosash's own
// products in a sliding row, straight after New Arrivals — the place Luxury Beds
// held, which moved down the page. The same row as New Arrivals and the bedroom
// rails (SlidingRail), packshots drawn whole on white as New Arrivals draws them.
//
// Which products: biosashRange.js — Biosash's, in stock, priced, the catalogue's
// order, twelve at most. Editable in Storefronts → Wellness: hide, heading,
// View-all label and link (empty: the shop). None to show, or hidden: no section.
// ============================================================
export { BIOSASH_SECTION };

/** `items` is for a test; the page passes nothing and the live catalogue is read. */
export function BiosashRange({ items: given, autoplayMs } = {}) {
  const section = useStorefrontSection('wellness', 'biosash', BIOSASH_SECTION);
  const items = given ?? selectBiosashRange(products);
  return (
    <SlidingRail id="biosash" label="Biosash products" section={section} defaults={BIOSASH_SECTION}
      link={section.link || '/shop'} items={items} {...(autoplayMs ? { autoplayMs } : {})} />
  );
}
