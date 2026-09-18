import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import DeferredImage from './DeferredImage.jsx';

// ============================================================
// The homepage doorway to the two existing stores. No catalogue dependency.
// Images stay deferred; all editorial copy and navigation remain real HTML.
// ============================================================
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
          <Link to="/fashion" className="fsb__card fsb__card--fashion" aria-labelledby="fsb-fashion-h fsb-fashion-cta">
            <div className="fsb__art">
              <DeferredImage src="/img/fashion-hero.webp" alt="Relaxed olive and cream styling in a warm, sunlit studio" width={1599} height={900} className="fsb__image" />
            </div>
            <div className="fsb__content">
              <p className="fsb__eyebrow">Discover your style</p>
              <h3 className="fsb__h" id="fsb-fashion-h"><span>Fashion</span> <span>Store</span></h3>
              <p className="fsb__description">Clothing, footwear, bags, beauty and accessories — all in one place.</p>
              <span className="fsb__cta" id="fsb-fashion-cta">Explore Fashion <Icon name="arrowRight" size={18} /></span>
              <ul className="fsb__details" aria-label="Explore fashion">
                <li><Icon name="bag" size={22} /><span>Clothing<br />&amp; more</span></li>
                <li><Icon name="sparkle" size={22} /><span>Everyday<br />style</span></li>
                <li><Icon name="search" size={22} /><span>Easy<br />shopping</span></li>
              </ul>
            </div>
          </Link>
          <Link to="/homeliving" className="fsb__card fsb__card--living" aria-labelledby="fsb-living-h fsb-living-cta">
            <div className="fsb__art">
              <DeferredImage src="/img/homeliving-hero.webp" alt="Sunlit bedroom with a woven headboard, botanical textiles and warm wood" width={1600} height={900} className="fsb__image" />
            </div>
            <div className="fsb__content">
              <p className="fsb__eyebrow">Make space for a better you</p>
              <h3 className="fsb__h" id="fsb-living-h"><span>Home &amp; Living</span> <span>Store</span></h3>
              <p className="fsb__description">Home textiles, soft furnishings and everyday essentials for your space.</p>
              <span className="fsb__cta" id="fsb-living-cta">Explore Living <Icon name="arrowRight" size={18} /></span>
              <ul className="fsb__details" aria-label="Explore home and living">
                <li><Icon name="leaf" size={22} /><span>Soft<br />textures</span></li>
                <li><Icon name="home" size={22} /><span>Calm<br />spaces</span></li>
                <li><Icon name="grid" size={22} /><span>Everyday<br />living</span></li>
              </ul>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
