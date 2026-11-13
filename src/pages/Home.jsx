import { useEffect, useSyncExternalStore } from 'react';
import { HomeHero, HomeTrustStrip, HomeTiles, ExploreStores, FestivePromo, JewelleryBanner } from '../components/HomeStorefront.jsx';
import EditorialCard from '../components/EditorialCard.jsx';
import StoryBlock from '../components/StoryBlock.jsx';
import Newsletter from '../components/Newsletter.jsx';
import HomeOffers from '../components/promo/HomeOffers.jsx';
import HomeLeaderboard from '../components/HomeLeaderboard.jsx';
import { LifestyleBanner } from '../components/FashionBanner.jsx';
import BrandCarousel from '../components/BrandCarousel.jsx';
import { BiosashRange } from '../components/BiosashRange.jsx';
import HomeGroup from '../components/HomeGroup.jsx';
import { NewArrivals } from '../components/NewArrivals.jsx';
import { LuxuryBeds, Bedsheets } from '../components/HomeCategoryRails.jsx';
import RecentlyViewedHome from '../components/RecentlyViewedHome.jsx';
import OfferBanner from '../components/OfferBanner.jsx';
import GiftShop from '../components/GiftShop.jsx';
import { TopDeals, WishlistRail, BagReminder } from '../components/HomeExtras.jsx';
import {
  MarketplaceProductRail, DiscoveryEdit, MomTrustSpotlight,
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

      {/* 2026-11-13 redesign ("homepage cleanup"): the page in four parts, each opened by
          a HomeGroup band — Offers, Shop by store, Our brands, For you — then the
          closing blocks. The ten partner sections that ran one after another are one
          "Our brands" row now (BrandCarousel.jsx), each card opening the brand's page;
          the store carousel that repeated "Explore the stores" and the wellness
          brand row are gone. */}

      {/* The top of the page — white with an orange accent (HomeStorefront.jsx).
             The hero is static: the admin Hero Slides page no longer drives it,
             and the circle row replaced the category strip. */}
      <HomeHero />
      <HomeTrustStrip />
      {/* Something already in the bag: how many, and the way to it (HomeExtras.jsx). */}
      <BagReminder phone={false} />
      <HomeTiles />
      {/* The round quick-nav row stays straight under the hero, above the offers (test-home-discovery D18). */}
      <ExploreStores />

      <HomeGroup eyebrow="Offers" title="Deals worth grabbing" />
      {/* The running offer with a live countdown (OfferBanner.jsx); nothing once it ends. */}
      <OfferBanner wrap="hx-wrap" />
      {/* The biggest verified discounts in stock (HomeExtras.jsx). */}
      <TopDeals />
      <FestivePromo />
      {/* Existing promotions runtime: nothing when no active promotion targets `home`. */}
      <HomeOffers appearance={visuals.offers} />

      <HomeGroup eyebrow="Shop by store" title="Wellness, fashion and home" />
      {/* The editorial category browse and the need-led one (HomeDiscoveryRails.jsx). */}
      <ShopByCategory />
      <ShopByConcerns />
      {/* Gift-ready categories across Fashion and Home & Living (GiftShop.jsx). */}
      <GiftShop />
      {/* The products flagged new, across the stores (NewArrivals.jsx; View All opens /new). */}
      <NewArrivals />
      {/* Biosash's own range stays here, straight after New Arrivals (owner, 2026-11-07). */}
      <BiosashRange />
      {/* Home & Living's Bedsheets, straight under the Biosash range (HomeCategoryRails.jsx). */}
      <Bedsheets />
      <LifestyleBanner />

      {/* The doorway to the jewellery page, directly under the fashion category strip. */}
      <JewelleryBanner />

      <HomeGroup eyebrow="Our brands" title="The makers behind SORA" />
      <BrandCarousel />

      <HomeGroup eyebrow="For you" title="Picked for you" />
      {/* This visitor's recently viewed and saved products (this browser only). */}
      <RecentlyViewedHome />
      <WishlistRail />
      {/* selectHomeMerchandising balances this across categories: an entry point, not a popularity claim. */}
      <MarketplaceProductRail id="trending" eyebrow="Across the catalogue" title="Start here" products={merchandise.trending} />
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
                <h2 className="v2-h2">This week at Sora Lifestyle</h2>
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

      {/* Home & Living's Luxury Beds near the foot of the page, after "Why Sora Life" (owner, 2026-11-07). */}
      <LuxuryBeds />

      {/* 11 · Newsletter + Footer + tab bar are existing components, unchanged
             in Phase 1 */}
      <Newsletter />

      {/* 12 · CREATOR LEADERBOARD — the dark block that closes the page and
             runs into the footer. Absent until a creator has confirmed sales. */}
      <HomeLeaderboard />
    </div>
  );
}
