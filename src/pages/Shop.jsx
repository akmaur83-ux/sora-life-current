import { useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductBrowser from '../components/ProductBrowser.jsx';
import Icon from '../components/Icon.jsx';
import { products } from '../data/products.js';
import { getHomepageSnapshot, subscribeHomepage } from '../lib/settings.js';
import {
  concernMatches, discoveryConcernProducts, findConcern, selectConcernCards,
} from '../lib/homeDiscovery.js';

// SORA LIFE V2 — Shop / Product Listing.
// The page head is deliberately compact: on a phone the job is to get real
// products above the fold, so the breadcrumb and title carry the header and
// the supporting line only appears from 768px up.
//
// ?concern=<id> narrows the page to one discovery concern. The set it shows is
// produced by the SAME function that decides whether the homepage card is
// worth rendering (concernMatches), so a card can never open a page that
// disagrees with it. An unrecognised value is ignored rather than shown as an
// error — the URL simply falls back to the full catalogue.
export default function Shop() {
  const [params] = useSearchParams();
  // Read through the settings store so an admin's saved product mapping is
  // picked up on the same render as the rest of the homepage settings.
  const savedHomepage = useSyncExternalStore(subscribeHomepage, getHomepageSnapshot, getHomepageSnapshot);
  const concern = findConcern(params.get('concern'));

  if (!concern) {
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

  const items = concernMatches(concern, products, discoveryConcernProducts(savedHomepage));
  const siblings = selectConcernCards().filter((c) => c.id !== concern.id);

  return (
    <div className="v2-shop">
      <div className="v2-wrap v2-shop__head">
        <nav className="v2-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <Link to="/shop">Shop</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <strong>{concern.label}</strong>
        </nav>
        <h1 className="v2-shop__title">{concern.label}</h1>
        {/* The plain count, and nothing else. A concern is a shelf label, not
            a claim about what these products do. */}
        <p className="v2-shop__count">{items.length} {items.length === 1 ? 'product' : 'products'}</p>
      </div>

      {siblings.length > 0 && (
        <div className="v2-wrap">
          <div className="v2-rail v2-shop__cats">
            <Link to="/shop" className="v2-chip">
              <Icon name="grid" size={14} stroke={1.5} /> All products
            </Link>
            {siblings.map((c) => (
              <Link key={c.id} to={c.to} className="v2-chip">{c.label}</Link>
            ))}
          </div>
        </div>
      )}

      <ProductBrowser baseProducts={items} showCategoryFilter={false} />
    </div>
  );
}
