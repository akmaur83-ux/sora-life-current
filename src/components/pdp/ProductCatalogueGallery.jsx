import { useEffect, useState } from 'react';
import ProductImage from '../ProductImage.jsx';
import { secondaryProductGallery } from '../../data/products.js';

// A continuous, image-led view of genuine secondary catalogue media. The
// primary image stays in the main gallery above and is never repeated here.
export default function ProductCatalogueGallery({ product }) {
  // Product media is attached during live catalogue hydration, so do not memo
  // against only the stable product object reference.
  const candidates = secondaryProductGallery(product);
  const [failedUrls, setFailedUrls] = useState(() => new Set());

  // A hydrated product can replace the legacy seed without remounting the
  // route. Failed media belongs to that specific product/media set only.
  useEffect(() => { setFailedUrls(new Set()); }, [product?.id, product?.media, product?.gallery]);

  const frames = candidates.filter((frame) => !failedUrls.has(frame.url));
  if (!frames.length) return null;

  const rejectFrame = (url) => {
    if (!url) return;
    setFailedUrls((current) => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });
  };

  return (
    <section className="pdp-catalogue" aria-labelledby="pdp-catalogue-h">
      <div className="v2-wrap">
        <div className="pdp-catalogue__head">
          <p className="v2-eyebrow">Product gallery</p>
          <h2 id="pdp-catalogue-h" className="pdp-sec__title serif">A closer look</h2>
        </div>
        <div className={`pdp-catalogue__grid${frames.length === 1 ? ' pdp-catalogue__grid--single' : ''}`}>
          {frames.map((frame, index) => (
            <ProductImage
              key={frame.id || frame.url}
              product={product}
              src={frame.url}
              alt={frame.alt || `${product.name} — image ${index + 2}`}
              sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 580px"
              frame="v2"
              className="pdp-catalogue__image"
              onImageError={rejectFrame}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
