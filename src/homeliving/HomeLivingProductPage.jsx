import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';
import { HOMELIVING_DELIVERY_WINDOW, useHomeLivingCatalogue } from '../data/homelivingHomepage.js';
import { breadcrumbFor } from '../lib/homelivingListing.js';
import { readSelection, writeSelection, selectionState, relatedFor } from '../lib/homelivingPdp.js';
import { Breadcrumb } from './HomeLivingCategory.jsx';
import HomeLivingProductCard from './HomeLivingProductCard.jsx';
import ProductInformation from '../components/ProductInformation.jsx';
import { fetchEligibleCoupons } from '../lib/couponApi.js';
import ProductDeliveryInfo from '../components/pdp/ProductDeliveryInfo.jsx';
import { PdpCompare, PdpService, PdpBrandRail, PdpBundle, PdpRecent, PdpShare, useRecentlyViewed, useHoverZoom } from '../components/pdp/PdpOwnerKit.jsx';

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

export function Gallery({ view, badge = null }) {
  const images = view.gallery && view.gallery.length ? view.gallery : [];
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(null);   // the image open full screen
  const track = useRef(null);
  /**
   * Show image i: the track scrolls sideways to it and nothing else moves — not the
   * window, not the URL, not history. (The thumbnails were #hl-slide-N links: the
   * browser's fragment jump also scrolled the page ~300 px, the slide under the
   * sticky header, and added a history entry per click.)
   */
  const show = (i, behavior) => {
    setActive(i);
    const el = track.current, slide = el?.children[i];
    if (!slide) return null;
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: slide.offsetLeft - el.firstElementChild.offsetLeft, behavior: behavior || (reduced ? 'auto' : 'smooth') });
    return slide;
  };
  // A swipe on the track moves the counter and the dots with it.
  const onScroll = (e) => {
    const el = e.currentTarget;
    if (!el.clientWidth) return;
    const i = Math.floor(el.scrollLeft / el.clientWidth + 0.5);
    if (i !== active && i >= 0 && i < images.length) setActive(i);
  };
  // Back from full screen: the gallery shows the image it closed on, and that image has focus.
  const closeZoom = (i) => {
    setZoom(null);
    show(i, 'auto')?.querySelector('button')?.focus({ preventScroll: true });
  };
  if (images.length === 0) return <div className="hl-pdp__media hl-pdp__media--none" aria-hidden="true"><b>{view.name.slice(0, 1)}</b></div>;
  return (
    <div className={`hl-gallery${images.length > 1 ? ' has-thumbs' : ''}`}>
      {images.length > 1 && (
        <div className="hl-gallery__thumbs" role="tablist" aria-label="Choose image">
          {images.map((img, i) => (
            <button key={img.url + i} type="button" role="tab" aria-selected={i === active} aria-controls={`hl-slide-${i}`} aria-label={`Show image ${i + 1} of ${images.length}`} className={`hl-gallery__thumb${i === active ? ' is-on' : ''}`} onClick={() => show(i)}>
              <img src={img.url} alt="" width="120" height="120" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
      <div className="hl-gallery__main">
        <div className="hl-gallery__track" role="group" aria-label={`${view.name} images`} ref={track} onScroll={onScroll}>
          {images.map((img, i) => (
            <figure key={img.url + i} className={`hl-gallery__slide${i === active ? ' is-on' : ''}`} id={`hl-slide-${i}`}>
              <button type="button" className="hl-gallery__zoom" aria-label={`View image ${i + 1} of ${images.length} full screen`} onClick={() => setZoom(i)}>
                <img src={img.url} alt={img.alt} width="900" height="900" decoding="async" loading={i === 0 ? 'eager' : 'lazy'} fetchpriority={i === 0 ? 'high' : undefined} />
              </button>
            </figure>
          ))}
        </div>
        {badge && <span className="hl-gallery__badge"><Icon name="award" size={15} /> {badge}</span>}
        <button type="button" className="hl-gallery__heart" aria-label={`Save ${view.name} to wishlist`} aria-disabled="true"><Icon name="heart" size={20} /></button>
        {images.length > 1 && <span className="hl-gallery__count" aria-hidden="true">{active + 1} / {images.length}</span>}
      </div>
      {images.length > 1 && (
        <div className="hl-gallery__dots" aria-hidden="true">
          {images.map((img, i) => <span key={img.url + i} className={i === active ? 'is-on' : undefined} />)}
        </div>
      )}
      {zoom != null && <GalleryZoom images={images} start={zoom} name={view.name} onClose={closeZoom} />}
    </div>
  );
}

/**
 * The size (× colour) choice. Every size and colour is listed — an
 * unavailable one is disabled or struck, not hidden — and the stock note
 * answers for the pair. A size-only product shows sizes alone.
 */
/** The price a size button shows: the chosen colour's figure, else the lowest across colours. */
export function sizePrice(view, size, colour = null) {
  const rows = (view.variants || []).filter((v) => v.size === size && (!colour || v.colour === colour));
  const prices = rows.map((v) => (v.price_override != null ? v.price_override : view.price)).filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : view.price;
}

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
              ><span /><em>{c.colour}</em></button>
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
            ><span>{s.size}</span><small>{money(sizePrice(view, s.size, st.colour))}</small></button>
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
      <span className="hl-pdp__delivery-icon" aria-hidden="true"><Icon name="truck" size={26} /></span>
      <div>
        <h2 className="hl-pdp__delivery-h" id="hl-deliv-h">Standard Delivery: {HOMELIVING_DELIVERY_WINDOW}</h2>
        <p className="hl-pdp__ship">Free on every order · Cash on Delivery available</p>
      </div>
    </section>
  );
}

// Store-wide facts, each true of every order (the trust strip, shipping and returns pages).
const ASSURANCES = [
  { icon: 'truck', label: ['Free', 'Delivery'] },
  { icon: 'card', label: ['Cash on', 'Delivery'] },
  { icon: 'return', label: ['7-Day', 'Returns'] },
  { icon: 'lock', label: ['Secure', 'Payments'] },
  { icon: 'shield', label: ['Genuine', 'Products'] },
];
const STRIP = [
  { icon: 'leaf', label: 'Premium Home Decor' },
  { icon: 'shield', label: 'Trusted Quality' },
  { icon: 'truck', label: 'Free Delivery' },
  { icon: 'return', label: 'Easy Returns' },
];

export function AssuranceStrip() {
  return (
    <ul className="hl-assure" aria-label="Why shop with us">
      {STRIP.map((a) => <li key={a.label}><Icon name={a.icon} size={16} /> {a.label}</li>)}
    </ul>
  );
}

function Assurances() {
  return (
    <ul className="hl-feats">
      {ASSURANCES.map((a) => <li key={a.icon}><span aria-hidden="true"><Icon name={a.icon} size={20} /></span>{a.label[0]}<br />{a.label[1]}</li>)}
    </ul>
  );
}

/** The name with its middle words picked out ("Parquet Wood <Anti-Skid> Doormat"); short names stay whole. */
export function titleParts(name) {
  const [main, ...rest] = String(name || '').split(' — ');
  const w = main.split(' ').filter(Boolean);
  const tail = rest.length ? ` — ${rest.join(' — ')}` : '';
  if (w.length < 4) return [main + tail, '', ''];
  return [w.slice(0, 2).join(' '), w.slice(2, -1).join(' '), w[w.length - 1] + tail];
}

/** The description as sentences: the first is the subtitle, up to five are the "why" list. */
export function sentencesOf(text) {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter((x) => x.length > 2);
}

/** The best live offer on this product, from the server (no rupee figure: what it saves depends on the basket). */
function useOffer(view, variantId) {
  const [offer, setOffer] = useState(null);
  useEffect(() => {
    if (!view?.id) return undefined;
    const ctl = new AbortController();
    fetchEligibleCoupons({ items: [{ id: view.id, qty: 1, variantId, catalogue: 'homeliving' }], signal: ctl.signal })
      .then(({ applicable, unlockable }) => { if (!ctl.signal.aborted) setOffer([...applicable, ...unlockable][0] || null); })
      .catch(() => { if (!ctl.signal.aborted) setOffer(null); });
    return () => ctl.abort();
  }, [view?.id, variantId]);
  return offer;
}

function OfferStrip({ view }) {
  const offer = useOffer(view, null);
  const { couponCode, dispatch, toast } = useStore();
  if (!offer) return null;
  const applied = couponCode === offer.code;
  const apply = () => { dispatch({ type: 'APPLY_COUPON', code: offer.code }); toast(`${offer.code} will be applied in your cart`, { kind: 'cart' }); };
  return (
    <button type="button" className={`hl-offer${applied ? ' is-applied' : ''}`} onClick={applied ? undefined : apply} aria-label={applied ? `${offer.code} applied` : `Apply code ${offer.code}: ${offer.title}`}>
      <Icon name="gift" size={20} />
      <span className="hl-offer__t"><b>{offer.title}</b>{offer.description ? <em>{offer.description}</em> : null}</span>
      <span className="hl-offer__code">{applied ? 'Applied' : <>Use code <b>{offer.code}</b></>}</span>
      <Icon name="chevronRight" size={18} />
    </button>
  );
}

const faqs = () => [
  ['When will my order arrive?', `Standard delivery takes ${HOMELIVING_DELIVERY_WINDOW}, and it is free on every order.`],
  ['Can I pay on delivery?', 'Yes. Cash on Delivery is available at checkout, as are cards, UPI and net banking.'],
  ['What if I want to return it?', 'Returns are accepted within 7 days of delivery. See the returns page for the details.'],
];

function InfoTabs({ view, node, categories, st, bullets }) {
  const tabs = [['about', 'About this Product'], ...(view.review_count > 0 ? [['reviews', `Reviews (${view.review_count.toLocaleString('en-IN')})`]] : []), ['faqs', 'FAQs']];
  const [tab, setTab] = useState('about');
  return (
    <section className="hl-tabs" aria-label="Product information">
      <div className="hl-tabs__bar" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`hl-tab-${id}`} aria-selected={tab === id} aria-controls={`hl-panel-${id}`} className={tab === id ? 'is-on' : undefined} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {/* Every panel is in the page (search engines, find-in-page); only the chosen one shows. */}
      <div className="hl-tabs__panel" role="tabpanel" id="hl-panel-about" aria-labelledby="hl-tab-about" hidden={tab !== 'about'}>
        {bullets.length > 1 && (
          <div className="hl-love">
            <h2 className="hl-love__h"><Icon name="heart" size={20} /> Why You’ll Love It</h2>
            <ul>{bullets.map((b) => <li key={b}><Icon name="check" size={16} /> {b}</li>)}</ul>
          </div>
        )}
        {view.description && (bullets.length < 2 || sentencesOf(view.description).length > bullets.length) && <p className="hl-pdp__desc">{view.description}</p>}
      </div>
      {view.review_count > 0 && (
        <div className="hl-tabs__panel" role="tabpanel" id="hl-panel-reviews" aria-labelledby="hl-tab-reviews" hidden={tab !== 'reviews'}>
          <p className="hl-pdp__desc">Rated {view.rating.toFixed(1)} out of 5 from {view.review_count.toLocaleString('en-IN')} reviews.</p>
        </div>
      )}
      <div className="hl-tabs__panel" role="tabpanel" id="hl-panel-faqs" aria-labelledby="hl-tab-faqs" hidden={tab !== 'faqs'}>
        <dl className="hl-faq">{faqs().map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}</dl>
      </div>
    </section>
  );
}

/** The product's information, open (owner, 2026-11-08): the details and the listing's declarations. */
function ProductInfoSection({ view, node, categories, st }) {
  return (
    <section className="hl-info" aria-labelledby="hl-info-h">
      <h2 className="pdpk-h pdpk-h--lg" id="hl-info-h">Product information</h2>
        <dl className="hl-pdp__details">
          {view.brand && <div><dt>Brand</dt><dd>{view.brand}</dd></div>}
          {node && <div><dt>Category</dt><dd>{breadcrumbFor(categories, node).slice(1).map((c) => c.name).join(' › ')}</dd></div>}
          {view.net_content && <div><dt>Size</dt><dd>{view.net_content}</dd></div>}
          {view.sizes.length > 0 && <div><dt>Sizes</dt><dd>{view.sizes.join(', ')}</dd></div>}
          {view.swatches.length > 0 && <div><dt>Colours</dt><dd>{view.swatches.map((s) => s.colour).join(', ')}</dd></div>}
          {view.sku && <div><dt>SKU</dt><dd>{view.sku}</dd></div>}
        </dl>
        {/* Net quantity is the Size row above. */}
        <ProductInformation store="homeliving" productId={view.id} variant={st.variant} prefix="hl" netQuantity={false} />
    </section>
  );
}

function Stars({ rating }) {
  return (
    <span className="hl-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={18} className={rating >= i - 0.25 ? 'is-on' : rating >= i - 0.75 ? 'is-half' : undefined} />)}
    </span>
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

export function BuyNowButton({ st, onBuy, className = '' }) {
  return (
    <button type="button" className={`hl-btn hl-buy${className ? ` ${className}` : ''}`} disabled={!st.canAdd} onClick={st.canAdd ? onBuy : undefined}>
      <Icon name="sparkle" size={18} /> Buy Now
    </button>
  );
}

export default function HomeLivingProductPage() {
  const { slug } = useParams();
  const { status, categories, products } = useHomeLivingCatalogue();
  const { addHomeLivingToCart } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => products.find((p) => p.slug === String(slug || '')) || null, [products, slug]);
  const [qty, setQty] = useState(1);
  const recent = useRecentlyViewed(view ? { key: `hl-${view.id}`, href: `/homeliving/p/${view.slug}`, name: view.name, image: (view.gallery && view.gallery[0]?.url) || view.images?.[0] || null, price: view.price } : null);
  useHoverZoom('.hl-pdp .hl-gallery__slide', view?.id);

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
  const [head, hl, tail] = titleParts(view.name);
  // Frequently bought together: this item and two from the same shelf; "Add all" only when each can go in as it is.
  const bundle = [view, ...related.filter((p) => !(p.variants && p.variants.length)).slice(0, 2)];
  const bundleAddable = st.canAdd && bundle.slice(1).every((p) => p.stock > 0 && !(p.variants && p.variants.length));
  const sentences = sentencesOf(view.description);
  const lede = sentences[0] && sentences[0].length <= 140 ? sentences[0] : null;
  const bullets = sentences.slice(0, 6).filter((x) => x.length <= 220);
  // st.variant is the chosen size × colour (null for a product without variants).
  const add = () => addHomeLivingToCart(view, st.variant, qty);
  const buy = () => { if (addHomeLivingToCart(view, st.variant, qty) !== false) navigate('/checkout'); };

  const stockLine = (
    <p className="hl-pdp__tax"><span className={`hl-pdp__stock is-${st.shape === 'none' ? st.status : st.status === 'choose' ? 'in' : st.status}`}><Icon name="checkCircle" size={18} /> {st.shape === 'none' ? (st.stockNote || 'In stock') : (st.stockNote || (st.sizes.some((x) => x.available) ? 'In stock' : 'Out of stock'))}</span><span aria-hidden="true">|</span> Inclusive of all taxes</p>
  );

  // The owner's second reference (2026-11-08, a marketplace product page): three
  // columns on a desktop — the pictures, the details, and a buy box — in a quiet
  // sans at reading size, colour carrying meaning (red the discount, teal the links,
  // green the stock). On a phone the same blocks stack in that order.
  return (
    <div className="hl-wrap hl-pdp" data-product={view.slug}>
      <AssuranceStrip />
      <Breadcrumb trail={trail} />
      <div className="hl-pdp__grid">
        <Gallery view={view} badge={view.is_bestseller ? 'Bestseller' : null} />
        <div className="hl-pdp__body">
          {view.brand && <p className="hl-pdp__brand">{view.brand}</p>}
          <h1 className="hl-pdp__h serif">{head}{hl && <> <span className="hl-pdp__hl">{hl}</span></>}{tail && <> {tail}</>}</h1>
          {lede && <p className="hl-pdp__lede">{lede}</p>}
          {view.review_count > 0 && view.rating > 0 && (
            <p className="hl-pdp__rating"><Stars rating={view.rating} /><b>{view.rating.toFixed(1)}</b> <span>({view.review_count.toLocaleString('en-IN')} Reviews)</span></p>
          )}
          {view.net_content && <p className="hl-pdp__size">{view.net_content}</p>}

          <div className="hl-pdp__pricecard">
            <p className="hl-price hl-price--lg" data-price={st.price}>
              <strong><span className="hl-price__cur">₹</span>{priceDigits(st.price)}</strong>
              {st.hasDiscount && <><span className="hl-price__mrp">M.R.P: <s>{money(st.mrp)}</s></span><span className="hl-badge">{st.discountPct}%<span className="hl-badge__off"> OFF</span></span></>}
            </p>
            {st.hasDiscount && <p className="hl-pdp__save">Save {money(st.saving)} on this item</p>}
          </div>

          <OfferStrip view={view} />
          <Assurances />

          {st.shape === 'none'
            ? null
            : <VariantPicker view={view} st={st} onChange={setSel} />}

          {/* Marketplace detail (owner, 2026-11-08): only what the catalogue carries. */}
          {(() => {
            const rows = [
              ['Brand', view.brand], ['Size', view.net_content], ['Material', view.material],
              ['Colour', view.swatches.length ? view.swatches.map((x) => x.colour).join(', ') : null],
              ['Category', node ? node.name : null], ['Available sizes', view.sizes.length > 1 ? view.sizes.join(', ') : null], ['SKU', view.sku], ['Care', view.care], ['Country of origin', view.country_of_origin === 'IN' ? 'India' : view.country_of_origin],
              ['Delivery', `Standard, ${HOMELIVING_DELIVERY_WINDOW}, free`], ['Returns', 'Within 7 days of delivery'],
            ].filter((r) => r[1] != null && String(r[1]).trim());
            return (
              <section className="pdpk-facts" aria-label="Product details">
                <h2 className="pdpk-h">Product details</h2>
                <table><tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
              </section>
            );
          })()}

          {bullets.length > 1 && (
            <section className="hl-about" aria-labelledby="hl-about-h">
              <h2 className="hl-about__h" id="hl-about-h">About this item</h2>
              <ul>{bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            </section>
          )}
        </div>

        <aside className="hl-buybox" aria-label="Buy">
          <p className="hl-buybox__price"><span className="hl-price__cur">₹</span>{priceDigits(st.price)}</p>
          <DeliveryBlock />
          {stockLine}
          <label className="hl-qty">Quantity:{' '}
            <select value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} disabled={!st.canAdd}>
              {Array.from({ length: Math.max(1, Math.min(10, st.stock || 10)) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {/* The action row: Add to cart in the first cell, Buy now beside it. */}
          <div className="hl-pdp__actions" data-slot="add-to-cart" data-can-add={st.canAdd ? 'yes' : 'no'}>
            <AddToCartButton st={st} onAdd={add} />
            <BuyNowButton st={st} onBuy={buy} />
          </div>
          <p className="pdp__bbsecure"><Icon name="lock" size={14} /> Secure transaction</p>
          <PdpShare name={view.name} />
          <ProductDeliveryInfo />
          <dl className="hl-buybox__facts">
            {view.brand && <div><dt>Brand</dt><dd>{view.brand}</dd></div>}
            <div><dt>Delivery</dt><dd>Standard, free</dd></div>
            <div><dt>Payment</dt><dd>Secure transaction · COD</dd></div>
            <div><dt>Returns</dt><dd>Within 7 days of delivery</dd></div>
          </dl>
        </aside>
      </div>

      <InfoTabs view={view} node={node} categories={categories} st={st} bullets={[]} />

      {/* Marketplace detail under the fold (owner, 2026-11-08): compare, then service. */}
      <PdpCompare items={[view, ...related.slice(0, 3)].map((p, i) => ({
        key: p.id, href: `/homeliving/p/${p.slug}`, name: p.name, image: (p.gallery && p.gallery[0]?.url) || p.images?.[0] || null,
        price: p.price, mrp: p.mrp > p.price ? p.mrp : 0, pct: p.mrp > p.price ? (p.discount_percent || 0) : 0, size: p.net_content || null, brand: p.brand || null, current: i === 0,
      }))} />
      <ProductInfoSection view={view} node={node} categories={categories} st={st} />
      <PdpBundle items={bundle.map((p, i) => ({ key: p.id, href: `/homeliving/p/${p.slug}`, name: p.name, image: (p.gallery && p.gallery[0]?.url) || p.images?.[0] || null, price: i === 0 ? st.price : p.price }))}
        canAddAll={bundleAddable} onAddAll={() => bundle.forEach((p, i) => addHomeLivingToCart(p, i === 0 ? st.variant : null, 1))} />
      <PdpService />
      <PdpRecent items={recent} />
      <PdpBrandRail brand={view.brand} items={products.filter((p) => p.id !== view.id && p.brand && p.brand === view.brand && !related.slice(0, 4).some((r) => r.id === p.id))
        .slice(0, 8).map((p) => ({ key: p.id, href: `/homeliving/p/${p.slug}`, name: p.name, image: (p.gallery && p.gallery[0]?.url) || p.images?.[0] || null, price: p.price, mrp: p.mrp, pct: p.mrp > p.price ? (p.discount_percent || 0) : 0 }))} />

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
        <span className="hl-pdp__bar-price"><b><span className="hl-price__cur">₹</span>{priceDigits(st.price)}</b>{st.hasDiscount && <><s>{money(st.mrp)}</s><i>{st.discountPct}% OFF</i></>}{st.label && <em>{st.label}</em>}<span className={`hl-pick__note is-${st.status}`}>{st.stockNote || st.missing || 'In stock'}</span></span>
        <AddToCartButton st={st} onAdd={add} className="hl-add--bar" />
        <BuyNowButton st={st} onBuy={buy} className="hl-buy--bar" />
      </div>
    </div>
  );
}
