import Icon from '../Icon.jsx';
import { ratingSummaryFor } from '../../data/pdpContent.js';

// ============================================================
// Compact rating chip next to the product title:  4.7  ★★★★★  ·  128 ratings
//
// Part 1 shows this ONLY when the catalogue has a real review aggregate.
// With no real reviews yet it renders nothing (no placeholder numbers) —
// Part 3 wires ratingSummaryFor() to the real data and this lights up.
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
      <strong className="pdp-rating__score">{rating.toFixed(1)}</strong>
      <span className="pdp-rating__stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Icon key={i} name="star" size={13} stroke={1.4}
            fill={i <= full ? 'currentColor' : 'none'}
            className={i <= full ? 's-full' : 's-empty'} />
        ))}
      </span>
      <span className="pdp-rating__count">
        {count.toLocaleString('en-IN')} {count === 1 ? 'rating' : 'ratings'}
      </span>
    </a>
  );
}
