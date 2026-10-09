import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { categoryHref, resolveCategory, sortViews } from '../lib/fashion.js';
import { useFashionCatalogue } from './FashionCatalogue.jsx';
import FashionProductCard from './FashionProductCard.jsx';
import { DEPARTMENT_CONTENT } from './departmentContent.js';

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

function SectionHead({ eyebrow, title, href, id }) {
  return <header className="fd-section-head"><div><p className="fd-eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div>
    <Link to={href}>Explore all <Icon name="arrowRight" size={17} /></Link></header>;
}

function SareeDepartment({ config, products, status, listing, collectionHref }) {
  const [slide, setSlide] = useState(0);
  const productRail = useRef(null);
  const slides = [config.hero, config.alternateHero];
  const step = (direction) => setSlide((index) => (index + direction + slides.length) % slides.length);
  const scrollProducts = (direction) => {
    const rail = productRail.current;
    if (rail) rail.scrollBy({ left: direction * rail.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <div className="sw">
    <section className="sw-hero" aria-label="Saree collection" aria-roledescription="carousel">
      <EditorialImage key={slide} image={slides[slide]} priority className="sw-hero__art" />
      <div className="sw-hero__copy">
        <p className="sw-eyebrow">{config.eyebrow}</p>
        <h1>{config.title.map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="sw-hero__intro">{config.intro}</p>
        <Link to={listing} className="sw-button">{config.cta}<Icon name="arrowRight" size={17} /></Link>
      </div>
      <div className="sw-hero__controls">
        <div className="sw-hero__dots" aria-label="Choose a collection image">{slides.map((_, index) => <button key={index} type="button" aria-label={`Show collection image ${index + 1}`} aria-pressed={slide === index} onClick={() => setSlide(index)}>0{index + 1}</button>)}</div>
        <div className="sw-arrows"><button type="button" aria-label="Previous collection image" onClick={() => step(-1)}><Icon name="chevronLeft" size={18} /></button><button type="button" aria-label="Next collection image" onClick={() => step(1)}><Icon name="chevronRight" size={18} /></button></div>
      </div>
    </section>

    <section className="sw-collections sw-wrap" id="sw-collections" aria-labelledby="sw-collections-title">
      <div className="sw-collections__intro"><p className="sw-eyebrow">Shop by category</p><h2 id="sw-collections-title">Explore Our<br /> Collections</h2><p>Discover sarees for every mood,<br />occasion and style.</p><Link to={listing} className="sw-inline-link">View all <Icon name="arrowRight" size={16} /></Link></div>
      <div className="sw-collections__grid">{config.collections.map((item) => <Link key={item.slug} to={collectionHref(item.slug)} className="sw-collection"><EditorialImage image={item.image} /><strong>{item.title}</strong><span>{item.caption}</span></Link>)}</div>
    </section>

    <section className="sw-editorials" aria-label="Featured saree collections">{config.editorial.map((item, index) => <Link key={item.slug} to={collectionHref(item.slug)} className={`sw-editorial sw-editorial--${index + 1}`}>
      <EditorialImage image={item.image} /><div><p className="sw-eyebrow">{item.eyebrow}</p><h2>{item.title}</h2><p>{item.text}</p><span className="sw-button sw-button--outline">{item.cta}<Icon name="arrowRight" size={15} /></span></div>
    </Link>)}</section>

    <section className="sw-products sw-wrap" id="fd-products" aria-labelledby="sw-products-title">
      <header className="sw-section-head"><div><p className="sw-eyebrow">The wardrobe edit</p><h2 id="sw-products-title">{config.productsTitle}</h2><p>Explore the styles currently available<br />in our catalogue.</p></div><div className="sw-arrows"><button type="button" aria-label="Previous products" onClick={() => scrollProducts(-1)} disabled={products.length < 3}><Icon name="chevronLeft" size={16} /></button><button type="button" aria-label="Next products" onClick={() => scrollProducts(1)} disabled={products.length < 3}><Icon name="chevronRight" size={16} /></button></div></header>
      {products.length ? <div className="sw-products__rail" ref={productRail}>{products.slice(0, 8).map((view) => <FashionProductCard key={view.id} view={view} />)}</div>
        : <div className="fd-empty" role="status"><p>{status === 'loading' ? 'Loading the collection…' : status === 'error' ? 'The collection is unavailable right now. Please try again shortly.' : 'A new chapter in style is on its way. Explore all fashion while this collection comes together.'}</p><Link to="/fashion">Explore all fashion <Icon name="arrowRight" size={16} /></Link></div>}
    </section>

    <section className="sw-promo" aria-labelledby="sw-promo-title"><EditorialImage image={config.promo} /><div><p className="sw-eyebrow">A timeless expression</p><h2 id="sw-promo-title">A little tradition.<br />A story of your own.</h2></div><Link to={listing} className="sw-button sw-button--outline">Explore the collection <Icon name="arrowRight" size={16} /></Link></section>
    <nav className="sw-services sw-wrap" aria-label="Shopping information">
      {[
        ['truck', 'Free standard shipping', 'Choose Standard at checkout', '/shipping'],
        ['lock', 'Secure checkout', 'View payment options at checkout', '/terms'],
        ['return', 'Returns & refunds', 'Read our return policy', '/returns'],
        ['chat', 'Dedicated support', 'We’re here to help you', '/contact'],
      ].map(([icon, title, description, href]) => <Link key={title} to={href}><Icon name={icon} size={27} /><span><strong>{title}</strong><small>{description}</small></span></Link>)}
    </nav>
  </div>;
}

// The main women's page: a full-bleed hero under its own header, shop-by-category,
// the real catalogue (new arrivals when any are flagged), four edits, a capsule
// wardrobe, and the way into the saree store. Every word is HTML; no image carries text.
function WomenDepartment({ config, tree, category, categories, products, status, listing, collectionHref }) {
  const [shelf, setShelf] = useState('');
  // `root` names a top-level category (bags sit under Bags & Accessories, not under Women).
  const tileHref = (item) => {
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
    <section className="wm-hero" aria-labelledby="wm-title">
      <EditorialImage image={config.hero} priority className="wm-hero__art" />
      <div className="wm-hero__copy">
        <p className="wm-eyebrow">{config.eyebrow}</p>
        <h1 id="wm-title">{config.title.map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="wm-hero__intro">{config.intro}</p>
        <Link to={listing} className="wm-button">{config.cta}</Link>
      </div>
    </section>

    <section className="wm-categories wm-wrap" id="wm-categories" aria-labelledby="wm-categories-title">
      <h2 id="wm-categories-title">Shop by category</h2>
      <div className="wm-categories__grid">{config.categories.map((item) => <Link key={item.title} to={tileHref(item)} className="wm-category">
        <EditorialImage image={item.image} /><span>{item.title}</span>
      </Link>)}</div>
    </section>

    <section className="wm-products wm-wrap" id="wm-products" aria-labelledby="wm-products-title">
      <h2 id="wm-products-title">{fresh.length ? 'New in' : 'From the collection'}</h2>
      {shelves.length > 1 && <div className="wm-shelves" role="group" aria-label="Show a category">
        <button type="button" aria-pressed={!current} onClick={() => setShelf('')}>All</button>
        {shelves.map((s) => <button key={s.id} type="button" aria-pressed={current?.id === s.id} onClick={() => setShelf(s.id)}>{s.name}</button>)}
      </div>}
      {shown.length ? <div className="wm-products__grid">{shown.map((view) => <FashionProductCard key={view.id} view={view} />)}</div>
        : <div className="fd-empty" role="status"><p>{status === 'loading' ? 'Loading the collection…' : status === 'error' ? 'The collection is unavailable right now. Please try again shortly.' : 'A new chapter in style is on its way. Explore all fashion while this collection comes together.'}</p><Link to="/fashion">Explore all fashion <Icon name="arrowRight" size={16} /></Link></div>}
      {shown.length > 0 && <Link to={listing} className="wm-button wm-button--outline">View all</Link>}
    </section>

    <section className="wm-edits wm-wrap" aria-label="Edits">
      {config.edits.map((item, index) => <Link key={item.title} to={tileHref(item)} className={`wm-edit wm-edit--${index + 1}`}>
        <EditorialImage image={item.image} /><div><h2>{item.title}</h2><p>{item.text}</p>
          {item.slug || item.root ? <span className="wm-edit__link">{item.cta} <Icon name="arrowRight" size={16} /></span> : <span className="wm-button">{item.cta}</span>}</div>
      </Link>)}
    </section>

    <section className="wm-capsule wm-wrap" aria-labelledby="wm-capsule-title">
      <h2 id="wm-capsule-title">The capsule edit</h2>
      <div className="wm-capsule__grid">{config.capsule.map((item) => <Link key={item.title} to={tileHref(item)} className="wm-look">
        <EditorialImage image={item.image} /><div><h3>{item.title}</h3><p>{item.caption}</p><span>Shop <Icon name="arrowRight" size={15} /></span></div>
      </Link>)}</div>
    </section>

    <section className="wm-sarees wm-wrap" aria-labelledby="wm-sarees-title">
      <EditorialImage image={config.sarees.image} />
      <div><p className="wm-eyebrow">{config.sarees.eyebrow}</p><h2 id="wm-sarees-title">{config.sarees.title}</h2><p>{config.sarees.text}</p>
        <Link to="/fashion/women/sarees" className="wm-button">{config.sarees.cta} <Icon name="arrowRight" size={16} /></Link></div>
    </section>

    <nav className="wm-services wm-wrap" aria-label="Shopping information">
      {[
        ['truck', 'Standard delivery', '6–7 business days', '/shipping'],
        ['return', 'Returns', 'Within 7 days of delivery', '/returns'],
        ['chat', 'Need help?', 'Contact our team', '/contact'],
      ].map(([icon, title, description, href]) => <Link key={title} to={href}><Icon name={icon} size={24} /><span><strong>{title}</strong><small>{description}</small></span></Link>)}
    </nav>
  </div>;
}

export default function FashionDepartment({ department = 'men' }) {
  // Opening at the hero (or at a #section) is ScrollManager's, site-wide (main.jsx).
  const config = DEPARTMENT_CONTENT[department] || DEPARTMENT_CONTENT.men;
  const { tree, views, status } = useFashionCatalogue();
  const { category, categories, products } = departmentCatalogue(tree, views, config.categorySlug);
  const listing = category ? categoryHref(category) : '#fd-products';
  const collectionHref = (slug) => {
    const node = categories.find((c) => c.slug === slug);
    return node ? categoryHref(node) : listing;
  };
  if (department === 'sarees') return <SareeDepartment config={config} products={products} status={status} listing={listing} collectionHref={collectionHref} />;
  if (department === 'women') return <WomenDepartment config={config} tree={tree} category={category} categories={categories} products={products} status={status} listing={listing} collectionHref={collectionHref} />;
  return <div className={`fd fd--${department}`}>
    <DepartmentNav active={department} />
    <section className="fd-hero" aria-labelledby="fd-title">
      <div className="fd-hero__photo"><EditorialImage key={department} image={config.hero} priority /></div>
      <div className="fd-hero__copy">
        <p className="fd-eyebrow">{config.eyebrow}</p>
        <h1 id="fd-title">{config.title.map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="fd-hero__intro">{config.intro}</p>
        <Link to={listing} className="fd-cta">{config.cta} <Icon name="arrowRight" size={19} /></Link>
      </div>
      <span className="fd-hero__edition">{config.heroNote}</span>
      <span className="fd-hero__number" aria-hidden="true">{department === 'men' ? '01' : '02'}</span>
    </section>

    {department === 'men' && <nav className="fd-highlights" aria-label="Explore menswear">
      {[["sparkle", "Everyday style", "Find your own rhythm"], ["star", "The wardrobe edit", "Pieces to make yours"], ["grid", "Mix. Match. Repeat.", "A fresh perspective"], ["bag", "Your next favourite", "Explore the collection"]].map(([icon, label, sub]) =>
        <Link key={label} to={listing}><Icon name={icon} size={28} /><span><strong>{label}</strong><small>{sub}</small></span></Link>)}
    </nav>}

    <section className="fd-section fd-collections" aria-labelledby="fd-collections-title">
      <SectionHead eyebrow="Shop by collection" title={config.collectionTitle} href={listing} id="fd-collections-title" />
      <div className="fd-collections__grid">{config.collections.map((item) => <Link key={item.title} to={collectionHref(item.slug)} className="fd-collection">
        <span className="fd-collection__photo"><EditorialImage image={item.image} /></span><strong>{item.title}</strong><Icon name="arrowRight" size={17} />
      </Link>)}</div>
    </section>

    <section className="fd-editorials" aria-label="The style edits">{config.editorial.map((item, i) => <Link key={item.title} to={listing} className={`fd-editorial fd-editorial--${i + 1}`}>
      <EditorialImage image={item.image} /><div><p className="fd-eyebrow">{item.eyebrow}</p><h2>{item.title}</h2><p>{item.text}</p><span className="fd-text-link">Discover the edit <Icon name="arrowRight" size={16} /></span></div>
    </Link>)}</section>

    <section className="fd-section" aria-labelledby="fd-products-title" id="fd-products">
      <SectionHead eyebrow="Curated for you" title={config.productsTitle} href={listing} id="fd-products-title" />
      {products.length ? <div className="fd-products">{products.slice(0, 8).map((view) => <FashionProductCard key={view.id} view={view} />)}</div>
        : <div className="fd-empty" role="status"><Icon name="bag" size={28} /><p>{status === 'loading' ? 'Loading the collection…' : status === 'error' ? 'The collection is unavailable right now. Please try again shortly.' : 'A new chapter in style is on its way. Explore all fashion while this collection comes together.'}</p><Link to="/fashion">Explore all fashion <Icon name="arrowRight" size={16} /></Link></div>}
    </section>

    <section className="fd-section fd-looks" aria-labelledby="fd-looks-title">
      <SectionHead eyebrow={department === 'men' ? 'Wear it your way' : 'The styling journal'} title={department === 'men' ? 'Shop the look' : 'A little inspiration'} href={listing} id="fd-looks-title" />
      <div className="fd-looks__grid">{config.looks.map((look) => <Link key={look.title} to={listing}><EditorialImage image={look.image} /><span>{look.title}<Icon name="arrowRight" size={17} /></span></Link>)}</div>
    </section>
    <section className="fd-closing"><p className="fd-eyebrow">SORA LIFE / {config.label}</p><h2>{department === 'men' ? 'Good style. Your rules.' : 'Your story. Beautifully worn.'}</h2><Link to={listing} className="fd-cta">Find your next favourite <Icon name="arrowRight" size={18} /></Link></section>
  </div>;
}
