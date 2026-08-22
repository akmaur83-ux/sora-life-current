import { useParams, Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductBrowser from '../components/ProductBrowser.jsx';
import NotFound from './NotFound.jsx';
import { categoryBySlug, categories } from '../data/categories.js';
import { getByCategory } from '../data/products.js';

export default function Category() {
  const { slug } = useParams();
  const cat = categoryBySlug[slug];
  if (!cat) return <NotFound />;
  const items = getByCategory(slug);

  return (
    <>
      <section className={`cathero tone-${cat.tone}`}>
        <div className="container cathero__in">
          <div>
            <nav className="crumbs"><Link to="/">Home</Link><Icon name="chevronRight" size={14} /><Link to="/shop">Shop</Link><Icon name="chevronRight" size={14} /><span>{cat.name}</span></nav>
            <span className="eyebrow">{cat.tagline}</span>
            <h1 className="serif cathero__title">{cat.name}</h1>
            <p className="cathero__blurb">{cat.blurb}</p>
            <span className="cathero__count">{items.length} products</span>
          </div>
          <div className="cathero__chips">
            {categories.filter((c) => c.slug !== slug).slice(0, 6).map((c) => (
              <Link key={c.slug} to={`/category/${c.slug}`} className="chip">{c.name}</Link>
            ))}
          </div>
        </div>
      </section>
      <div className="section-sm" style={{ paddingTop: 'var(--sp-8)' }}>
        <ProductBrowser baseProducts={items} lockCategory showCategoryFilter={false} />
      </div>
    </>
  );
}
