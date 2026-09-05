import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductImage from './ProductImage.jsx';
import StarRating from './StarRating.jsx';
import PriceTag from './PriceTag.jsx';
import { useStore } from '../lib/store.jsx';
import { isPurchasable, UNAVAILABLE_LABEL } from '../data/products.js';
import { categoryBySlug } from '../data/categories.js';
import { benefitsFor } from '../data/pdpContent.js';

export default function QuickView({ product, onClose }) {
  const { addToCart, toggleWish, isWished } = useStore();
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState(product.variants?.[0]?.label || null);
  const cat = categoryBySlug[product.category];
  // Through the shared helper, not off product.benefits directly. The field
  // used to be an array of strings and the list below rendered `{b}` straight
  // into JSX; migration 0025 stores objects, which React cannot render as a
  // child — the quick view would have thrown on the first ingested product.
  // benefitsFor() normalises both shapes.
  const quickBenefits = benefitsFor(product).items;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="modal-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Quick view: ${product.name}`}>
      <div className="modal qv" onClick={(e) => e.stopPropagation()}>
        <button className="iconbtn modal__close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        <div className="qv__grid">
          <div className="qv__media"><ProductImage product={product} /></div>
          <div className="qv__info">
            <span className="pcard__cat">{cat?.name}</span>
            <h2 style={{ fontSize: 'var(--text-2xl)', margin: '4px 0 8px' }}>{product.name}</h2>
            {product.reviewCount > 0 && <StarRating value={product.rating} count={product.reviewCount} />}
            <p className="muted" style={{ margin: '14px 0' }}>{product.shortDescription}</p>
            <PriceTag product={product} size="lg" />

            {product.variants && (
              <div style={{ marginTop: 18 }}>
                <div className="label" style={{ marginBottom: 8 }}>Variant</div>
                <div className="taglist">
                  {product.variants.map((v) => (
                    <button key={v.id} className={`chip ${variant === v.label ? 'active' : ''}`} onClick={() => setVariant(v.label)}>{v.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="qv__actions">
              <div className="qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease"><Icon name="minus" size={16} /></button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} aria-label="Increase"><Icon name="plus" size={16} /></button>
              </div>
              <button className="btn btn-block" disabled={!isPurchasable(product, variant)} onClick={() => { addToCart(product, qty, variant); onClose(); }}>
                <Icon name="bag" size={18} /> {isPurchasable(product, variant) ? 'Add to cart' : UNAVAILABLE_LABEL}
              </button>
              <button className="iconbtn" style={{ border: '1px solid var(--line)' }} onClick={() => toggleWish(product)} aria-label="Wishlist">
                <Icon name="heart" size={20} fill={isWished(product.id) ? 'currentColor' : 'none'} style={isWished(product.id) ? { color: 'var(--color-sale)' } : undefined} />
              </button>
            </div>

            {quickBenefits.length > 0 && (
              <ul className="qv__benefits">
                {quickBenefits.slice(0, 3).map((b) => (
                  <li key={b.label}><Icon name="check" size={16} /> {b.label}</li>
                ))}
              </ul>
            )}
            <Link to={`/product/${product.slug}`} className="sec-link" onClick={onClose} style={{ marginTop: 4 }}>
              View full details <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
