import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { categoryHref } from '../lib/fashion.js';
import { useFashionCatalogue } from './FashionCatalogue.jsx';
import FashionProductCard from './FashionProductCard.jsx';
import { departmentCatalogue } from './FashionDepartment.jsx';
import { JEWELLERY, JEWELLERY_SECTIONS } from './jewelleryContent.js';
import { useStorefrontSection, filledLines, positionAttr, imageFor, linkOr } from '../lib/storefrontSections.js';

// ============================================================
// /fashion/jewellery — SORA LIFE Jewellery, laid out as the owner's reference
// (section for section): the hero, one trust strip, seven category circles,
// four real catalogue pieces, two editorial banners, the story beside the
// craftsmanship photograph, and the newsletter. Its own header sits above
// (FashionLayout). Scoped to .jw; square edges everywhere except the circles
// and the story's arched frame.
// ============================================================

function Photo({ image, priority = false, className = '' }) {
  return <picture className={className}>
    {image.mobile && <source media="(max-width: 700px)" srcSet={image.mobile} />}
    <img src={image.src} srcSet={image.srcSet} sizes={image.sizes || '100vw'} alt={image.alt} width={image.width || 400} height={image.height || 400}
      loading={priority ? 'eager' : 'lazy'} fetchpriority={priority ? 'high' : 'auto'} decoding="async" />
  </picture>;
}

// The newsletter posts to the same endpoint as the site's sign-up and, like it,
// confirms only after the server has stored the address.
function Newsletter({ content }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, done: false, error: '' });
  const submit = async (e) => {
    e.preventDefault();
    if (state.busy) return;
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email.trim())) { setState({ busy: false, done: false, error: 'Please enter a valid email address.' }); return; }
    setState({ busy: true, done: false, error: '' });
    try {
      const res = await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      let data = null;
      try { data = await res.json(); } catch { /* not JSON */ }
      if (!res.ok || !data?.subscribed) { setState({ busy: false, done: false, error: data?.error || 'We could not sign you up right now. Please try again.' }); return; }
      setState({ busy: false, done: true, error: '' });
    } catch {
      setState({ busy: false, done: false, error: 'We could not reach us just now. Please check your connection and try again.' });
    }
  };
  return <section className="jw-news" aria-labelledby="jw-news-title">
    <Photo image={content.image} className="jw-news__art" />
    <div className="jw-wrap jw-news__body">
      <h2 id="jw-news-title">{content.title}</h2>
      <p>{content.text}</p>
      {state.done ? <p className="jw-news__done" role="status"><Icon name="check" size={16} /> You’re subscribed. We’ll be in touch when there’s something worth sending.</p>
        : <form className="jw-news__form" onSubmit={submit} noValidate>
          <label className="jw-sr" htmlFor="jw-news-email">Email address</label>
          <input id="jw-news-email" type="email" placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={state.busy} autoComplete="email" />
          <button type="submit" className="jw-button" disabled={state.busy}>{state.busy ? 'Subscribing…' : 'Subscribe'}</button>
        </form>}
      {state.error && <p className="jw-news__error" role="alert">{state.error}</p>}
    </div>
  </section>;
}

const visible = (entry) => !entry.hidden;
/** A replaced hero photograph also replaces the blurred copy of it behind the copy (.jw-hero::before). */
const heroLook = (hero) => {
  const image = imageFor(hero);
  return image.src === hero.image.src ? {} : { 'data-art': '', style: { '--jw-hero-art': `url(${JSON.stringify(image.src)})` } };
};

// Every section is the admin's (Storefronts → Fashion → Jewellery page): `s` is the page's sections as
// published over their built-in content (JEWELLERY_SECTIONS), and a hidden one is left out.
export default function FashionJewellery({ content = JEWELLERY }) {
  const s = useStorefrontSection('fashion', 'jewellery', JEWELLERY_SECTIONS);
  const { tree, views, status } = useFashionCatalogue();
  // Jewellery and its active sub-categories only; the catalogue's featured order puts any
  // product flagged bestseller first. Nothing here invents a price, a rating or a review.
  const { category, categories, products } = departmentCatalogue(tree, views, content.categorySlug);
  const listing = category ? categoryHref(category) : '#jw-products';
  const hrefFor = (slug) => { const node = categories.find((c) => c.slug === slug); return node ? categoryHref(node) : listing; };
  const loved = products.slice(0, 4);
  return <div className="jw">
    {!s.hero.hidden && <section className="jw-hero" {...positionAttr(s.hero.position)} {...heroLook(s.hero)} aria-labelledby="jw-title">
      <Photo image={imageFor(s.hero)} priority className="jw-hero__art" />
      <div className="jw-wrap jw-hero__copy">
        <p className="jw-eyebrow">{s.hero.eyebrow}</p>
        <h1 id="jw-title">{filledLines(s.hero.title).map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="jw-hero__intro">{s.hero.intro}</p>
        <Link to={linkOr(s.hero.link, listing)} className="jw-button">{s.hero.cta} <Icon name="arrowRight" size={15} /></Link>
      </div>
    </section>}

    {!s.trust.hidden && <nav className="jw-trust" aria-label="Shopping with SORA LIFE">
      <ul className="jw-wrap">{s.trust.items.filter(visible).map((t) => <li key={t.title}><Link to={t.link}>
        <Icon name={t.icon} size={22} />
        <span className="jw-trust__full"><strong>{t.title}</strong><small>{t.note}</small></span>
        <span className="jw-trust__phone"><strong>{t.phone[0]}</strong><small>{t.phone[1]}</small></span>
      </Link></li>)}</ul>
    </nav>}

    {!s.categories.hidden && <section className="jw-cats jw-wrap" id="jw-categories" aria-labelledby="jw-cats-title">
      <header className="jw-head jw-head--center"><p className="jw-eyebrow">{s.categories.eyebrow}</p><h2 id="jw-cats-title">{s.categories.title}</h2><p>{s.categories.intro}</p></header>
      <ul className="jw-cats__row">{s.categories.items.filter(visible).map((item) => <li key={item.slug}><Link to={linkOr(item.link, hrefFor(item.slug))} className="jw-cat">
        <Photo image={imageFor(item)} className="jw-cat__art" /><span>{item.title}</span>
      </Link></li>)}</ul>
    </section>}

    {!s.loved.hidden && <section className="jw-loved jw-wrap" id="jw-products" aria-labelledby="jw-loved-title">
      <header className="jw-head jw-head--split"><h2 id="jw-loved-title">{s.loved.title}</h2>
        {loved.length > 0 && <Link to={listing} className="jw-more">{s.loved.viewAll} <Icon name="arrowRight" size={14} /></Link>}</header>
      {loved.length ? <div className="jw-loved__grid">{loved.map((view) => <FashionProductCard key={view.id} view={view} />)}</div>
        : <div className="jw-empty" role="status"><p>{status === 'loading' ? 'Loading the collection…' : status === 'error' ? 'The collection is unavailable right now. Please try again shortly.' : 'Our first jewellery pieces are on their way. Explore the categories above in the meantime.'}</p>
          <a href="#jw-categories" className="jw-more">Shop by category <Icon name="arrowRight" size={14} /></a></div>}
    </section>}

    {!s.edits.hidden && <section className="jw-edits" aria-label="Wedding and gifts">{s.edits.items.filter(visible).map((item, i) => <Link key={item.slug} to={linkOr(item.link, hrefFor(item.slug))} className={`jw-edit jw-edit--${i + 1}`}>
      <Photo image={imageFor(item)} className="jw-edit__art" />
      <div><h2>{filledLines(item.title).map((line) => <span key={line}>{line}</span>)}</h2><span className="jw-button">{item.cta} <Icon name="arrowRight" size={14} /></span></div>
    </Link>)}</section>}

    {!s.story.hidden && <section className="jw-story jw-wrap" aria-labelledby="jw-story-title">
      <div className="jw-story__copy"><p className="jw-eyebrow">{s.story.eyebrow}</p><h2 id="jw-story-title">{s.story.title}</h2><p>{s.story.text}</p>
        <Link to={s.story.link} className="jw-button">{s.story.cta} <Icon name="arrowRight" size={14} /></Link></div>
      <Photo image={imageFor(s.story)} className="jw-story__art" />
    </section>}

    {!s.newsletter.hidden && <Newsletter content={{ title: s.newsletter.title, text: s.newsletter.text, image: imageFor(s.newsletter) }} />}
  </div>;
}
