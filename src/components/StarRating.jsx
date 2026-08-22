import Icon from './Icon.jsx';

export default function StarRating({ value = 0, count, size = 15, showValue = false }) {
  const full = Math.round(value);
  return (
    <span className="rating-row">
      <span className="stars" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Icon key={i} name="star" size={size} fill={i <= full ? 'currentColor' : 'none'}
            className={i <= full ? 's-full' : 's-empty'} stroke={1.4} />
        ))}
      </span>
      {showValue && <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{value.toFixed(1)}</strong>}
      {typeof count === 'number' && <span>({count.toLocaleString('en-IN')})</span>}
    </span>
  );
}
