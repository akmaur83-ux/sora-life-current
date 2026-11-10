import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHomeLivingCatalogue } from '../data/homelivingHomepage.js';
import { searchItems, didYouMean } from '../lib/searchMatch.js';
import { DidYouMean } from '../components/SearchSuggest.jsx';
import { homelivingSearchRows } from './HomeLivingLayout.jsx';
import { Breadcrumb, Listing } from './HomeLivingCategory.jsx';
import HomeLivingProductCard from './HomeLivingProductCard.jsx';

// ============================================================
// /homeliving/search?q=… (owner, 2026-11-08: the store's search bar was visual
// only). The same rule as the live suggestions (searchMatch.js): every word in
// the name, brand or category; best matches first, then the catalogue's order.
// ============================================================
export default function HomeLivingSearch() {
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const { status, products, categories } = useHomeLivingCatalogue();
  const rows = useMemo(() => homelivingSearchRows(products, categories), [products, categories]);
  const results = useMemo(() => (q.length >= 2 ? searchItems(rows, q).map((r) => r.product) : []), [q, rows]);
  const fix = useMemo(() => (q.length >= 2 && results.length === 0 ? didYouMean(rows, q) : ''), [q, rows, results.length]);
  const title = q ? `Results for “${q}”` : 'Search Home & Living';
  // No words, a filter (?price= from "Shop by budget"): the whole range, with the listing's filters and sort.
  if (!q && params.get('price')) {
    return <Listing title="All Home & Living" trail={[{ name: 'Home & Living', href: '/homeliving' }, { name: 'All products' }]} emptyCopy="Nothing in this price range yet." />;
  }
  return (
    <div className="hl-wrap hl-listing">
      <Breadcrumb trail={[{ name: 'Home & Living', href: '/homeliving' }, { name: 'Search' }]} />
      <div className="hl-listing__bar">
        <h1 className="hl-listing__h serif">{title}</h1>
        {q.length >= 2 && <p className="hl-listing__count" role="status">{status === 'loading' ? 'Loading…' : `${results.length} ${results.length === 1 ? 'product' : 'products'}`}</p>}
      </div>
      {q.length < 2 ? (
        <div className="hl-empty hl-empty--listing"><p>Type at least two letters in the search bar above, e.g. “bedsheet”, “cushion” or “table cover”.</p></div>
      ) : results.length === 0 ? (
        <div className="hl-empty hl-empty--listing">
          <p>{status === 'loading' ? 'Loading the catalogue…' : `Nothing in Home & Living matches “${q}”. Try a shorter word, or browse the store.`}</p>
          {status !== 'loading' && <DidYouMean fix={fix} href={`/homeliving/search?q=${encodeURIComponent(fix)}`} />}
          {status !== 'loading' && <Link to="/homeliving" className="hl-btn">Browse Home &amp; Living</Link>}
        </div>
      ) : (
        <div className="hl-grid">
          {results.map((p, i) => <HomeLivingProductCard key={p.id} product={p} layout="grid" mediaLoading={i < 2 ? 'eager' : 'lazy'} />)}
        </div>
      )}
    </div>
  );
}
