import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductImage from './ProductImage.jsx';
import StarRating from './StarRating.jsx';
import PriceTag from './PriceTag.jsx';
import QuickView from './QuickView.jsx';
import { useStore } from '../lib/store.jsx';
import { categoryBySlug } from '../data/categories.js';

const badgeClass = { new: 'badge-new', best: 'badge-best', sale: 'badge-sale' };

export default function ProductCard({ product }) {
  const { addToCart, toggleWish, isWished } = useStore();
  const [qv, setQv] = useState(false);
  const wished = isWished(product.id);
  const out = product.stock === 0;
  const cat = categoryBySlug[product.category];

  return (
    <article className="pcard">
      <div className="pcard__media">
        <Link to={`/product/${product.slug}`} aria-label={product.name}>
          <ProductImage product={product} />
        </Link>

        <div className="pcard__badges">
          {out ? (
            <span className="badge badge-out">Sold out</span>
          ) : (
            product.badges.slice(0, 2).map((b) => (
              <span key={b.type} className={`badge ${badgeClass[b.type] || ''}`}>{b.label}</span>
            ))
          )}
        </div>

        <button
          className={`pcard__wish ${wished ? 'active' : ''}`}
          onClick={() => toggleWish(product)}
          aria-pressed={wished}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Icon name="heart" size={20} fill={wished ? 'currentColor' : 'none'} />
        </button>

        {!out && (
          <div className="pcard__quick">
            <button className="btn btn-sm btn-block pcard__quickadd" onClick={() => addToCart(product)}>
              <Icon name="bag" size={16} /> Quick add
            </button>
            <button className="btn btn-sm btn-light" onClick={() => setQv(true)} aria-label="Quick view" title="Quick view" style={{ paddingInline: 12 }}>
              <Icon name="eye" size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="pcard__body">
        <span className="pcard__cat">{cat?.name}{product.form ? <span className="pcard__cat-form"> · {product.form}</span> : ''}</span>
        <h3 className="pcard__name"><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
        {product.reviewCount > 0 && <StarRating value={product.rating} count={product.reviewCount} size={14} />}
        <div className="pcard__foot">
          <PriceTag product={product} showOff={false} />
          {out ? (
            <span className="hint">Notify me</span>
          ) : (
            <button className="iconbtn pcard__add" onClick={() => addToCart(product)} aria-label="Add to cart">
              <Icon name="plus" size={18} />
            </button>
          )}
        </div>
      </div>

      {qv && <QuickView product={product} onClose={() => setQv(false)} />}
    </article>
  );
}
