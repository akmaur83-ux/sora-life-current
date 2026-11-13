import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import SkeletonGrid from '../components/Skeleton.jsx';
import LoadMore, { useShowMore } from '../components/LoadMore.jsx';
import { money } from '../lib/format.js';
import { products } from '../data/products.js';
import { categoryBySlug } from '../data/categories.js';
import { productBrandName } from '../lib/homeMerchandising.js';
import { BRANDS, brandImage } from '../lib/brands.js';
import { BRAND_SORTS, useCatalogueBrand, wellnessBrandCards, arrangeBrandCards, brandCategories } from '../lib/brandPage.js';
import { usePageMeta } from '../lib/pageMeta.js';
import NotFound from './NotFound.jsx';

// ============================================================
// /brands/:id — one partner brand's page (2026-11-13 redesign): its banner and
// story, then everything of theirs that can be bought, by category and sort
// (brandPage.js has the rules). The link to send a partner, or put in an ad.
// ============================================================
const brandOf = (p) => String(p?.brand || productBrandName(p) || '').trim().toLowerCase();

export default function BrandPage() {
  const { id } = useParams();
  const brand = BRANDS.find((b) => b.id === id);
  const [params, setParams] = useSearchParams();
  const fromCatalogue = useCatalogueBrand(brand?.catalogueBrand || '');
  const wellness = brand && !brand.catalogueBrand
    ? wellnessBrandCards(products.map((p) => ({ ...p, categoryName: categoryBySlug[p.category]?.name || '' })), (p) => brandOf(p) === brand.name.toLowerCase())
    : null;
  const cards = brand?.catalogueBrand ? fromCatalogue : wellness;
  const category = params.get('cat') || '';
  const sort = BRAND_SORTS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'featured';
  const shown = cards ? arrangeBrandCards(cards, { category, sort }) : [];
  const paging = useShowMore(shown.length, `${id}|${category}|${sort}`);
  usePageMeta({ title: brand ? brand.name : 'Brand', description: brand ? `${brand.name} at SORA LIFESTYLE. ${brand.text}` : '', path: `/brands/${id}` }, [id]);
  if (!brand) return <NotFound />;
  const cats = cards ? brandCategories(cards) : [];
  const set = (k, v) => { const next = new URLSearchParams(params); if (!v || v === 'featured') next.delete(k); else next.set(k, v); setParams(next, { replace: true }); };
  const hero = brandImage(brand, products, (p) => brandOf(p) === brand.name.toLowerCase());
  return (
    <div className={`hx sora-brand${brand.luxe ? ' sora-brand--luxe' : ''}`}>
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <Link to="/brands">Our brands</Link> <Icon name="chevronRight" size={12} /> <span>{brand.name}</span></nav>
        <header className="sora-brand__hero">
          <div className={`sora-brand__img${brand.imageFrom ? ' is-whole' : ''}`}>{hero && <img src={hero} alt="" width="900" height="600" decoding="async" />}</div>
          <div className="sora-brand__copy">
            <p className="sora-brand__eyebrow">{brand.store} · on SORA LIFESTYLE</p>
            <h1>{brand.name}</h1>
            <p className="sora-brand__story">{brand.story}</p>
            <p className="sora-brand__count">{cards === null ? 'Loading the range…' : `${cards.length} ${cards.length === 1 ? 'product' : 'products'} available`}</p>
          </div>
        </header>
        <div className="sora-brand__bar">
          <div className="sora-brand__cats" role="group" aria-label="Category">
            <button type="button" aria-pressed={!category} className={`hx-offers__chip${!category ? ' is-on' : ''}`} onClick={() => set('cat', '')}>All</button>
            {cats.map((c) => (
              <button key={c.name} type="button" aria-pressed={category === c.name} className={`hx-offers__chip${category === c.name ? ' is-on' : ''}`} onClick={() => set('cat', c.name)}>{c.name} <em>{c.count}</em></button>
            ))}
          </div>
          <label className="sora-brand__sort">
            <span>Sort</span>
            <select value={sort} onChange={(e) => set('sort', e.target.value)}>
              {BRAND_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        {cards === null ? <SkeletonGrid label={`Loading ${brand.name}…`} />
          : shown.length === 0 ? <p className="hx-offers__empty">Nothing of {brand.name}’s is in stock right now. New pieces appear the moment they go live.</p>
            : (
              <>
                <ul className="hx-offers__grid">
                  {shown.slice(0, paging.shown).map((c, i) => (
                    <li key={c.key}>
                      <Link to={c.href} className="hx-deals__card">
                        <span className={`hx-deals__img${c.whole ? ' sora-brand__whole' : ''}`}><img src={c.image} alt="" width="300" height="300" loading={i < 8 ? 'eager' : 'lazy'} decoding="async" /></span>
                        <span className="hx-deals__name">{c.name}</span>
                        <span className="hx-deals__price"><b>{money(c.price)}</b>{c.mrp ? <s>{money(c.mrp)}</s> : null}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <LoadMore shown={paging.shown} total={shown.length} onMore={paging.more} />
              </>
            )}
      </div>
    </div>
  );
}
