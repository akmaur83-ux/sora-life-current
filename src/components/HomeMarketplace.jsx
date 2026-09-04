import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductCard from './ProductCard.jsx';
import CompactProductCard from './CompactProductCard.jsx';
import ProductImage from './ProductImage.jsx';

function SectionHeading({ eyebrow, title, copy, link, linkLabel = 'View all' }) {
  return (
    <div className="v2-sechead hm-heading">
      <div>
        {eyebrow && <p className="v2-eyebrow">{eyebrow}</p>}
        <h2 className="v2-h2">{title}</h2>
        {copy && <p className="hm-heading__copy">{copy}</p>}
      </div>
      {link && <Link to={link} className="v2-more">{linkLabel} <Icon name="chevronRight" size={12} stroke={1.8} /></Link>}
    </div>
  );
}

export function MarketplaceProductRail({ id, eyebrow, title, products, link = '/shop' }) {
  if (!Array.isArray(products) || products.length < 4) return null;
  return (
    <section className="v2-sec hm-section" data-home-section={id}>
      <div className="v2-wrap">
        <SectionHeading eyebrow={eyebrow} title={title} link={link} />
        <div className="v2-rail v2-rail--cards hm-product-rail">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}

export function FeaturedBrands({ brands }) {
  // One brand would turn a marketplace module into a takeover. Wait until the
  // real catalogue can support an actual comparison/discovery experience.
  if (!Array.isArray(brands) || brands.length < 2) return null;
  return (
    <section className="v2-sec hm-section hm-section--brands" data-home-section="brands">
      <div className="v2-wrap">
        {/* NOT a directory. This section can only show labels the catalogue can
            prove, and the catalogue has no brand field yet — so it currently
            surfaces a couple of names while other real brands (Roshna Herbals,
            TIENS) sit in the range unrepresented. "Brand directory" promised a
            complete list we cannot deliver; a spotlight promises exactly what
            this is. Revisit when brand metadata exists. */}
        <SectionHeading
          eyebrow="Multi-brand marketplace"
          title="Brands in the range"
          copy="A few of the labels you'll find here — the catalogue carries more."
        />
        <div className={`hm-brands${brands.length === 1 ? ' hm-brands--single' : ''}`}>
          {brands.map((brand, index) => {
            const product = brand.products[0];
            return (
              <Link key={brand.name} to={`/product/${product.slug}`} className={`hm-brand hm-brand--${index + 1}`}>
                <div className="hm-brand__media"><ProductImage product={product} frame="v2" sizes="(max-width: 767px) 48vw, 300px" /></div>
                <div className="hm-brand__body">
                  {/* The raw count was truthful but made the marketplace read
                      as one dominant label beside a small one. Brand discovery
                      does not need the tally to be useful. */}
                  <span className="hm-brand__kicker">Brand</span>
                  <h3>{brand.name}</h3>
                  <span className="hm-brand__link">Discover the brand <Icon name="arrowRight" size={14} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function DiscoveryEdit({ products, link = '/shop' }) {
  if (!Array.isArray(products) || products.length < 4) return null;
  const [lead, ...supporting] = products;
  return (
    <section className="v2-sec hm-section hm-section--discover" data-home-section="discover">
      <div className="v2-wrap">
        <SectionHeading
          eyebrow="Keep exploring"
          title="More of the range"
          copy="Products from across the catalogue you have not already seen further up this page."
          link={link}
          linkLabel="Explore all"
        />
        <div className="hm-discover">
          <div className="hm-discover__lead"><ProductCard product={lead} /></div>
          <div className="hm-discover__list">
            {supporting.slice(0, 4).map((product) => <CompactProductCard key={product.id} product={product} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function MomTrustSpotlight({ category, products }) {
  if (!Array.isArray(products) || !products.length) return null;
  const [lead, ...more] = products;
  const destination = category?.slug ? `/category/${category.slug}` : `/product/${lead.slug}`;
  return (
    <section className="v2-sec hm-section" data-home-section="mom-trust">
      <div className="v2-wrap">
        <div className="hm-mom">
          <Link to={`/product/${lead.slug}`} className="hm-mom__media" aria-label={lead.name}>
            <ProductImage product={lead} frame="v2" sizes="(max-width: 767px) 100vw, 560px" />
          </Link>
          <div className="hm-mom__body">
            <p className="v2-eyebrow">Brand spotlight</p>
            <h2>Mom Trust</h2>
            <p>Explore the Mom Trust products currently available through the SORA LIFE catalogue.</p>
            <div className="hm-mom__products">
              {[lead, ...more].slice(0, 3).map((product) => (
                <Link key={product.id} to={`/product/${product.slug}`}>{product.name}<Icon name="chevronRight" size={13} /></Link>
              ))}
            </div>
            <Link to={destination} className="v2-btn v2-btn--sm">Explore Mom Trust</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CuratedCollections({ collections }) {
  if (!Array.isArray(collections) || collections.length < 2) return null;
  return (
    <section className="v2-sec hm-section" data-home-section="collections">
      <div className="v2-wrap">
        <SectionHeading
          eyebrow="Browse the range"
          title="Inside every category"
          copy="Real products from each part of the catalogue, so you can see where to start."
        />
        <div className="hm-collections">
          {collections.map(({ category, products }) => (
            <Link key={category.slug} to={`/category/${category.slug}`} className="hm-collection">
              <div className="hm-collection__images" aria-hidden="true">
                {products.slice(0, 3).map((product) => <ProductImage key={product.id} product={product} frame="v2" sizes="160px" />)}
              </div>
              <div className="hm-collection__body">
                <span>Curated category</span>
                <h3>{category.name}</h3>
                <span className="hm-collection__link">Explore category <Icon name="arrowRight" size={14} /></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CreatorCommunity() {
  return (
    <section className="v2-sec hm-section" data-home-section="creator">
      <div className="v2-wrap">
        <div className="hm-creator">
          <div className="hm-creator__mark" aria-hidden="true"><Icon name="users" size={42} stroke={1.25} /></div>
          <div className="hm-creator__copy">
            <p className="v2-eyebrow">SORA LIFE Creator Program</p>
            <h2>Share what you genuinely discover.</h2>
            <p>Use your customer account to explore the Creator Program, its attribution model and your application status.</p>
          </div>
          <Link to="/account/creator" className="v2-btn v2-btn--gold">Explore the program <Icon name="arrowRight" size={15} /></Link>
        </div>
      </div>
    </section>
  );
}

const TRUST_ITEMS = [
  { icon: 'grid', title: 'Broad discovery', copy: 'Browse the active catalogue by category, search and filters.', to: '/shop' },
  { icon: 'lock', title: 'Secure checkout', copy: 'Payment amounts are verified by the server before an order is created.', to: '/cart' },
  { icon: 'heart', title: 'Keep a wishlist', copy: 'Save products and return to them from your account or this device.', to: '/wishlist' },
  { icon: 'package', title: 'Orders in one place', copy: 'Signed-in customers can revisit their order information.', to: '/account/orders' },
];

export function WhySoraLife() {
  return (
    <section className="v2-sec hm-section hm-section--trust" data-home-section="why-sora-life">
      <div className="v2-wrap">
        <SectionHeading eyebrow="Built for confident browsing" title="Why shop SORA LIFE" />
        <div className="hm-trust">
          {TRUST_ITEMS.map((item, index) => (
            <Link key={item.title} to={item.to} className="hm-trust__item">
              <span className="hm-trust__number">0{index + 1}</span>
              <Icon name={item.icon} size={21} stroke={1.4} />
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <span className="hm-trust__link">Explore <Icon name="arrowRight" size={13} /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
