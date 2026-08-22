import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Reveal from '../components/Reveal.jsx';
import Hero from '../components/Hero.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ProductImage from '../components/ProductImage.jsx';
import Newsletter from '../components/Newsletter.jsx';
import { categories } from '../data/categories.js';
import { getBestsellers, getNewArrivals, getByCategory, categoryCount } from '../data/products.js';
import { homepage } from '../lib/settings.js';

const EDITORIALS = [
  { title: 'Pure Himalayan Wellness', copy: 'Nourish your body with the purity of nature.', cta: 'SHOP WELLNESS', to: '/category/wellness', tone: 'forest' },
  { title: 'For Healthy Hair, Naturally', copy: 'Strength from root to tip with nature’s best.', cta: 'SHOP HAIR CARE', to: '/category/hair-care', tone: 'plum' },
  { title: 'Nourish Your Skin', copy: 'The natural way.', cta: 'SHOP SKIN CARE', to: '/category/skin-care', tone: 'rose' },
];

export default function Home() {
  const railRef = useRef(null);
  const bestsellers = getBestsellers(12);
  const newArrivals = getNewArrivals(6);

  const scrollRail = (dir) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const editorialProduct = (slug) => getByCategory(slug).find((p) => p.stock > 0) || getByCategory(slug)[0];

  return (
    <>
      {/* ============ HERO CAROUSEL ============ */}
      <Hero />

      {/* ============ CATEGORY CIRCLES ============ */}
      <section className="bh-cats">
        <div className="container">
          <div className="bh-cats__row">
            {categories.map((c, i) => (
              <Reveal key={c.slug} as={Link} to={`/category/${c.slug}`} className="bh-cat" variant="scale" delay={i * 55}>
                <span className={`bh-cat__circle tone-${c.tone}`}>
                  <ProductImage product={getByCategory(c.slug)[0]} />
                </span>
                <span className="bh-cat__name">{c.name}</span>
                <span className="bh-cat__view">View all</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BESTSELLERS ============ */}
      <section className="bh-best">
        <div className="container">
          <div className="bh-best__head">
            <div>
              <h2 className="serif bh-best__title">{homepage.bestsellerTitle}</h2>
              <p className="muted">{homepage.bestsellerSubtitle}</p>
            </div>
            <Link to="/shop?sort=bestselling" className="bh-best__all">VIEW ALL BESTSELLERS <Icon name="arrowRight" size={16} /></Link>
          </div>
          <div className="bh-best__wrap">
            <div className="bh-grid" ref={railRef}>
              {bestsellers.map((p, i) => (
                <Reveal key={p.id} variant="scale" delay={(i % 6) * 60}><ProductCard product={p} /></Reveal>
              ))}
            </div>
            <button className="bh-best__arrow" onClick={() => scrollRail(1)} aria-label="Scroll products"><Icon name="chevronRight" size={20} /></button>
          </div>
        </div>
      </section>

      {/* ============ EDITORIAL CARDS ============ */}
      <section className="bh-edit-wrap">
        <div className="container">
          <div className="bh-edit">
            {EDITORIALS.map((e) => {
              const p = editorialProduct(e.to.split('/').pop());
              return (
                <Reveal key={e.title}>
                  <Link to={e.to} className={`bh-editcard tone-${e.tone}`}>
                    <div className="bh-editcard__body">
                      <h3 className="serif">{e.title}</h3>
                      <p>{e.copy}</p>
                      <span className="bh-editcard__cta">{e.cta} <Icon name="arrowRight" size={15} /></span>
                    </div>
                    {p && <div className="bh-editcard__img"><ProductImage product={p} /></div>}
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ NEW ARRIVALS ============ */}
      <section className="section-sm">
        <div className="container">
          <div className="sec-head">
            <div>
              <span className="eyebrow">Just added</span>
              <h2 className="sec-title serif" style={{ marginTop: 8 }}>New in at Sora Life</h2>
            </div>
            <Link to="/shop?filter=new" className="sec-link">View all <Icon name="arrowRight" size={17} /></Link>
          </div>
          <div className="rail">
            {newArrivals.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* ============ WELLNESS PROMISE STRIP ============ */}
      <section className="bh-promise">
        <div className="container bh-promise__in">
          {[['leaf', '100% Natural', 'Sea-buckthorn sourced from the Himalayas'],
            ['award', 'Made in India', 'Ethically produced, lab verified'],
            ['shield', 'Authentic Biosash', 'Genuine products, authorised store'],
            ['truck', 'Fast Delivery', 'Free shipping over ₹699 · COD available']].map(([ic, t, s]) => (
            <div key={t} className="bh-promise__item">
              <span className="bh-promise__ic"><Icon name={ic} size={22} /></span>
              <span><strong>{t}</strong><em>{s}</em></span>
            </div>
          ))}
        </div>
      </section>

      <Newsletter />
    </>
  );
}
