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
export default function ProductImage({ product, className = '', index = 0, sizes = GRID_SIZES, src: mediaSrc = null, alt: altOverride = null }) {
  const [failed, setFailed] = useState(false);
  if (!product) return <div className={`pimg ${className}`} style={{ background: 'var(--cream)' }} />;
  const cat = categoryBySlug[product.category];
  const t = tones[cat?.tone] || tones.forest;

  const src = mediaSrc || (index === 0
    ? product.image
    : (product.gallery && product.gallery[index]) || product.image);
  const alt = altOverride || product.name;

  if (src && !failed) {
    const base = optimizedBase(src);
    // Sizing/fit is controlled entirely by CSS (.pimg img) so product photos
    // are never cropped and every context presents them consistently.
    const img = (
      <img src={src} alt={alt} loading="lazy" decoding="async"
        sizes={base ? sizes : undefined}
        onError={() => setFailed(true)} />
    );
    if (base) {
      const srcSet = OPTIMIZED_WIDTHS.map((w) => `/img/${base}-${w}.webp ${w}w`).join(', ');
      return (
        <div className={`pimg ${className}`}>
          <picture>
            <source type="image/webp" srcSet={srcSet} sizes={sizes} />
            {img}
          </picture>
        </div>
      );
    }
    return <div className={`pimg ${className}`}>{img}</div>;
  }

  // Fallback branded tile
  return (
    <div className={`pimg ${className}`} style={{ background: `linear-gradient(150deg, ${t.tint}, #fff)` }}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: t.b, textAlign: 'center', padding: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, letterSpacing: 1 }}>SORA LIFE</div>
          <div style={{ fontSize: 10, letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' }}>{cat?.name}</div>
        </div>
      </div>
    </div>
  );
}
