import { useEffect, useState } from 'react';

// ============================================================
// Long listings show 24 products, then "Show more" adds 24 at a time (owner,
// 2026-11-09: a 250-product category rendered every card at once, heavy on a
// phone). A new filter, sort or category starts from 24 again.
// ============================================================
export const PAGE = 24;

export function useShowMore(total, resetKey) {
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [resetKey]);
  return { shown: Math.min(shown, total), more: () => setShown((n) => n + PAGE), left: Math.max(0, total - shown) };
}

export default function LoadMore({ shown, total, onMore, cls = '' }) {
  if (total <= shown) return null;
  return (
    <div className={`hx-more-wrap ${cls}`.trim()}>
      <p className="hx-more-wrap__n">Showing {shown} of {total}</p>
      <div className="hx-more-wrap__bar" aria-hidden="true"><i style={{ width: `${Math.round((shown / total) * 100)}%` }} /></div>
      <button type="button" className="hx-more-wrap__btn" onClick={onMore}>Show {Math.min(PAGE, total - shown)} more</button>
    </div>
  );
}
