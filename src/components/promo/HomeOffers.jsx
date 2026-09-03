import { useEffect, useRef, useState } from 'react';
import { promosForPlacement } from '../../lib/promotions.js';
import { safeVisualUrl, uniqueHomepagePromotions } from '../../lib/homepageAppearance.js';
import HomeVisualLayers from '../HomeVisualLayers.jsx';
import PromoPoster from './PromoPoster.jsx';
import PromoOfferCard from './PromoOfferCard.jsx';
import PromoArtwork from './PromoArtwork.jsx';

export function HomeOfferArtwork({ promo }) {
  const [failed, setFailed] = useState(false);
  const url = safeVisualUrl(promo.imageUrl);
  // Rendered through the shared PromoArtwork so the rail honours the same
  // CTA/coupon contract as PromoPoster: the image becomes the click target
  // when a ctaUrl exists, and a coupon code stays reachable below the art.
  if (url && !failed) {
    return (
      <PromoArtwork
        promo={promo}
        src={url}
        className="hp-offers__poster"
        onError={() => setFailed(true)}
      />
    );
  }
  // Missing or failed artwork falls back to existing, real configured copy.
  const content = { ...promo, imageUrl: null };
  return promo.type === 'poster' ? <PromoPoster promo={content} /> : <PromoOfferCard promo={content} />;
}

export default function HomeOffers({ appearance: a }) {
  const rail = useRef(null);
  const [active, setActive] = useState(0);
  const items = uniqueHomepagePromotions(promosForPlacement('home'));
useEffect(() => {
  if (items.length < 2) return;

  const mobile = window.matchMedia('(max-width: 767px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!mobile.matches || reduced.matches) return;

  const timer = window.setInterval(() => {
    setActive((current) => {
      const next = (current + 1) % items.length;
      const el = rail.current;
      const card = el?.children[next];

      if (el && card) {
        el.scrollTo({
          left: card.offsetLeft - el.firstElementChild.offsetLeft,
          behavior: 'smooth',
        });
      }

      return next;
    });
  }, 2000);

  return () => window.clearInterval(timer);
}, [items.length]);
  if (!items.length) return null;
  const columns = Math.min(a.desktopColumns, items.length);
  const scrollTo = (index) => {
    const el = rail.current;
    const card = el?.children[index];
    if (card) el.scrollTo({ left: card.offsetLeft - el.firstElementChild.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <section className="hp-offers" aria-labelledby="homepage-offers-title" style={{
    backgroundColor: a.backgroundColor, paddingBlock: a.padding,
    '--hp-offers-accent': a.accentColor, '--hp-offers-gap': `${a.gap}px`,
    '--hp-offers-columns': columns, '--hp-offers-mobile-width': `${a.mobileWidth}%`,
  }}>
    <div className="v2-wrap">
      <div className="hp-offers__heading">
        <div><p className="v2-eyebrow">Offers</p><h2 className="v2-h2" id="homepage-offers-title">Current offers</h2></div>
        {items.length > 1 && <span className="hp-offers__hint">Swipe to explore <span aria-hidden="true">→</span></span>}
      </div>
      <div className="hp-offers__frame" style={{ backgroundColor: a.frameColor,
        border: a.frameEnabled ? `${a.borderWidth}px solid ${a.borderColor}` : '0 solid transparent', borderRadius: a.radius }}>
        <HomeVisualLayers texture={{ url: a.textureUrl, opacity: a.textureOpacity, fit: 'cover' }}
          right={{ url: a.decorationUrl, opacity: a.decorationOpacity, size: a.decorationSize }} />
        <ul ref={rail} className={`hp-offers__gallery${items.length === 1 ? ' hp-offers__gallery--single' : ''}`} aria-label="Homepage promotions"
          onScroll={() => {
            const el = rail.current;
            if (!el?.children.length) return;
            const positions = [...el.children].map((child) => Math.abs(child.offsetLeft - el.firstElementChild.offsetLeft - el.scrollLeft));
            setActive(positions.indexOf(Math.min(...positions)));
          }}>
          {items.map((promo) => <li key={promo.id} className="hp-offers__item" data-promotion-id={promo.id}>
            <HomeOfferArtwork key={`${promo.id}:${promo.imageUrl}`} promo={promo} />
          </li>)}
        </ul>
        {items.length > 1 && <div className="hp-offers__pagination" aria-label="Choose promotion">
          {items.map((promo, index) => <button type="button" key={promo.id} aria-label={`Show promotion ${index + 1}: ${promo.title}`}
            aria-current={index === Math.min(active, items.length - 1) ? 'true' : undefined} onClick={() => scrollTo(index)}><span /></button>)}
        </div>}
      </div>
    </div>
  </section>;
}
