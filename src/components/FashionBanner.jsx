import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import DeferredImage from './DeferredImage.jsx';

// ============================================================
// The homepage doorway to the two other stores. No catalogue dependency.
//
// Each card is one whole-card link over one photograph. The photo is a
// full-bleed background and every word sits on it as HTML: on wide screens
// the copy runs down the LEFT of a 16:9 landscape shot whose subject sits
// to the right; under 1024px the browser swaps in a 4:5 portrait shot whose
// subject sits low, and the copy takes the empty upper area while the three
// icon badges drop below the photo. The <picture> does the choosing, so a
// phone never downloads the landscape file and a desktop never the portrait.
// Images stay deferred until they scroll near; nothing is baked into them.
// ============================================================
const TALL = '(max-width: 1023px)';

const STORES = [
  {
    key: 'fashion',
    to: '/fashion',
    eyebrow: 'Discover your style',
    heading: ['Fashion', 'Store'],
    description: 'Clothing, footwear, bags, beauty and accessories — all in one place.',
    cta: 'Explore Fashion',
    wide: '/img/doorway-fashion-wide.webp',
    tall: '/img/doorway-fashion-tall.webp',
    alt: 'Camel coat and cream turtleneck, seated against a sunlit plaster wall',
    detailsLabel: 'Explore fashion',
    details: [['bag', 'Clothing', '& more'], ['sparkle', 'Everyday', 'style'], ['search', 'Easy', 'shopping']],
  },
  {
    key: 'living',
    to: '/homeliving',
    eyebrow: 'Make space for a better you',
    heading: ['Home & Living', 'Store'],
    description: 'Home textiles, soft furnishings and everyday essentials for your space.',
    cta: 'Explore Living',
    wide: '/img/doorway-living-wide.webp',
    tall: '/img/doorway-living-tall.webp',
    alt: 'Cream sofa with green cushions and a throw, a wooden coffee table and a jute rug in soft light',
    detailsLabel: 'Explore home and living',
    details: [['leaf', 'Soft', 'textures'], ['home', 'Calm', 'spaces'], ['grid', 'Everyday', 'living']],
  },
];

function DoorwayCard({ store }) {
  const hId = `fsb-${store.key}-h`;
  const ctaId = `fsb-${store.key}-cta`;
  return (
    <Link to={store.to} className={`fsb__card fsb__card--${store.key}`} aria-labelledby={`${hId} ${ctaId}`}>
      <div className="fsb__art">
        <DeferredImage
          src={store.wide}
          sources={[{ media: TALL, srcSet: store.tall }]}
          alt={store.alt}
          width={1600}
          height={900}
          className="fsb__image"
        />
      </div>
      <div className="fsb__content">
        <div className="fsb__copy">
          <p className="fsb__eyebrow">{store.eyebrow}</p>
          <h3 className="fsb__h" id={hId}><span>{store.heading[0]}</span> <span>{store.heading[1]}</span></h3>
          <p className="fsb__description">{store.description}</p>
          <span className="fsb__cta" id={ctaId}>{store.cta} <Icon name="arrowRight" size={18} /></span>
        </div>
        <ul className="fsb__details" aria-label={store.detailsLabel}>
          {store.details.map(([icon, a, b]) => (
            <li key={icon}><Icon name={icon} size={22} /><span>{a}<br />{b}</span></li>
          ))}
        </ul>
      </div>
    </Link>
  );
}

export default function FashionBanner() {
  return (
    <section className="v2-sec fsb" aria-labelledby="fsb-h" id="more-to-explore">
      <div className="v2-wrap">
        <header className="fsb__intro">
          <p className="fsb__eyebrow fsb__overline">More to explore</p>
          <h2 id="fsb-h">Two Worlds. A Better You.</h2>
          <p className="fsb__lede">Fashion for your style. Living for your space. All at SORA LIFE.</p>
        </header>
        <div className="fsb__grid">
          {STORES.map((store) => <DoorwayCard key={store.key} store={store} />)}
        </div>
      </div>
    </section>
  );
}
