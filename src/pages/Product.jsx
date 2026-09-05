import { useState, useEffect, Fragment } from 'react';
import { useParams, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import ProductGallery from '../components/ProductGallery.jsx';
import PriceTag from '../components/PriceTag.jsx';
import NotFound from './NotFound.jsx';
import { useStore } from '../lib/store.jsx';
import { productBySlug, isCatalogHydrated, productRouteState, getRelated, isPurchasable, UNAVAILABLE_LABEL } from '../data/products.js';
import { categoryBySlug, tones } from '../data/categories.js';
import { canonicalProductSlug } from '../data/legacyProductSlugs.js';
import { money } from '../lib/format.js';

import ProductRatingTeaser from '../components/pdp/ProductRatingTeaser.jsx';
import ProductOfferTeaser from '../components/pdp/ProductOfferTeaser.jsx';
import ProductDeliveryInfo from '../components/pdp/ProductDeliveryInfo.jsx';
import ProductBenefits from '../components/pdp/ProductBenefits.jsx';
import ProductIngredients from '../components/pdp/ProductIngredients.jsx';
import ProductHowToUse from '../components/pdp/ProductHowToUse.jsx';
import ProductInfoAccordion from '../components/pdp/ProductInfoAccordion.jsx';
import ProductTrustList from '../components/pdp/ProductTrustList.jsx';
import ProductCatalogueGallery from '../components/pdp/ProductCatalogueGallery.jsx';
import ProductReviewsTeaser from '../components/pdp/ProductReviewsTeaser.jsx';
import ProductRecommendations from '../components/pdp/ProductRecommendations.jsx';
import PdpCouponSlot from '../components/pdp/PdpCouponSlot.jsx';
import PdpStorySlot from '../components/pdp/PdpStorySlot.jsx';
import PromoRail from '../components/promo/PromoRail.jsx';
import { overviewFor, suitableForList, faqFor } from '../data/pdpContent.js';
import { promotionsSource } from '../lib/promotions.js';

// Shown while the Supabase catalogue is still hydrating, so a direct load of a
// live-only product never flashes the 404 page. Display-only; no data/logic.
function ProductLoading() {
  const bar = (w) => ({ height: 12, width: w, borderRadius: 2, background: 'var(--slv2-line, #E5DCCB)', margin: '12px 0' });
  return (
    <div className="v2-wrap v2-pdp-loading" role="status" aria-live="polite" aria-busy="true">
      <div style={{ display: 'grid', gap: 'var(--sp-6, 28px)' }}>
        <div style={{ aspectRatio: '1', maxWidth: 620, borderRadius: 2, background: 'var(--slv2-cream, #F4EEE1)' }} />
        <div>
          <div style={bar('55%')} />
          <div style={bar('35%')} />
          <div style={bar('80%')} />
          <div style={bar('30%')} />
        </div>
      </div>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Loading product…</span>
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, toggleWish, isWished, toast } = useStore();
  const product = productBySlug[slug];
  const [qty, setQty] = useState(1);
const [leadExpanded, setLeadExpanded] = useState(false);
useEffect(() => {
  setLeadExpanded(false);
}, [slug]);
  // The selected VARIANT OBJECT (not just its label): price, MRP, SKU, stock
  // and image all follow from it, and the cart needs its id so the server can
  // price the exact pack the customer chose.
  // A size is only selectable when it has its own price. Unpriced catalogue
  // labels are ignored so the selector can never promise a choice that does
  // not change the price (the "750 ml still shows Rs.640" bug).
  const pricedVariants = (product?.variants || []).filter((v) => v && v.price != null && v.price > 0);
  const [variant, setVariant] = useState(null);
  const [justAdded, setJustAdded] = useState(false);

  // Variants arrive from Supabase AFTER the first render, so the initial
  // useState value is always empty and cannot be relied on to pick a default.
  // This keeps the selection valid for whatever the product currently offers:
  // it selects the first size once they load, re-selects when the customer
  // navigates to another product, and drops a selection that no longer exists.
  // Without it no chip reads as selected and the page falls back to the base
  // price — which silently looks correct only when the smallest pack happens
  // to cost the same as the base product.
  const variantKeys = pricedVariants.map((v) => v.id ?? v.label).join('|');
  useEffect(() => {
    setVariant((current) => {
      if (!pricedVariants.length) return null;
      const stillThere = current && pricedVariants.some((v) => (v.id ?? v.label) === (current.id ?? current.label));
      return stillThere ? current : pricedVariants[0];
    });
    // variantKeys collapses the list to a stable string so this runs when the
    // set of sizes actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, variantKeys]);

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1600);
    return () => clearTimeout(t);
  }, [justAdded]);

  // The catalogue hydrates from Supabase AFTER first paint, so a slug that only
  // exists in the live catalogue is briefly "not found" on a direct load/refresh.
  // Show a loading state until the catalogue is hydrated; a safety timeout (a
  // little beyond main.jsx's 4s fetch window) makes sure a failed/slow load can
  // never hang a genuinely-missing slug forever — it falls through to NotFound.
  const [catalogTimedOut, setCatalogTimedOut] = useState(false);
  useEffect(() => {
    if (isCatalogHydrated()) return;
    const t = setTimeout(() => setCatalogTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [slug]);

  const view = productRouteState(!!product, isCatalogHydrated() || catalogTimedOut);
  if (view === 'loading') return <ProductLoading />;

  // Six products shipped with malformed slugs (see legacyProductSlugs.js).
  // This runs only once the normal lookup has already failed AND the catalogue
  // has settled, so while production still stores the old slug it resolves
  // directly and nothing redirects. The query string is carried across because
  // product URLs can arrive with creator attribution (?ref=/&trk=) attached.
  const canonical = canonicalProductSlug(slug, productBySlug);
  if (canonical) return <Navigate to={`/product/${canonical}${location.search}${location.hash}`} replace />;

  if (view === 'notfound') return <NotFound />;

  const cat = categoryBySlug[product.category];
  // The media frame's ground, from the product's own category tone — the
  // same idea as the spotlight giving each slide its own colour, sourced
  // from data the catalogue already carries rather than from pixels. The
  // storefront must never analyse image pixels at runtime.
  const tone = tones[cat?.tone] || null;
  const related = getRelated(product);
  const wished = isWished(product.id);
  const out = product.stock === 0;
  // No usable price for this product (or the chosen pack size) means it
  // cannot be bought. Checkout would refuse the line, so the PDP says so
  // here rather than letting the customer find out at the payment step.
  const buyable = isPurchasable(product, variant);
  const blocked = out || !buyable;
  const lowStock = product.stock > 0 && product.stock <= 5;
  // Net quantity of the pack actually selected, so the row cannot keep
  // saying "250 ml" after the customer switches to the 500 ml pack.
  const size = variant?.label || product.form || null;

  const fbt = [product, ...related.slice(0, 2)];
  const fbtTotal = fbt.reduce((s, p) => s + p.price, 0);

  const buyNow = () => { addToCart(product, qty, variant); navigate('/checkout'); };
  const addNow = () => { addToCart(product, qty, variant); setJustAdded(true); };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch { /* user dismissed the share sheet — nothing to do */ }
  };

  // ---- Product-information accordion. Only rows backed by real, product-
  // specific data. Overview keeps a neutral name/size/category fallback (the
  // one always-present anchor); every other row is omitted unless the
  // catalogue actually carries that field. Store-wide promises live only in
  // the SORA LIFE Promise section.
  const overview = overviewFor(product);
  const suitable = suitableForList(product);
  const faq = faqFor(product);
  const accordionSections = [
    {
      title: 'Product overview', icon: 'leaf',
      content: <p className="pdp-acc__p">{overview.text}</p>,
    },
    ...(product.ingredients?.length ? [{
      title: 'Full ingredient list', icon: 'flask',
      content: (
        <div className="pdp-acc__tags">
          {product.ingredients.map((ig) => <span key={ig} className="v2-chip">{ig}</span>)}
        </div>
      ),
    }] : []),
    ...(product.benefits?.length ? [{
      title: 'All benefits', icon: 'sparkle',
      content: (
        <ul className="ticklist">
          {product.benefits.map((b) => <li key={b}><Icon name="check" size={16} /> {b}</li>)}
        </ul>
      ),
    }] : []),
    ...(product.usage ? [{
      title: 'Usage details', icon: 'droplet',
      content: <p className="pdp-acc__p muted">{product.usage}</p>,
    }] : []),
    ...(suitable.length ? [{
      title: 'Suitable for', icon: 'users',
      content: (
        <div className="pdp-acc__tags">
          {suitable.map((s) => <span key={s} className="v2-chip">{s}</span>)}
        </div>
      ),
    }] : []),
    {
      title: 'Product details', icon: 'package',
      content: (
        <ul className="ticklist">
          <li><Icon name="check" size={16} /> Category: {cat.name}</li>
          {product.form && <li><Icon name="check" size={16} /> Pack size: {product.form}</li>}
        </ul>
      ),
    },
    ...(faq.length ? [{
      title: 'FAQ', icon: 'chat',
      content: (
        <dl className="pdp-faq">
          {faq.map((f) => (
            <Fragment key={f.q}>
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </Fragment>
          ))}
        </dl>
      ),
    }] : []),
  ];

  return (
    <div className="v2-pdp-root" style={tone ? { '--pdp-ground': tone.tint } : undefined}>
      <div className="v2-wrap pdp-top">
        <nav className="v2-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link><Icon name="chevronRight" size={14} />
          <Link to={`/category/${cat.slug}`}>{cat.name}</Link><Icon name="chevronRight" size={14} />
          <span>{product.name}</span>
        </nav>
        <button type="button" className="pdp-back" onClick={() => navigate(-1)}>
          <Icon name="chevronLeft" size={16} /> Back
        </button>
      </div>

      <section className="pdp v2-wrap">
        {/* Gallery — real multi-image gallery from product_media (0016), with a
            single-primary fallback for products that have no media rows yet.
            Architecture unchanged; only the overlay controls are new. */}
        <ProductGallery product={product}>
          <div className="pdp__galactions">
            <button
              type="button"
              className={`v2-iconbtn pdp__galbtn ${wished ? 'is-active' : ''}`}
              onClick={() => toggleWish(product)}
              aria-pressed={wished}
              aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Icon name="heart" size={20} fill={wished ? 'currentColor' : 'none'} />
            </button>
            <button type="button" className="v2-iconbtn pdp__galbtn" onClick={share} aria-label="Share this product">
              <Icon name="externalLink" size={19} />
            </button>
          </div>
        </ProductGallery>

        {/* Buying block. Hierarchy is brand -> name -> price -> rating -> size:
            Sora Life is a marketplace, so whose product this is comes before
            what it is. The category/pack-size line that used to open this block
            is now the size row further down, where it belongs — it was
            competing with the title for the top of the page. */}
        <div className="pdp__info">
          {product.brand && (
            <Link
              to={`/shop?q=${encodeURIComponent(product.brand)}`}
              className="pdp__brand"
              aria-label={`See more from ${product.brand}`}
            >
              {product.brand}
              <Icon name="chevronRight" size={13} />
            </Link>
          )}
          <h1 className="pdp__title">{product.name}</h1>

          {/* ONE price line. Price, struck MRP and the discount used to be
              three competing sizes stacked with the tax note; PriceTag already
              emits them as a single row, so the row just needs to stay a row. */}
          <div className="pdp__price">
            <PriceTag product={product} size="lg" variant={variant} v2 />
            <span className="pdp__tax">Inclusive of all taxes</span>
          </div>

          <div className="pdp__facts">
            <ProductRatingTeaser product={product} />
            {size && <span className="pdp__size">{size}</span>}
          </div>

          {/* Only a real, authored description earns a lead paragraph. */}
          {product.description && (
            <div className={`pdp__leadwrap ${leadExpanded ? 'is-open' : ''}`}>
              <p className="pdp__lead">{product.description}</p>
              <button
                type="button"
                className="pdp__leadmore"
                onClick={() => setLeadExpanded((v) => !v)}
                aria-expanded={leadExpanded}
              >
                {leadExpanded ? 'Show less' : 'See more'}
              </button>
            </div>
          )}

          <ProductOfferTeaser product={product} />

          {/* A single pack size is not a choice. Rendering one lonely chip that
              is already selected asks the customer to make a decision that does
              not exist; the size row above already states what they are buying. */}
          {pricedVariants.length > 1 && (
            <div className="pdp__block">
              <span className="label">Choose pack size</span>
              <div className="variantlist" role="radiogroup" aria-label="Choose pack size">
                {pricedVariants.map((v) => {
                  const selected = (variant?.id ?? variant?.label) === (v.id ?? v.label);
                  const soldOut = v.stock === 0;
                  return (
                    <button
                      key={v.id ?? v.label}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={soldOut}
                      className={`variantchip ${selected ? 'active' : ''} ${soldOut ? 'is-out' : ''}`}
                      onClick={() => setVariant(v)}
                    >
                      <span className="variantchip__label">{v.label}</span>
                      {v.price != null && (
                        <span className="variantchip__price">
                          {money(v.price, product.currency)}
                          {v.mrp > v.price && <s>{money(v.mrp, product.currency)}</s>}
                        </span>
                      )}
                      {soldOut && <span className="variantchip__out">Sold out</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pdp__stock">
            {out ? <span className="v2-badge v2-badge--out">Out of stock</span>
              : lowStock ? <span className="v2-badge"><Icon name="clock" size={13} /> Only {product.stock} left</span>
              : <span className="v2-badge v2-badge--soft"><Icon name="check" size={13} /> In stock</span>}
          </div>

          {/* Run 2 mounts recommended coupon cards here. Renders nothing today. */}
          <PdpCouponSlot product={product} />

          <div className="pdp__buy">
            <div className="qty">
              {/* The clamp already prevented 0; the button just stayed enabled and
                  did nothing when it was pressed. Native `disabled` says so. */}
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" disabled={out || qty <= 1}><Icon name="minus" size={16} /></button>
              <span aria-live="polite">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity" disabled={out}><Icon name="plus" size={16} /></button>
            </div>
            <button className={`v2-btn v2-btn--block pdp__addbtn ${justAdded ? 'is-added' : ''}`} disabled={blocked} onClick={addNow}>
              {!buyable ? UNAVAILABLE_LABEL : justAdded ? <><Icon name="check" size={18} /> Added to cart</> : <><Icon name="bag" size={18} /> Add to cart</>}
            </button>
          </div>
          <button className="v2-btn v2-btn--ghost v2-btn--block pdp__buynow" disabled={blocked} onClick={buyNow}>Buy it now</button>

          <ProductDeliveryInfo product={product} />
        </div>
      </section>

      {/* Richer scroll: benefits → ingredients → usage → product information → trust */}
      <div className="v2-wrap pdp-flow">
        <ProductBenefits product={product} />
        <ProductIngredients product={product} />
        <ProductHowToUse product={product} />

        <section className="pdp-sec" aria-labelledby="pdp-info-h">
          <h2 id="pdp-info-h" className="pdp-sec__title serif">Product information</h2>
          <ProductInfoAccordion
  key={product.id ?? product.slug}
  sections={accordionSections}
/>
        </section>

        {/* Run 3 (Admin PDP Experience) mounts story imagery here. */}
        <PdpStorySlot product={product} />

        <ProductTrustList />
      </div>

      <ProductCatalogueGallery product={product} />

      {/* Promotions (pdp placement; renders nothing when there are none).
          Presentation only — no pricing / cart interaction. */}
      {promotionsSource === 'supabase' && (
        <div className="v2-pdp__promos">
          <PromoRail place="pdp" eyebrow="Available offers" title="Offers on your order" maxOffers={2} />
        </div>
      )}

      {/* Frequently bought together — existing real feature, unchanged */}
      {related.length >= 2 && (
        <section className="v2-pdp__fbt-section">
          <div className="v2-wrap">
            <p className="v2-eyebrow">Complete the selection</p>
            <h2 className="v2-h2">Goes well with</h2>
            <div className="fbt">
              <div className="fbt__items">
                {fbt.map((p, i) => (
                  <Fragment key={p.id}>
                    <Link to={`/product/${p.slug}`} className="fbt__item">
                      <ProductImage product={p} frame="v2" />
                      <span className="fbt__name">{p.name}</span>
                      <span className="fbt__price">{money(p.price)}</span>
                    </Link>
                    {i < fbt.length - 1 && <span className="fbt__plus"><Icon name="plus" size={18} /></span>}
                  </Fragment>
                ))}
              </div>
              <div className="fbt__buy">
                <span className="fbt__label">Total for {fbt.length} items</span>
                <span className="fbt__total v2-disp">{money(fbtTotal)}</span>
                <button className="v2-btn v2-btn--block" onClick={() => { fbt.forEach((p) => addToCart(p, 1)); }}>Add all to cart</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ratings & reviews — lightweight Part 1 teaser; Part 3 fills this in */}
      <ProductReviewsTeaser product={product} />

      {/* Related */}
      <ProductRecommendations product={product} />

      {/* Sticky mobile buy bar */}
      <div className="buybar only-mobile" role="region" aria-label="Purchase">
        <div className="buybar__price">
          <PriceTag product={product} showOff={false} variant={variant} v2 />
        </div>
        <button className="v2-btn buybar__add" disabled={blocked} onClick={addNow} aria-label="Add to cart">
          <Icon name="bag" size={17} /> {buyable ? 'Add' : UNAVAILABLE_LABEL}
        </button>
        <button className="v2-btn v2-btn--ghost buybar__buy" disabled={blocked} onClick={buyNow}>Buy now</button>
      </div>
    </div>
  );
}
