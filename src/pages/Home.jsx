import { useEffect, useSyncExternalStore } from 'react';
import Hero from '../components/Hero.jsx';
import HomeCategoryStrip from '../components/HomeCategoryStrip.jsx';
import EditorialCard from '../components/EditorialCard.jsx';
import StoryBlock from '../components/StoryBlock.jsx';
import Newsletter from '../components/Newsletter.jsx';
import HomeOffers from '../components/promo/HomeOffers.jsx';
import {
  MarketplaceProductRail, FeaturedBrands, DiscoveryEdit, MomTrustSpotlight,
  CuratedCollections, CreatorCommunity, WhySoraLife,
} from '../components/HomeMarketplace.jsx';
import { ShopByCategory, ShopByConcerns } from '../components/HomeDiscoveryRails.jsx';
import { products } from '../data/products.js';
import { categories } from '../data/categories.js';
import { selectHomeMerchandising } from '../lib/homeMerchandising.js';
import { homepage, getHomepageSnapshot, subscribeHomepage } from '../lib/settings.js';
import { sanitizeHomepageVisuals } from '../lib/homepageAppearance.js';
import { watchHomepageVisuals } from '../lib/homepageVisualSync.js';

// ============================================================================
// SORA LIFE V2 — HOMEPAGE
//
// A catalogue-driven marketplace sequence: arrive → orient → offers → product
// discovery → brands → editorial commerce → collections → community → trust.
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
  const merchandise = selectHomeMerchandising(products, categories);
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

      {/* selectHomeMerchandising balances this across categories. It is NOT a
          popularity measure, and today it is not a curated one either: the live
          catalogue has no is_featured or is_bestseller rows, and every product
          carries a discount — so "trending", "featured" and "on offer" would
          all be claims the data cannot back. It is an entry point, so it says
          so. Flag real featured products and this can become a Featured rail. */}
      <MarketplaceProductRail id="trending" eyebrow="Across the catalogue" title="Start here" products={merchandise.trending} />

      {/* Two deliberately different category experiences: the circular rail
          under the hero is quick navigation, and this is the editorial browse.
          They sit far apart so neither reads as a duplicate of the other. */}
      <ShopByCategory />

      {/* Need-led discovery, paired with the section above: every concern is
          backed by real catalogue results (see homeDiscovery.js). */}
      <ShopByConcerns />

      <FeaturedBrands brands={merchandise.brands} />

      <DiscoveryEdit products={merchandise.discover} link={merchandise.discoverLink} />

      <MarketplaceProductRail
        id="popular"
        eyebrow={merchandise.popularEyebrow}
        title={merchandise.popularTitle}
        products={merchandise.popular}
        link={merchandise.popularTitle === 'Bestsellers' ? '/shop?sort=bestselling' : '/shop'}
      />

      <MomTrustSpotlight category={merchandise.momCategory} products={merchandise.momProducts} />

      <CuratedCollections collections={merchandise.collections} />

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

      <CreatorCommunity />

      <WhySoraLife />

      {/* 11 · Newsletter + Footer + tab bar are existing components, unchanged
             in Phase 1 */}
      <Newsletter />
    </div>
  );
}
