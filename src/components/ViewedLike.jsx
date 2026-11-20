import { SlidingRail } from './HomeCategoryRails.jsx';
import { readRecentlyViewed } from './pdp/PdpOwnerKit.jsx';
import { products, productBySlug } from '../data/products.js';
import { useViewedLike } from '../lib/viewedLike.js';

// More like what you viewed (round 15, 2026-11-20) — viewedLike.js has the rules.
export const LIKE_SECTION = Object.freeze({ hidden: false, title: 'More like what you viewed', more: '', link: '' });

export default function ViewedLike() {
  const recent = typeof window !== 'undefined' ? readRecentlyViewed() : [];
  const items = useViewedLike(recent, productBySlug, products);
  if (!items.length) return null;
  return (
    <div className="hx-wv-range">
      <SlidingRail id="viewedlike" label="More like what you viewed" section={LIKE_SECTION} defaults={LIKE_SECTION} link="" items={items} />
    </div>
  );
}
