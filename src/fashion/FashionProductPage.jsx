import { useRef, useState } from 'react';
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
import ProductInformation from '../components/ProductInformation.jsx';
import { GalleryZoom } from '../homeliving/HomeLivingProductPage.jsx';
import { PdpPrice, PdpSaving, PdpAssurances, PdpFactTable, PdpAbout, aboutBullets, PdpCompare, PdpService, PdpBrandRail, PdpRecent, PdpShare, PdpReviews, useRecentlyViewed, useHoverZoom } from '../components/pdp/PdpOwnerKit.jsx';
import { useFashionDetails, countryName } from '../lib/fashionPdpDetails.js';
import PdpDeliveryDate from '../components/pdp/PdpDeliveryDate.jsx';

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

export function Gallery({ view }) {
  const images = view.images.length ? view.images : (view.image ? [view.image] : []);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(null);   // the picture open full screen (Home & Living's viewer: pinch, swipe, Escape)
  const track = useRef(null);
  /**
   * Show image i: the track scrolls sideways to it and nothing else moves — not the
   * window, not the URL, not history. (The thumbnails were #fs-slide-N links, and the
   * browser's fragment jump scrolled the whole page and added a history entry per click.)
   */
  const show = (i) => {
    setActive(i);
    const el = track.current, slide = el?.children[i];
    if (!slide) return;
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: slide.offsetLeft - el.firstElementChild.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
  };
  if (images.length === 0) return <div className="fs-pdp__media fs-pdp__media--none" aria-hidden="true"><b>{view.name.slice(0, 1)}</b></div>;
  return (
    <div className="fs-gallery">
      <div className="fs-gallery__track" role="group" aria-label={`${view.name} images`} ref={track}>
        {images.map((src, i) => (
          <figure key={src + i} className={`fs-gallery__slide${i === active ? ' is-on' : ''}`} id={`fs-slide-${i}`} onClick={() => setZoom(i)}>
            <img src={src} alt={i === 0 ? view.name : `${view.name} — view ${i + 1}`} width="900" height="900" decoding="async" loading={i === 0 ? 'eager' : 'lazy'} fetchpriority={i === 0 ? 'high' : undefined} />
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <div className="fs-gallery__thumbs" role="tablist" aria-label="Choose image">
          {images.map((src, i) => (
            <button key={src + i} type="button" role="tab" aria-selected={i === active} aria-controls={`fs-slide-${i}`} aria-label={`Show image ${i + 1} of ${images.length}`} className={`fs-gallery__thumb${i === active ? ' is-on' : ''}`} onClick={() => show(i)}>
              <img src={src} alt="" width="120" height="120" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
      {zoom != null && <GalleryZoom images={images.map((url, i) => ({ url, alt: i === 0 ? view.name : `${view.name} — view ${i + 1}` }))} start={zoom} name={view.name} onClose={() => setZoom(null)} />}
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

/**
 * One-size pieces (shawls, stoles, caps) open ready to buy, as a marketplace page does: the only
 * size, and the first colour in stock (or the only one). A garment with several sizes waits for
 * the customer to choose both; whatever the URL names always wins.
 */
export function defaultSelection(view, sel) {
  if (view.sizes.length !== 1) return sel;
  const size = sel.size ?? view.sizes[0];
  let colour = sel.colour;
  if (!colour) {
    const live = view.swatches.find((sw) => view.variants.some((v) => v.size === size && v.colour === sw.colour && v.stock > 0));
    colour = live ? live.colour : (view.swatches.length === 1 ? view.swatches[0].colour : null);
  }
  return { size, colour };
}

export default function FashionProductPage() {
  const { slug } = useParams();
  const { status, tree, views, bySlug } = useFashionCatalogue();
  const { addFashionToCart } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const wish = useFashionWishlist();
  const view = bySlug.get(String(slug || ''));
  const facts = useFashionDetails(view?.id);
  const recent = useRecentlyViewed(view ? { key: `fs-${view.id}`, href: `/fashion/p/${view.slug}`, name: view.name, image: view.image, price: view.price } : null);
  useHoverZoom('.fs-pdp .fs-gallery__slide', view?.id);

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
  const sel = defaultSelection(view, readSelection(params, view));
  const st = selectionState(view, sel);
  const setSel = (next) => setParams(writeSelection(params, next), { replace: true });
  const wished = wish.has(view.id);
  const related = relatedFor(view, views, 8);
  const priced = { ...view, price: st.price };
  const bullets = aboutBullets(view.description);
  const anyLive = view.variants.some((v) => v.stock > 0);
  const stockText = st.status === 'in' ? 'In stock' : st.status === 'low' ? st.stockNote : st.status === 'choose' ? (anyLive ? 'In stock' : 'Out of stock') : st.stockNote;
  const stockClass = st.status === 'choose' ? (anyLive ? 'in' : 'out') : st.status;
  const factRows = [
    ['Brand', view.brand],
    ['Material', facts?.material],
    ['Colour', st.colour || (view.swatches.length ? view.swatches.map((x) => x.colour).join(', ') : null)],
    ['Size', st.size || (view.sizes.length ? view.sizes.join(', ') : null)],
    ['Net quantity', facts?.net_content],
    ['Product type', facts?.generic_name],
    ['Category', node ? tree.ancestors(node.id).map((a) => a.name).join(' › ') : null],
    ['Care', facts?.care],
    ['SKU', st.variant?.sku || facts?.sku],
    ['Country of origin', facts?.country_of_origin ? countryName(facts.country_of_origin) : null],
    ['Delivery', 'Standard, 6–7 business days, free'],
    ['Returns', 'Within 7 days of delivery'],
  ];

  const add = () => addFashionToCart(view, st.variant);
  const buyNow = () => { if (addFashionToCart(view, st.variant)) navigate('/checkout'); };
  const addLabel = st.canAdd ? 'Add to cart' : st.status === 'out' ? 'Out of stock' : st.status === 'missing' ? 'Not available' : st.missing;

  return (
    <div className="fs-pdp fs-pdp--mk" data-product={view.slug}>
      <CategoryChips />
      <Breadcrumb trail={trail} />
      <div className="fs-pdp__grid">
        <Gallery view={view} />
        <div className="fs-pdp__body">
          {view.brand && <p className="fs-pdp__brand">Brand: <Link to={`/fashion/search?q=${encodeURIComponent(view.brand)}`}>{view.brand}</Link></p>}
          <h1 className="fs-pdp__h serif">{view.name}</h1>
          {/* No reviews yet: no rating row, rather than "0.0 ☆☆☆☆☆ (0 reviews)" (as on the card). */}
          {view.reviewCount > 0 && <p className="fs-rating"><b>{view.rating.toFixed(1)}</b><Stars value={view.rating} size={15} /><span className="fs-rating__count">({view.reviewCount.toLocaleString('en-IN')} {view.reviewCount === 1 ? 'review' : 'reviews'})</span></p>}
          {facts?.net_content && <p className="fs-pdp__net">{facts.net_content}</p>}

          <div className="fs-pdp__pricewrap" data-price={st.price}>
            <PdpPrice product={priced} />
            <p className="fs-pdp__tax">Inclusive of all taxes</p>
            <PdpSaving product={priced} />
          </div>
          <PdpAssurances />

          <VariantPicker view={view} size={st.size} colour={st.colour} onChange={setSel} />

          <PdpFactTable rows={factRows} />
          <PdpAbout bullets={bullets} />
          {view.description && bullets.length < 2 && (
            <section className="fs-pdp__section" aria-labelledby="fs-desc-h">
              <h2 className="fs-pdp__h2" id="fs-desc-h">About this item</h2>
              <p className="fs-pdp__desc">{view.description}</p>
            </section>
          )}
          <ProductInformation store="fashion" productId={view.id} variant={st.variant} prefix="fs" />
        </div>

        <aside className="fs-buybox" aria-label="Buy">
          <p className="fs-buybox__price"><span className="fs-price__cur">₹</span>{money(st.price).replace(/^₹\s?/, '')}</p>
          <PdpDeliveryDate out={st.status === 'out' || !anyLive} productKey={`fashion:${view.id}`} productName={view.name} choice={st.status === 'out' ? (st.label || '') : ''} />
          <p className="fs-buybox__deliv"><b>FREE</b> Standard Delivery: 6–7 business days</p>
          <p className="fs-buybox__note">Free on every order · Cash on Delivery available</p>
          <p className={`fs-buybox__stock is-${stockClass}`}>{stockText}</p>
          {st.label && <p className="fs-buybox__sel">{st.label}</p>}
          <div className="fs-pdp__actions">
            <button type="button" className="fs-btn fs-btn--add" disabled={!st.canAdd} onClick={add} data-can-add={st.canAdd ? 'yes' : 'no'}>
              <Icon name="bag" size={18} /> {addLabel}
            </button>
            <button type="button" className="fs-btn fs-btn--buy" disabled={!st.canAdd} onClick={buyNow}>Buy now</button>
            <button type="button" className={`fs-heart fs-heart--inline${wished ? ' is-on' : ''}`} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'} onClick={() => wish.toggle(view.id)}>
              <Icon name="heart" size={20} fill={wished ? 'currentColor' : 'none'} /> <span>{wished ? 'Saved to wishlist' : 'Add to wishlist'}</span>
            </button>
          </div>
          <p className="fs-buybox__secure"><Icon name="lock" size={14} /> Secure transaction</p>
          <PdpShare name={view.name} />
          <dl className="fs-buybox__facts">
            {view.brand && <div><dt>Brand</dt><dd>{view.brand}</dd></div>}
            <div><dt>Delivery</dt><dd>Standard, free</dd></div>
            <div><dt>Payment</dt><dd>Secure transaction · COD</dd></div>
            <div><dt>Returns</dt><dd>Within 7 days of delivery</dd></div>
          </dl>
          <DeliveryBlock />
        </aside>
      </div>

      <div className="fs-pdp__more">
        <PdpCompare items={[view, ...related.slice(0, 3)].map((p, i) => ({
          key: p.id, href: `/fashion/p/${p.slug}`, name: p.name, image: p.image, price: p.price,
          mrp: p.hasDiscount ? p.mrp : 0, pct: p.discountPct, size: p.sizes.join(', '), brand: p.brand, current: i === 0,
        }))} />
        <PdpService />
        <PdpReviews productKey={`fashion:${view.id}`} productName={view.name} />
        <PdpRecent items={recent} />
        <PdpBrandRail brand={view.brand} items={views.filter((p) => p.id !== view.id && p.brand && p.brand === view.brand && !related.slice(0, 4).some((r) => r.id === p.id)).slice(0, 12)
          .map((p) => ({ key: p.id, href: `/fashion/p/${p.slug}`, name: p.name, image: p.image, price: p.price }))} />
      </div>

      {related.length > 0 && (
        <section className="fs-sec" aria-labelledby="fs-related-h">
          <header className="fs-sec__head"><h2 className="fs-sec__h serif" id="fs-related-h">You may also like</h2></header>
          <div className="fs-grid fs-grid--related">
            {related.slice(0, 4).map((v) => <FashionProductCard key={v.id} view={v} />)}
          </div>
        </section>
      )}

      {/* Phone: the price and the buy button stay in reach. */}
      <div className="fs-pdp__bar" role="region" aria-label="Buy">
        <span className="fs-pdp__bar-price"><b><span className="fs-price__cur">₹</span>{money(st.price).replace(/^₹\s?/, '')}</b>{st.label && <em>{st.label}</em>}</span>
        <button type="button" className="fs-btn fs-btn--add" disabled={!st.canAdd} onClick={add}><Icon name="bag" size={18} /> {st.canAdd ? 'Add to cart' : st.missing || addLabel}</button>
        <button type="button" className="fs-btn fs-btn--buy" disabled={!st.canAdd} onClick={buyNow}>Buy now</button>
      </div>
    </div>
  );
}
