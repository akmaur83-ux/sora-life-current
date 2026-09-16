import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  FASHION_SORTS, FASHION_PRICE_BANDS, DISCOUNT_STEPS, RATING_STEPS,
  readFashionUrlState, updateFashionUrlState, activeFilterCount, filterOptions, applyListing,
  resolveCategory, breadcrumbFor, categoryScope, categoryHref,
} from '../lib/fashion.js';
import { useFashionWishlist } from '../lib/fashionWishlist.js';
import { useFashionCatalogue } from './FashionCatalogue.jsx';
import { CategoryChips } from './FashionLayout.jsx';
import FashionProductCard from './FashionProductCard.jsx';

// ============================================================
// The listing — /fashion/c/<slug> at any level, /fashion/search and
// /fashion/wishlist all render this. Every filter, the sort and the view
// live in the URL (readFashionUrlState / updateFashionUrlState), so a
// listing is shareable and the back button restores it.
// ============================================================

export function Breadcrumb({ trail }) {
  return (
    <nav className="fs-crumb" aria-label="Breadcrumb">
      <ol>
        {trail.map((c, i) => (
          <li key={c.href || c.name}>
            {i < trail.length - 1 && c.href ? <Link to={c.href}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Check({ checked, onChange, children, swatch = null }) {
  return (
    <label className={`fs-filter__opt${checked ? ' is-on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {swatch && <span className="fs-filter__swatch" style={{ background: swatch }} aria-hidden="true" />}
      <span>{children}</span>
    </label>
  );
}

export function FilterPanel({ state, options, onPatch, onClear, onClose = null, id = 'fs-filters' }) {
  const toggle = (key, value) => onPatch({ [key]: state[key].includes(value) ? state[key].filter((v) => v !== value) : [...state[key], value] });
  const count = activeFilterCount(state);
  return (
    <aside className="fs-filters" id={id} aria-label="Filters">
      <header className="fs-filters__head">
        <strong>Filters{count ? ` (${count})` : ''}</strong>
        {count > 0 && <button type="button" className="fs-filters__clear" onClick={onClear}>Clear all</button>}
        {onClose && <button type="button" className="fs-filters__x" aria-label="Close filters" onClick={onClose}><Icon name="x" size={18} /></button>}
      </header>
      <fieldset className="fs-filter"><legend>Price</legend>
        {FASHION_PRICE_BANDS.map((b) => (
          <label key={b.id} className={`fs-filter__opt${state.price === b.id ? ' is-on' : ''}`}>
            <input type="radio" name="price" checked={state.price === b.id} onChange={() => onPatch({ price: state.price === b.id ? null : b.id })} onClick={() => { if (state.price === b.id) onPatch({ price: null }); }} />
            <span>{b.label}</span>
          </label>
        ))}
      </fieldset>
      {options.sizes.length > 0 && (
        <fieldset className="fs-filter"><legend>Size</legend>
          <div className="fs-filter__sizes">
            {options.sizes.map((s) => <Check key={s} checked={state.sizes.includes(s)} onChange={() => toggle('sizes', s)}>{s}</Check>)}
          </div>
        </fieldset>
      )}
      {options.colours.length > 0 && (
        <fieldset className="fs-filter"><legend>Colour</legend>
          {options.colours.map((c) => <Check key={c.colour} checked={state.colours.includes(c.colour)} onChange={() => toggle('colours', c.colour)} swatch={c.hex || '#D9CBB0'}>{c.colour}</Check>)}
        </fieldset>
      )}
      {options.brands.length > 0 && (
        <fieldset className="fs-filter"><legend>Brand</legend>
          {options.brands.map((b) => <Check key={b} checked={state.brands.includes(b)} onChange={() => toggle('brands', b)}>{b}</Check>)}
        </fieldset>
      )}
      <fieldset className="fs-filter"><legend>Discount</legend>
        {DISCOUNT_STEPS.map((d) => (
          <label key={d} className={`fs-filter__opt${state.discount === d ? ' is-on' : ''}`}>
            <input type="radio" name="discount" checked={state.discount === d} onChange={() => onPatch({ discount: d })} onClick={() => { if (state.discount === d) onPatch({ discount: null }); }} />
            <span>{d}% or more</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="fs-filter"><legend>Rating</legend>
        {RATING_STEPS.map((r) => (
          <label key={r} className={`fs-filter__opt${state.rating === r ? ' is-on' : ''}`}>
            <input type="radio" name="rating" checked={state.rating === r} onChange={() => onPatch({ rating: r })} onClick={() => { if (state.rating === r) onPatch({ rating: null }); }} />
            <span><Icon name="star" size={13} fill="currentColor" /> {r}★ &amp; above</span>
          </label>
        ))}
      </fieldset>
    </aside>
  );
}

export function Listing({ title, trail, scope = null, only = null, intro = null, emptyCopy }) {
  const { status, tree, views } = useFashionCatalogue();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => readFashionUrlState(params), [params]);
  const [panel, setPanel] = useState(false);
  useEffect(() => { if (!panel) return undefined; const onKey = (e) => { if (e.key === 'Escape') setPanel(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [panel]);

  const pool = only ? views.filter(only) : views;
  const inScope = scope ? pool.filter((v) => v.category_id && scope.has(v.category_id)) : pool;
  const options = useMemo(() => filterOptions(inScope), [inScope]);
  const results = applyListing(pool, state, scope);
  const patch = (p) => setParams(updateFashionUrlState(params, p));
  const clear = () => setParams(updateFashionUrlState(params, { price: null, sizes: [], colours: [], brands: [], discount: null, rating: null }));
  const count = activeFilterCount(state);

  return (
    <div className="fs-listing">
      <CategoryChips onFilters={() => setPanel((v) => !v)} filterCount={count} />
      <Breadcrumb trail={trail} />
      {intro}
      <div className="fs-listing__bar">
        <h1 className="fs-listing__h serif">{title}</h1>
        <p className="fs-listing__count" role="status">{status === 'loading' ? 'Loading…' : `${results.length} ${results.length === 1 ? 'product' : 'products'}`}</p>
        <div className="fs-listing__tools">
          <label className="fs-sort">
            <span>Sort by:</span>
            <select value={state.sort} onChange={(e) => patch({ sort: e.target.value })} aria-label="Sort">
              {FASHION_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <Icon name="chevronDown" size={15} />
          </label>
          <div className="fs-view" role="group" aria-label="Layout">
            <button type="button" className={state.view === 'grid' ? 'is-on' : ''} aria-pressed={state.view === 'grid'} aria-label="Grid view" onClick={() => patch({ view: 'grid' })}><Icon name="grid" size={18} /></button>
            <button type="button" className={state.view === 'list' ? 'is-on' : ''} aria-pressed={state.view === 'list'} aria-label="List view" onClick={() => patch({ view: 'list' })}><Icon name="menu" size={18} /></button>
          </div>
        </div>
      </div>
      <div className={`fs-listing__body${panel ? ' has-panel' : ''}`}>
        {panel && <button type="button" className="fs-filters__scrim" aria-label="Close filters" onClick={() => setPanel(false)} />}
        <FilterPanel state={state} options={options} onPatch={patch} onClear={clear} onClose={() => setPanel(false)} />
        <div className="fs-listing__results">
          {results.length === 0 ? (
            <div className="fs-empty">
              <p>{status === 'loading' ? 'Loading the catalogue…' : count > 0 ? 'Nothing matches these filters.' : emptyCopy}</p>
              {count > 0 && <button type="button" className="fs-btn" onClick={clear}>Clear filters</button>}
            </div>
          ) : (
            <div className={`fs-grid${state.view === 'list' ? ' fs-grid--list' : ''}`}>
              {results.map((v, i) => <FashionProductCard key={v.id} view={v} layout={state.view} mediaLoading={i < 2 ? 'eager' : 'lazy'} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- /fashion/c/<slug> --------------------------------------------------------
export default function FashionCategory() {
  const { slug } = useParams();
  const { status, tree } = useFashionCatalogue();
  const node = resolveCategory(tree, slug);
  if (!node) {
    return (
      <div className="fs-listing">
        <CategoryChips />
        <Breadcrumb trail={[{ name: 'Fashion', href: '/fashion' }, { name: 'Not found' }]} />
        <div className="fs-empty">
          <p>{status === 'loading' ? 'Loading the catalogue…' : `There is no “${slug}” category in the fashion store.`}</p>
          <Link to="/fashion" className="fs-btn">Back to fashion</Link>
        </div>
      </div>
    );
  }
  const children = tree.children(node.id).filter((c) => c.is_active);
  const intro = children.length > 0 ? (
    <nav className="fs-subcats" aria-label={`Shop ${node.name}`}>
      {children.map((c) => <Link key={c.id} to={categoryHref(c)} className="fs-subcat">{c.name}</Link>)}
    </nav>
  ) : null;
  return (
    <Listing
      title={node.name}
      trail={breadcrumbFor(tree, node)}
      scope={categoryScope(tree, node)}
      intro={intro}
      emptyCopy={`No styles in ${node.name} yet — they appear here as they go live.`}
    />
  );
}

// ---- /fashion/search ----------------------------------------------------------
export function FashionSearch() {
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim();
  return (
    <Listing
      title={q ? `Results for “${q}”` : 'All fashion'}
      trail={[{ name: 'Fashion', href: '/fashion' }, { name: q ? 'Search' : 'All styles' }]}
      emptyCopy={q ? `Nothing found for “${q}”. Try another word, or browse a category.` : 'The fashion store is being stocked — styles appear here as they go live.'}
    />
  );
}

// ---- /fashion/wishlist --------------------------------------------------------
export function FashionWishlistPage() {
  const wish = useFashionWishlist();
  const set = new Set(wish.ids);
  return (
    <Listing
      title="Your fashion wishlist"
      trail={[{ name: 'Fashion', href: '/fashion' }, { name: 'Wishlist' }]}
      only={(v) => set.has(v.id)}
      emptyCopy="Nothing saved yet — tap the heart on any style to keep it here."
    />
  );
}
