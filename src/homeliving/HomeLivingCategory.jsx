import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useHomeLivingCatalogue } from '../data/homelivingHomepage.js';
import {
  HOMELIVING_SORTS, PRICE_BANDS, CLEAR_FILTERS,
  readListingState, updateListingState, activeFilterCount, filterOptions, applyListing,
  resolveCategory, categoryChildren, categoryScope, breadcrumbFor, categoryHref,
} from '../lib/homelivingListing.js';
import HomeLivingProductCard from './HomeLivingProductCard.jsx';

// ============================================================
// /homeliving/category/<slug> — the category listing. Every filter, the
// sort and the view live in the URL (readListingState / updateListingState,
// the fashion listing's contract), so a listing is shareable and the back
// button restores it. The categories and products are the live catalogue
// (useHomeLivingCatalogue); nothing here is hardcoded. A category with
// nothing in it says so; an unknown slug says so inside the shell.
// ============================================================

export function Breadcrumb({ trail }) {
  return (
    <nav className="hl-crumb" aria-label="Breadcrumb">
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
    <label className={`hl-filter__opt${checked ? ' is-on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {swatch && <span className="hl-filter__swatch" style={{ background: swatch }} aria-hidden="true" />}
      <span>{children}</span>
    </label>
  );
}

function Radio({ name, on, label, onPick, onClear }) {
  return (
    <label className={`hl-filter__opt${on ? ' is-on' : ''}`}>
      <input type="radio" name={name} checked={on} onChange={onPick} onClick={() => { if (on) onClear(); }} />
      <span>{label}</span>
    </label>
  );
}

export function FilterPanel({ state, options, onPatch, onClear, onClose = null, id = 'hl-filters' }) {
  const toggle = (key, value) => onPatch({ [key]: state[key].includes(value) ? state[key].filter((v) => v !== value) : [...state[key], value] });
  const count = activeFilterCount(state);
  return (
    <aside className="hl-filters" id={id} aria-label="Filters">
      <header className="hl-filters__head">
        <strong>Filters{count ? ` (${count})` : ''}</strong>
        {count > 0 && <button type="button" className="hl-filters__clear" onClick={onClear}>Clear all</button>}
        {onClose && <button type="button" className="hl-filters__x" aria-label="Close filters" onClick={onClose}><Icon name="x" size={18} /></button>}
      </header>
      <fieldset className="hl-filter"><legend>Price</legend>
        {PRICE_BANDS.map((b) => <Radio key={b.id} name="price" on={state.price === b.id} label={b.label} onPick={() => onPatch({ price: b.id })} onClear={() => onPatch({ price: null })} />)}
      </fieldset>
      {options.sizes.length > 0 && (
        <fieldset className="hl-filter"><legend>Size</legend>
          <div className="hl-filter__sizes">
            {options.sizes.map((s) => <Check key={s} checked={state.sizes.includes(s)} onChange={() => toggle('sizes', s)}>{s}</Check>)}
          </div>
        </fieldset>
      )}
      {options.colours.length > 0 && (
        <fieldset className="hl-filter"><legend>Colour</legend>
          {options.colours.map((c) => <Check key={c.colour} checked={state.colours.includes(c.colour)} onChange={() => toggle('colours', c.colour)} swatch={c.hex || '#D9CBB0'}>{c.colour}</Check>)}
        </fieldset>
      )}
      {options.brands.length > 0 && (
        <fieldset className="hl-filter"><legend>Brand</legend>
          {options.brands.map((b) => <Check key={b} checked={state.brands.includes(b)} onChange={() => toggle('brands', b)}>{b}</Check>)}
        </fieldset>
      )}
      {options.discounts.length > 0 && (
        <fieldset className="hl-filter"><legend>Discount</legend>
          {options.discounts.map((d) => <Radio key={d} name="discount" on={state.discount === d} label={`${d}% or more`} onPick={() => onPatch({ discount: d })} onClear={() => onPatch({ discount: null })} />)}
        </fieldset>
      )}
      {options.ratings.length > 0 && (
        <fieldset className="hl-filter"><legend>Rating</legend>
          {options.ratings.map((r) => <Radio key={r} name="rating" on={state.rating === r} label={`${r}★ & above`} onPick={() => onPatch({ rating: r })} onClear={() => onPatch({ rating: null })} />)}
        </fieldset>
      )}
    </aside>
  );
}

export function Listing({ title, trail, scope = null, intro = null, emptyCopy }) {
  const { status, products } = useHomeLivingCatalogue();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => readListingState(params), [params]);
  const [panel, setPanel] = useState(false);
  useEffect(() => { if (!panel) return undefined; const onKey = (e) => { if (e.key === 'Escape') setPanel(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [panel]);

  const inScope = useMemo(() => (scope ? products.filter((p) => p.category_id != null && scope.has(String(p.category_id))) : products), [products, scope]);
  const options = useMemo(() => filterOptions(inScope), [inScope]);
  const results = useMemo(() => applyListing(products, state, scope), [products, state, scope]);
  const patch = (p) => setParams(updateListingState(params, p));
  const clear = () => setParams(updateListingState(params, CLEAR_FILTERS));
  const count = activeFilterCount(state);

  return (
    <div className="hl-wrap hl-listing">
      <Breadcrumb trail={trail} />
      {intro}
      <div className="hl-listing__bar">
        <h1 className="hl-listing__h serif">{title}</h1>
        <p className="hl-listing__count" role="status">{status === 'loading' ? 'Loading…' : `${results.length} ${results.length === 1 ? 'product' : 'products'}`}</p>
        <div className="hl-listing__tools">
          <button type="button" className="hl-filters__toggle" onClick={() => setPanel((v) => !v)} aria-expanded={panel} aria-controls="hl-filters" aria-label={count ? `Filters, ${count} active` : 'Filters'}>
            <Icon name="sliders" size={17} /> Filters{count ? <b>{count}</b> : null}
          </button>
          <label className="hl-sort">
            <span>Sort by:</span>
            <select value={state.sort} onChange={(e) => patch({ sort: e.target.value })} aria-label="Sort">
              {HOMELIVING_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <Icon name="chevronDown" size={15} />
          </label>
          <div className="hl-view" role="group" aria-label="Layout">
            <button type="button" className={state.view === 'grid' ? 'is-on' : ''} aria-pressed={state.view === 'grid'} aria-label="Grid view" onClick={() => patch({ view: 'grid' })}><Icon name="grid" size={18} /></button>
            <button type="button" className={state.view === 'list' ? 'is-on' : ''} aria-pressed={state.view === 'list'} aria-label="List view" onClick={() => patch({ view: 'list' })}><Icon name="menu" size={18} /></button>
          </div>
        </div>
      </div>
      <div className={`hl-listing__body${panel ? ' has-panel' : ''}`}>
        {panel && <button type="button" className="hl-filters__scrim" aria-label="Close filters" onClick={() => setPanel(false)} />}
        <FilterPanel state={state} options={options} onPatch={patch} onClear={clear} onClose={() => setPanel(false)} />
        <div className="hl-listing__results">
          {results.length === 0 ? (
            <div className="hl-empty hl-empty--listing">
              <p>{status === 'loading' ? 'Loading the catalogue…' : status === 'error' ? 'The Home & Living catalogue could not be loaded. Please try again shortly.' : count > 0 ? 'Nothing matches these filters.' : emptyCopy}</p>
              {count > 0 && <button type="button" className="hl-btn" onClick={clear}>Clear filters</button>}
            </div>
          ) : (
            <div className={`hl-grid${state.view === 'list' ? ' hl-grid--list' : ''}`}>
              {results.map((p, i) => <HomeLivingProductCard key={p.id} product={p} layout={state.view} mediaLoading={i < 2 ? 'eager' : 'lazy'} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- /homeliving/category/<slug> ------------------------------------------------
export default function HomeLivingCategory() {
  const { slug } = useParams();
  const { status, categories } = useHomeLivingCatalogue();
  const node = resolveCategory(categories, slug);
  // Hooks before the early return: the scope memo runs on every render.
  const scope = useMemo(() => categoryScope(categories, node), [categories, node]);
  if (!node) {
    return (
      <div className="hl-wrap hl-listing">
        <Breadcrumb trail={[{ name: 'Home & Living', href: '/homeliving' }, { name: 'Not found' }]} />
        <div className="hl-empty hl-empty--listing">
          <p>{status === 'loading' ? 'Loading the catalogue…' : status === 'error' ? 'The Home & Living catalogue could not be loaded. Please try again shortly.' : `There is no “${slug}” category in the Home & Living store.`}</p>
          <Link to="/homeliving" className="hl-btn">Back to Home &amp; Living</Link>
        </div>
      </div>
    );
  }
  const children = categoryChildren(categories, node);
  const intro = children.length > 0 ? (
    <nav className="hl-subcats" aria-label={`Shop ${node.name}`}>
      {children.map((c) => <Link key={c.id} to={categoryHref(c)} className="hl-subcat">{c.name}</Link>)}
    </nav>
  ) : null;
  return (
    <Listing
      title={node.name}
      trail={breadcrumbFor(categories, node)}
      scope={scope}
      intro={intro}
      emptyCopy={`No products in ${node.name} yet — they appear here as they go live.`}
    />
  );
}
