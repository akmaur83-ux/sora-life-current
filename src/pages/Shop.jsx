import { Link } from 'react-router-dom';
import ProductBrowser from '../components/ProductBrowser.jsx';
import Icon from '../components/Icon.jsx';
import { products } from '../data/products.js';

// SORA LIFE V2 — Shop / Product Listing.
// The page head is deliberately compact: on a phone the job is to get real
// products above the fold, so the breadcrumb and title carry the header and
// the supporting line only appears from 768px up.
export default function Shop() {
  return (
    <div className="v2-shop">
      <div className="v2-wrap v2-shop__head">
        <nav className="v2-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <strong>Shop</strong>
        </nav>
        <h1 className="v2-shop__title">All products</h1>
        <p className="v2-shop__lede">
          Browse wellness, nutrition, hair, skin, beauty and everyday-care products available through Sora Life.
        </p>
      </div>

      <ProductBrowser baseProducts={products} />
    </div>
  );
}
