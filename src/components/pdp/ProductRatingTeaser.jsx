import Icon from '../Icon.jsx';
import { ratingSummaryFor } from '../../data/pdpContent.js';

// ============================================================
// Rating line under the product name:  ★★★★☆  4.1/5  (31)
//
// Shown ONLY when the catalogue carries a real review aggregate. Four of 164
// products have one today, so hiding cleanly is the common case, not the edge
// case — there is no placeholder score and no empty star rail.
// ============================================================
export default function ProductRatingTeaser({ product, href = '#reviews', className = '' }) {
  const { rating, count, isPreview } = ratingSummaryFor(product);
  if (isPreview || rating == null) return null;

  const full = Math.round(rating);
  return (
    <a
      href={href}
      className={`pdp-rating ${className}`}
      aria-label={`Rated ${rating} out of 5 from ${count} ratings. Jump to reviews.`}
    >
      <span className="pdp-rating__stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Icon key={i} name="star" size={14} stroke={1.4}
            fill={i <= full ? 'currentColor' : 'none'}
            className={i <= full ? 's-full' : 's-empty'} />
        ))}
      </span>
      <strong className="pdp-rating__score">{rating.toFixed(1)}<span>/5</span></strong>
      <span className="pdp-rating__count">({count.toLocaleString('en-IN')})</span>
    </a>
  );
}
