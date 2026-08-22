import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ProductRail from '../components/ProductRail.jsx';
import { useStore } from '../lib/store.jsx';
import { productById, getBestsellers } from '../data/products.js';

export default function Wishlist() {
  const { wishlist, addToCart } = useStore();
  const items = wishlist.map((id) => productById[id]).filter(Boolean);

  if (!items.length) {
    return (
      <div className="container section">
        <div className="state">
          <span className="state-ic"><Icon name="heart" size={32} /></span>
          <h3>Your wishlist is empty</h3>
          <p>Save the products you love by tapping the heart — they'll live here for later.</p>
          <Link to="/shop" className="btn">Find something you love <Icon name="arrowRight" size={18} /></Link>
        </div>
        <ProductRail eyebrow="Get inspired" title="Popular right now" products={getBestsellers()} link="/shop" />
      </div>
    );
  }

  return (
    <>
      <div className="pagehead"><div className="container">
        <nav className="crumbs"><Link to="/">Home</Link><Icon name="chevronRight" size={14} /><span>Wishlist</span></nav>
        <div className="wishhead">
          <div><h1 className="serif">Your wishlist</h1><p className="muted">{items.length} saved {items.length === 1 ? 'item' : 'items'}.</p></div>
          <button className="btn btn-outline" onClick={() => items.forEach((p) => p.stock > 0 && addToCart(p))}><Icon name="bag" size={18} /> Add all to cart</button>
        </div>
      </div></div>
      <div className="container section-sm" style={{ paddingTop: 'var(--sp-8)' }}>
        <div className="pgrid">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </div>
      <ProductRail eyebrow="More to love" title="You might also like" products={getBestsellers()} link="/shop" />
    </>
  );
}
