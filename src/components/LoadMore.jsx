import { useEffect, useState } from 'react';

// ============================================================
// Long listings show 24 products, then "Show more" adds 24 at a time (owner,
// 2026-11-09: a 250-product category rendered every card at once, heavy on a
// phone). A new filter, sort or category starts from 24 again.
// ============================================================
export const PAGE = 24;

/**
 * A page at a time, remembered for this list in the tab (2026-11-21, speed): `key` names the
 * list (its path and filters), so back from a product shows as many as were open before.
 */
export function useRememberedShowMore(total, key) {
  const read = () => { try { return Math.max(PAGE, Number(window.sessionStorage.getItem(`sora.shown:${key}`)) || PAGE); } catch { return PAGE; } };
  const [shown, setShown] = useState(read);
  useEffect(() => { setShown(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const more = () => setShown((n) => {
    const next = n + PAGE;
    try { window.sessionStorage.setItem(`sora.shown:${key}`, String(next)); } catch { /* storage blocked */ }
    return next;
  });
  return { shown: Math.min(shown, total), more, left: Math.max(0, total - shown) };
}

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
