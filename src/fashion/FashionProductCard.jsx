import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { swatchOverflow } from '../lib/fashion.js';
import { quickAddPlan } from '../lib/fashionPdp.js';
import { useFashionWishlist } from '../lib/fashionWishlist.js';
import { useStore } from '../lib/store.jsx';
import { VariantSheet } from './FashionVariantPicker.jsx';

// ============================================================
// Fashion product card — image, discount badge, wishlist heart, quick-add,
// price with the MRP struck through, name, rating with review count, and
// colour swatches with a "+N" overflow.
//
// Quick-add is real: a product with one size × colour goes straight into
// the cart; one with several opens the size/colour sheet. The line the
// store keeps carries ids only — the server prices it.
// ============================================================
const rupee = (v) => money(v);
export const productHref = (view) => `/fashion/p/${view.slug}`;

export function Stars({ value, size = 13 }) {
  const full = Math.round(Number(value) || 0);
  return (
    <span className="fs-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} fill={i <= full ? 'currentColor' : 'none'} className={i <= full ? 'is-full' : 'is-empty'} stroke={1.4} />)}
    </span>
  );
}

export default function FashionProductCard({ view, layout = 'grid', mediaLoading = 'lazy' }) {
  const wish = useFashionWishlist();
  const { addFashionToCart } = useStore();
  const [sheet, setSheet] = useState(false);
  const wished = wish.has(view.id);
  const plan = quickAddPlan(view);
  const quickAdd = () => {
    if (plan.mode === 'direct') addFashionToCart(view, plan.variant);
    else if (plan.mode === 'sheet') setSheet(true);
  };
  const { shown, more } = swatchOverflow(view.swatches, 4);
  const href = productHref(view);
  const out = !view.inStock;
  return (
    <article className={`fs-card${layout === 'list' ? ' fs-card--list' : ''}${out ? ' is-out' : ''}`} data-product={view.slug}>
      <div className="fs-card__media">
        <Link to={href} className="fs-card__img" aria-label={view.name}>
          {view.image ? <img src={view.image} alt="" loading={mediaLoading} decoding="async" width="600" height="600" /> : <span className="fs-card__noimg" aria-hidden="true">{view.name.slice(0, 1)}</span>}
        </Link>
        {out ? <span className="fs-badge fs-badge--out">Sold out</span>
          : view.hasDiscount ? <span className="fs-badge">{view.discountPct}% OFF</span>
          : view.isNew ? <span className="fs-badge fs-badge--soft">New</span> : null}
        <button type="button" className={`fs-heart${wished ? ' is-on' : ''}`} aria-pressed={wished} aria-label={wished ? `Remove ${view.name} from wishlist` : `Save ${view.name} to wishlist`} onClick={() => wish.toggle(view.id)}>
          <Icon name="heart" size={17} fill={wished ? 'currentColor' : 'none'} />
        </button>
        {plan.mode !== 'none' && (
          <button type="button" className="fs-quick" data-quick={plan.mode} aria-label={plan.mode === 'direct' ? `Add ${view.name} to cart` : `Choose size and colour for ${view.name}`} onClick={quickAdd}><Icon name="plus" size={20} /></button>
        )}
      </div>
      <div className="fs-card__body">
        <p className="fs-price">
          <strong><span className="fs-price__cur">₹</span>{rupee(view.price).replace(/^₹\s?/, '')}</strong>
          {view.hasDiscount && <span className="fs-price__mrp">M.R.P: <s>{rupee(view.mrp)}</s></span>}
        </p>
        <h3 className="fs-card__name"><Link to={href}>{view.name}</Link></h3>
        {layout === 'list' && view.brand && <p className="fs-card__brand">{view.brand}</p>}
        <p className="fs-rating">
          <b>{view.rating.toFixed(1)}</b>
          <Stars value={view.rating} />
          <span className="fs-rating__count">({view.reviewCount >= 1000 ? `${(view.reviewCount / 1000).toFixed(view.reviewCount >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : view.reviewCount})</span>
        </p>
        {shown.length > 1 && (
          <p className="fs-swatches" aria-label={`${view.swatches.length} colours`}>
            {shown.map((s) => <span key={s.colour} className={`fs-swatch${s.stock === 0 ? ' is-out' : ''}`} style={{ background: s.hex || '#D9CBB0' }} title={s.colour} />)}
            {more > 0 && <Link to={href} className="fs-swatches__more">+{more}</Link>}
          </p>
        )}
      </div>
      {sheet && <VariantSheet view={view} onAdd={(variant) => addFashionToCart(view, variant)} onClose={() => setSheet(false)} />}
    </article>
  );
}
