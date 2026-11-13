import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { products } from '../data/products.js';
import { productBrandName } from '../lib/homeMerchandising.js';
import { BRANDS, brandImage } from '../lib/brands.js';
import { usePageMeta } from '../lib/pageMeta.js';

// /brands — every partner brand on SORA Lifestyle (brands.js has the list).
const isBiosash = (p) => productBrandName(p).toLowerCase() === 'biosash';

export default function Brands() {
  usePageMeta({ title: 'Our brands', description: 'The brands you can shop at SORA LIFESTYLE: Biosash, Atomy, Weavers Villa, Leather Factory, Taj Leather and Ansari Fashion.', path: '/brands' });
  return (
    <div className="hx hx-brands">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Our brands</span></nav>
        <h1 className="hx-offers__h">Our brands</h1>
        <p className="hx-offers__lede">The makers we partner with, across wellness, fashion and home. Each one sells here at its own prices.</p>
        <ul className="hx-brands__grid">
          {BRANDS.map((b, i) => {
            const img = brandImage(b, products, isBiosash);
            return (
              <li key={b.id}>
                <Link to={b.href} className="hx-brands__card">
                  <span className={`hx-brands__img${b.imageFrom ? ' is-whole' : ''}`}>
                    {img && <img src={img} alt="" width="600" height="450" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />}
                  </span>
                  <span className="hx-brands__body">
                    <em>{b.store}</em>
                    <b>{b.name}</b>
                    <span>{b.text}</span>
                    <i>Shop {b.name} <Icon name="arrowRight" size={14} /></i>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
