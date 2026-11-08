import { Link } from 'react-router-dom';
import { money } from '../lib/format.js';

// ============================================================
// The live suggestions under a store's search box (searchMatch.js has the rule):
// up to six products with a picture, name and price, then "See all results".
// The search box owns the open state and the keyboard; this only draws the list.
// `active` is the highlighted row (-1 none); `onPick` closes the list.
// ============================================================
export const SUGGEST_MAX = 6;
/** A partner CDN picture asked for at thumbnail size (Shopify resizes on `width`). */
const thumb = (src) => String(src).replace(/([?&])width=\d+/, '$1width=120');

export default function SearchSuggest({ id, items, query, active = -1, allHref, onPick }) {
  if (!items) return null;
  const shown = items.slice(0, SUGGEST_MAX);
  return (
    <div className="hx-suggest" id={id} role="listbox" aria-label="Search suggestions">
      {shown.length === 0 ? (
        <p className="hx-suggest__none">No products match “{query}”.</p>
      ) : shown.map((p, i) => (
        <Link key={p.key} id={`${id}-${i}`} role="option" aria-selected={i === active} to={p.href} className={`hx-suggest__item${i === active ? ' is-on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={onPick}>
          <span className="hx-suggest__img">{p.image && <img src={thumb(p.image)} alt="" width="44" height="44" decoding="async" />}</span>
          <span className="hx-suggest__name">{p.name}{p.brand && <em>{p.brand}</em>}</span>
          {p.price > 0 && <b className="hx-suggest__price">{money(p.price)}</b>}
        </Link>
      ))}
      {items.length > 0 && allHref && (
        <Link to={allHref} className="hx-suggest__all" onMouseDown={(e) => e.preventDefault()} onClick={onPick}>
          See all {items.length} {items.length === 1 ? 'result' : 'results'} for “{query}”
        </Link>
      )}
    </div>
  );
}

/** Keyboard for a search box with suggestions: ↓ ↑ move, Enter opens the highlighted one, Escape closes. */
export function suggestKeys(e, { count, active, setActive, open, setOpen, go }) {
  if (e.key === 'Escape') { setOpen(false); setActive(-1); return; }
  if (!open || count === 0) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % count); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active <= 0 ? count - 1 : active - 1); }
  else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); go(active); }
}
