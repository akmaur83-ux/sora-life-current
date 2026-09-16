import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';
import { deliveryEstimate, deliveryOptions } from '../data/pdpContent.js';
import { breadcrumbFor } from '../lib/fashion.js';
import { readSelection, writeSelection, selectionState, relatedFor } from '../lib/fashionPdp.js';
import { useFashionWishlist } from '../lib/fashionWishlist.js';
import { useFashionCatalogue } from './FashionCatalogue.jsx';
import { CategoryChips } from './FashionLayout.jsx';
import { Breadcrumb } from './FashionListing.jsx';
import FashionProductCard, { Stars } from './FashionProductCard.jsx';
import { VariantPicker } from './FashionVariantPicker.jsx';

// ============================================================
// /fashion/p/<slug> — the product page.
//
// Gallery (swipeable on a phone, thumbnails on desktop), brand, name,
// rating, the price row, colour and size selectors with per-combination
// stock, Add to Cart / Buy Now (both wait for a size AND a colour), the real
// delivery rules, the description, and related styles. The chosen size and
// colour live in the URL, so a link to a variant opens on that variant.
// Every price shown is the row's own figure; the order is priced server-side.
// ============================================================

function Gallery({ view }) {
  const images = view.images.length ? view.images : (view.image ? [view.image] : []);
  const [active, setActive] = useState(0);
  if (images.length === 0) return <div className="fs-pdp__media fs-pdp__media--none" aria-hidden="true"><b>{view.name.slice(0, 1)}</b></div>;
  return (
    <div className="fs-gallery">
      <div className="fs-gallery__track" role="group" aria-label={`${view.name} images`}>
        {images.map((src, i) => (
          <figure key={src + i} className={`fs-gallery__slide${i === active ? ' is-on' : ''}`} id={`fs-slide-${i}`}>
            <img src={src} alt={i === 0 ? view.name : `${view.name} — view ${i + 1}`} width="900" height="900" decoding="async" loading={i === 0 ? 'eager' : 'lazy'} fetchpriority={i === 0 ? 'high' : undefined} />
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <div className="fs-gallery__thumbs" role="tablist" aria-label="Choose image">
          {images.map((src, i) => (
            <a key={src + i} href={`#fs-slide-${i}`} role="tab" aria-selected={i === active} className={`fs-gallery__thumb${i === active ? ' is-on' : ''}`} onClick={() => setActive(i)}>
              <img src={src} alt="" width="120" height="120" loading="lazy" decoding="async" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryBlock() {
  const est = deliveryEstimate();
  const options = deliveryOptions();
  return (
    <section className="fs-pdp__delivery" aria-labelledby="fs-deliv-h">
      <h2 className="fs-pdp__h2" id="fs-deliv-h"><Icon name="truck" size={18} /> Delivery</h2>
      <ul className="fs-pdp__ship">
        {options.map((o) => (
          <li key={o.id}><span>{o.label}<em>{o.eta}</em></span><b>{o.price === 0 ? 'Free' : money(o.price)}</b></li>
        ))}
      </ul>
      <p className="fs-pdp__fine">{est.range} — {est.days.toLowerCase()}. Delivery is chosen at checkout.</p>
    </section>
  );
}

export default function FashionProductPage() {
  const { slug } = useParams();
  const { status, tree, views, bySlug } = useFashionCatalogue();
  const { addFashionToCart } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const wish = useFashionWishlist();
  const view = bySlug.get(String(slug || ''));

  if (!view) {
    return (
      <div className="fs-listing">
        <CategoryChips />
        <div className="fs-empty">
          <p>{status === 'loading' ? 'Loading the catalogue…' : `There is no “${slug}” in the fashion store.`}</p>
          <Link to="/fashion" className="fs-btn">Back to fashion</Link>
        </div>
      </div>
    );
  }

  const node = view.category_id ? tree.byId.get(view.category_id) : null;
  const trail = [...breadcrumbFor(tree, node), { name: view.name }];
  const sel = readSelection(params, view);
  const st = selectionState(view, sel);
  const setSel = (next) => setParams(writeSelection(params, next), { replace: true });
  const wished = wish.has(view.id);
  const related = relatedFor(view, views, 4);

  const add = () => addFashionToCart(view, st.variant);
  const buyNow = () => { if (addFashionToCart(view, st.variant)) navigate('/checkout'); };
  const addLabel = st.canAdd ? 'Add to cart' : st.status === 'out' ? 'Out of stock' : st.status === 'missing' ? 'Not available' : st.missing;

  return (
    <div className="fs-pdp" data-product={view.slug}>
      <CategoryChips />
      <Breadcrumb trail={trail} />
      <div className="fs-pdp__grid">
        <Gallery view={view} />
        <div className="fs-pdp__body">
          {view.brand && <p className="fs-pdp__brand">{view.brand}</p>}
          <h1 className="fs-pdp__h serif">{view.name}</h1>
          <p className="fs-rating"><b>{view.rating.toFixed(1)}</b><Stars value={view.rating} size={15} /><span className="fs-rating__count">({view.reviewCount.toLocaleString('en-IN')} {view.reviewCount === 1 ? 'review' : 'reviews'})</span></p>

          <p className="fs-price fs-price--lg" data-price={st.price}>
            <strong><span className="fs-price__cur">₹</span>{money(st.price).replace(/^₹\s?/, '')}</strong>
            {view.hasDiscount && <><span className="fs-price__mrp">M.R.P: <s>{money(view.mrp)}</s></span><span className="fs-badge">{view.discountPct}% OFF</span></>}
          </p>
          <p className="fs-pdp__tax">Inclusive of all taxes</p>

          <VariantPicker view={view} size={st.size} colour={st.colour} onChange={setSel} />

          <div className="fs-pdp__actions">
            <button type="button" className="fs-btn fs-btn--add" disabled={!st.canAdd} onClick={add} data-can-add={st.canAdd ? 'yes' : 'no'}>
              <Icon name="bag" size={18} /> {addLabel}
            </button>
            <button type="button" className="fs-btn fs-btn--buy" disabled={!st.canAdd} onClick={buyNow}>Buy now</button>
            <button type="button" className={`fs-heart fs-heart--inline${wished ? ' is-on' : ''}`} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'} onClick={() => wish.toggle(view.id)}>
              <Icon name="heart" size={20} fill={wished ? 'currentColor' : 'none'} />
            </button>
          </div>

          <DeliveryBlock />

          {view.description && (
            <section className="fs-pdp__section" aria-labelledby="fs-desc-h">
              <h2 className="fs-pdp__h2" id="fs-desc-h">About this style</h2>
              <p className="fs-pdp__desc">{view.description}</p>
            </section>
          )}
          {(view.brand || node) && (
            <section className="fs-pdp__section" aria-labelledby="fs-details-h">
              <h2 className="fs-pdp__h2" id="fs-details-h">Details</h2>
              <dl className="fs-pdp__details">
                {view.brand && <div><dt>Brand</dt><dd>{view.brand}</dd></div>}
                {node && <div><dt>Category</dt><dd>{tree.ancestors(node.id).map((a) => a.name).join(' › ')}</dd></div>}
                {view.sizes.length > 0 && <div><dt>Sizes</dt><dd>{view.sizes.join(', ')}</dd></div>}
                {view.swatches.length > 0 && <div><dt>Colours</dt><dd>{view.swatches.map((s) => s.colour).join(', ')}</dd></div>}
              </dl>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="fs-sec" aria-labelledby="fs-related-h">
          <header className="fs-sec__head"><h2 className="fs-sec__h serif" id="fs-related-h">You may also like</h2></header>
          <div className="fs-grid fs-grid--related">
            {related.map((v) => <FashionProductCard key={v.id} view={v} />)}
          </div>
        </section>
      )}

      {/* Phone: the price and the buy button stay in reach. */}
      <div className="fs-pdp__bar" role="region" aria-label="Buy">
        <span className="fs-pdp__bar-price"><b><span className="fs-price__cur">₹</span>{money(st.price).replace(/^₹\s?/, '')}</b>{st.label && <em>{st.label}</em>}</span>
        <button type="button" className="fs-btn fs-btn--add" disabled={!st.canAdd} onClick={add}><Icon name="bag" size={18} /> {st.canAdd ? 'Add to cart' : st.missing || addLabel}</button>
      </div>
    </div>
  );
}
