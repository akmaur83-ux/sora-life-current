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
