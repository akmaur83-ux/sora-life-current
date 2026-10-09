// ============================================================
// Where the window should be after a navigation — the rules ScrollManager
// (src/components/ScrollManager.jsx) applies on every route change, in all
// five storefronts and the admin. Pure: no DOM here.
//
//   back / forward (POP)        → the position that history entry had, if we
//                                 saw it; else as a new page
//   a #hash                     → that anchor (on a new page, the top first,
//                                 in case the anchor is not rendered yet)
//   a new path                  → the top
//   only the query string       → left alone (filters, sort, variant choice,
//                                 admin tabs)
//   first load / reload         → the saved position for this entry, else
//                                 the anchor, else left to the browser
// ============================================================

export const SCROLL_STORAGE_KEY = 'sora-scroll-positions';
export const MAX_SCROLL_ENTRIES = 200;

/**
 * The history entry's identity. React Router gives every entry it creates a
 * key; entries it did not create (the first page load, a plain <a href="#x">)
 * are all "default", so those are told apart by their full path.
 */
export function entryKey(location) {
  const path = `${location.pathname}${location.search || ''}${location.hash || ''}`;
  return !location.key || location.key === 'default' ? `default:${path}` : location.key;
}

/** The anchor a hash names, or null ("#" and "#top"-less empties name none). */
export function anchorId(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return null;
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/**
 * @param action  'POP' | 'PUSH' | 'REPLACE' (useNavigationType)
 * @param prev    the previous location, or null on the first render
 * @param next    the location now
 * @param saved   the remembered scroll position for next's entry, or undefined
 * @param anchorClicked  true when a plain <a href="#x"> was just clicked: the browser reports
 *                that as a POP, and its entry shares a key with every earlier visit to the
 *                same #x, so a remembered position must not win over the anchor
 * @returns { kind: 'restore', y } | { kind: 'anchor', id, top } | { kind: 'top' } | { kind: 'none' }
 *          (`top` on an anchor: go to the top first while the anchor renders, and stay there if it never does)
 */
export function scrollDecision({ action, prev, next, saved, anchorClicked = false }) {
  const id = anchorId(next.hash);
  const newPath = !prev || prev.pathname !== next.pathname;
  const remembered = Number.isFinite(saved) && saved >= 0 && !(anchorClicked && id);
  if (!prev) {
    if (remembered) return { kind: 'restore', y: saved };
    return id ? { kind: 'anchor', id, top: false } : { kind: 'none' };
  }
  if (action === 'POP' && remembered) return { kind: 'restore', y: saved };
  if (id) return { kind: 'anchor', id, top: newPath };
  return newPath ? { kind: 'top' } : { kind: 'none' };
}

/** Remembered positions, oldest first, at most MAX_SCROLL_ENTRIES. */
export function rememberPosition(positions, key, y) {
  positions.delete(key);
  positions.set(key, Math.max(0, Math.round(y)));
  while (positions.size > MAX_SCROLL_ENTRIES) positions.delete(positions.keys().next().value);
  return positions;
}

export function readPositions(storage) {
  try {
    const list = JSON.parse(storage?.getItem(SCROLL_STORAGE_KEY) || '[]');
    return new Map((Array.isArray(list) ? list : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1])).slice(-MAX_SCROLL_ENTRIES));
  } catch { return new Map(); }
}

export function writePositions(storage, positions) {
  try { storage?.setItem(SCROLL_STORAGE_KEY, JSON.stringify([...positions])); } catch { /* private mode, quota: positions just do not survive a reload */ }
}
