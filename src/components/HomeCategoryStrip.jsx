import { categories } from '../data/categories.js';
import CategoryRail from './CategoryRail.jsx';
import HomeVisualLayers from './HomeVisualLayers.jsx';

export default function HomeCategoryStrip({ appearance: a }) {
  // Match CategoryRail's existing empty-state rule, without changing its links.
  if (categories.filter((c) => c?.slug && c?.name).length < 3) return null;
  // The admin's padding arrives as custom properties rather than inline
  // padding. An inline `padding` beats every stylesheet rule at every width,
  // which is how a 12px value tuned for the phone's full-bleed strip was also
  // the desktop section's padding. As a variable the stylesheet decides where
  // it applies: below 1024px it is used as-is (identical result), and at
  // desktop the page's section rhythm takes over.
  return <section className="v2-home-categories hp-category-strip" style={{
    '--hp-strip-pt': `${a.paddingTop}px`, '--hp-strip-pb': `${a.paddingBottom}px`,
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
      <div className="hm-category-head">
        <div>
          <p className="v2-eyebrow">Shop the catalogue</p>
          <h2 className="v2-h2">Browse by category</h2>
        </div>
        <span>Swipe to explore <span aria-hidden="true">→</span></span>
      </div>
      <CategoryRail />
    </div>
  </section>;
}
