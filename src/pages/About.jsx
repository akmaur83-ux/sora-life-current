import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { categories } from '../data/categories.js';
import { branding } from '../lib/settings.js';

// ============================================================
// ABOUT SORA LIFE
//
// Every line here is either an operational fact about how the platform works
// (verifiable in the code that implements it) or neutral marketplace
// positioning. There are deliberately NO statistics, testimonials, dates,
// certifications, partnerships, delivery guarantees or origin claims — none of
// those are knowable from the data the storefront holds, so none are stated.
//
// The four capability blocks map one-to-one to features that exist:
//   discovery  -> categories.js + Shop/search
//   accounts   -> customer auth + account order history
//   checkout   -> server-verified pricing + Razorpay (api/razorpay/*)
//   creator    -> the Creator Program (its own portal + attribution engine)
// ============================================================

const CAPABILITIES = [
  {
    icon: 'grid',
    title: 'Broad discovery',
    body: 'Browse wellness, nutrition, hair, skin, beauty and everyday-care products across the catalogue — by category, search or curated collections.',
  },
  {
    icon: 'user',
    title: 'Your own account',
    body: 'Create an account to keep your order history, saved addresses and a wishlist in one place, on any device you sign in from.',
  },
  {
    icon: 'lock',
    title: 'Secure checkout',
    body: 'Every price and order total is recalculated on our server before payment, and card payments are processed by Razorpay — Sora Life never sees or stores your card details.',
  },
  {
    icon: 'package',
    title: 'Orders you can follow',
    body: 'Once you have placed an order, its verified status — and tracking, when the seller adds it — is available in your account.',
  },
];

export default function About() {
  const name = branding?.siteName || 'SORA LIFE';

  return (
    <div className="info">
      <div className="v2-wrap">
        <nav className="v2-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <strong>About</strong>
        </nav>

        <header className="info-hero">
          <p className="info-eyebrow">About {name}</p>
          <h1 className="info-title">
            A modern marketplace for wellness, personal care and everyday essentials.
          </h1>
          <p className="info-lede">
            {name} brings a broad range of products together in one place — so you can
            discover what fits your routine, buy it through a secure checkout, and keep
            track of your orders from your own account.
          </p>
          <div className="info-hero__cta">
            <Link to="/shop" className="v2-btn">Browse the catalogue <Icon name="arrowRight" size={15} /></Link>
            <Link to="/account/creator" className="v2-btn v2-btn--out">Explore the Creator Program</Link>
          </div>
        </header>

        <section className="info-sec" aria-labelledby="about-what">
          <div className="info-sechead">
            <h2 id="about-what" className="info-h2">What you can do here</h2>
            <p className="info-sub">Everything below is part of the platform today.</p>
          </div>
          <div className="info-grid info-grid--2">
            {CAPABILITIES.map((item) => (
              <article key={item.title} className="info-card">
                <span className="info-card__ic"><Icon name={item.icon} size={22} stroke={1.5} /></span>
                <h3 className="info-card__t">{item.title}</h3>
                <p className="info-card__b">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="info-sec" aria-labelledby="about-cats">
          <div className="info-sechead">
            <h2 id="about-cats" className="info-h2">Explore the range</h2>
            <p className="info-sub">Product categories available across {name}.</p>
          </div>
          <ul className="info-cats">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link to={`/category/${c.slug}`} className="info-cat">
                  <span>{c.name}</span>
                  <Icon name="arrowRight" size={14} stroke={1.7} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="info-sec info-creator" aria-labelledby="about-creator">
          <div>
            <p className="info-eyebrow">{name} Creator Program</p>
            <h2 id="about-creator" className="info-h2">Share what you genuinely discover</h2>
            <p className="info-sub info-sub--wide">
              Creators use their {name} account to join the program, share products they
              believe in, and follow their attribution and application status in one place.
            </p>
          </div>
          <Link to="/account/creator" className="v2-btn v2-btn--gold">
            Explore the program <Icon name="arrowRight" size={15} />
          </Link>
        </section>

        <nav className="info-more" aria-label="More information">
          <Link to="/contact" className="info-more__link">
            <span><strong>Contact &amp; help</strong><em>Get in touch or find order help</em></span>
            <Icon name="arrowRight" size={16} stroke={1.7} />
          </Link>
          <Link to="/shipping" className="info-more__link">
            <span><strong>Shipping</strong><em>Delivery options and charges</em></span>
            <Icon name="arrowRight" size={16} stroke={1.7} />
          </Link>
        </nav>
      </div>
    </div>
  );
}
