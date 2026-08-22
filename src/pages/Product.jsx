import { useState, useEffect, Fragment } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import StarRating from '../components/StarRating.jsx';
import PriceTag from '../components/PriceTag.jsx';
import ProductRail from '../components/ProductRail.jsx';
import NotFound from './NotFound.jsx';
import { useStore } from '../lib/store.jsx';
import { productBySlug, getRelated, productById } from '../data/products.js';
import { categoryBySlug, tones } from '../data/categories.js';
import { money } from '../lib/format.js';

function GalleryFrame({ product, index }) {
  if (index === 0) return <ProductImage product={product} />;
  const t = tones[categoryBySlug[product.category]?.tone] || tones.forest;
  const labels = ['Texture', 'Ingredients', 'In use'];
  const icons = ['droplet', 'leaf', 'sparkle'];
  return (
    <div className="pimg" style={{ background: `linear-gradient(150deg, ${t.tint}, #fff)` }}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: t.b }}>
        <div style={{ textAlign: 'center' }}>
          <Icon name={icons[index - 1]} size={40} />
          <div style={{ marginTop: 10, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{labels[index - 1]}</div>
        </div>
      </div>
    </div>
  );
}

function Accordion({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="accordion">
      {items.map((it, i) => (
        <div key={it.title} className={`accordion__item ${open === i ? 'open' : ''}`}>
          <button className="accordion__head" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span>{it.title}</span><Icon name={open === i ? 'chevronUp' : 'chevronDown'} size={18} />
          </button>
          <div className="accordion__body"><div className="accordion__inner">{it.content}</div></div>
        </div>
      ))}
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWish, isWished } = useStore();
  const product = productBySlug[slug];
  const [frame, setFrame] = useState(0);
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState(product?.variants?.[0]?.label || null);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1600);
    return () => clearTimeout(t);
  }, [justAdded]);

  if (!product) return <NotFound />;
  const cat = categoryBySlug[product.category];
  const related = getRelated(product);
  const wished = isWished(product.id);
  const out = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;

  const fbt = [product, ...related.slice(0, 2)];
  const fbtTotal = fbt.reduce((s, p) => s + p.price, 0);

  const buyNow = () => { addToCart(product, qty, variant); navigate('/checkout'); };

  return (
    <>
      <div className="container" style={{ paddingTop: 'var(--sp-6)' }}>
        <nav className="crumbs">
          <Link to="/">Home</Link><Icon name="chevronRight" size={14} />
          <Link to={`/category/${cat.slug}`}>{cat.name}</Link><Icon name="chevronRight" size={14} />
          <span>{product.name}</span>
        </nav>
      </div>

      <section className="pdp container">
        {/* Gallery */}
        <div className="pdp__gallery">
          <div className="pdp__main">
            <div className="pdp__frame-fade" key={frame}><GalleryFrame product={product} index={frame} /></div>
            <button className={`pcard__wish pdp__wish ${wished ? 'active' : ''}`} onClick={() => toggleWish(product)} aria-label="Wishlist">
              <Icon name="heart" size={22} fill={wished ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div className="pdp__thumbs">
            {[0, 1, 2, 3].map((i) => (
              <button key={i} className={`pdp__thumb ${frame === i ? 'active' : ''}`} onClick={() => setFrame(i)} aria-label={`View ${i + 1}`}>
                <GalleryFrame product={product} index={i} />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="pdp__info">
          <span className="pcard__cat">{cat.name}</span>
          <h1 className="pdp__title serif">{product.name}</h1>
          <div className="pdp__rate">
            {product.reviewCount > 0 ? (
              <>
                <StarRating value={product.rating} showValue />
                <a href="#reviews" className="pdp__reviewlink">{product.reviewCount} reviews</a>
              </>
            ) : (
              <span className="badge badge-soft"><Icon name="leaf" size={13} /> Sea buckthorn</span>
            )}
            {product.form && <span className="pdp__sku muted">· {product.form}</span>}
          </div>

          <p className="pdp__lead">{product.shortDescription}</p>

          <div className="pdp__price">
            <PriceTag product={product} size="lg" />
            <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>Inclusive of all taxes</span>
          </div>

          {product.variants && (
            <div className="pdp__block">
              <span className="label">Choose variant</span>
              <div className="taglist" style={{ marginTop: 8 }}>
                {product.variants.map((v) => (
                  <button key={v.id} className={`chip ${variant === v.label ? 'active' : ''}`} onClick={() => setVariant(v.label)}>{v.label}</button>
                ))}
              </div>
            </div>
          )}

          <div className="pdp__stock">
            {out ? <span className="badge badge-out">Out of stock</span>
              : lowStock ? <span className="badge badge-sale"><Icon name="clock" size={13} /> Only {product.stock} left</span>
              : <span className="badge"><Icon name="check" size={13} /> In stock</span>}
          </div>

          <div className="pdp__buy">
            <div className="qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease" disabled={out}><Icon name="minus" size={16} /></button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="Increase" disabled={out}><Icon name="plus" size={16} /></button>
            </div>
            <button className={`btn btn-block pdp__addbtn ${justAdded ? 'is-added' : ''}`} disabled={out}
              onClick={() => { addToCart(product, qty, variant); setJustAdded(true); }}>
              {justAdded ? <><Icon name="check" size={18} /> Added to cart</> : <><Icon name="bag" size={18} /> Add to cart</>}
            </button>
          </div>
          <button className="btn btn-accent btn-lg btn-block pdp__buynow" disabled={out} onClick={buyNow}>Buy it now</button>

          <div className="pdp__assure">
            {[['truck', 'Free delivery', 'On orders over ₹699'],
              ['return', '15-day returns', 'Easy & free'],
              ['lock', 'Secure checkout', '100% protected']].map(([ic, t, s]) => (
              <div key={t} className="pdp__assure-item"><Icon name={ic} size={20} /><span><strong>{t}</strong><em>{s}</em></span></div>
            ))}
          </div>

          <div className="pdp__deliver">
            <Icon name="mapPin" size={18} />
            <span>Deliver to <strong>India</strong> — estimated <strong>2–4 business days</strong>. Enter your PIN at checkout for exact dates.</span>
          </div>

          <Accordion items={[
            { title: 'Product details', content: (
              <ul className="ticklist">
                <li><Icon name="check" size={16} /> Category: {cat.name}</li>
                {product.form && <li><Icon name="check" size={16} /> Size: {product.form}</li>}
                <li><Icon name="check" size={16} /> Authentic Biosash product, sourced from the Himalayas</li>
                <li><Icon name="check" size={16} /> Fulfilled by Sora Life · genuine, sealed packaging</li>
              </ul>
            ) },
            ...(product.description ? [{ title: 'Description', content: <p className="muted">{product.description}</p> }] : []),
            ...(product.benefits?.length ? [{ title: 'Key benefits', content: (
              <ul className="ticklist">{product.benefits.map((b) => <li key={b}><Icon name="check" size={16} /> {b}</li>)}</ul>
            ) }] : []),
            ...(product.ingredients?.length ? [{ title: 'Ingredients', content: (
              <div className="taglist">{product.ingredients.map((ig) => <span key={ig} className="badge badge-soft">{ig}</span>)}</div>
            ) }] : []),
            ...(product.usage ? [{ title: 'How to use', content: <p className="muted">{product.usage}</p> }] : []),
          ]} />
        </div>
      </section>

      {/* Frequently bought together */}
      {related.length >= 2 && (
        <section className="section-sm">
          <div className="container">
            <h2 className="serif" style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--sp-6)' }}>Frequently bought together</h2>
            <div className="fbt">
              <div className="fbt__items">
                {fbt.map((p, i) => (
                  <Fragment key={p.id}>
                    <Link to={`/product/${p.slug}`} className="fbt__item">
                      <ProductImage product={p} />
                      <span className="fbt__name">{p.name}</span>
                      <span className="fbt__price">{money(p.price)}</span>
                    </Link>
                    {i < fbt.length - 1 && <span className="fbt__plus"><Icon name="plus" size={18} /></span>}
                  </Fragment>
                ))}
              </div>
              <div className="fbt__buy">
                <span className="muted">Total for {fbt.length} items</span>
                <span className="fbt__total serif">{money(fbtTotal)}</span>
                <button className="btn btn-block" onClick={() => { fbt.forEach((p) => addToCart(p, 1)); }}>Add all to cart</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="section" id="reviews">
        <div className="container">
          <h2 className="serif" style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--sp-5)' }}>Reviews</h2>
          {product.reviewCount > 0 && product.reviews.length ? (
            <div className="reviews-block">
              <div className="reviews-block__summary">
                <div className="reviews-block__score serif">{product.rating.toFixed(1)}</div>
                <StarRating value={product.rating} size={18} />
                <p className="muted">{product.reviewCount} verified reviews</p>
                <button className="btn btn-outline btn-block" style={{ marginTop: 16 }}>Write a review</button>
              </div>
              <div className="reviews-block__list">
                {product.reviews.map((r, i) => (
                  <figure key={i} className="rev">
                    <div className="rev__top">
                      <span className="review__avatar">{r.name.charAt(0)}</span>
                      <div><strong>{r.name}</strong>{r.verified && <span className="rev__verified"><Icon name="checkCircle" size={13} /> Verified buyer</span>}</div>
                      <span className="muted rev__date">{r.date}</span>
                    </div>
                    <StarRating value={r.rating} size={14} />
                    <h4 className="rev__title">{r.title}</h4>
                    <p className="muted">{r.body}</p>
                  </figure>
                ))}
              </div>
            </div>
          ) : (
            <div className="surface pad-lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-5)', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-lg)' }}>No reviews yet</h3>
                <p className="muted">Be the first to share your experience with this product.</p>
              </div>
              <button className="btn btn-outline">Write a review</button>
            </div>
          )}
        </div>
      </section>

      {/* Related */}
      <ProductRail eyebrow="Complete the ritual" title="You may also like" products={related} />

      {/* Sticky mobile buy bar */}
      <div className="buybar only-mobile">
        <div className="buybar__price"><PriceTag product={product} showOff={false} /></div>
        <button className="btn" disabled={out} onClick={() => addToCart(product, qty, variant)}><Icon name="bag" size={18} /> Add</button>
        <button className="btn btn-accent" disabled={out} onClick={buyNow}>Buy now</button>
      </div>
    </>
  );
}
