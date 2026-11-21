// ============================================================
// Skeleton loading (2026-11-13 redesign): while a product list loads, shimmering
// card shapes in its place instead of a line of text, so the page holds its shape
// and feels quicker. The words are still there for screen readers (role="status").
// Styles: sora-ds.css (.sora-skel*). Nothing moves under prefers-reduced-motion.
// ============================================================
export default function SkeletonGrid({ count = 8, label = 'Loading…', className = '' }) {
  return (
    <div role="status" className={className}>
      <span className="sora-sr">{label}</span>
      <ul className="sora-skel-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="sora-skel-card">
            <span className="sora-skel sora-skel--img" />
            <span className="sora-skel sora-skel--line" />
            <span className="sora-skel sora-skel--short" />
            <span className="sora-skel sora-skel--price" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A product page's shape while its catalogue loads (round 35, 2026-11-21): the picture, the
 * name, the price and the button as soft blocks — the page reads as arriving, not empty.
 */
export function SkeletonPdp({ label = 'Loading the product…' }) {
  return (
    <div role="status" className="sora-skel-pdp">
      <span className="sora-sr">{label}</span>
      <span className="sora-skel sora-skel-pdp__img" aria-hidden="true" />
      <div className="sora-skel-pdp__info" aria-hidden="true">
        <span className="sora-skel sora-skel--short" />
        <span className="sora-skel sora-skel-pdp__title" />
        <span className="sora-skel sora-skel-pdp__title sora-skel-pdp__title--2" />
        <span className="sora-skel sora-skel--price" />
        <span className="sora-skel sora-skel-pdp__btn" />
        <span className="sora-skel sora-skel--line" />
        <span className="sora-skel sora-skel--line" />
      </div>
    </div>
  );
}
