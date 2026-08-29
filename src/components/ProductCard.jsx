import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductImage from './ProductImage.jsx';
import PriceTag from './PriceTag.jsx';
import { useStore } from '../lib/store.jsx';
import { categoryBySlug } from '../data/categories.js';

// ============================================================================
// SORA LIFE V2 — PRODUCT CARD
//
// Public API is unchanged: takes a single `product` and calls the same store
// actions, so every existing call site (Home, Shop, Category, Wishlist,
// Search) keeps working without edits.
//
// Removed in V2, and why:
//   · StarRating   — the rating row cluttered a 173px card and the data is
//                    thin. Ratings belong on the PDP. Component untouched.
//   · QuickView    — the trigger and the hover quick-add strip fought the
//                    imagery. Component untouched, just not mounted here.
//   · badge stack  — at most one badge now, chosen by priority.
//
// Geometry is 2px everywhere; the media frame is square and sharp; there is no
// resting shadow. Separation is the hairline plus paper-on-ivory.
// ============================================================================

// One badge only. Priority: sold out > discount > editorial badge.
function pickBadge(product, out) {
  if (out) return { label: 'Sold out', cls: 'v2-badge--out' };

  const pct = Number(product.discountPct);
  // Under 5% is not worth a badge — and rounding a 3% saving up to "5% off"
  // is exactly the kind of thing that erodes trust.
  if (Number.isFinite(pct) && pct >= 5) return { label: `${pct}% off`, cls: '' };

  const b = Array.isArray(product.badges) ? product.badges[0] : null;
  if (b?.label) {
    return { label: b.label, cls: b.type === 'new' ? 'v2-badge--soft' : 'v2-badge--forest' };
  }
  return null;
}

export default function ProductCard({ product }) {
  const { addToCart, toggleWish, isWished } = useStore();
  const wished = isWished(product.id);
  const out = product.stock === 0;
  const cat = categoryBySlug[product.category];
  const badge = pickBadge(product, out);

  const meta = [cat?.name, product.form].filter(Boolean).join(' · ');
  const lowStock = !out && Number.isFinite(product.stock) && product.stock > 0 && product.stock <= 5;

  return (
    <article className={`v2-pc ${out ? 'is-out' : ''}`}>
      <div className="v2-pc__media">
        <Link to={`/product/${product.slug}`} aria-label={product.name}>
          <ProductImage product={product} frame="v2" />
        </Link>

        {badge && (
          <div className="v2-pc__badges">
            <span className={`v2-badge ${badge.cls}`}>{badge.label}</span>
          </div>
        )}

        <button
          type="button"
          className={`v2-iconbtn v2-pc__wish ${wished ? 'is-on' : ''}`}
          onClick={() => toggleWish(product)}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        >
          <Icon name="heart" size={14} stroke={1.6} fill={wished ? 'currentColor' : 'none'} />
        </button>

        {out && <span className="v2-pc__soldout">Sold out</span>}
      </div>

      <div className="v2-pc__body">
        {meta && <p className="v2-pc__meta">{meta}</p>}

        <h3 className="v2-pc__name">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>

        <div className="v2-pc__foot">
          {lowStock && <span className="v2-pc__note">Only {product.stock} left</span>}
          <PriceTag product={product} showOff={false} v2 />
          {out ? (
            <button type="button" className="v2-pc__cta v2-pc__cta--out" disabled aria-disabled="true">
              Notify me
            </button>
          ) : (
            <button type="button" className="v2-pc__cta" onClick={() => addToCart(product)}>
              <Icon name="bag" size={14} stroke={1.6} /> Add to cart
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
