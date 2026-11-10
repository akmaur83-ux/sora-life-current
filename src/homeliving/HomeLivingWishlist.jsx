import { Link } from 'react-router-dom';
import { useHomeLivingCatalogue } from '../data/homelivingHomepage.js';
import { useHomeLivingWishlist } from '../lib/homelivingWishlist.js';
import { Breadcrumb } from './HomeLivingCategory.jsx';
import HomeLivingProductCard from './HomeLivingProductCard.jsx';
import ShareList from '../components/ShareList.jsx';
import PriceDrops from '../components/PriceDrops.jsx';

// /homeliving/wishlist (owner, 2026-11-08): the products saved with a heart in this
// browser, newest first; a saved product no longer in the catalogue is skipped.
export default function HomeLivingWishlist() {
  const wish = useHomeLivingWishlist();
  const { status, products } = useHomeLivingCatalogue();
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const saved = [...wish.ids].reverse().map((id) => byId.get(String(id))).filter(Boolean);
  return (
    <div className="hl-wrap hl-listing">
      <Breadcrumb trail={[{ name: 'Home & Living', href: '/homeliving' }, { name: 'Wishlist' }]} />
      <div className="hl-listing__bar">
        <h1 className="hl-listing__h serif">Your wishlist</h1>
        <p className="hl-listing__count" role="status">{status === 'loading' ? 'Loading…' : `${saved.length} ${saved.length === 1 ? 'product' : 'products'}`}</p>
      </div>
      {saved.length === 0 ? (
        <div className="hl-empty hl-empty--listing">
          <p>{status === 'loading' ? 'Loading your wishlist…' : 'Nothing saved yet. Tap the heart on any product to keep it here.'}</p>
          {status !== 'loading' && <Link to="/homeliving" className="hl-btn">Browse Home &amp; Living</Link>}
        </div>
      ) : (
        <>
        <PriceDrops items={saved.map((p) => ({ key: `hl-${p.id}`, name: p.name, price: p.price, href: `/homeliving/p/${p.slug}`, image: (p.gallery && p.gallery[0]?.url) || p.images?.[0] || null }))} />
        <ShareList items={saved.map((p) => ({ name: p.name, price: p.price, href: `/homeliving/p/${p.slug}` }))} heading="My Home & Living wishlist on SORA LIFESTYLE" />
        <div className="hl-grid">
          {saved.map((p, i) => <HomeLivingProductCard key={p.id} product={p} mediaLoading={i < 2 ? 'eager' : 'lazy'} />)}
        </div>
        </>
      )}
    </div>
  );
}
