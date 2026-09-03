import { useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductBrowser from '../components/ProductBrowser.jsx';
import Icon from '../components/Icon.jsx';
import { products } from '../data/products.js';
import { getHomepageSnapshot, subscribeHomepage } from '../lib/settings.js';
import {
  normalizeDiscovery, findCollectionCard, findConcernCard,
  collectionProducts, concernCardProducts, selectCategoryCards, selectConcernCards,
} from '../lib/homeDiscovery.js';

// SORA LIFE V2 — Shop / Product Listing.
// The page head is deliberately compact: on a phone the job is to get real
// products above the fold, so the breadcrumb and title carry the header and
// the supporting line only appears from 768px up.
//
// Two narrowed modes, both driven by the admin's saved discovery cards:
//
//   ?collection=<id>   a curated "Shop by Category" card
//   ?concern=<id>      a "Shop by Concerns" card
//
// Each resolves through the SAME functions that decide whether the homepage
// card is worth rendering, so a card can never open a page that disagrees with
// it. A value that names nothing — a deleted card, a disabled one, a typo — is
// ignored and the full catalogue is shown, rather than erroring.
export default function Shop() {
  const [params] = useSearchParams();
  // Read through the settings store so an admin's saved cards are picked up on
  // the same render as the rest of the homepage settings.
  const savedHomepage = useSyncExternalStore(subscribeHomepage, getHomepageSnapshot, getHomepageSnapshot);
  const discovery = normalizeDiscovery(savedHomepage?.discovery);

  // A collection wins if both are present: one URL, one meaning.
  const collection = findCollectionCard(params.get('collection'), discovery.categoryCards);
  const concern = collection ? null : findConcernCard(params.get('concern'), discovery.concernCards);

  // The sibling chips ARE the homepage rail, minus the card you are on. Built
  // from the same selector rather than from the raw card list, because not
  // every configured card is worth offering: a built-in concern this catalogue
  // cannot back, or one nobody has curated yet, is hidden on the homepage and
  // must not reappear here as a link to an empty page.
  const siblingsOf = (railCards, currentId) => railCards
    .filter((c) => c.id !== currentId)
    .map((c) => ({ key: c.id, label: c.name || c.label, to: c.to }));

  let view = null;
  if (collection) {
    view = {
      name: collection.name,
      items: collectionProducts(collection, products),
      siblings: siblingsOf(
        selectCategoryCards(undefined, products, undefined, savedHomepage?.discovery?.categoryCards),
        collection.id,
      ),
    };
  } else if (concern) {
    view = {
      name: concern.name,
      items: concernCardProducts(concern, products),
      siblings: siblingsOf(
        selectConcernCards(products, undefined, undefined, undefined, savedHomepage?.discovery?.concernCards),
        concern.id,
      ),
    };
  }

  if (!view) {
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

  return (
    <div className="v2-shop">
      <div className="v2-wrap v2-shop__head">
        <nav className="v2-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <Link to="/shop">Shop</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <strong>{view.name}</strong>
        </nav>
        <h1 className="v2-shop__title">{view.name}</h1>
        {/* The plain count, and nothing else. These are shelf labels, not
            claims about what the products do. */}
        <p className="v2-shop__count">{view.items.length} {view.items.length === 1 ? 'product' : 'products'}</p>
      </div>

      {view.siblings.length > 0 && (
        <div className="v2-wrap">
          <div className="v2-rail v2-shop__cats">
            <Link to="/shop" className="v2-chip">
              <Icon name="grid" size={14} stroke={1.5} /> All products
            </Link>
            {view.siblings.map((s) => (
              <Link key={s.key} to={s.to} className="v2-chip">{s.label}</Link>
            ))}
          </div>
        </div>
      )}

      <ProductBrowser baseProducts={view.items} showCategoryFilter={false} />
    </div>
  );
}
