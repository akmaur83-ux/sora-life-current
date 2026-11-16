import { SlidingRail } from './HomeCategoryRails.jsx';
import { productBySlug } from '../data/products.js';
import { usePopular } from '../lib/popular.js';

// ============================================================
// Popular this week (round 9, 2026-11-16): the products people opened most in the last
// seven days, across the stores (lib/popular.js has the rules). Nothing to show, no row.
// ============================================================
export const POPULAR_SECTION = Object.freeze({ hidden: false, title: 'Popular this week', more: 'All categories', link: '/categories' });

export default function PopularThisWeek({ items: given } = {}) {
  const loaded = usePopular(productBySlug);
  const items = given ?? loaded;
  if (!items.length) return null;
  return (
    <div className="hx-wv-range">
      <SlidingRail id="popular" label="Popular products" section={POPULAR_SECTION} defaults={POPULAR_SECTION} link={POPULAR_SECTION.link} items={items} />
    </div>
  );
}
