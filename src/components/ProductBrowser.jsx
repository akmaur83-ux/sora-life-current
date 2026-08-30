import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductCard from './ProductCard.jsx';
import PromoRail from './promo/PromoRail.jsx';
import { categories } from '../data/categories.js';
import { priceRange, searchProducts } from '../data/products.js';
import { money } from '../lib/format.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';

// ============================================================================
// SORA LIFE V2 — PRODUCT BROWSER (Phase 2, Shop / Category)
//
// CHROME ONLY. Every piece of behaviour below is carried over unchanged from
// V1: the search/filter/sort memos, the sort list and its URL sync, category /
// highlight / price / rating / in-stock filters, the active-filter count and
// clear-all, and the empty state. ProductCard, the price hierarchy and the
// media contract are frozen and reused exactly as they are.
//
// What is new is presentation: a sharp expanded search on phone/tablet,
// rectangular category tabs, a compact sticky Filter | count | Sort row, a
// promotions slot that renders only for real active promotions, a denser
// two-column mobile grid, and a persistent desktop filter rail.
// ============================================================================

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'bestselling', label: 'Best selling' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'rating', label: 'Top rated' },
  { id: 'new', label: 'Newest' },
];

export default function ProductBrowser({ baseProducts, lockCategory = false, showCategoryFilter = true }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const initialSort = params.get('sort') || 'featured';
  const initialFlag = params.get('filter') || '';

  const [sort, setSort] = useState(initialSort);
  const [selCats, setSelCats] = useState(new Set());
  // null means no user cap: follow the live range when the catalogue hydrates.
  // An explicit selection stays fixed across subsequent catalogue updates.
  const [selectedPriceMax, setPriceMax] = useState(null);
  const priceMax = selectedPriceMax ?? priceRange.max;
  const [minRating, setMinRating] = useState(0);
  const [flags, setFlags] = useState(new Set(initialFlag ? [initialFlag] : []));
  const [inStock, setInStock] = useState(false);
  const [drawer, setDrawer] = useState(false);
  // Local mirror of the ?q= param so the field can be typed into before submit.
  const [qInput, setQInput] = useState(q);

  useEffect(() => { setSort(params.get('sort') || 'featured'); }, [params]);
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

  const toggleSet = (setter, set, val) => {
    const next = new Set(set); next.has(val) ? next.delete(val) : next.add(val); setter(next);
  };

  const searched = useMemo(() => {
    if (!q) return baseProducts;
    const ids = new Set(searchProducts(q).map((p) => p.id));
    return baseProducts.filter((p) => ids.has(p.id));
  }, [q, baseProducts]);

  const filtered = useMemo(() => {
    let list = searched.filter((p) => p.price <= priceMax && p.rating >= minRating);
    if (selCats.size) list = list.filter((p) => [...selCats].some((c) => (p.categories || [p.category]).includes(c)));
    if (inStock) list = list.filter((p) => p.stock > 0);
    if (flags.size) list = list.filter((p) => [...flags].every((f) => f === 'sale' ? p.discountPct > 0 : p.flags.includes(f)));
    const s = [...list];
    switch (sort) {
      case 'price-asc': s.sort((a, b) => a.price - b.price); break;
      case 'price-desc': s.sort((a, b) => b.price - a.price); break;
      case 'rating': s.sort((a, b) => b.rating - a.rating); break;
      case 'bestselling': s.sort((a, b) => b.reviewCount - a.reviewCount); break;
      case 'new': s.sort((a, b) => Number(b.isNew) - Number(a.isNew)); break;
      default: s.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
    }
    return s;
  }, [searched, priceMax, minRating, selCats, inStock, flags, sort]);

  const activeCount = selCats.size + flags.size + (minRating ? 1 : 0) + (inStock ? 1 : 0) + (priceMax < priceRange.max ? 1 : 0);
  const clearAll = () => { setSelCats(new Set()); setFlags(new Set()); setMinRating(0); setInStock(false); setPriceMax(null); };

  const onSort = (id) => { setSort(id); const p = new URLSearchParams(params); p.set('sort', id); setParams(p, { replace: true }); };

  const setQuery = (value) => {
    const p = new URLSearchParams(params);
    if (value) p.set('q', value); else p.delete('q');
    setParams(p, { replace: true });
  };
  const submitSearch = (e) => { e.preventDefault(); setQuery(qInput.trim()); };

  const showCats = showCategoryFilter && !lockCategory;

  const FilterPanel = (
    <div className="v2-fp">
      <div className="v2-fp__head">
        <h3>Filters</h3>
        {activeCount > 0 && <button className="v2-fp__clear" onClick={clearAll}>Clear all ({activeCount})</button>}
      </div>

      {showCats && (
        <div className="v2-fp__g">
          <span className="v2-fp__t">Category</span>
          {categories.map((c) => (
            <label key={c.slug} className="v2-check">
              <input type="checkbox" checked={selCats.has(c.slug)} onChange={() => toggleSet(setSelCats, selCats, c.slug)} />
              <span className="v2-check__box"><Icon name="check" size={11} stroke={2.2} /></span>
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      )}

      <div className="v2-fp__g">
        <span className="v2-fp__t">Highlights</span>
        {[['bestseller', 'Bestsellers'], ['new', 'New arrivals'], ['sale', 'On sale']].map(([id, label]) => (
          <label key={id} className="v2-check">
            <input type="checkbox" checked={flags.has(id)} onChange={() => toggleSet(setFlags, flags, id)} />
            <span className="v2-check__box"><Icon name="check" size={11} stroke={2.2} /></span>
            <span>{label}</span>
          </label>
        ))}
        <label className="v2-check">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
          <span className="v2-check__box"><Icon name="check" size={11} stroke={2.2} /></span>
          <span>In stock only</span>
        </label>
      </div>

      <div className="v2-fp__g">
        <span className="v2-fp__t">Max price</span>
        <input type="range" className="v2-fp__range" min={priceRange.min} max={priceRange.max} step={1} value={priceMax}
          aria-label="Maximum price" aria-valuetext={money(priceMax)}
          onChange={(e) => setPriceMax(Number(e.target.value))} />
        <div className="v2-fp__rangelbl"><span>{money(priceRange.min)}</span><strong>Up to {money(priceMax)}</strong></div>
      </div>

      <div className="v2-fp__g">
        <span className="v2-fp__t">Rating</span>
        <div className="v2-fp__tags">
          {[0, 4, 4.5].map((r) => (
            <button key={r} className={`v2-chip ${minRating === r ? 'is-on' : ''}`} onClick={() => setMinRating(r)}>
              {r === 0 ? 'Any' : <><Icon name="star" size={12} fill="currentColor" /> {r}+</>}
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
          <button className={`v2-chip ${selCats.size === 0 ? 'is-on' : ''}`} onClick={() => setSelCats(new Set())}>
            <Icon name="grid" size={14} stroke={1.5} /> All
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              className={`v2-chip ${selCats.has(c.slug) ? 'is-on' : ''}`}
              onClick={() => toggleSet(setSelCats, selCats, c.slug)}
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
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
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
              <h3>Nothing matched</h3>
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
            <h3>Filters{activeCount ? ` (${activeCount})` : ''}</h3>
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
