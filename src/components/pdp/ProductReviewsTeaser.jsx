import Icon from '../Icon.jsx';
import StarRating from '../StarRating.jsx';
import { ratingSummaryFor, previewReviewsFor } from '../../data/pdpContent.js';

// ============================================================
// Ratings & Reviews — LIGHTWEIGHT Part 1 seat for the Part 3 review system.
//
//   • No real review data yet  → a calm "coming soon" placeholder ONLY.
//                                 No score, no star fill, no counts, no
//                                 sample review — nothing fabricated.
//   • Real aggregate present    → real score / stars / count + real cards.
//
// Part 3 replaces ratingSummaryFor() / previewReviewsFor() with the real
// data source; the real-data branch below is already shaped for it.
// ============================================================
export default function ProductReviewsTeaser({ product }) {
  const { rating, count, isPreview } = ratingSummaryFor(product);
  const { items } = previewReviewsFor(product);

  if (isPreview) {
    return (
      <section className="section-sm" id="reviews">
        <div className="container">
          <div className="pdp-sec__head">
            <h2 className="pdp-sec__title serif">Ratings &amp; reviews</h2>
            <span className="pdp-preview-tag">Coming soon</span>
          </div>
          <div className="pdp-reviews-soon">
            <span className="pdp-reviews-soon__ic"><Icon name="chat" size={22} /></span>
            <p>
              Verified customer reviews are on the way. Once shoppers have rated this product,
              their ratings and notes will appear here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const full = Math.round(rating);
  return (
    <section className="section-sm" id="reviews">
      <div className="container">
        <h2 className="pdp-sec__title serif">Ratings &amp; reviews</h2>

        <div className="pdp-reviews">
          <div className="pdp-reviews__summary">
            <span className="pdp-reviews__score serif">{rating.toFixed(1)}</span>
            <span className="pdp-reviews__stars" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon key={i} name="star" size={16} stroke={1.4}
                  fill={i <= full ? 'currentColor' : 'none'}
                  className={i <= full ? 's-full' : 's-empty'} />
              ))}
            </span>
            <span className="muted">{count.toLocaleString('en-IN')} {count === 1 ? 'rating' : 'ratings'}</span>
            <a href="#reviews" className="btn btn-outline btn-block pdp-reviews__cta">Read all reviews</a>
          </div>

          <div className="pdp-reviews__list">
            {items.slice(0, 2).map((r, i) => (
              <figure key={i} className="pdp-reviewcard">
                <div className="pdp-reviewcard__top">
                  <span className="pdp-reviewcard__avatar" aria-hidden="true">{r.name.charAt(0)}</span>
                  <div>
                    <strong>{r.name}</strong>
                    {r.verified && (
                      <span className="pdp-reviewcard__verified">
                        <Icon name="checkCircle" size={13} /> Verified buyer
                      </span>
                    )}
                  </div>
                </div>
                <StarRating value={r.rating} size={13} />
                {r.title && <h3 className="pdp-reviewcard__title">{r.title}</h3>}
                <p className="muted">{r.body}</p>
              </figure>
            ))}
            <a href="#reviews" className="pdp-reviews__all">
              View all reviews <Icon name="arrowRight" size={16} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
