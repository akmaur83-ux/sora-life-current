import { Fragment, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { categoryHref, resolveCategory, sortViews } from '../lib/fashion.js';
import { useFashionCatalogue } from './FashionCatalogue.jsx';
import FashionProductCard from './FashionProductCard.jsx';
import { DEPARTMENT_CONTENT, DEPARTMENT_SECTIONS } from './departmentContent.js';
import { useStorefrontSection, filledLines, positionAttr, imageFor, linkOr } from '../lib/storefrontSections.js';

// Use the existing category tree, including active descendants. Missing
// departments never fall back to showing another department's products.
export function departmentCatalogue(tree, views, slug) {
  const category = resolveCategory(tree, slug);
  const belongs = (node) => !!category && tree.ancestors(node.id).some((p) => p.id === category.id)
    && tree.ancestors(node.id).every((p) => p.is_active);
  const categories = tree.list.filter(belongs);
  const ids = new Set(categories.map((c) => c.id));
  return { category, categories, products: sortViews(views.filter((v) => ids.has(v.category_id)), 'featured') };
}

function EditorialImage({ image, priority = false, className = '' }) {
  const [failed, setFailed] = useState('');
  const src = image.src && failed !== image.src ? image.src : image.fallback;
  return <picture className={className}>
    {image.mobile && !failed && <source media="(max-width: 700px)" srcSet={image.mobile} />}
    <img key={src} src={src} srcSet={!failed ? image.srcSet : undefined} sizes={image.sizes || '100vw'} alt={image.alt} width={image.width || 1200} height={image.height || 1400}
    loading={priority ? 'eager' : 'lazy'} fetchpriority={priority ? 'high' : 'auto'} decoding="async"
    onError={src !== image.fallback ? () => setFailed(src) : undefined} />
  </picture>;
}

function DepartmentNav({ active }) {
  return <nav className="fd-nav" aria-label="Fashion departments">
    <Link to="/fashion">All fashion</Link>
    <Link to="/fashion/men" aria-current={active === 'men' ? 'page' : undefined}>Men</Link>
    <Link to="/fashion/women" aria-current={active === 'women' ? 'page' : undefined}>Women</Link>
    <span aria-disabled="true">Kids <small>Coming soon</small></span>
  </nav>;
}

function SectionHead({ eyebrow, title, href, id, more = 'Explore all' }) {
  return <header className="fd-section-head"><div><p className="fd-eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div>
    <Link to={href}>{more} <Icon name="arrowRight" size={17} /></Link></header>;
}

/** Lines set with a line break between them (and `gap` after each break), the empty ones left out. */
const brLines = (lines, gap = '') => filledLines(lines).map((line, i) => <Fragment key={i}>{i > 0 && <br />}{i > 0 && gap}{line}</Fragment>);
const visible = (entry) => !entry.hidden;

// Every section below is the admin's (Storefronts → Fashion): `s` is the page's sections as
// published over their built-in content (DEPARTMENT_SECTIONS), and a hidden one is left out.
function SareeDepartment({ sections: s, products, status, listing, collectionHref }) {
  const [slide, setSlide] = useState(0);
  const productRail = useRef(null);
  const slides = s.hero.slides.map(imageFor);
  const step = (direction) => setSlide((index) => (index + direction + slides.length) % slides.length);
  const scrollProducts = (direction) => {
    const rail = productRail.current;
    if (rail) rail.scrollBy({ left: direction * rail.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <div className="sw">
    {!s.hero.hidden && <section className="sw-hero" {...positionAttr(s.hero.position)} aria-label="Saree collection" aria-roledescription="carousel">
      <EditorialImage key={slide} image={slides[slide]} priority className="sw-hero__art" />
      <div className="sw-hero__copy">
        <p className="sw-eyebrow">{s.hero.eyebrow}</p>
        <h1>{filledLines(s.hero.title).map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="sw-hero__intro">{s.hero.intro}</p>
        <Link to={linkOr(s.hero.link, listing)} className="sw-button">{s.hero.cta}<Icon name="arrowRight" size={17} /></Link>
      </div>
      <div className="sw-hero__controls">
        <div className="sw-hero__dots" aria-label="Choose a collection image">{slides.map((_, index) => <button key={index} type="button" aria-label={`Show collection image ${index + 1}`} aria-pressed={slide === index} onClick={() => setSlide(index)}>0{index + 1}</button>)}</div>
        <div className="sw-arrows"><button type="button" aria-label="Previous collection image" onClick={() => step(-1)}><Icon name="chevronLeft" size={18} /></button><button type="button" aria-label="Next collection image" onClick={() => step(1)}><Icon name="chevronRight" size={18} /></button></div>
      </div>
    </section>}

    {!s.collections.hidden && <section className="sw-collections sw-wrap" id="sw-collections" aria-labelledby="sw-collections-title">
      <div className="sw-collections__intro"><p className="sw-eyebrow">{s.collections.eyebrow}</p><h2 id="sw-collections-title">{brLines(s.collections.title, ' ')}</h2><p>{brLines(s.collections.text)}</p><Link to={listing} className="sw-inline-link">{s.collections.viewAll} <Icon name="arrowRight" size={16} /></Link></div>
      <div className="sw-collections__grid">{s.collections.items.filter(visible).map((item) => <Link key={item.slug} to={linkOr(item.link, collectionHref(item.slug))} className="sw-collection"><EditorialImage image={imageFor(item)} /><strong>{item.title}</strong><span>{item.caption}</span></Link>)}</div>
    </section>}

    {!s.editorial.hidden && <section className="sw-editorials" aria-label="Featured saree collections">{s.editorial.items.filter(visible).map((item, index) => <Link key={item.slug} to={linkOr(item.link, collectionHref(item.slug))} className={`sw-editorial sw-editorial--${index + 1}`}>
      <EditorialImage image={imageFor(item)} /><div><p className="sw-eyebrow">{item.eyebrow}</p><h2>{item.title}</h2><p>{item.text}</p><span className="sw-button sw-button--outline">{item.cta}<Icon name="arrowRight" size={15} /></span></div>
    </Link>)}</section>}

    {!s.products.hidden && <section className="sw-products sw-wrap" id="fd-products" aria-labelledby="sw-products-title">
      <header className="sw-section-head"><div><p className="sw-eyebrow">{s.products.eyebrow}</p><h2 id="sw-products-title">{s.products.title}</h2><p>{brLines(s.products.text)}</p></div><div className="sw-arrows"><button type="button" aria-label="Previous products" onClick={() => scrollProducts(-1)} disabled={products.length < 3}><Icon name="chevronLeft" size={16} /></button><button type="button" aria-label="Next products" onClick={() => scrollProducts(1)} disabled={products.length < 3}><Icon name="chevronRight" size={16} /></button></div></header>
      {products.length ? <div className="sw-products__rail" ref={productRail}>{products.slice(0, 8).map((view) => <FashionProductCard key={view.id} view={view} />)}</div>
        : <div className="fd-empty" role="status"><p>{status === 'loading' ? 'Loading the collection…' : status === 'error' ? 'The collection is unavailable right now. Please try again shortly.' : 'A new chapter in style is on its way. Explore all fashion while this collection comes together.'}</p><Link to="/fashion">Explore all fashion <Icon name="arrowRight" size={16} /></Link></div>}
    </section>}

    {!s.promo.hidden && <section className="sw-promo" aria-labelledby="sw-promo-title"><EditorialImage image={imageFor(s.promo)} /><div><p className="sw-eyebrow">{s.promo.eyebrow}</p><h2 id="sw-promo-title">{brLines(s.promo.title)}</h2></div><Link to={linkOr(s.promo.link, listing)} className="sw-button sw-button--outline">{s.promo.cta} <Icon name="arrowRight" size={16} /></Link></section>}
    {!s.services.hidden && <nav className="sw-services sw-wrap" aria-label="Shopping information">
      {s.services.items.filter(visible).map((item) => <Link key={item.title} to={item.link}><Icon name={item.icon} size={27} /><span><strong>{item.title}</strong><small>{item.text}</small></span></Link>)}
    </nav>}
  </div>;
}

// The main women's page: a full-bleed hero under its own header, shop-by-category,
// the real catalogue (new arrivals when any are flagged), four edits, a capsule
// wardrobe, and the ways into the saree and jewellery stores. Every word is HTML; no image carries text.
function WomenDepartment({ sections: s, tree, category, categories, products, status, listing, collectionHref }) {
  const [shelf, setShelf] = useState('');
  // A link the admin set wins; else `root` names a top-level category (bags sit under Bags &
  // Accessories, not under Women), else the slug's category, else the Women listing.
  const tileHref = (item) => {
    if (item.link) return item.link;
    if (!item.root) return item.slug ? collectionHref(item.slug) : listing;
    const node = resolveCategory(tree, item.root);
    return node && !node.parent_id ? categoryHref(node) : listing;
  };
  const fresh = products.filter((view) => view.isNew);
  const pool = fresh.length ? sortViews(fresh, 'new') : products;
  // Filters only for Women's own sub-categories that have something in the row.
  const shelves = (category ? tree.children(category.id) : []).filter((child) => child.is_active).map((child) => ({
    id: child.id, name: child.name,
    ids: new Set(categories.filter((node) => tree.ancestors(node.id).some((a) => a.id === child.id)).map((node) => node.id)),
  })).filter((s) => pool.some((view) => s.ids.has(view.category_id)));
  const current = shelves.find((s) => s.id === shelf);
  const shown = (current ? pool.filter((view) => current.ids.has(view.category_id)) : pool).slice(0, 8);
  return <div className="wm">
    {!s.hero.hidden && <section className="wm-hero" {...positionAttr(s.hero.position)} aria-labelledby="wm-title">
      <EditorialImage image={imageFor(s.hero)} priority className="wm-hero__art" />
      <div className="wm-hero__copy">
        <p className="wm-eyebrow">{s.hero.eyebrow}</p>
        <h1 id="wm-title">{filledLines(s.hero.title).map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="wm-hero__intro">{s.hero.intro}</p>
        <Link to={linkOr(s.hero.link, listing)} className="wm-button">{s.hero.cta}</Link>
      </div>
    </section>}

    {!s.categories.hidden && <section className="wm-categories wm-wrap" id="wm-categories" aria-labelledby="wm-categories-title">
      <h2 id="wm-categories-title">{s.categories.title}</h2>
      <div className="wm-categories__grid">{s.categories.items.filter(visible).map((item) => <Link key={item.title} to={tileHref(item)} className="wm-category">
        <EditorialImage image={imageFor(item)} /><span>{item.title}</span>
      </Link>)}</div>
    </section>}

    {!s.products.hidden && <section className="wm-products wm-wrap" id="wm-products" aria-labelledby="wm-products-title">
      <h2 id="wm-products-title">{fresh.length ? s.products.newTitle : s.products.title}</h2>
      {shelves.length > 1 && <div className="wm-shelves" role="group" aria-label="Show a category">
        <button type="button" aria-pressed={!current} onClick={() => setShelf('')}>All</button>
        {shelves.map((s) => <button key={s.id} type="button" aria-pressed={current?.id === s.id} onClick={() => setShelf(s.id)}>{s.name}</button>)}
      </div>}
      {shown.length ? <div className="wm-products__grid">{shown.map((view) => <FashionProductCard key={view.id} view={view} />)}</div>
        : <div className="fd-empty" role="status"><p>{status === 'loading' ? 'Loading the collection…' : status === 'error' ? 'The collection is unavailable right now. Please try again shortly.' : 'A new chapter in style is on its way. Explore all fashion while this collection comes together.'}</p><Link to="/fashion">Explore all fashion <Icon name="arrowRight" size={16} /></Link></div>}
      {shown.length > 0 && <Link to={listing} className="wm-button wm-button--outline">{s.products.viewAll}</Link>}
    </section>}

    {!s.edits.hidden && <section className="wm-edits wm-wrap" aria-label="Edits">
      {s.edits.items.filter(visible).map((item, index) => <Link key={item.title} to={tileHref(item)} className={`wm-edit wm-edit--${index + 1}`}>
        <EditorialImage image={imageFor(item)} /><div><h2>{item.title}</h2><p>{item.text}</p>
          {item.slug || item.root ? <span className="wm-edit__link">{item.cta} <Icon name="arrowRight" size={16} /></span> : <span className="wm-button">{item.cta}</span>}</div>
      </Link>)}
    </section>}

    {!s.capsule.hidden && <section className="wm-capsule wm-wrap" aria-labelledby="wm-capsule-title">
      <h2 id="wm-capsule-title">{s.capsule.title}</h2>
      <div className="wm-capsule__grid">{s.capsule.items.filter(visible).map((item) => <Link key={item.title} to={tileHref(item)} className="wm-look">
        <EditorialImage image={imageFor(item)} /><div><h3>{item.title}</h3><p>{item.caption}</p><span>{s.capsule.cta} <Icon name="arrowRight" size={15} /></span></div>
      </Link>)}</div>
    </section>}

    {!s.sarees.hidden && <section className="wm-sarees wm-wrap" aria-labelledby="wm-sarees-title">
      <EditorialImage image={imageFor(s.sarees)} />
      <div><p className="wm-eyebrow">{s.sarees.eyebrow}</p><h2 id="wm-sarees-title">{s.sarees.title}</h2><p>{s.sarees.text}</p>
        <Link to={s.sarees.link} className="wm-button">{s.sarees.cta} <Icon name="arrowRight" size={16} /></Link></div>
    </section>}

    {!s.jewellery.hidden && <section className="wm-sarees wm-jewellery wm-wrap" aria-labelledby="wm-jewellery-title">
      <EditorialImage image={imageFor(s.jewellery)} />
      <div><p className="wm-eyebrow">{s.jewellery.eyebrow}</p><h2 id="wm-jewellery-title">{s.jewellery.title}</h2><p>{s.jewellery.text}</p>
        <Link to={s.jewellery.link} className="wm-button">{s.jewellery.cta} <Icon name="arrowRight" size={16} /></Link></div>
    </section>}

    {!s.services.hidden && <nav className="wm-services wm-wrap" aria-label="Shopping information">
      {s.services.items.filter(visible).map((item) => <Link key={item.title} to={item.link}><Icon name={item.icon} size={24} /><span><strong>{item.title}</strong><small>{item.text}</small></span></Link>)}
    </nav>}
  </div>;
}

export default function FashionDepartment({ department = 'men' }) {
  // Opening at the hero (or at a #section) is ScrollManager's, site-wide (main.jsx).
  const config = DEPARTMENT_CONTENT[department] || DEPARTMENT_CONTENT.men;
  const page = DEPARTMENT_SECTIONS[department] ? department : 'men';
  const s = useStorefrontSection('fashion', page, DEPARTMENT_SECTIONS[page]);
  const { tree, views, status } = useFashionCatalogue();
  const { category, categories, products } = departmentCatalogue(tree, views, config.categorySlug);
  const listing = category ? categoryHref(category) : '#fd-products';
  const collectionHref = (slug) => {
    const node = categories.find((c) => c.slug === slug);
    return node ? categoryHref(node) : listing;
  };
  if (department === 'sarees') return <SareeDepartment sections={s} products={products} status={status} listing={listing} collectionHref={collectionHref} />;
  if (department === 'women') return <WomenDepartment sections={s} tree={tree} category={category} categories={categories} products={products} status={status} listing={listing} collectionHref={collectionHref} />;
  return <div className={`fd fd--${department}`}>
    <DepartmentNav active={department} />
    {!s.hero.hidden && <section className="fd-hero" {...positionAttr(s.hero.position)} aria-labelledby="fd-title">
      <div className="fd-hero__photo"><EditorialImage key={department} image={imageFor(s.hero)} priority /></div>
      <div className="fd-hero__copy">
        <p className="fd-eyebrow">{s.hero.eyebrow}</p>
        <h1 id="fd-title">{filledLines(s.hero.title).map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="fd-hero__intro">{s.hero.intro}</p>
        <Link to={linkOr(s.hero.link, listing)} className="fd-cta">{s.hero.cta} <Icon name="arrowRight" size={19} /></Link>
      </div>
      <span className="fd-hero__edition">{s.hero.note}</span>
      <span className="fd-hero__number" aria-hidden="true">{department === 'men' ? '01' : '02'}</span>
    </section>}

    {department === 'men' && !s.highlights.hidden && <nav className="fd-highlights" aria-label="Explore menswear">
      {s.highlights.items.filter(visible).map((item) =>
        <Link key={item.title} to={linkOr(item.link, listing)}><Icon name={item.icon} size={28} /><span><strong>{item.title}</strong><small>{item.text}</small></span></Link>)}
    </nav>}

    {!s.collections.hidden && <section className="fd-section fd-collections" aria-labelledby="fd-collections-title">
      <SectionHead eyebrow={s.collections.eyebrow} title={s.collections.title} more={s.collections.more} href={listing} id="fd-collections-title" />
      <div className="fd-collections__grid">{s.collections.items.filter(visible).map((item) => <Link key={item.title} to={linkOr(item.link, collectionHref(item.slug))} className="fd-collection">
        <span className="fd-collection__photo"><EditorialImage image={imageFor(item)} /></span><strong>{item.title}</strong><Icon name="arrowRight" size={17} />
      </Link>)}</div>
    </section>}

    {!s.editorial.hidden && <section className="fd-editorials" aria-label="The style edits">{s.editorial.items.filter(visible).map((item, i) => <Link key={item.title} to={linkOr(item.link, listing)} className={`fd-editorial fd-editorial--${i + 1}`}>
      <EditorialImage image={imageFor(item)} /><div><p className="fd-eyebrow">{item.eyebrow}</p><h2>{item.title}</h2><p>{item.text}</p><span className="fd-text-link">{item.cta} <Icon name="arrowRight" size={16} /></span></div>
    </Link>)}</section>}

    {!s.products.hidden && <section className="fd-section" aria-labelledby="fd-products-title" id="fd-products">
      <SectionHead eyebrow={s.products.eyebrow} title={s.products.title} more={s.products.more} href={listing} id="fd-products-title" />
      {products.length ? <div className="fd-products">{products.slice(0, 8).map((view) => <FashionProductCard key={view.id} view={view} />)}</div>
        : <div className="fd-empty" role="status"><Icon name="bag" size={28} /><p>{status === 'loading' ? 'Loading the collection…' : status === 'error' ? 'The collection is unavailable right now. Please try again shortly.' : 'A new chapter in style is on its way. Explore all fashion while this collection comes together.'}</p><Link to="/fashion">Explore all fashion <Icon name="arrowRight" size={16} /></Link></div>}
    </section>}

    {!s.looks.hidden && <section className="fd-section fd-looks" aria-labelledby="fd-looks-title">
      <SectionHead eyebrow={s.looks.eyebrow} title={s.looks.title} more={s.looks.more} href={listing} id="fd-looks-title" />
      <div className="fd-looks__grid">{s.looks.items.filter(visible).map((look) => <Link key={look.title} to={linkOr(look.link, listing)}><EditorialImage image={imageFor(look)} /><span>{look.title}<Icon name="arrowRight" size={17} /></span></Link>)}</div>
    </section>}
    {!s.closing.hidden && <section className="fd-closing"><p className="fd-eyebrow">{s.closing.eyebrow}</p><h2>{s.closing.title}</h2><Link to={linkOr(s.closing.link, listing)} className="fd-cta">{s.closing.cta} <Icon name="arrowRight" size={18} /></Link></section>}
  </div>;
}
