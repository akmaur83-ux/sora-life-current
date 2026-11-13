import { Link } from 'react-router-dom';
import { usePopularSearches } from '../lib/insights.js';
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

// ---- Recent searches (this browser only, per store) -----------------------------------
const RECENT_MAX = 6;
const recentKey = (store) => `sora.search.recent.${store}`;
export function readRecentSearches(store) {
  try { const v = JSON.parse(window.localStorage.getItem(recentKey(store)) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENT_MAX) : []; } catch { return []; }
}
export function rememberSearch(store, term) {
  const t = String(term || '').trim().slice(0, 60);
  if (t.length < 2) return;
  try { const cur = readRecentSearches(store).filter((x) => x.toLowerCase() !== t.toLowerCase()); window.localStorage.setItem(recentKey(store), JSON.stringify([t, ...cur].slice(0, RECENT_MAX))); } catch { /* storage off */ }
}
export function clearRecentSearches(store) { try { window.localStorage.removeItem(recentKey(store)); } catch { /* storage off */ } }

/** With nothing typed yet: the last searches, each a link to its results, and Clear. */
export function RecentSearches({ id, terms, hrefFor, onPick, onClear, popular = [] }) {
  const hasTerms = terms && terms.length > 0;
  // Trending searches (2026-11-13): what shoppers actually searched (3+ times in two weeks, with results).
  const trending = usePopularSearches().filter((t) => !(terms || []).some((x) => x.toLowerCase() === t)).slice(0, 6);
  if (!hasTerms && popular.length === 0 && trending.length === 0) return null;
  return (
    <div className="hx-suggest hx-suggest--recent" id={id} aria-label={hasTerms ? 'Recent searches' : 'Popular categories'}>
      {hasTerms && <>
        <p className="hx-suggest__head">Recent searches <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClear}>Clear</button></p>
        {terms.map((t) => (
          <Link key={t} to={hrefFor(t)} className="hx-suggest__recent" onMouseDown={(e) => e.preventDefault()} onClick={onPick}>{t}</Link>
        ))}
      </>}
      {trending.length > 0 && <>
        <p className="hx-suggest__head">Trending searches</p>
        <div className="hx-suggest__chips">
          {trending.map((t) => <Link key={t} to={hrefFor(t)} className="hx-suggest__chip" onMouseDown={(e) => e.preventDefault()} onClick={onPick}>{t}</Link>)}
        </div>
      </>}
      {/* Nothing typed and nothing searched yet: the store's categories, one tap away (2026-11-09). */}
      {popular.length > 0 && <>
        <p className="hx-suggest__head">Popular categories</p>
        <div className="hx-suggest__chips">
          {popular.slice(0, 8).map((c) => <Link key={c.href} to={c.href} className="hx-suggest__chip" onMouseDown={(e) => e.preventDefault()} onClick={onPick}>{c.name}</Link>)}
        </div>
      </>}
    </div>
  );
}

/** "Did you mean …?" — a corrected search (searchMatch.js didYouMean) as a link to its results. */
export function DidYouMean({ fix, href, onPick, className = '' }) {
  if (!fix) return null;
  return (
    <p className={`hx-dym${className ? ` ${className}` : ''}`}>
      Did you mean <Link to={href} onMouseDown={(e) => e.preventDefault()} onClick={onPick}>{fix}</Link>?
    </p>
  );
}

export default function SearchSuggest({ id, items, query, active = -1, allHref, onPick, fix = '', fixHref = '' }) {
  if (!items) return null;
  const shown = items.slice(0, SUGGEST_MAX);
  return (
    <div className="hx-suggest" id={id} role="listbox" aria-label="Search suggestions">
      {shown.length === 0 ? (
        <>
          <p className="hx-suggest__none">No products match “{query}”.</p>
          <DidYouMean fix={fix} href={fixHref} onPick={onPick} className="hx-dym--suggest" />
        </>
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
