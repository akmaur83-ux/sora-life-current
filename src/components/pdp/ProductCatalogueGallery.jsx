import ProductImage from '../ProductImage.jsx';
import { secondaryProductGallery } from '../../data/products.js';

// A continuous, image-led view of genuine secondary catalogue media. The
// primary image stays in the main gallery above and is never repeated here.
export default function ProductCatalogueGallery({ product }) {
  const frames = secondaryProductGallery(product);
  if (!frames.length) return null;

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
            />
          ))}
        </div>
      </div>
    </section>
  );
}
