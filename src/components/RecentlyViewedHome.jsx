import { useEffect, useState } from 'react';
import { SlidingRail } from './HomeCategoryRails.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { readRecentlyViewed, clearRecentlyViewed } from './pdp/PdpOwnerKit.jsx';

// ============================================================
// "Continue where you left off" on the wellness homepage (owner, 2026-11-08: more
// features): the products this visitor opened most recently, in any store, newest
// first — the same list the product pages keep (PdpOwnerKit, this browser only,
// nothing sent anywhere). Two or more to show; fewer renders nothing. "Clear"
// forgets the list. Editable in Storefronts → Wellness (hide, heading).
// ============================================================
export const RECENT_SECTION = Object.freeze({ hidden: false, title: 'Continue where you left off', more: '', link: '' });

/** `prefix` keeps one store's products ('fs-' Fashion, 'hl-' Home & Living); none keeps all. */
export default function RecentlyViewedHome({ prefix = '' } = {}) {
  const section = useStorefrontSection('wellness', 'recentlyViewed', RECENT_SECTION);
  const [items, setItems] = useState([]);
  useEffect(() => { setItems(readRecentlyViewed().filter((r) => r && r.href && r.name && r.price > 0 && String(r.key || '').startsWith(prefix))); }, [prefix]);
  if (section.hidden || items.length < 2) return null;
  return (
    <div className="hx-recent">
      <SlidingRail id="recent" label="Recently viewed" section={{ ...section, more: '' }} defaults={RECENT_SECTION}
        link="" items={items.slice(0, 12).map((r) => ({ ...r, whole: true }))} />
      <div className="hx-wrap hx-recent__foot">
        <button type="button" className="hx-recent__clear" onClick={() => { clearRecentlyViewed(); setItems([]); }}>Clear history</button>
      </div>
    </div>
  );
}
