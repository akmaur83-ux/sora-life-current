// The admin-configurable wrapper (background, borders, padding, decorations)
// is unchanged. Only its contents were upgraded, from the small circular rail
// to the large image-led category cards, so the homepage carries ONE category
// section rather than two near-identical ones.
import { categories } from '../data/categories.js';
import { ShopByCategory } from './HomeDiscoveryRails.jsx';
import HomeVisualLayers from './HomeVisualLayers.jsx';

export default function HomeCategoryStrip({ appearance: a }) {
  // Match CategoryRail's existing empty-state rule, without changing its links.
  if (categories.filter((c) => c?.slug && c?.name).length < 3) return null;
  return <section className="v2-home-categories hp-category-strip" style={{
    paddingTop: a.paddingTop, paddingBottom: a.paddingBottom,
    backgroundColor: a.enabled ? a.backgroundColor : 'transparent',
    borderTop: a.borderTop ? `${a.borderWidth}px solid ${a.borderColor}` : undefined,
    borderBottom: a.borderBottom ? `${a.borderWidth}px solid ${a.borderColor}` : undefined,
    borderRadius: a.radius,
  }}>
    {a.enabled && <>
      <HomeVisualLayers
        background={{ url: a.imageUrl, fit: a.imageSize, position: a.imagePosition, opacity: a.imageOpacity }}
        texture={{ url: a.textureUrl, fit: 'cover', position: a.texturePosition, opacity: a.decorationOpacity, hideMobile: a.hideTextureMobile }}
        left={{ url: a.leftImage, opacity: a.decorationOpacity, size: a.decorationSize, position: `left ${a.decorationPosition}`, hideMobile: a.hideLeftMobile }}
        right={{ url: a.rightImage, opacity: a.decorationOpacity, size: a.decorationSize, position: `right ${a.decorationPosition}`, hideMobile: a.hideRightMobile }} />
      {a.overlayOpacity > 0 && <span aria-hidden="true" className="hp-category-overlay" style={{ backgroundColor: a.overlayColor, opacity: a.overlayOpacity }} />}
    </>}
    <div className="v2-wrap hp-category-strip__content">
      <ShopByCategory />
    </div>
  </section>;
}
