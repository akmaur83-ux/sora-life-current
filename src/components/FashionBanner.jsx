import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

// ============================================================
// The doorway from the wellness homepage to the fashion store. One block,
// no data dependency, so it renders on every visit regardless of what the
// fashion catalogue holds. Styled in fashion-banner.css (storefront bundle).
// ============================================================
export default function FashionBanner() {
  return (
    <section className="v2-sec fsb" aria-labelledby="fsb-h">
      <div className="v2-wrap">
        <Link to="/fashion" className="fsb__card">
          <span className="fsb__leaf" aria-hidden="true" />
          <span className="fsb__txt">
            <span className="fsb__eyebrow">New · Fashion &amp; Lifestyle</span>
            <strong className="fsb__h" id="fsb-h">Clothing, footwear, bags, beauty and accessories — the SORA LIFE fashion store</strong>
            <span className="fsb__sub">Same account, same bag, one checkout.</span>
          </span>
          <span className="fsb__cta">Explore fashion <Icon name="arrowRight" size={16} /></span>
        </Link>
      </div>
    </section>
  );
}
