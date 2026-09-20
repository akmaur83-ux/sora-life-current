import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useCustomerAuth } from '../lib/customerAuth.jsx';
import { categoryHref, sortViews, topBrands } from '../lib/fashion.js';
import { useFashionCatalogue } from './FashionCatalogue.jsx';
import { CategoryChips } from './FashionLayout.jsx';
import FashionProductCard from './FashionProductCard.jsx';
import { HERO_IMAGE, circleArt, cardArt } from './fashionArt.js';

// ============================================================
// /fashion — circular category tiles, the benefits strip, the hero (image
// slot left for the supplied artwork), Shop by Category, Top Brands, and
// the product grid. Every list is the live catalogue; a section with
// nothing to show says so rather than inventing tiles.
// ============================================================

export const HERO = {
  eyebrow: 'Fashion for a brighter you',
  title: 'New Season Essentials',
  sub: 'Style · Comfort · Everyday Living',
  cta: 'Shop now',
  href: '/fashion/c/clothing',
  note: 'Under ₹499',
  image: HERO_IMAGE, // the supplied banner; null falls back to the typographic slot
};

function CategoryTiles({ tree }) {
  const clothing = tree.roots.find((r) => r.slug === 'clothing');
  const tiles = [...(clothing ? tree.children(clothing.id) : []), ...tree.roots.filter((r) => r !== clothing)].filter((c) => c.is_active);
  if (tiles.length === 0) return null;
  return (
    <nav className="fs-tiles" aria-label="Shop by">
      {tiles.map((c) => (
        <Link key={c.id} to={categoryHref(c)} className="fs-tile">
          <span className="fs-tile__img">{circleArt(c) ? <img src={circleArt(c)} alt="" loading="lazy" decoding="async" width="200" height="200" /> : <b aria-hidden="true">{c.name.slice(0, 1)}</b>}</span>
          <span className="fs-tile__name">{c.name}</span>
        </Link>
      ))}
    </nav>
  );
}

const BENEFITS = [
  ['truck', 'Free standard', 'delivery*'],
  ['card', 'UPI & cards', 'at checkout'],
  ['package', 'Cash on', 'delivery'],
  ['tag', 'Coupons', '& offers'],
];
function Benefits() {
  const { session } = useCustomerAuth();
  return (
    <section className="fs-benefits" aria-label="Benefits">
      <Link to="/account" className="fs-benefits__signin">
        <Icon name="gift" size={30} />
        <span>{session ? <><strong>Your account</strong> orders &amp; addresses</> : <><strong>Sign in</strong> for exclusive benefits</>}</span>
        <Icon name="chevronRight" size={18} />
      </Link>
      <ul className="fs-benefits__list">
        {BENEFITS.map(([icon, a, b]) => <li key={a}><Icon name={icon} size={26} /><span>{a}<br />{b}</span></li>)}
      </ul>
    </section>
  );
}

function Hero() {
  return (
    <section className={`fs-hero${HERO.image ? ' has-image' : ''}`} aria-labelledby="fs-hero-h">
      <div className="fs-hero__txt">
        <p className="fs-hero__eyebrow">{HERO.eyebrow}</p>
        <h1 className="fs-hero__h serif" id="fs-hero-h">{HERO.title}</h1>
        <p className="fs-hero__sub">{HERO.sub}</p>
        <Link to={HERO.href} className="fs-hero__cta">{HERO.cta} <Icon name="arrowRight" size={17} /></Link>
        <p className="fs-hero__note serif">{HERO.note}</p>
      </div>
      <div className="fs-hero__art" aria-hidden="true">
        {HERO.image ? <img src={HERO.image} alt="" width="1600" height="900" decoding="async" fetchpriority="high" /> : (
          <div className="fs-hero__slot">
            <p className="serif">Good Style<br />Brighter Days</p>
            <span className="fs-hero__words"><span>Wear</span><span>Live</span><span>Explore</span><span>Belong</span></span>
          </div>
        )}
      </div>
    </section>
  );
}

function ShopByCategory({ tree }) {
  const roots = tree.roots.filter((r) => r.is_active).slice(0, 4);
  if (roots.length === 0) return null;
  return (
    <section className="fs-sec" aria-labelledby="fs-cats-h">
      <header className="fs-sec__head">
        <h2 className="fs-sec__h serif" id="fs-cats-h">Shop by Category</h2>
        {tree.roots[0] && <Link to={categoryHref(tree.roots[0])} className="fs-sec__link">Explore all <Icon name="chevronRight" size={16} /></Link>}
      </header>
      <div className="fs-catcards">
        {roots.map((c) => (
          <Link key={c.id} to={categoryHref(c)} className="fs-catcard">
            <span className="fs-catcard__img">{cardArt(c) ? <img src={cardArt(c)} alt="" loading="lazy" decoding="async" width="480" height="360" /> : <b aria-hidden="true">{c.name.slice(0, 1)}</b>}</span>
            <span className="fs-catcard__body">
              <strong>{c.name}</strong>
              {c.tagline && <em>{c.tagline}</em>}
              <i className="fs-catcard__go" aria-hidden="true"><Icon name="chevronRight" size={16} /></i>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TopBrands({ views }) {
  const brands = topBrands(views, 6);
  if (brands.length === 0) return null;
  return (
    <section className="fs-sec fs-brands" aria-labelledby="fs-brands-h">
      <header className="fs-sec__head">
        <h2 className="fs-sec__h serif" id="fs-brands-h">Top Brands on SORA LIFE</h2>
        <Link to="/fashion/search" className="fs-sec__link">See all <Icon name="chevronRight" size={16} /></Link>
      </header>
      <div className="fs-brands__row">
        {brands.map((b) => (
          <Link key={b.name} to={`/fashion/search?brand=${encodeURIComponent(b.name)}`} className="fs-brandcard">
            <span className="fs-brandcard__logo serif">{b.name}</span>
            <span className="fs-brandcard__meta">{b.products} {b.products === 1 ? 'style' : 'styles'}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function FashionHome() {
  const { status, tree, views } = useFashionCatalogue();
  const grid = sortViews(views, 'featured');
  return (
    <div className="fs-home">
      <Hero />
      <CategoryChips />
      <CategoryTiles tree={tree} />
      <Benefits />
      <ShopByCategory tree={tree} />
      <TopBrands views={views} />
      <section className="fs-sec" aria-labelledby="fs-grid-h">
        <header className="fs-sec__head">
          <h2 className="fs-sec__h serif" id="fs-grid-h">Fresh in fashion</h2>
          <span className="fs-sec__count">{grid.length} {grid.length === 1 ? 'style' : 'styles'}</span>
        </header>
        {grid.length === 0 ? (
          <p className="fs-empty">{status === 'loading' ? 'Loading the catalogue…' : status === 'error' ? 'The fashion catalogue could not be loaded. Please try again shortly.' : 'The fashion store is being stocked — styles appear here as they go live.'}</p>
        ) : (
          <div className="fs-grid">
            {grid.map((v, i) => <FashionProductCard key={v.id} view={v} mediaLoading={i < 2 ? 'eager' : 'lazy'} />)}
          </div>
        )}
      </section>
    </div>
  );
}
