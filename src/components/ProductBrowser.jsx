import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductCard from './ProductCard.jsx';
import PromoRail from './promo/PromoRail.jsx';
import { categories } from '../data/categories.js';
import { searchProducts } from '../data/products.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';
import {
  PRICE_BANDS, SHOP_SORTS, productMatchesHighlight, productMatchesPriceBand,
  readShopUrlState, updateShopUrlState,
} from '../lib/shopFilters.js';

// ============================================================================
// SORA LIFE V2 — PRODUCT BROWSER (Phase 2, Shop / Category)
//
// CHROME ONLY. ProductCard, the price hierarchy and the media contract remain
// frozen. Search, sort and launch-supported filters share the URL as their
// source of truth, so refresh and browser history reproduce the same shelf.
//
// What is new is presentation: a sharp expanded search on phone/tablet,
// rectangular category tabs, a compact sticky Filter | count | Sort row, a
// promotions slot that renders only for real active promotions, a denser
// two-column mobile grid, and a persistent desktop filter rail.
// ============================================================================

export default function ProductBrowser({ baseProducts, lockCategory = false, showCategoryFilter = true }) {
  const [params, setParams] = useSearchParams();
  const showCats = showCategoryFilter && !lockCategory;
  const urlState = useMemo(() => readShopUrlState(
    params,
    showCats ? categories.map((category) => category.slug) : [],
  ), [params, showCats, categories]);
  const { q, sort, inStock, priceBand } = urlState;
  const selCats = useMemo(() => new Set(urlState.categories), [urlState.categories]);
  const flags = useMemo(() => new Set(urlState.highlights), [urlState.highlights]);
  const [drawer, setDrawer] = useState(false);
  // Local mirror of the ?q= param so the field can be typed into before submit.
  const [qInput, setQInput] = useState(q);

  useEffect(() => { setQInput(q); }, [q]);

  // Same reference-counted lock the header drawer uses, so the two can never
  // unlock each other.
  useEffect(() => {
    if (!drawer) return undefined;
    lockScroll();
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); unlockScroll(); };
  }, [drawer]);

  const setUrlState = (patch) => setParams(updateShopUrlState(params, patch));
  const toggled = (set, value) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return [...next];
  };

  const searched = useMemo(() => {
    if (!q) return baseProducts;
    const ids = new Set(searchProducts(q).map((p) => p.id));
    return baseProducts.filter((p) => ids.has(p.id));
  }, [q, baseProducts]);

  const filtered = useMemo(() => {
    let list = searched.filter((product) => productMatchesPriceBand(product, priceBand));
    if (selCats.size) list = list.filter((p) => [...selCats].some((c) => (p.categories || [p.category]).includes(c)));
    if (inStock) list = list.filter((p) => p.stock > 0);
    if (flags.size) list = list.filter((p) => [...flags].every((flag) => productMatchesHighlight(p, flag)));
    const s = [...list];
    switch (sort) {
      case 'price-asc': s.sort((a, b) => a.price - b.price); break;
      case 'price-desc': s.sort((a, b) => b.price - a.price); break;
      case 'new': s.sort((a, b) => Number(b.isNew) - Number(a.isNew)); break;
      default: s.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
    }
    return s;
  }, [searched, priceBand, selCats, inStock, flags, sort]);

  const activeCount = selCats.size + flags.size + (inStock ? 1 : 0) + (priceBand ? 1 : 0);
  const clearAll = () => setUrlState({ categories: [], highlights: [], inStock: false, priceBand: null });

  const onSort = (id) => setUrlState({ sort: id });

  const setQuery = (value) => setUrlState({ q: value });
  const submitSearch = (e) => { e.preventDefault(); setQuery(qInput.trim()); };

  const FilterPanel = (
    <div className="v2-fp">
      <div className="v2-fp__head">
        <h2>Filters</h2>
        {activeCount > 0 && <button className="v2-fp__clear" onClick={clearAll}>Clear all ({activeCount})</button>}
      </div>

      {showCats && (
        <div className="v2-fp__g">
          <span className="v2-fp__t">Category</span>
          {categories.map((c) => (
            <label key={c.slug} className="v2-check">
              <input type="checkbox" checked={selCats.has(c.slug)} onChange={() => setUrlState({ categories: toggled(selCats, c.slug) })} />
              <span className="v2-check__box"><Icon name="check" size={11} stroke={2.2} /></span>
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      )}

      <div className="v2-fp__g">
        <span className="v2-fp__t">Highlights</span>
        {[['new', 'New arrivals'], ['sale', 'On sale']].map(([id, label]) => (
          <label key={id} className="v2-check">
            <input type="checkbox" checked={flags.has(id)} onChange={() => setUrlState({ highlights: toggled(flags, id) })} />
            <span className="v2-check__box"><Icon name="check" size={11} stroke={2.2} /></span>
            <span>{label}</span>
          </label>
        ))}
        <label className="v2-check">
          <input type="checkbox" checked={inStock} onChange={(e) => setUrlState({ inStock: e.target.checked })} />
          <span className="v2-check__box"><Icon name="check" size={11} stroke={2.2} /></span>
          <span>In stock only</span>
        </label>
      </div>

      <div className="v2-fp__g">
        <span className="v2-fp__t">Price</span>
        <div className="v2-fp__prices" role="group" aria-label="Price range">
          {PRICE_BANDS.map((band) => (
            <button
              type="button"
              key={band.id}
              className={`v2-fp__price ${priceBand === band.id ? 'is-on' : ''}`}
              aria-pressed={priceBand === band.id}
              onClick={() => setUrlState({ priceBand: priceBand === band.id ? null : band.id })}
            >
              {band.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="v2-wrap">
      {/* Expanded search — phone/tablet only; the V2 header owns it from 901px */}
      <div className="v2-shop__search">
        <form className="v2-searchbox" onSubmit={submitSearch} role="search">
          <Icon name="search" size={17} stroke={1.5} />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search wellness essentials"
            aria-label="Search products"
          />
          {qInput && (
            <button type="button" className="v2-searchbox__clear" onClick={() => { setQInput(''); setQuery(''); }} aria-label="Clear search">
              <Icon name="x" size={15} stroke={1.7} />
            </button>
          )}
        </form>
      </div>

      {/* Rectangular category tabs — drive the same selCats filter as the panel */}
      {showCats && (
        <div className="v2-rail v2-shop__cats">
          <button className={`v2-chip ${selCats.size === 0 ? 'is-on' : ''}`} onClick={() => setUrlState({ categories: [] })}>
            <Icon name="grid" size={14} stroke={1.5} /> All
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              className={`v2-chip ${selCats.has(c.slug) ? 'is-on' : ''}`}
              onClick={() => setUrlState({ categories: toggled(selCats, c.slug) })}
              aria-pressed={selCats.has(c.slug)}
            >
              <Icon name={c.icon || 'leaf'} size={14} stroke={1.5} /> {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Filter | count | Sort */}
      <div className="v2-flt">
        <button className="v2-flt__btn" onClick={() => setDrawer(true)} aria-label="Open filters" aria-expanded={drawer}>
          <Icon name="sliders" size={15} stroke={1.5} /> Filter
          {activeCount > 0 && <span className="v2-flt__n">{activeCount}</span>}
        </button>
        <p className="v2-flt__count">
          {q && <>“{q}” · </>}<strong>{filtered.length}</strong> {filtered.length === 1 ? 'product' : 'products'}
        </p>
        <label className="v2-flt__sort">
          <span className="sr-only">Sort by</span>
          <select value={sort} onChange={(e) => onSort(e.target.value)} aria-label="Sort products">
            {SHOP_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <Icon name="chevronDown" size={14} stroke={1.7} />
        </label>
      </div>

      {/* Real promotions only. Renders nothing unless the engine returns an
          active, in-window promotion for this surface. */}
      <div className="v2-shop__promo">
        <PromoRail place="shop" eyebrow="Offers" title="Current offers" maxOffers={2} />
      </div>

      <div className="v2-shop__body">
        <aside className="v2-shop__rail hide-mobile">{FilterPanel}</aside>

        <div>
          {filtered.length ? (
            <div className="v2-shop__grid">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="v2-shop__empty">
              <Icon name="search" size={30} stroke={1.4} />
              <h2>Nothing matched</h2>
              <p>Try clearing a filter or searching a different term.</p>
              <button className="v2-btn v2-btn--out v2-btn--sm" onClick={clearAll}>Clear filters</button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <div className={`v2-fd ${drawer ? 'is-open' : ''}`} aria-hidden={!drawer} role="dialog" aria-modal="true" aria-label="Filters" {...(drawer ? {} : { inert: '' })}>
        <div className="v2-fd__scrim" onClick={() => setDrawer(false)} />
        <div className="v2-fd__panel">
          <div className="v2-fd__top">
            <h2>Filters{activeCount ? ` (${activeCount})` : ''}</h2>
            <button className="v2-iconbtn v2-iconbtn--bare" onClick={() => setDrawer(false)} aria-label="Close filters">
              <Icon name="x" size={17} stroke={1.6} />
            </button>
          </div>
          <div className="v2-fd__scroll">{FilterPanel}</div>
          <div className="v2-fd__foot">
            <button className="v2-btn v2-btn--ghost v2-btn--sm" onClick={clearAll}>Clear</button>
            <button className="v2-btn v2-btn--sm" onClick={() => setDrawer(false)}>Show {filtered.length} results</button>
          </div>
        </div>
      </div>
    </div>
  );
}
