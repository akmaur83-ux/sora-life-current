import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { categoryHref } from '../lib/fashion.js';
import { useFashionCatalogue } from './FashionCatalogue.jsx';
import FashionProductCard from './FashionProductCard.jsx';
import { departmentCatalogue } from './FashionDepartment.jsx';
import { JEWELLERY } from './jewelleryContent.js';

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

export default function FashionJewellery({ content = JEWELLERY }) {
  const { tree, views, status } = useFashionCatalogue();
  // Jewellery and its active sub-categories only; the catalogue's featured order puts any
  // product flagged bestseller first. Nothing here invents a price, a rating or a review.
  const { category, categories, products } = departmentCatalogue(tree, views, content.categorySlug);
  const listing = category ? categoryHref(category) : '#jw-products';
  const hrefFor = (slug) => { const node = categories.find((c) => c.slug === slug); return node ? categoryHref(node) : listing; };
  const loved = products.slice(0, 4);
  const { hero, categories: cats, story } = content;
  return <div className="jw">
    <section className="jw-hero" aria-labelledby="jw-title">
      <Photo image={hero.image} priority className="jw-hero__art" />
      <div className="jw-wrap jw-hero__copy">
        <p className="jw-eyebrow">{hero.eyebrow}</p>
        <h1 id="jw-title">{hero.title.map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="jw-hero__intro">{hero.intro}</p>
        <Link to={listing} className="jw-button">{hero.cta} <Icon name="arrowRight" size={15} /></Link>
      </div>
    </section>

    <nav className="jw-trust" aria-label="Shopping with SORA LIFE">
      <ul className="jw-wrap">{content.trust.map((t) => <li key={t.title}><Link to={t.to}>
        <Icon name={t.icon} size={22} />
        <span className="jw-trust__full"><strong>{t.title}</strong><small>{t.note}</small></span>
        <span className="jw-trust__phone"><strong>{t.phone[0]}</strong><small>{t.phone[1]}</small></span>
      </Link></li>)}</ul>
    </nav>

    <section className="jw-cats jw-wrap" id="jw-categories" aria-labelledby="jw-cats-title">
      <header className="jw-head jw-head--center"><p className="jw-eyebrow">{cats.eyebrow}</p><h2 id="jw-cats-title">{cats.title}</h2><p>{cats.intro}</p></header>
      <ul className="jw-cats__row">{cats.items.map((item) => <li key={item.slug}><Link to={hrefFor(item.slug)} className="jw-cat">
        <Photo image={item.image} className="jw-cat__art" /><span>{item.title}</span>
      </Link></li>)}</ul>
    </section>

    <section className="jw-loved jw-wrap" id="jw-products" aria-labelledby="jw-loved-title">
      <header className="jw-head jw-head--split"><h2 id="jw-loved-title">{content.loved.title}</h2>
        {loved.length > 0 && <Link to={listing} className="jw-more">{content.loved.viewAll} <Icon name="arrowRight" size={14} /></Link>}</header>
      {loved.length ? <div className="jw-loved__grid">{loved.map((view) => <FashionProductCard key={view.id} view={view} />)}</div>
        : <div className="jw-empty" role="status"><p>{status === 'loading' ? 'Loading the collection…' : status === 'error' ? 'The collection is unavailable right now. Please try again shortly.' : 'Our first jewellery pieces are on their way. Explore the categories above in the meantime.'}</p>
          <a href="#jw-categories" className="jw-more">Shop by category <Icon name="arrowRight" size={14} /></a></div>}
    </section>

    <section className="jw-edits" aria-label="Wedding and gifts">{content.edits.map((item, i) => <Link key={item.slug} to={hrefFor(item.slug)} className={`jw-edit jw-edit--${i + 1}`}>
      <Photo image={item.image} className="jw-edit__art" />
      <div><h2>{item.title.map((line) => <span key={line}>{line}</span>)}</h2><span className="jw-button">{item.cta} <Icon name="arrowRight" size={14} /></span></div>
    </Link>)}</section>

    <section className="jw-story jw-wrap" aria-labelledby="jw-story-title">
      <div className="jw-story__copy"><p className="jw-eyebrow">{story.eyebrow}</p><h2 id="jw-story-title">{story.title}</h2><p>{story.text}</p>
        <Link to={story.to} className="jw-button">{story.cta} <Icon name="arrowRight" size={14} /></Link></div>
      <Photo image={story.image} className="jw-story__art" />
    </section>

    <Newsletter content={content.newsletter} />
  </div>;
}
