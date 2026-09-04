import { useState } from 'react';
import { categoryBySlug, tones } from '../data/categories.js';
import { OPTIMIZED_IMAGES, OPTIMIZED_WIDTHS } from '../data/optimizedImages.js';

// Default sizes hint tuned for the product grid (2-up on phones, up to ~240px
// tiles on desktop). Detail/hero contexts pass a larger `sizes`.
const GRID_SIZES = '(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 240px';

// If the source is a local /img/<name>.<png|jpg> that the optimizer has covered,
// return its basename so we can serve responsive WebP; otherwise null.
function optimizedBase(src) {
  if (typeof src !== 'string') return null;
  const m = src.match(/^\/img\/([^/]+)\.(?:png|jpe?g)$/i);
  return m && OPTIMIZED_IMAGES.has(m[1]) ? m[1] : null;
}

// Renders the real official product photo. Serves right-sized WebP variants via
// <picture> when available (originals stay as the <img> fallback), and falls
// back to a branded tile if the image is missing or fails to load.
//
// V2 (Phase 1) changes FRAMING ONLY. Source resolution, the optimized-WebP
// path, srcSet widths and the media data contract are all untouched. Pass
// `frame="v2"` to get the square, sharp, warm-ground presentation the V2 cards
// require; every existing call site keeps the legacy 4:5 `.pimg` frame.
export default function ProductImage({
  product,
  className = '',
  index = 0,
  sizes = GRID_SIZES,
  src: mediaSrc = null,
  alt: altOverride = null,
  frame = 'legacy',
  fit = 'contain',
  onImageError = null,
}) {
  const [failed, setFailed] = useState(false);

  const v2 = frame === 'v2';
  const hero = frame === 'hero';
  // V2 media frames are square and sharp. `contain` is deliberate for today's
  // largely plain-background catalogue — `cover` would crop real labels. Once a
  // product receives upgraded editorial photography (stone plinth, warm cream
  // environment, botanical context) pass fit="cover" for that instance.
  // `hero` is the product-led hero layer: no frame, no ground of its own —
  // the product sits directly on the hero's editorial environment.
  const wrapClass = hero
    ? `v2-hero__product ${className}`.trim()
    : v2
      ? `v2-pimg ${fit === 'cover' ? 'v2-pimg--cover' : ''} ${className}`.trim()
      : `pimg ${className}`.trim();

  if (!product) {
    return <div className={wrapClass} style={(v2 || hero) ? undefined : { background: 'var(--cream)' }} />;
  }

  const cat = categoryBySlug[product.category];

  const src = mediaSrc || (index === 0
    ? product.image
    : (product.gallery && product.gallery[index]) || product.image);
  const alt = altOverride || product.name;

  if (src && !failed) {
    const base = optimizedBase(src);
    const img = (
      <img src={src} alt={alt} loading="lazy" decoding="async"
        sizes={base ? sizes : undefined}
        onError={() => {
          setFailed(true);
          onImageError?.(src);
        }} />
    );
    if (base) {
      const srcSet = OPTIMIZED_WIDTHS.map((w) => `/img/${base}-${w}.webp ${w}w`).join(', ');
      return (
        <div className={wrapClass}>
          <picture>
            <source type="image/webp" srcSet={srcSet} sizes={sizes} />
            {img}
          </picture>
        </div>
      );
    }
    return <div className={wrapClass}>{img}</div>;
  }

  // Fallback: warm neutral ground plus the brand and category wordmark. Never a
  // grey box, never a broken-image glyph, and never invented packaging.
  if (hero) return null;   // hero degrades to environment-only; no placeholder product
  if (v2) {
    return (
      <div className={wrapClass}>
        <div className="v2-pimg__fallback">
          <div>
            <b>Sora Life</b>
            {cat?.name && <span>{cat.name}</span>}
          </div>
        </div>
      </div>
    );
  }

  // Legacy fallback tile — unchanged from V1 so Shop, PDP, Cart and every other
  // surface that has not been migrated yet looks exactly as it does today.
  const t = tones[cat?.tone] || tones.forest;
  return (
    <div className={wrapClass} style={{ background: `linear-gradient(150deg, ${t.tint}, #fff)` }}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: t.b, textAlign: 'center', padding: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, letterSpacing: 1 }}>SORA LIFE</div>
          <div style={{ fontSize: 10, letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' }}>{cat?.name}</div>
        </div>
      </div>
    </div>
  );
}
