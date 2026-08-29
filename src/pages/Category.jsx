import { useParams, Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductBrowser from '../components/ProductBrowser.jsx';
import NotFound from './NotFound.jsx';
import { categoryBySlug, categories, hasConfiguredCategoryCopy } from '../data/categories.js';
import { getByCategory } from '../data/products.js';

// SORA LIFE V2 — Category listing. Same compact head as Shop, plus a rail of
// sibling categories. All copy comes from the real category record (name,
// tagline, blurb); nothing is authored here.
export default function Category() {
  const { slug } = useParams();
  const cat = categoryBySlug[slug];
  if (!cat) return <NotFound />;
  const items = getByCategory(slug);
  const siblings = categories.filter((c) => c.slug !== slug);
  const hasConfiguredCopy = hasConfiguredCategoryCopy(cat);

  return (
    <div className="v2-shop">
      <div className="v2-wrap v2-shop__head">
        <nav className="v2-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <Link to="/shop">Shop</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <strong>{cat.name}</strong>
        </nav>
        {hasConfiguredCopy && cat.tagline && <p className="v2-eyebrow v2-shop__eyebrow">{cat.tagline}</p>}
        <h1 className="v2-shop__title">{cat.name}</h1>
        {hasConfiguredCopy && cat.blurb && <p className="v2-shop__lede">{cat.blurb}</p>}
      </div>

      {siblings.length > 0 && (
        <div className="v2-wrap">
          <div className="v2-rail v2-shop__cats">
            <Link to="/shop" className="v2-chip">
              <Icon name="grid" size={14} stroke={1.5} /> All products
            </Link>
            {siblings.map((c) => (
              <Link key={c.slug} to={`/category/${c.slug}`} className="v2-chip">
                <Icon name={c.icon || 'leaf'} size={14} stroke={1.5} /> {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <ProductBrowser baseProducts={items} lockCategory showCategoryFilter={false} />
    </div>
  );
}
