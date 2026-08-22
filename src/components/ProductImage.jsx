import { useState } from 'react';
import { categoryBySlug, tones } from '../data/categories.js';

// Renders the real official product photo. Falls back to a branded tile
// if the image is missing or fails to load.
export default function ProductImage({ product, className = '', index = 0 }) {
  const [failed, setFailed] = useState(false);
  if (!product) return <div className={`pimg ${className}`} style={{ background: 'var(--cream)' }} />;
  const cat = categoryBySlug[product.category];
  const t = tones[cat?.tone] || tones.forest;

  const src = index === 0
    ? product.image
    : (product.gallery && product.gallery[index]) || product.image;

  if (src && !failed) {
    return (
      <div className={`pimg ${className}`}>
        <img src={src} alt={product.name} loading="lazy" decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
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
