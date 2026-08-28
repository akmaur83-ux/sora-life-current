import { promoLayoutFor } from '../../lib/promotions.js';
import PromoPoster from './PromoPoster.jsx';
import PromoOfferCard from './PromoOfferCard.jsx';

// ============================================================
// PROMO PLACEMENT WRAPPER
//
// Renders the active, in-window promotions assigned to one surface
// ('home' | 'pdp' | 'cart'). Returns null when there are none, so a
// surface never gains empty space.
//
//   variant="section"  → titled section: one poster + an offer-card rail
//                        (Home, PDP). Horizontal scroll-snap on mobile.
//   variant="compact"  → just the offer cards, no poster, tight spacing
//                        (Cart summary aside).
//
// Presentation only. No pricing / cart / checkout interaction.
// ============================================================
export default function PromoRail({
  place,
  variant = 'section',
  title = 'Offers & savings',
  eyebrow = 'For you',
  maxOffers = 3,
}) {
  const { poster, offers } = promoLayoutFor(place);
  const shownOffers = offers.slice(0, maxOffers);
  if (!poster && shownOffers.length === 0) return null;

  if (variant === 'compact') {
    return (
      <div className="promo-compact" aria-label="Available offers">
        <span className="promo-compact__lbl">Available offers</span>
        <ul className="promo-compact__list">
          {(poster ? [poster, ...shownOffers] : shownOffers).map((p) => (
            <li key={p.id}><PromoOfferCard promo={{ ...p, type: 'offer' }} /></li>
          ))}
        </ul>
        <p className="promo-compact__note">Copy a code and enter it at checkout if it applies to your order.</p>
      </div>
    );
  }

  return (
    <section className="promo-section" aria-labelledby={`promo-${place}-h`}>
      <div className="container">
        <div className="promo-section__head">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 id={`promo-${place}-h`} className="promo-section__title serif">{title}</h2>
        </div>
        <div className={`promo-section__grid ${poster ? 'has-poster' : ''}`}>
          {poster && <PromoPoster promo={poster} />}
          {shownOffers.length > 0 && (
            <ul className="promo-offers-rail">
              {shownOffers.map((p) => (
                <li key={p.id}><PromoOfferCard promo={p} /></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
