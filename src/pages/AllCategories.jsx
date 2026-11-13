import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import SkeletonGrid from '../components/Skeleton.jsx';
import { categories as wellnessCategories } from '../data/categories.js';
import { products as wellnessProducts } from '../data/products.js';
import { useHomeLivingCatalogue } from '../data/homelivingHomepage.js';
import { FashionCatalogueProvider, useFashionCatalogue } from '../fashion/FashionCatalogue.jsx';
import { fashionGroups, flatTiles } from '../lib/allCategories.js';
import { usePageMeta } from '../lib/pageMeta.js';

// ============================================================
// /categories (2026-11-13 redesign): every store's categories on one page, with
// pictures (allCategories.js says where each picture comes from). ?store=fashion
// (the Fashion tab bar's "Categories") opens at that store's section.
// ============================================================
function Tile({ t, small = false }) {
  return (
    <li>
      <Link to={t.href} className={`sora-cat${small ? ' sora-cat--sm' : ''}`}>
        <span className="sora-cat__img">{t.image ? <img src={t.image} alt="" width="240" height="240" loading="lazy" decoding="async" /> : <span className="sora-cat__ph" aria-hidden="true">{t.name.slice(0, 1)}</span>}</span>
        <span className="sora-cat__name">{t.name}</span>
        {t.count ? <span className="sora-cat__count">{t.count} {t.count === 1 ? 'product' : 'products'}</span> : null}
      </Link>
    </li>
  );
}

function FashionSection() {
  const { status, tree, views } = useFashionCatalogue();
  const groups = fashionGroups(tree, views);
  return (
    <section className="sora-cats__store" id="cats-fashion" aria-labelledby="cats-fashion-h">
      <div className="sora-cats__head"><h2 id="cats-fashion-h">Fashion</h2><Link to="/fashion">Visit the store <Icon name="arrowRight" size={14} /></Link></div>
      {status === 'loading' && !groups.length ? <SkeletonGrid count={6} label="Loading the Fashion categories…" /> : groups.map((g) => (
        <div key={g.key} className="sora-cats__group">
          <h3><Link to={g.href}>{g.name} <Icon name="chevronRight" size={14} /></Link></h3>
          <ul className="sora-cats__grid">{(g.children.length ? g.children : [g]).map((t) => <Tile key={t.key} t={t} small />)}</ul>
        </div>
      ))}
    </section>
  );
}

function HomeLivingSection() {
  const { status, categories, products } = useHomeLivingCatalogue();
  const tiles = flatTiles(categories, products, { catOf: (p) => p.category_id, imageOf: (p) => p.images?.[0], href: (c) => `/homeliving/category/${c.slug}`, key: (c) => c.id });
  return (
    <section className="sora-cats__store" id="cats-homeliving" aria-labelledby="cats-homeliving-h">
      <div className="sora-cats__head"><h2 id="cats-homeliving-h">Home &amp; Living</h2><Link to="/homeliving">Visit the store <Icon name="arrowRight" size={14} /></Link></div>
      {status === 'loading' && !tiles.length ? <SkeletonGrid count={4} label="Loading the Home & Living categories…" /> : <ul className="sora-cats__grid">{tiles.map((t) => <Tile key={t.key} t={t} />)}</ul>}
    </section>
  );
}

export default function AllCategories() {
  const [params] = useSearchParams();
  const want = params.get('store');
  usePageMeta({ title: 'All categories', description: 'Every category at SORA LIFESTYLE: wellness, fashion and home, in one place.', path: '/categories' });
  const wellness = flatTiles(wellnessCategories, wellnessProducts, { catOf: (p) => p.category, imageOf: (p) => p.image, href: (c) => `/category/${c.slug}`, key: (c) => c.slug });
  useEffect(() => {
    if (!want) return undefined;
    const t = setTimeout(() => document.getElementById(`cats-${want}`)?.scrollIntoView({ block: 'start' }), 400);
    return () => clearTimeout(t);
  }, [want]);
  return (
    <div className="hx sora-cats">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>All categories</span></nav>
        <h1 className="hx-offers__h">All categories</h1>
        <p className="hx-offers__lede">Everything at SORA LIFESTYLE, store by store.</p>
        <nav className="sora-cats__jump" aria-label="Stores">
          <a href="#cats-wellness">Wellness</a><a href="#cats-fashion">Fashion</a><a href="#cats-homeliving">Home &amp; Living</a><Link to="/grocery">Grocery</Link><Link to="/lifestyle">Lifestyle</Link>
        </nav>
        <section className="sora-cats__store" id="cats-wellness" aria-labelledby="cats-wellness-h">
          <div className="sora-cats__head"><h2 id="cats-wellness-h">Wellness &amp; beauty</h2><Link to="/shop">Visit the store <Icon name="arrowRight" size={14} /></Link></div>
          <ul className="sora-cats__grid">{wellness.map((t) => <Tile key={t.key} t={t} />)}</ul>
        </section>
        <FashionCatalogueProvider><FashionSection /></FashionCatalogueProvider>
        <HomeLivingSection />
      </div>
    </div>
  );
}
