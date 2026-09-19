import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { HOMELIVING_DELIVERY_WINDOW, useHomeLivingCatalogue } from '../data/homelivingHomepage.js';
import { breadcrumbFor } from '../lib/homelivingListing.js';
import { readSelection, writeSelection, selectionState, relatedFor } from '../lib/homelivingPdp.js';
import { Breadcrumb } from './HomeLivingCategory.jsx';
import HomeLivingProductCard from './HomeLivingProductCard.jsx';

// ============================================================
// /homeliving/p/<slug> — the product page.
//
// Gallery from the ordered media (primary plus detail shots; swipeable on
// a phone, thumbnails on desktop), brand, name, the price row, net content,
// size and colour selectors with per-combination stock — or the product's
// own stock when it has no variants — the delivery promise, the
// description, details, and related products. The chosen size and colour
// live in the URL, so a link to a variant opens on that variant. Every
// price shown is the row's own figure.
//
// There is no Add to cart yet: this store has no cart namespace until the
// cart is next opened. The action row (.hl-pdp__actions, data-slot) and the
// phone bar (.hl-pdp__bar) keep the space for it beside the wishlist.
// ============================================================

export function Gallery({ view }) {
  const images = view.gallery && view.gallery.length ? view.gallery : [];
  const [active, setActive] = useState(0);
  if (images.length === 0) return <div className="hl-pdp__media hl-pdp__media--none" aria-hidden="true"><b>{view.name.slice(0, 1)}</b></div>;
  return (
    <div className="hl-gallery">
      <div className="hl-gallery__track" role="group" aria-label={`${view.name} images`}>
        {images.map((img, i) => (
          <figure key={img.url + i} className={`hl-gallery__slide${i === active ? ' is-on' : ''}`} id={`hl-slide-${i}`}>
            <img src={img.url} alt={img.alt} width="900" height="900" decoding="async" loading={i === 0 ? 'eager' : 'lazy'} fetchpriority={i === 0 ? 'high' : undefined} />
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <div className="hl-gallery__thumbs" role="tablist" aria-label="Choose image">
          {images.map((img, i) => (
            <a key={img.url + i} href={`#hl-slide-${i}`} role="tab" aria-selected={i === active} className={`hl-gallery__thumb${i === active ? ' is-on' : ''}`} onClick={() => setActive(i)}>
              <img src={img.url} alt="" width="120" height="120" loading="lazy" decoding="async" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The size (× colour) choice. Every size and colour is listed — an
 * unavailable one is disabled or struck, not hidden — and the stock note
 * answers for the pair. A size-only product shows sizes alone.
 */
export function VariantPicker({ view, st, onChange }) {
  return (
    <div className="hl-pick">
      {st.colours.length > 0 && (
        <fieldset className="hl-pick__group">
          <legend>Colour{st.colour ? <b>: {st.colour}</b> : null}</legend>
          <div className="hl-pick__swatches">
            {st.colours.map((c) => (
              <button
                key={c.colour} type="button"
                className={`hl-pick__swatch${c.colour === st.colour ? ' is-on' : ''}${c.available ? '' : ' is-out'}`}
                style={{ '--sw': c.hex || '#D9CBB0' }}
                aria-pressed={c.colour === st.colour}
                aria-label={`${c.colour}${c.available ? '' : ' — not available for this size'}`}
                title={c.colour}
                onClick={() => onChange({ size: st.size, colour: c.colour === st.colour ? null : c.colour })}
              ><span /></button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="hl-pick__group">
        <legend>Size{st.size ? <b>: {st.size}</b> : null}</legend>
        <div className="hl-pick__sizes">
          {st.sizes.map((s) => (
            <button
              key={s.size} type="button"
              className={`hl-pick__size${s.size === st.size ? ' is-on' : ''}${s.available ? '' : ' is-out'}`}
              aria-pressed={s.size === st.size}
              disabled={!s.available && s.size !== st.size}
              aria-label={`${s.size}${s.available ? '' : ' — out of stock'}`}
              onClick={() => onChange({ size: s.size === st.size ? null : s.size, colour: st.colour })}
            >{s.size}</button>
          ))}
        </div>
      </fieldset>
      <p className={`hl-pick__note is-${st.status}`} role="status">{st.stockNote || st.missing || 'In stock'}</p>
    </div>
  );
}

function DeliveryBlock() {
  return (
    <section className="hl-pdp__delivery" aria-labelledby="hl-deliv-h">
      <h2 className="hl-pdp__h2" id="hl-deliv-h"><Icon name="truck" size={18} /> Delivery</h2>
      <p className="hl-pdp__ship"><span>Standard delivery<em>{HOMELIVING_DELIVERY_WINDOW}</em></span><b>Free</b></p>
      <p className="hl-pdp__fine">Other delivery options are chosen at checkout.</p>
    </section>
  );
}

const priceDigits = (n) => money(n).replace(/^₹\s?/, '');

export default function HomeLivingProductPage() {
  const { slug } = useParams();
  const { status, categories, products } = useHomeLivingCatalogue();
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => products.find((p) => p.slug === String(slug || '')) || null, [products, slug]);

  if (!view) {
    return (
      <div className="hl-wrap hl-listing">
        <Breadcrumb trail={[{ name: 'Home & Living', href: '/homeliving' }, { name: 'Not found' }]} />
        <div className="hl-empty hl-empty--listing">
          <p>{status === 'loading' ? 'Loading the catalogue…' : status === 'error' ? 'The Home & Living catalogue could not be loaded. Please try again shortly.' : `There is no “${slug}” in the Home & Living store.`}</p>
          <Link to="/homeliving" className="hl-btn">Back to Home &amp; Living</Link>
        </div>
      </div>
    );
  }

  const node = view.category_id != null ? categories.find((c) => String(c.id) === String(view.category_id)) || null : null;
  const trail = [...breadcrumbFor(categories, node), { name: view.name }];
  const sel = readSelection(params, view);
  const st = selectionState(view, sel);
  const setSel = (next) => setParams(writeSelection(params, next), { replace: true });
  const related = relatedFor(view, products, 4);

  return (
    <div className="hl-wrap hl-pdp" data-product={view.slug}>
      <Breadcrumb trail={trail} />
      <div className="hl-pdp__grid">
        <Gallery view={view} />
        <div className="hl-pdp__body">
          {view.brand && <p className="hl-pdp__brand">{view.brand}</p>}
          <h1 className="hl-pdp__h serif">{view.name}</h1>
          {view.net_content && <p className="hl-pdp__size">{view.net_content}</p>}

          <p className="hl-price hl-price--lg" data-price={st.price}>
            <strong><span className="hl-price__cur">₹</span>{priceDigits(st.price)}</strong>
            {st.hasDiscount && <><span className="hl-price__mrp">M.R.P: <s>{money(st.mrp)}</s></span><span className="hl-badge">{st.discountPct}% OFF</span></>}
          </p>
          <p className="hl-pdp__tax">Inclusive of all taxes</p>

          {st.shape === 'none'
            ? <p className={`hl-pick__note hl-pick__note--solo is-${st.status}`} role="status">{st.stockNote || 'In stock'}</p>
            : <VariantPicker view={view} st={st} onChange={setSel} />}

          {/* The action row. Add to cart lands in the first cell (data-slot) once this store has a cart namespace. */}
          <div className="hl-pdp__actions" data-slot="add-to-cart" data-can-add={st.canAdd ? 'yes' : 'no'}>
            <button type="button" className="hl-card__heart hl-heart--inline" aria-label={`Save ${view.name} to wishlist`} aria-disabled="true"><Icon name="heart" size={20} /></button>
          </div>

          <DeliveryBlock />

          {view.description && (
            <section className="hl-pdp__section" aria-labelledby="hl-desc-h">
              <h2 className="hl-pdp__h2" id="hl-desc-h">About this product</h2>
              <p className="hl-pdp__desc">{view.description}</p>
            </section>
          )}
          <section className="hl-pdp__section" aria-labelledby="hl-details-h">
            <h2 className="hl-pdp__h2" id="hl-details-h">Details</h2>
            <dl className="hl-pdp__details">
              {view.brand && <div><dt>Brand</dt><dd>{view.brand}</dd></div>}
              {node && <div><dt>Category</dt><dd>{breadcrumbFor(categories, node).slice(1).map((c) => c.name).join(' › ')}</dd></div>}
              {view.net_content && <div><dt>Size</dt><dd>{view.net_content}</dd></div>}
              {view.sizes.length > 0 && <div><dt>Sizes</dt><dd>{view.sizes.join(', ')}</dd></div>}
              {view.swatches.length > 0 && <div><dt>Colours</dt><dd>{view.swatches.map((s) => s.colour).join(', ')}</dd></div>}
              {view.sku && <div><dt>SKU</dt><dd>{view.sku}</dd></div>}
            </dl>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="hl-sec" aria-labelledby="hl-related-h">
          <header className="hl-sec__head"><h2 className="hl-sec__h serif" id="hl-related-h">You may also like</h2></header>
          <div className="hl-row hl-row--related">
            {related.map((p) => <HomeLivingProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Phone: the price stays in reach; the Add button joins it here once the cart namespace exists. */}
      <div className="hl-pdp__bar" role="region" aria-label="Buy" data-slot="add-to-cart">
        <span className="hl-pdp__bar-price"><b><span className="hl-price__cur">₹</span>{priceDigits(st.price)}</b>{st.label && <em>{st.label}</em>}</span>
        <span className={`hl-pick__note is-${st.status}`}>{st.stockNote || st.missing || 'In stock'}</span>
      </div>
    </div>
  );
}
