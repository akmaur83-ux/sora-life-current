import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import RequestProduct from '../components/RequestProduct.jsx';
import { useGroceryCatalogue } from '../data/groceryHomepage.js';
import { usePageMeta } from '../lib/pageMeta.js';
import GroceryProductCard from './GroceryProductCard.jsx';

// ============================================================
// A grocery category (bug audit, 2026-11-21): the grocery homepage linked ten categories to
// /grocery/category/<slug>, and every one was a 404 — the route had never been made. The
// page lists the category's live products (its sub-categories' too); one with none yet says
// so plainly, offers to note what the shopper wanted, and leads back to the grocery store.
// ============================================================

/** The category and its live products, sub-categories included. Pure. */
export function groceryCategoryView(categories, products, slug) {
  const cats = Array.isArray(categories) ? categories : [];
  const cat = cats.find((c) => c && c.slug === slug) || null;
  if (!cat) return { cat: null, items: [] };
  const ids = new Set([cat.id, ...cats.filter((c) => c.parent_id === cat.id).map((c) => c.id)]);
  const items = (Array.isArray(products) ? products : []).filter((p) => p && ids.has(p.category_id) && !p.is_demo);
  return { cat, items };
}

export default function GroceryCategory() {
  const { slug } = useParams();
  const { status, categories, products } = useGroceryCatalogue();
  const { cat, items } = groceryCategoryView(categories, products, slug);
  usePageMeta({ title: cat ? `${cat.name} — Grocery` : 'Grocery', description: cat?.tagline || 'Groceries at SORA LIFESTYLE.' });
  return (
    <section className="gs-sec gs-cat" aria-labelledby="gs-cat-h">
      <nav className="gs-cat__crumbs" aria-label="Breadcrumb"><Link to="/grocery">Grocery</Link> <span aria-hidden="true">›</span> <span>{cat?.name || 'Category'}</span></nav>
      <header className="gs-sec__head">
        <div>
          <h1 className="gs-sec__h serif" id="gs-cat-h">{cat?.name || (status === 'loading' ? 'Loading…' : 'Category')}</h1>
          {cat?.tagline && <p className="gs-sec__sub">{cat.tagline}</p>}
        </div>
      </header>
      {status === 'loading' && !cat ? (
        <p className="gs-empty">Loading the catalogue…</p>
      ) : items.length ? (
        <div className="gs-catgrid">
          {items.map((p, i) => <GroceryProductCard key={p.id} product={p} mediaLoading={i < 4 ? 'eager' : 'lazy'} />)}
        </div>
      ) : (
        <div className="gs-empty gs-cat__empty">
          <p>{cat ? `${cat.name} is being stocked — products appear here as they go live.` : 'This grocery category is not in the store.'}</p>
          <Link to="/grocery" className="gs-sec__link"><Icon name="chevronLeft" size={16} /> Back to Grocery</Link>
          {cat && <RequestProduct q={cat.name} store="grocery" />}
        </div>
      )}
    </section>
  );
}
