import { useEffect, useRef, useState } from 'react';
import ProductImage from './ProductImage.jsx';
import { productGallery } from '../data/products.js';

// ============================================================
// Product detail gallery — real multi-image gallery driven by product_media
// (migration 0016), with a single-primary fallback for legacy products.
//
//   Desktop : large primary image + vertical thumbnail rail (click to switch)
//   Mobile  : the same main image, swipeable left/right, with dot indicators
//             and a horizontal thumb strip (existing .pdp__* responsive CSS).
//
// Display-only: no pricing, cart, variant or attribution logic lives here.
// ============================================================
export default function ProductGallery({ product, children }) {
  const frames = productGallery(product);
  const [active, setActive] = useState(0);
  const startX = useRef(null);

  // Reset to the primary whenever the product changes, and clamp if the media
  // set shrank (e.g. after a live re-hydration from Supabase).
  useEffect(() => { setActive(0); }, [product?.id]);
  const count = frames.length;
  const idx = Math.min(active, Math.max(0, count - 1));
  const current = frames[idx] || frames[0];

  const go = (n) => { if (count) setActive(((n % count) + count) % count); };

  // Touch/pointer swipe on the main image (mobile). A small threshold avoids
  // hijacking taps; vertical scrolling is unaffected.
  const onPointerDown = (e) => { startX.current = e.clientX; };
  const onPointerUp = (e) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
  };

  const single = count <= 1;

  return (
    <div className={`pdp__gallery ${single ? 'pdp__gallery--single' : ''}`}>
      <div
        className="pdp__main"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') go(idx + 1); if (e.key === 'ArrowLeft') go(idx - 1); }}
        tabIndex={single ? -1 : 0}
        role={single ? undefined : 'group'}
        aria-roledescription={single ? undefined : 'carousel'}
        aria-label={single ? undefined : `${product.name} — image ${idx + 1} of ${count}`}
      >
        <div className="pdp__frame-fade" key={current?.url || idx}>
          <ProductImage
            product={product}
            src={current?.url}
            alt={current?.alt || product.name}
            sizes="(max-width: 900px) 92vw, 460px"
            frame="v2"
          />
        </div>
        {children}
        {!single && (
          <div className="pdp__dots" role="tablist" aria-label="Gallery images">
            {frames.map((f, i) => (
              <button
                key={f.id || f.url || i}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-label={`Show image ${i + 1}`}
                className={`pdp__dot ${i === idx ? 'active' : ''}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
        )}
      </div>

      {!single && (
        <div className="pdp__thumbs">
          {frames.map((f, i) => (
            <button
              key={f.id || f.url || i}
              type="button"
              className={`pdp__thumb ${i === idx ? 'active' : ''}`}
              onClick={() => go(i)}
              aria-label={`View image ${i + 1}${f.isPrimary ? ' (primary)' : ''}`}
              aria-pressed={i === idx}
            >
              <ProductImage product={product} src={f.url} alt={f.alt || product.name} sizes="84px" frame="v2" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
