import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import DeferredImage from './DeferredImage.jsx';
import FashionEntryLink from './FashionEntryLink.jsx';
import { useStorefrontSection, filledLines, positionAttr, toneAttrs, phoneSources } from '../lib/storefrontSections.js';

// ============================================================
// The top of the wellness homepage: white, with an orange accent — a
// palette of its own, scoped to these sections (every rule in v2-home.css
// that styles them starts with .hx; no --slv2-* token changes).
//
// HomeHero      — three slides, each three portrait photographs side by side
//                 (a collage), each with its own Shop button into a store; the
//                 headline above them. Autoplays, pauses on hover and focus,
//                 still under prefers-reduced-motion, dots and a swipe.
// HomeTrustStrip — four facts: free standard delivery on every order,
//                 genuine products, 7-day returns, support 9am–6pm IST. On a
//                 phone, one row of four, each two short lines beside its icon.
// HomeTiles     — Fashion, large, beside Health & Nutrition and Home & Living.
// ExploreStores — six circles in one row, "View All" beside the heading.
// FestivePromo  — the gift-and-diya banner, its copy in the clear centre.
//
// Further down the page, directly under the fashion category strip:
// JewelleryBanner — full-bleed and square-edged like the Lifestyle banner
//                 above it, its copy on the photograph's empty ivory.
//
// Every word is HTML; no image carries text beyond product packaging.
// Orange text and fills meet WCAG AA: buttons are the deep orange
// (#C2500A, 4.72:1 with white); the bright orange (#F47B20) carries
// near-black text (6.19:1) or nothing.
// ============================================================
export const HERO_AUTOPLAY_MS = 6000;
const PHONE = '(max-width: 700px)';

// The hero (owner, 2026-11-27: "hero image pe 3 shop ke button hone chahiye jiss se 3 stores
// accessible ho … 3 collage show honge"): each slide three portrait photographs side by side, each
// its own way in with its own Shop button; the slide's headline above them. The admin swaps the
// photographs (Storefronts → Wellness homepage → Hero), three per slide, phone and desktop.
// Photographs are portrait, 3:4, with no words in them; `focus` is where a phone's narrow crop
// centres (left, center, right).
const heroPic = (name) => ({ phone: `/img/home-hero/${name}-600.webp`, desktop: `/img/home-hero/${name}.webp` });
const panel = (title, note, link, name, alt, focus = 'center') => ({ title, note, cta: 'Shop now', link, picture: heroPic(name), alt, focus });
export const HERO_SLIDES = [
  {
    key: 'stores',
    eyebrow: 'Fashion · Jewellery · Wellness',
    title: ['Dress up. Shine.', 'Feel good.'],
    panels: [
      panel('Leather', 'Jackets, coats & bags', '/fashion/leather', 'leather', 'A man in a dark brown leather jacket and cream trousers beside a curved stone wall', 'right'),
      panel('Jewellery', 'Bangles, mangalsutra & more', '/fashion/jewellery', 'jewellery', 'A woman half-veiled in a rust drape wearing a sparkling necklace, drop earrings and a ring', 'right'),
      panel('Wellness', 'Juices, care & nutrition', '/category/wellness', 'wellness', 'Biosash sea buckthorn juice, Berry Veda and Mom’s Trust care products with marigolds and oranges'),
    ],
  },
  {
    // The wedding season (November to February).
    key: 'wedding',
    eyebrow: 'The wedding season',
    title: ['Dressed for', 'every function.'],
    panels: [
      panel('Sarees', 'The saree edit', '/fashion/women/sarees', 'sarees', 'A woman in a plum saree with a gold border seated on sunlit steps', 'right'),
      panel('Suits', 'Suits & dress materials', '/fashion/c/suits-dress-materials', 'suits', 'A woman in a pink Banarasi suit and matching dupatta in a palace courtyard'),
      panel('Mangalsutra', 'Kiara Jewels', '/fashion/c/mangalsutra', 'mangalsutra', 'A hand wearing a black-bead mangalsutra beside a pink and gold silk saree and a lit diya', 'right'),
    ],
  },
  {
    key: 'winter',
    eyebrow: 'Winter · Leather · Home',
    title: ['Layer up.', 'Settle in.'],
    panels: [
      panel('Women’s jackets', 'Taj Leather', '/fashion/c/womens-leather-jackets', 'womens-jackets', 'A woman in a dark brown leather jacket and cream trousers seated beside a leather handbag'),
      panel('The winter edit', 'Jackets, shawls & mufflers', '/fashion/winter', 'winter', 'A woman in a camel coat and brown trousers sitting on a sunlit floor'),
      panel('Home & Living', 'Bedsheets & more', '/homeliving', 'home', 'A bed made up in leaf-print sheets and a green quilt beside a plant on a side table', 'left'),
    ],
  },
];

// A title in two parts is two lines on a phone, where its note gives way so every item is two lines.
export const TRUST = [
  { icon: 'truck', title: ['Free Standard', 'Delivery'], note: 'On every order', to: '/shipping' },
  { icon: 'shield', title: ['Genuine', 'Products'], note: null, to: null },
  { icon: 'return', title: ['Easy Returns'], note: '7 days', to: '/returns' },
  { icon: 'chat', title: ['Support'], note: '9am–6pm IST', to: '/contact' },
];

export const STORES = [
  { key: 'wellness', name: 'Wellness', to: '/category/wellness', image: '/img/home-cat-wellness.webp' },
  { key: 'personal-care', name: 'Personal Care', to: '/category/personal-care', image: '/img/home-cat-personal-care.webp' },
  { key: 'fashion', name: 'Fashion', to: '/fashion', image: '/img/home-cat-fashion.webp' },
  { key: 'groceries', name: 'Groceries', to: '/grocery', image: '/img/home-cat-groceries.webp' },
  { key: 'home-textiles', name: 'Home Textiles', to: '/homeliving', image: '/img/home-cat-home-textiles.webp' },
  // The jewellery page's rings shot, cropped square around the ring at its own resolution.
  { key: 'jewellery', name: 'Jewellery', to: '/fashion/jewellery', image: '/img/home-cat-jewellery.webp', size: 344 },
];

// The hero and the jewellery banner are the admin's (Storefronts → Wellness homepage): these are
// their built-in content in the schema's shape (storefrontContent.js). What is published replaces
// it field by field; a field that breaks its rule stays as it is here.
export const HERO_SECTION = Object.freeze({
  hidden: false,
  slides: HERO_SLIDES.map((s) => ({
    key: s.key, hidden: false, eyebrow: s.eyebrow, title: [s.title[0], s.title[1]],
    panels: s.panels.map((p) => ({ hidden: false, ...p })),
  })),
});

/** The hero's slides as HomeHero renders them: the hidden slides and panels left out, a button only with a label. */
export function heroSlidesOf(section) {
  if (section.hidden) return [];
  return section.slides.filter((s) => !s.hidden).map((s) => ({
    ...s,
    title: filledLines(s.title),
    panels: s.panels.filter((p) => !p.hidden && p.link && p.picture.desktop),
  })).filter((s) => s.panels.length > 0);
}

// Where a phone's narrow crop of the photograph centres, across its width (per cent).
const FOCUS = { left: 30, center: 50, right: 70 };

/** One panel: the photograph, its name, and its own Shop button — the whole panel one link. */
function HeroPanel({ p, current, eager, high, i }) {
  const Entry = entryFor(p.link);
  return (
    <li className="hx-hero__panel" style={{ '--i': i, '--focus': `${FOCUS[p.focus] || FOCUS.center}%` }}>
      <Entry to={p.link} className="hx-hero__card" tabIndex={current ? undefined : -1}>
        <span className="hx-hero__ph">
          <DeferredImage src={p.picture.desktop} {...phoneSources(p.picture.phone, p.picture.desktop)} alt={p.alt} width={900} height={1200}
            className="hx-hero__img" loading={eager ? 'eager' : 'lazy'} fetchPriority={high ? 'high' : undefined} />
        </span>
        <span className="hx-hero__txt">
          {p.note && <em>{p.note}</em>}
          <b>{p.title}</b>
          {p.cta && <span className="hx-hero__shop">{p.cta} <Icon name="arrowRight" size={14} /></span>}
        </span>
      </Entry>
    </li>
  );
}

/** The slides, one in view on a transform-only track; the first slide's headline is the page's h1. */
export function HomeHero({ slides: given, autoplayMs = HERO_AUTOPLAY_MS }) {
  const section = useStorefrontSection('wellness', 'hero', HERO_SECTION);
  const slides = given || heroSlidesOf(section);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // The later slides' photographs load once the page has (or after 2.5 s), so a slide never arrives blank.
  const [warm, setWarm] = useState(false);
  const reduced = useRef(false);
  const swipe = useRef({ x: null, y: null, moved: false });
  const n = slides.length;
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { reduced.current = mq.matches; };
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  useEffect(() => {
    if (n < 2 || typeof window === 'undefined') return undefined;
    const t = setTimeout(() => setWarm(true), 2500);
    return () => clearTimeout(t);
  }, [n]);
  useEffect(() => {
    if (n < 2 || paused) return undefined;
    const t = setInterval(() => { if (!reduced.current) setIndex((i) => (i + 1) % n); }, autoplayMs);
    return () => clearInterval(t);
  }, [n, paused, autoplayMs]);
  if (n === 0) return null;
  const at = index % n;
  const go = (d) => { setWarm(true); setIndex((i) => (i + d + n) % n); };
  const onPointerDown = (e) => { swipe.current = { x: e.clientX, y: e.clientY, moved: false }; };
  const onPointerUp = (e) => {
    const s = swipe.current;
    if (s.x == null) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    swipe.current = { x: null, y: null, moved: Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) };
    if (swipe.current.moved) go(dx < 0 ? 1 : -1);
  };
  const onClickCapture = (e) => { if (swipe.current.moved) { e.preventDefault(); e.stopPropagation(); swipe.current.moved = false; } };
  return (
    <section className="hx hx-hero" aria-roledescription="carousel" aria-label="SORA LIFESTYLE"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="hx-hero__viewport" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = { x: null, y: null, moved: false }; }} onClickCapture={onClickCapture}>
        <div className="hx-hero__track" style={{ transform: `translateX(-${at * 100}%)` }}>
          {slides.map((s, i) => {
            const Title = i === 0 ? 'h1' : 'h2';
            const current = i === at;
            return (
              <div key={s.key || i} className={`hx-hero__slide hx-hero__slide--${s.key || i}${current ? ' is-on' : ''}`} aria-hidden={!current} aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}>
                <div className="hx-wrap">
                  <div className="hx-hero__head">
                    {s.eyebrow && <p className="hx-eyebrow">{s.eyebrow}</p>}
                    <Title className="hx-hero__title">{s.title.map((line, j) => <Fragment key={j}>{j > 0 && ' '}<span className={j > 0 ? 'hx-hl' : undefined}>{line}</span></Fragment>)}</Title>
                  </div>
                  <ul className="hx-hero__panels" style={{ '--n': s.panels.length }}>
                    {s.panels.map((p, k) => <HeroPanel key={k} p={p} i={k} current={current} eager={i === 0 || warm} high={i === 0} />)}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {n > 1 && (
        <div className="hx-hero__dots" role="group" aria-label="Choose a slide">
          {slides.map((s, i) => (
            <button key={s.key || i} type="button" aria-label={`Show slide ${i + 1} of ${n}`} aria-pressed={i === at} className={`hx-hero__dot${i === at ? ' is-on' : ''}`} onClick={() => { setWarm(true); setIndex(i); }} />
          ))}
        </div>
      )}
    </section>
  );
}

// The trust strip, the three store tiles, the store circles and the festive promo are the admin's too
// (Storefronts → Wellness homepage). Their built-in content, in the schema's shape:
export const TRUST_SECTION = Object.freeze({
  hidden: false,
  items: TRUST.map((t) => ({ ...t, hidden: false, title: [t.title[0], t.title[1] || ''], note: t.note || '', link: t.to || '' })),
});

const tileArt = (src) => ({ colour: '', phone: src, desktop: src });
export const TILES_SECTION = Object.freeze({
  hidden: false,
  fashion: {
    hidden: false, title: ['Fashion', 'for every', 'mood.'], cta: 'Shop Fashion', link: '/fashion',
    picture: tileArt('/img/home-fashion-portrait-orange.webp'), alt: 'Woman in an orange knit sweater against an orange backdrop',
  },
  nutrition: { hidden: false, title: ['Health &', 'Nutrition'], link: '/category/supplements', picture: tileArt('/img/home-tile-nutrition.webp') },
  living: { hidden: false, title: ['Home &', 'Living'], link: '/homeliving', picture: tileArt('/img/home-tile-living.webp') },
});

export const STORES_SECTION = Object.freeze({
  hidden: false, title: 'Explore the stores', more: 'View All', link: '/shop',
  items: STORES.map((s) => ({ ...s, hidden: false, link: s.to, picture: tileArt(s.image) })),
});

const visible = (entry) => !entry.hidden;
/** Lines set as spans with a space between them, the empty ones left out. */
const spans = (lines) => filledLines(lines).map((line, i) => <Fragment key={i}>{i > 0 && ' '}<span>{line}</span></Fragment>);
/** The fashion chooser for /fashion (as the built-in tile and circle open it); a plain link anywhere else. */
const entryFor = (to) => (to === '/fashion' ? FashionEntryLink : Link);

export function HomeTrustStrip() {
  const section = useStorefrontSection('wellness', 'trust', TRUST_SECTION);
  const items = section.hidden ? [] : section.items.filter(visible);
  if (!items.length) return null;
  // Fewer than four: the row keeps its columns even (only then is the count set).
  const count = items.length === TRUST.length ? {} : { 'data-count': items.length, style: { '--hx-trust-n': items.length } };
  return (
    <section className="hx hx-trust" aria-label="Shopping with SORA LIFESTYLE">
      <ul className="hx-wrap hx-trust__list" {...count}>
        {items.map((t) => {
          const lines = filledLines(t.title);
          const title = lines.join(' ');
          const body = <><Icon name={t.icon} size={26} /><span><strong>{lines.map((line, j) => <span key={line}>{j > 0 && ' '}{line}</span>)}</strong>{t.note && <small>{t.note}</small>}</span></>;
          return <li key={title} className={lines.length > 1 ? 'hx-trust--split' : undefined}>{t.link ? <Link to={t.link}>{body}</Link> : <span className="hx-trust__item">{body}</span>}</li>;
        })}
      </ul>
    </section>
  );
}

export function HomeTiles() {
  const section = useStorefrontSection('wellness', 'tiles', TILES_SECTION);
  const { fashion, nutrition, living } = section;
  const hiddenTiles = ['fashion', 'nutrition', 'living'].filter((key) => section[key].hidden);
  if (section.hidden || hiddenTiles.length === 3) return null;
  const Fashion = entryFor(fashion.link);
  const small = (key, tile) => (
    <Link to={tile.link} className={`hx-tile hx-tile--small hx-tile--${key}`} {...toneAttrs(tile.picture.colour)} aria-labelledby={`hx-${key}-h`}>
      <DeferredImage src={tile.picture.desktop} {...phoneSources(tile.picture.phone, tile.picture.desktop)} alt="" width={900} height={563} className="hx-tile__image" />
      <h2 className="hx-tile__h" id={`hx-${key}-h`}>{spans(tile.title)}</h2>
      <span className="hx-tile__go" aria-hidden="true"><Icon name="arrowRight" size={18} /></span>
    </Link>
  );
  return (
    <section className="hx hx-tiles" aria-label="Shop the stores">
      {/* A hidden tile's place is closed up (storefront-sections.css); only then is it named here. */}
      <div className="hx-wrap hx-tiles__grid" {...(hiddenTiles.length ? { 'data-without': hiddenTiles.join(' ') } : {})}>
        {!fashion.hidden && <Fashion to={fashion.link} className="hx-tile hx-tile--fashion" {...toneAttrs(fashion.picture.colour)} aria-labelledby="hx-fashion-h hx-fashion-cta">
          <div className="hx-tile__panel">
            <h2 className="hx-tile__h" id="hx-fashion-h">{spans(fashion.title)}</h2>
            <span className="hx-btn hx-btn--light" id="hx-fashion-cta">{fashion.cta} <Icon name="arrowRight" size={16} /></span>
          </div>
          <span className="hx-tile__art"><DeferredImage src={fashion.picture.desktop} {...phoneSources(fashion.picture.phone, fashion.picture.desktop)} alt={fashion.alt} width={800} height={1067} className="hx-tile__image" /></span>
        </Fashion>}
        {!nutrition.hidden && small('nutrition', nutrition)}
        {!living.hidden && small('living', living)}
      </div>
    </section>
  );
}

/** The six circles: `stores` (as built in, or a test's) or the published section over the built-in one. */
export function ExploreStores({ stores: given }) {
  const section = useStorefrontSection('wellness', 'stores', STORES_SECTION);
  const circles = given
    ? given.map((s) => ({ ...s, link: s.to, picture: tileArt(s.image) }))
    : (section.hidden ? [] : section.items.filter(visible));
  if (!circles.length) return null;
  const count = given || circles.length === STORES.length ? {} : { 'data-count': circles.length, style: { '--hx-stores-n': circles.length } };
  return (
    <section className="hx hx-stores" aria-labelledby="hx-stores-h">
      <div className="hx-wrap">
        <div className="hx-stores__head">
          <h2 className="hx-stores__h" id="hx-stores-h">{section.title}</h2>
          <Link to={section.link} className="hx-more" aria-label={section.link === STORES_SECTION.link ? 'View all products' : undefined}>{section.more} <Icon name="arrowRight" size={15} /></Link>
        </div>
        <ul className="hx-stores__row" {...count}>
          {circles.map((s) => {
            const Entry = entryFor(s.link);
            return (
              <li key={s.key}>
                <Entry to={s.link} className="hx-store">
                  <span className="hx-store__art" {...toneAttrs(s.picture.colour)}><DeferredImage src={s.picture.desktop} {...phoneSources(s.picture.phone, s.picture.desktop)} alt="" width={s.size || 480} height={s.size || 480} className="hx-store__image" /></span>
                  <span className="hx-store__name">{s.name}</span>
                </Entry>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// The jewellery page's own words: its eyebrow, its hero line and its story's "made to be worn every day".
export const JEWELLERY_BANNER = {
  to: '/fashion/jewellery',
  eyebrow: 'SORA LIFE Jewellery',
  title: ['Jewellery that', 'tells your story'],
  text: 'Rings, necklaces, earrings and bracelets, made to be worn every day.',
  cta: 'Explore Jewellery',
  // The owner's photographs at their own sizes, warm ivory: the wide one from 701px (the jewellery
  // on the right, the left 45% plain for the copy), the 4:5 portrait on a phone (the arrangement in
  // the lower half, the copy over the clear upper half).
  wide: { src: '/img/home-jewellery-wide.webp', width: 1891, height: 831 },
  tall: '/img/home-jewellery-portrait.webp',
  alt: 'A gold necklace and drop earrings with clear stones on a marble tray, among white flowers and ivory satin, a hand wearing a matching ring',
};

export const JEWELLERY_BANNER_SECTION = Object.freeze({
  hidden: false, eyebrow: JEWELLERY_BANNER.eyebrow, title: [...JEWELLERY_BANNER.title], text: JEWELLERY_BANNER.text,
  cta: JEWELLERY_BANNER.cta, link: JEWELLERY_BANNER.to, picture: { phone: JEWELLERY_BANNER.tall, desktop: JEWELLERY_BANNER.wide.src },
  alt: JEWELLERY_BANNER.alt, position: 'left',
});

/** The banner as JewelleryBanner renders it, from its section. */
export const jewelleryBannerOf = (s) => ({
  to: s.link, eyebrow: s.eyebrow, title: s.title, text: s.text, cta: s.cta,
  wide: { ...JEWELLERY_BANNER.wide, src: s.picture.desktop }, tall: s.picture.phone, alt: s.alt, position: s.position,
});

/** Full-bleed and square-edged under the fashion category strip: one whole-banner link, every word on the photograph. */
export function JewelleryBanner({ banner }) {
  const section = useStorefrontSection('wellness', 'jewelleryBanner', JEWELLERY_BANNER_SECTION);
  if (!banner && section.hidden) return null;
  const b = banner || jewelleryBannerOf(section);
  return (
    <section className="hx hx-jewel" {...positionAttr(b.position)} aria-labelledby="hx-jewel-h">
      <Link to={b.to} className="hx-jewel__link" aria-labelledby="hx-jewel-h hx-jewel-cta">
        <span className="hx-jewel__art">
          <DeferredImage src={b.wide.src} sources={[{ media: PHONE, srcSet: b.tall }]} alt={b.alt} width={b.wide.width} height={b.wide.height} className="hx-jewel__image" />
        </span>
        <div className="hx-jewel__copy">
          <p className="hx-jewel__eyebrow">{b.eyebrow}</p>
          <h2 className="hx-jewel__h" id="hx-jewel-h"><span>{b.title[0]}</span> <span>{b.title[1]}</span></h2>
          <p className="hx-jewel__text">{b.text}</p>
          <span className="hx-jewel__cta" id="hx-jewel-cta">{b.cta} <Icon name="arrowRight" size={16} /></span>
        </div>
      </Link>
    </section>
  );
}

/** The festive promo's built-in content; its copy's built-in place is the centre. */
export const FESTIVE_SECTION = Object.freeze({
  // Its button opens the gift finder (round 13, 2026-11-20) rather than the whole wellness shop.
  hidden: false, title: 'Festive gifting', text: 'Wellness, beauty and home picks to give this season', cta: 'Shop gifts', link: '/gifts',
  picture: { phone: '/img/home-promo-festive-800.webp', desktop: '/img/home-promo-festive.webp' },
  alt: 'A gift box tied with an orange ribbon beside a lit diya and marigolds', position: 'center',
});

export function FestivePromo() {
  const promo = useStorefrontSection('wellness', 'promo', FESTIVE_SECTION);
  if (promo.hidden) return null;
  return (
    <section className="hx hx-promo" {...positionAttr(promo.position, FESTIVE_SECTION.position)} aria-labelledby="hx-promo-h">
      <div className="hx-wrap">
        <Link to={promo.link} className="hx-promo__card" aria-labelledby="hx-promo-h hx-promo-cta">
          <DeferredImage src={promo.picture.desktop} sources={[{ media: PHONE, srcSet: promo.picture.phone }]}
            alt={promo.alt} width={1600} height={533} className="hx-promo__image" />
          <div className="hx-promo__copy">
            <h2 className="hx-promo__h" id="hx-promo-h">{promo.title}</h2>
            <p className="hx-promo__text">{promo.text}</p>
            <span className="hx-btn" id="hx-promo-cta">{promo.cta} <Icon name="arrowRight" size={16} /></span>
          </div>
        </Link>
      </div>
    </section>
  );
}
