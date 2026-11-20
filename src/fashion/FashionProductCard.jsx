import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { swatchOverflow } from '../lib/fashion.js';
import { quickAddPlan } from '../lib/fashionPdp.js';
import { useFashionWishlist } from '../lib/fashionWishlist.js';
import { useStore } from '../lib/store.jsx';
import { VariantSheet } from './FashionVariantPicker.jsx';

/**
 * The sizes in stock, for the card (round 9, 2026-11-16): any colour of that size has
 * stock. Short labels ("S (42)" → "S"); nothing for a one-size product or none in stock;
 * at most `max`, the rest as "+n". Pure.
 */
export function cardSizes(view, max = 6) {
  const vs = Array.isArray(view?.variants) ? view.variants : [];
  const sizes = (Array.isArray(view?.sizes) ? view.sizes : []).filter((s) => s && vs.some((v) => v.size === s && Number(v.stock) > 0));
  if (sizes.length < 2) return null;
  // "S (42)", "M-44" → "S", "M"; then smallest first: letter sizes in their order, numbers by value.
  const label = (x) => { const t = String(x).replace(/\s*\([^)]*\)\s*$/, '').trim(); const m = /^(XXS|XS|S|M|L|XL|XXL|[2-5]XL)[\s-]+\d+$/i.exec(t); return (m ? m[1].toUpperCase() : t) || String(x); };
  const rank = (t) => { const i = LETTER_SIZES.indexOf(t.toUpperCase() === 'XXL' ? '2XL' : t.toUpperCase()); if (i >= 0) return i; const n = parseFloat(t); return Number.isFinite(n) ? 100 + n : 10000; };
  const short = [...new Set(sizes.map(label))].sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  return { shown: short.slice(0, max), more: Math.max(0, short.length - max) };
}
const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

// ============================================================
// Fashion product card — image, discount badge, wishlist heart, quick-add,
// price with the MRP struck through, name, rating with review count (once
// there are reviews), and colour swatches with a "+N" overflow.
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
  const sizesLine = cardSizes(view);
  const href = productHref(view);
  const out = !view.inStock;
  return (
    <article className={`fs-card${layout === 'list' ? ' fs-card--list' : ''}${out ? ' is-out' : ''}`} data-product={view.slug}>
      <div className="fs-card__media">
        <Link to={href} className="fs-card__img" aria-label={view.name}>
          {view.image ? <img src={view.image} alt="" loading={mediaLoading} decoding="async" width="600" height="600" /> : <span className="fs-card__noimg" aria-hidden="true">{view.name.slice(0, 1)}</span>}
          {/* The second picture, shown on hover with a mouse (2026-11-13 redesign: product cards). */}
          {view.image && view.images?.[1] && view.images[1] !== view.image && <img className="fs-card__alt" src={view.images[1]} alt="" loading="lazy" decoding="async" width="600" height="600" onError={(e) => { e.currentTarget.remove(); }} />}
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
        {view.brand && <p className={`fs-card__brand${layout === 'list' ? '' : ' fs-card__brand--grid'}`}>{view.brand}</p>}
        {/* No reviews yet: no rating row at all, rather than "0.0 ☆☆☆☆☆ (0)". */}
        {view.reviewCount > 0 && (
          <p className="fs-rating">
            <b>{view.rating.toFixed(1)}</b>
            <Stars value={view.rating} />
            <span className="fs-rating__count">({view.reviewCount >= 1000 ? `${(view.reviewCount / 1000).toFixed(view.reviewCount >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : view.reviewCount})</span>
          </p>
        )}
        {sizesLine && (
          <p className="fs-sizes" aria-label={`Sizes in stock: ${sizesLine.shown.join(', ')}${sizesLine.more ? ` and ${sizesLine.more} more` : ''}`}>
            {sizesLine.shown.map((z) => <span key={z}>{z}</span>)}{sizesLine.more > 0 && <span>+{sizesLine.more}</span>}
          </p>
        )}
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
