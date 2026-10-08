import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';
import { HOMELIVING_DELIVERY_WINDOW, useHomeLivingCatalogue } from '../data/homelivingHomepage.js';
import { breadcrumbFor } from '../lib/homelivingListing.js';
import { readSelection, writeSelection, selectionState, relatedFor } from '../lib/homelivingPdp.js';
import { Breadcrumb } from './HomeLivingCategory.jsx';
import HomeLivingProductCard from './HomeLivingProductCard.jsx';

// ============================================================
// /homeliving/p/<slug> — the product page.
//
// Gallery from the ordered media (primary plus detail shots; swipeable on
// a phone, thumbnails on desktop; a tap opens it full screen, GalleryZoom),
// brand, name, the price row, net content,
// size and colour selectors with per-combination stock — or the product's
// own stock when it has no variants — the delivery promise, the
// description, details, and related products. The chosen size and colour
// live in the URL, so a link to a variant opens on that variant. Every
// price shown is the row's own figure.
//
// Add to cart sits in the action row (.hl-pdp__actions, data-slot) beside
// the wishlist, and in the phone bar (.hl-pdp__bar). It is enabled only when
// the choice is complete and in stock (selectionState → canAdd); the line
// goes into the homeliving cart namespace and the server prices it.
// ============================================================

// ---- Full screen --------------------------------------------------------------------
// A tap on a gallery image opens it full screen at that image. Two fingers pinch to
// zoom (up to ZOOM_MAX) and one finger drags a zoomed image about; a swipe left or
// right moves between images; a tap, a swipe down or Escape closes it, and focus
// returns to the image that opened it. With a mouse a click zooms in at the point and
// out again, the wheel zooms, a drag pans, ← → move and × or Escape closes. Pointer
// events only; the page under it does not scroll. Only transform and opacity animate.

export const ZOOM_MAX = 4;
const TAP_SLOP = 10;     // px a press may wander and still be a tap
const TAP_MS = 400;      // a press held longer is not a tap
const SWIPE_PX = 56;     // sideways travel that moves to the next image
const CLOSE_PX = 96;     // downward travel that closes
const REST = Object.freeze({ scale: 1, x: 0, y: 0 });
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Zoom to `scale` about `at` (a point from the frame's centre), keeping the image point under it still. */
export function zoomAbout(view, scale, at) {
  const s = clamp(scale, 1, ZOOM_MAX);
  if (s === 1) return REST;
  const k = s / view.scale;
  return { scale: s, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k };
}
/** The size an image shows at in the frame: contained, never enlarged. */
export function fitSize(natural, frame) {
  if (!natural?.width || !natural?.height) return { width: frame.width, height: frame.height };
  const k = Math.min(1, frame.width / natural.width, frame.height / natural.height);
  return { width: natural.width * k, height: natural.height * k };
}
/** A zoomed image can be dragged only as far as it overflows the frame on that axis. */
export function clampPan(view, fit, frame) {
  const mx = Math.max(0, (fit.width * view.scale - frame.width) / 2), my = Math.max(0, (fit.height * view.scale - frame.height) / 2);
  return { scale: view.scale, x: clamp(view.x, -mx, mx), y: clamp(view.y, -my, my) };
}
/** What a one-finger drag is, once it has left the tap slop. */
export function gestureKind(dx, dy, zoomed) {
  if (zoomed) return 'pan';
  if (Math.abs(dx) > Math.abs(dy)) return 'swipe';
  return dy > 0 ? 'dismiss' : 'none';
}
/** Where a released swipe or pull lands: another image, closed, or back where it was. */
export function release(kind, dx, dy, index, count) {
  if (kind === 'swipe' && dx <= -SWIPE_PX && index < count - 1) return { index: index + 1 };
  if (kind === 'swipe' && dx >= SWIPE_PX && index > 0) return { index: index - 1 };
  if (kind === 'dismiss' && dy >= CLOSE_PX) return { close: true };
  return {};
}

export function GalleryZoom({ images, start = 0, name, onClose }) {
  const count = images.length;
  const [index, setIndex] = useState(clamp(start, 0, count - 1));
  const [view, setView] = useState(REST);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const dialog = useRef(null), frame = useRef(null), closer = useRef(null);
  const pointers = useRef(new Map()), gesture = useRef(null), tap = useRef(null), natural = useRef({});
  const live = useRef({ index, view });
  live.current = { index, view };

  const close = useCallback(() => onClose(live.current.index), [onClose]);
  const go = useCallback((to) => {
    setIndex(clamp(to, 0, count - 1)); setView(REST); setDrag({ x: 0, y: 0 });
  }, [count]);
  /** A client point as an offset from the frame's centre. */
  const fromCentre = useCallback((x, y) => {
    const r = frame.current.getBoundingClientRect();
    return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) };
  }, []);
  const bound = useCallback((v) => {
    const f = { width: frame.current.clientWidth, height: frame.current.clientHeight };
    return v.scale <= 1 ? REST : clampPan(v, fitSize(natural.current[live.current.index], f), f);
  }, []);

  // The page under it stays put; Escape closes; ← → move; Tab stays inside.
  useEffect(() => {
    const root = document.documentElement, was = root.style.overflow;
    root.style.overflow = 'hidden';
    closer.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') go(live.current.index + 1);
      else if (e.key === 'ArrowLeft') go(live.current.index - 1);
      else if (e.key === 'Tab' && dialog.current) {
        const stops = [...dialog.current.querySelectorAll('button:not([disabled])')];
        const at = stops.indexOf(document.activeElement);
        e.preventDefault();
        stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); root.style.overflow = was; };
  }, [close, go]);

  // The wheel zooms about the pointer. Not passive, so the browser's own zoom stays out of it.
  useEffect(() => {
    const el = frame.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const v = live.current.view;
      setView(bound(zoomAbout(v, v.scale * Math.exp(-e.deltaY * 0.0025), fromCentre(e.clientX, e.clientY))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [bound, fromCentre]);

  const pair = () => { const [a, b] = [...pointers.current.values()]; return { a, b, d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2) }; };
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    tap.current = null;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v0 = live.current.view;
    if (pointers.current.size === 2) { const { d, m } = pair(); gesture.current = { kind: 'pinch', d0: d, m0: m, v0 }; setDrag({ x: 0, y: 0 }); }
    else if (pointers.current.size === 1) gesture.current = { kind: 'press', x0: e.clientX, y0: e.clientY, t0: performance.now(), v0, mouse: e.pointerType === 'mouse' };
    setMoving(true);
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) return;
      const { d, m } = pair();
      const z = zoomAbout(g.v0, (g.v0.scale * d) / g.d0, g.m0);
      setView(bound({ scale: z.scale, x: z.x + m.x - g.m0.x, y: z.y + m.y - g.m0.y }));
      return;
    }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (g.kind === 'press') {
      if (Math.hypot(dx, dy) < TAP_SLOP) return;
      g.kind = gestureKind(dx, dy, g.v0.scale > 1);
    }
    if (g.kind === 'pan') setView(bound({ scale: g.v0.scale, x: g.v0.x + dx, y: g.v0.y + dy }));
    else if (g.kind === 'swipe') {
      const edge = (dx > 0 && live.current.index === 0) || (dx < 0 && live.current.index === count - 1);
      setDrag({ x: edge ? dx * 0.35 : dx, y: 0 });
    } else if (g.kind === 'dismiss') setDrag({ x: 0, y: Math.max(0, dy) });
  };
  const onUp = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      // One finger lifted: the other carries on as a pan.
      if (pointers.current.size === 1) { const [r] = [...pointers.current.values()]; gesture.current = { kind: 'pan', x0: r.x, y0: r.y, v0: live.current.view }; return; }
      if (live.current.view.scale < 1.05) setView(REST);
      gesture.current = null; setMoving(false);
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null; setMoving(false);
    if (e.type === 'pointercancel') { setDrag({ x: 0, y: 0 }); return; }
    // A tap is acted on by the click that follows it (onTap): closing here would let a
    // phone's click land on the gallery image under the finger and open it again.
    if (g.kind === 'press') { tap.current = performance.now() - g.t0 <= TAP_MS ? { mouse: g.mouse } : null; return; }
    const to = release(g.kind, e.clientX - g.x0, e.clientY - g.y0, live.current.index, count);
    if (to.close) { close(); return; }
    if (to.index != null) go(to.index);
    else setDrag({ x: 0, y: 0 });
  };
  // A click zooms in at the point and back out; a tap steps out of a zoom, or closes.
  const onTap = (e) => {
    const t = tap.current;
    tap.current = null;
    if (!t) return;
    const zoomed = live.current.view.scale > 1;
    if (t.mouse) setView(zoomed ? REST : bound(zoomAbout(REST, 2.5, fromCentre(e.clientX, e.clientY))));
    else if (zoomed) setView(REST);
    else close();
  };

  return createPortal(
    <div className={`hl-zoom${moving ? ' is-moving' : ''}`} role="dialog" aria-modal="true" aria-label={`${name} images, full screen`} ref={dialog}>
      <div className="hl-zoom__backdrop" style={{ opacity: 1 - Math.min(0.6, drag.y / 400) }} aria-hidden="true" />
      <div className={`hl-zoom__frame${view.scale > 1 ? ' is-zoomed' : ''}`} ref={frame}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={onTap}>
        <div className="hl-zoom__track" style={{ transform: `translate3d(calc(${-index * 100}% + ${drag.x}px), ${drag.y}px, 0)` }}>
          {images.map((img, i) => (
            <figure key={img.url + i} className="hl-zoom__slide" aria-hidden={i !== index}>
              <img className="hl-zoom__img" src={img.url} alt={img.alt} draggable="false" decoding="async" loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                onLoad={(e) => { natural.current[i] = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }; }}
                style={i === index ? { transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` } : undefined} />
            </figure>
          ))}
        </div>
      </div>
      <div className="hl-zoom__bar">
        <span className="hl-zoom__count" aria-live="polite">{index + 1} / {count}</span>
        <button type="button" className="hl-zoom__btn" aria-label="Close full screen" ref={closer} onClick={close}><Icon name="x" size={22} /></button>
      </div>
      {count > 1 && (
        <>
          <button type="button" className="hl-zoom__btn hl-zoom__prev" aria-label="Previous image" disabled={index === 0} onClick={() => go(index - 1)}><Icon name="chevronLeft" size={24} /></button>
          <button type="button" className="hl-zoom__btn hl-zoom__next" aria-label="Next image" disabled={index === count - 1} onClick={() => go(index + 1)}><Icon name="chevronRight" size={24} /></button>
        </>
      )}
    </div>,
    document.body,
  );
}

export function Gallery({ view }) {
  const images = view.gallery && view.gallery.length ? view.gallery : [];
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(null);   // the image open full screen
  const track = useRef(null);
  // Back from full screen: the gallery shows the image it closed on, and that image has focus.
  const closeZoom = (i) => {
    setZoom(null); setActive(i);
    const el = track.current, slide = el?.children[i];
    if (!slide) return;
    el.scrollTo({ left: slide.offsetLeft - el.firstElementChild.offsetLeft });
    slide.querySelector('button')?.focus({ preventScroll: true });
  };
  if (images.length === 0) return <div className="hl-pdp__media hl-pdp__media--none" aria-hidden="true"><b>{view.name.slice(0, 1)}</b></div>;
  return (
    <div className="hl-gallery">
      <div className="hl-gallery__track" role="group" aria-label={`${view.name} images`} ref={track}>
        {images.map((img, i) => (
          <figure key={img.url + i} className={`hl-gallery__slide${i === active ? ' is-on' : ''}`} id={`hl-slide-${i}`}>
            <button type="button" className="hl-gallery__zoom" aria-label={`View image ${i + 1} of ${images.length} full screen`} onClick={() => setZoom(i)}>
              <img src={img.url} alt={img.alt} width="900" height="900" decoding="async" loading={i === 0 ? 'eager' : 'lazy'} fetchpriority={i === 0 ? 'high' : undefined} />
            </button>
          </figure>
        ))}
      </div>
      {zoom != null && <GalleryZoom images={images} start={zoom} name={view.name} onClose={closeZoom} />}
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
      <p className="hl-pdp__fine">Select Standard delivery at checkout.</p>
    </section>
  );
}

const priceDigits = (n) => money(n).replace(/^₹\s?/, '');

/**
 * Add to cart — disabled until the choice is complete and in stock. It names
 * a dead end (out of stock, not made in that pair); a choice still to make is
 * spelt out by the stock note beside it, so the button does not repeat it.
 */
export function AddToCartButton({ st, onAdd, className = '' }) {
  const label = st.status === 'out' ? 'Out of stock' : st.status === 'missing' ? 'Not available' : 'Add to cart';
  return (
    <button type="button" className={`hl-btn hl-add${className ? ` ${className}` : ''}`} disabled={!st.canAdd} onClick={st.canAdd ? onAdd : undefined}>
      <Icon name="bag" size={18} /> {label}
    </button>
  );
}

export default function HomeLivingProductPage() {
  const { slug } = useParams();
  const { status, categories, products } = useHomeLivingCatalogue();
  const { addHomeLivingToCart } = useStore();
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
  // st.variant is the chosen size × colour (null for a product without variants).
  const add = () => addHomeLivingToCart(view, st.variant, 1);

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

          {/* The action row: Add to cart in the first cell, the wishlist beside it. */}
          <div className="hl-pdp__actions" data-slot="add-to-cart" data-can-add={st.canAdd ? 'yes' : 'no'}>
            <AddToCartButton st={st} onAdd={add} />
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

      {/* Phone: the price, the choice and its stock in reach, with Add to cart beside them. */}
      <div className="hl-pdp__bar" role="region" aria-label="Buy" data-slot="add-to-cart">
        <span className="hl-pdp__bar-price"><b><span className="hl-price__cur">₹</span>{priceDigits(st.price)}</b>{st.label && <em>{st.label}</em>}<span className={`hl-pick__note is-${st.status}`}>{st.stockNote || st.missing || 'In stock'}</span></span>
        <AddToCartButton st={st} onAdd={add} className="hl-add--bar" />
      </div>
    </div>
  );
}
