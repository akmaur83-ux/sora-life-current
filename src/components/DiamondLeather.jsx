import { SlidingRail } from './HomeCategoryRails.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { DIAMOND_SECTION, DIAMOND_LISTING, useDiamondRange } from '../lib/diamondLeather.js';

// ============================================================
// Diamond Leather (partner, 2026-11-16) — diamondLeather.js has what is shown and why:
// the sliding row of their men's leather jackets, on the Fashion home.
// ============================================================
export { DIAMOND_SECTION };

/** `items` is for a test; the page passes nothing and the live catalogue is read. */
export function DiamondLeatherRange({ items: given, autoplayMs } = {}) {
  const section = useStorefrontSection('wellness', 'diamondLeather', DIAMOND_SECTION);
  const loaded = useDiamondRange();
  const items = (given ?? loaded) || [];
  return (
    <div className="hx-wv-range">
      <SlidingRail id="diamond" label="Diamond Leather jackets" section={section} defaults={DIAMOND_SECTION}
        link={section.link || DIAMOND_LISTING} items={items} {...(autoplayMs ? { autoplayMs } : {})} />
    </div>
  );
}
