import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductCard from './ProductCard.jsx';
import { categories } from '../data/categories.js';
import { priceRange, searchProducts } from '../data/products.js';
import { money } from '../lib/format.js';

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
  const [priceMax, setPriceMax] = useState(priceRange.max);
  const [minRating, setMinRating] = useState(0);
  const [flags, setFlags] = useState(new Set(initialFlag ? [initialFlag] : []));
  const [inStock, setInStock] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { setSort(params.get('sort') || 'featured'); }, [params]);

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
  const clearAll = () => { setSelCats(new Set()); setFlags(new Set()); setMinRating(0); setInStock(false); setPriceMax(priceRange.max); };

  const onSort = (id) => { setSort(id); const p = new URLSearchParams(params); p.set('sort', id); setParams(p, { replace: true }); };

  const FilterPanel = (
    <div className="filters">
      <div className="filters__head">
        <h3 style={{ fontSize: 'var(--text-lg)' }}>Filters</h3>
        {activeCount > 0 && <button className="filters__clear" onClick={clearAll}>Clear all ({activeCount})</button>}
      </div>

      {showCategoryFilter && !lockCategory && (
        <div className="filters__group">
          <span className="filters__title">Category</span>
          <div className="filters__opts">
            {categories.map((c) => (
              <label key={c.slug} className="check">
                <input type="checkbox" checked={selCats.has(c.slug)} onChange={() => toggleSet(setSelCats, selCats, c.slug)} />
                <span className="check__box"><Icon name="check" size={13} /></span>
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="filters__group">
        <span className="filters__title">Highlights</span>
        <div className="filters__opts">
          {[['bestseller', 'Bestsellers'], ['new', 'New arrivals'], ['sale', 'On sale']].map(([id, label]) => (
            <label key={id} className="check">
              <input type="checkbox" checked={flags.has(id)} onChange={() => toggleSet(setFlags, flags, id)} />
              <span className="check__box"><Icon name="check" size={13} /></span>
              <span>{label}</span>
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
            <span className="check__box"><Icon name="check" size={13} /></span>
            <span>In stock only</span>
          </label>
        </div>
      </div>

      <div className="filters__group">
        <span className="filters__title">Max price</span>
        <input type="range" className="range" min={priceRange.min} max={priceRange.max} step={50} value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} />
        <div className="filters__range-lbl"><span>{money(priceRange.min)}</span><strong>Up to {money(priceMax)}</strong></div>
      </div>

      <div className="filters__group">
        <span className="filters__title">Rating</span>
        <div className="taglist">
          {[0, 4, 4.5].map((r) => (
            <button key={r} className={`chip ${minRating === r ? 'active' : ''}`} onClick={() => setMinRating(r)}>
              {r === 0 ? 'Any' : <><Icon name="star" size={13} fill="currentColor" /> {r}+</>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="browser container">
      <aside className="browser__aside hide-mobile">{FilterPanel}</aside>

      <div className="browser__main">
        <div className="browser__bar">
          <p className="browser__count">
            {q && <>Results for “<strong>{q}</strong>” · </>}
            <strong>{filtered.length}</strong> {filtered.length === 1 ? 'product' : 'products'}
          </p>
          <div className="browser__tools">
            <button className="chip only-mobile" onClick={() => setDrawer(true)}>
              <Icon name="sliders" size={16} /> Filters{activeCount ? ` · ${activeCount}` : ''}
            </button>
            <label className="sortsel">
              <span className="hide-mobile">Sort</span>
              <select className="select" value={sort} onChange={(e) => onSort(e.target.value)}>
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <Icon name="chevronDown" size={16} />
            </label>
          </div>
        </div>

        {filtered.length ? (
          <div className="pgrid">{filtered.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : (
          <div className="state">
            <span className="state-ic"><Icon name="search" size={32} /></span>
            <h3>Nothing matched</h3>
            <p>Try clearing a filter or searching a different term.</p>
            <button className="btn btn-outline" onClick={clearAll}>Clear filters</button>
          </div>
        )}
      </div>

      {/* Mobile filter drawer */}
      <div className={`fdrawer ${drawer ? 'open' : ''}`} aria-hidden={!drawer}>
        <div className="drawer__scrim" onClick={() => setDrawer(false)} />
        <div className="fdrawer__panel">
          <div className="drawer__top">
            <h3 style={{ fontSize: 'var(--text-lg)' }}>Filters</h3>
            <button className="iconbtn" onClick={() => setDrawer(false)} aria-label="Close"><Icon name="x" /></button>
          </div>
          <div className="fdrawer__scroll">{FilterPanel}</div>
          <div className="fdrawer__foot">
            <button className="btn btn-ghost" onClick={clearAll}>Clear</button>
            <button className="btn btn-block" onClick={() => setDrawer(false)}>Show {filtered.length} results</button>
          </div>
        </div>
      </div>
    </div>
  );
}
