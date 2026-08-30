import { useEffect, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Hero from '../components/Hero.jsx';
import HomeCategoryStrip from '../components/HomeCategoryStrip.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CompactProductCard from '../components/CompactProductCard.jsx';
import EditorialCard from '../components/EditorialCard.jsx';
import StoryBlock from '../components/StoryBlock.jsx';
import TrustStrip from '../components/TrustStrip.jsx';
import Newsletter from '../components/Newsletter.jsx';
import HomeOffers from '../components/promo/HomeOffers.jsx';
import { getBestsellers, getNewArrivals } from '../data/products.js';
import { homepage, getHomepageSnapshot, subscribeHomepage } from '../lib/settings.js';
import { sanitizeHomepageVisuals } from '../lib/homepageAppearance.js';
import { watchHomepageVisuals } from '../lib/homepageVisualSync.js';

// ============================================================================
// SORA LIFE V2 — HOMEPAGE
//
// Eleven blocks on one repeated interval, arranged as a curated sequence:
// arrive → orient → one campaign → proof → editorial → story → discovery →
// reassurance. Not a stack of unrelated merchandising modules.
//
// Every block is independently removable when its data does not exist. The
// three hardcoded editorial tiles that lived here in V1 carried authored
// marketing copy; V2 does not inherit them. Editorial and story content now
// comes from settings.homepage and renders nothing when unconfigured.
// ============================================================================

// Optional, admin-configured. Shapes:
//   homepage.editorials = [{ id, kicker, title, note, href, image, alt }]
//   homepage.story      = { eyebrow, title, body, cta, href, image, alt }
function configuredEditorials() {
  const list = homepage?.editorials;
  return Array.isArray(list) ? list.filter((e) => e && e.title && e.href).slice(0, 3) : [];
}

export default function Home() {
  const savedHomepage = useSyncExternalStore(subscribeHomepage, getHomepageSnapshot, getHomepageSnapshot);
  const visuals = sanitizeHomepageVisuals(savedHomepage.visuals);
  useEffect(watchHomepageVisuals, []);
  const bestsellers = getBestsellers(8);
  const newArrivals = getNewArrivals(8);
  const editorials = configuredEditorials();
  const story = homepage?.story;

  return (
    <div className="v2-home">
      {/* 1–2 · announcement + header are mounted by Layout via Header */}

      {/* 3 · HERO — image-led, copy directly over the artwork */}
      <Hero />

      {/* 4 · CATEGORY NAVIGATION — orientation, not merchandising */}
      <HomeCategoryStrip appearance={visuals.categoryStrip} />

      {/* 5 · CAMPAIGN / PROMOTION — existing promotions runtime, untouched.
             Renders nothing when no active promotion targets `home`. */}
      <HomeOffers appearance={visuals.offers} />

      {/* 6 · BESTSELLERS — compact, 2.2 cards visible on mobile */}
      {bestsellers.length >= 4 && (
        <section className="v2-sec">
          <div className="v2-wrap">
            <div className="v2-sechead">
              <div>
                <p className="v2-eyebrow">Loved this month</p>
                <h2 className="v2-h2">{homepage.bestsellerTitle || 'Bestsellers'}</h2>
              </div>
              <Link to="/shop?sort=bestselling" className="v2-more">
                View all <Icon name="chevronRight" size={12} stroke={1.8} />
              </Link>
            </div>
            <div className="v2-rail v2-rail--cards">
              {bestsellers.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* 7 · THIS WEEK — editorial cards. Hidden entirely when unconfigured. */}
      {editorials.length > 0 && (
        <section className="v2-sec">
          <div className="v2-wrap">
            <div className="v2-sechead">
              <div>
                <p className="v2-eyebrow">Fresh on the shelf</p>
                <h2 className="v2-h2">This week at Sora Life</h2>
              </div>
            </div>
            <div className="v2-rail">
              {editorials.map((e) => <EditorialCard key={e.id || e.title} item={e} />)}
            </div>
          </div>
        </section>
      )}

      {/* 8 · STORY — the only long-form entry point. Hidden when unconfigured. */}
      {story?.title && story?.href && (
        <section className="v2-sec">
          <div className="v2-wrap">
            <StoryBlock story={story} />
          </div>
        </section>
      )}

      {/* 9 · RECOMMENDATIONS — deliberately lighter than Bestsellers so the
             page tapers rather than repeating itself */}
      {newArrivals.length >= 4 && (
        <section className="v2-sec">
          <div className="v2-wrap">
            <div className="v2-sechead">
              <div>
                <p className="v2-eyebrow">Just added</p>
                <h2 className="v2-h2">New in at Sora Life</h2>
              </div>
              <Link to="/shop?filter=new" className="v2-more">
                See all <Icon name="chevronRight" size={12} stroke={1.8} />
              </Link>
            </div>
            <div className="v2-rail v2-rail--compact">
              {newArrivals.slice(0, 4).map((p) => <CompactProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* 10 · TRUST — operational facts only */}
      <section className="v2-sec">
        <div className="v2-wrap">
          <TrustStrip />
        </div>
      </section>

      {/* 11 · Newsletter + Footer + tab bar are existing components, unchanged
             in Phase 1 */}
      <Newsletter />
    </div>
  );
}
