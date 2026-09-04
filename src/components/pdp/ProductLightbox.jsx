import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon.jsx';
import ProductImage from '../ProductImage.jsx';

// Display-only image viewer. It consumes the same genuine gallery frames as
// ProductGallery and never changes product or commerce state.
export default function ProductLightbox({ product, frames, active, onChange, onClose, onImageError }) {
  const closeRef = useRef(null);
  const startX = useRef(null);
  const count = frames.length;
  const index = Math.min(active, Math.max(0, count - 1));
  const current = frames[index];

  const go = (next) => {
    if (count > 1) onChange(((next % count) + count) % count);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') go(index + 1);
      if (event.key === 'ArrowLeft') go(index - 1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, count, onClose]);

  if (!current) return null;

  return createPortal(
    <div
      className="pdp-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${product.name} image viewer`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onPointerDown={(event) => { startX.current = event.clientX; }}
      onPointerUp={(event) => {
        if (startX.current == null) return;
        const dx = event.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="pdp-lightbox__topbar">
        {count > 1 && <span aria-live="polite">{index + 1} / {count}</span>}
        <button ref={closeRef} type="button" className="pdp-lightbox__close" onClick={onClose} aria-label="Close image viewer">
          <Icon name="x" size={22} />
        </button>
      </div>

      <div className="pdp-lightbox__stage" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        {count > 1 && (
          <button type="button" className="pdp-lightbox__nav pdp-lightbox__nav--prev" onClick={() => go(index - 1)} aria-label="Previous product image">
            <Icon name="chevronLeft" size={26} />
          </button>
        )}
        <ProductImage
          key={current.url}
          product={product}
          src={current.url}
          alt={current.alt || product.name}
          sizes="100vw"
          frame="v2"
          className="pdp-lightbox__image"
          loading="eager"
          onImageError={onImageError}
        />
        {count > 1 && (
          <button type="button" className="pdp-lightbox__nav pdp-lightbox__nav--next" onClick={() => go(index + 1)} aria-label="Next product image">
            <Icon name="chevronRight" size={26} />
          </button>
        )}
      </div>
      {count > 1 && <p className="pdp-lightbox__hint">Swipe or use arrow keys to browse</p>}
    </div>,
    document.body,
  );
}
