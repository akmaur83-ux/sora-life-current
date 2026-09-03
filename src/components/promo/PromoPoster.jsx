import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import PromoCopyCode from './PromoCopyCode.jsx';
import PromoArtwork from './PromoArtwork.jsx';
import { offerCalloutFrom } from '../../lib/promotions.js';

// ============================================================
// PROMO POSTER — the campaign creative.
//
// Composition (see src/styles/promotions.css):
//   text column   eyebrow chip -> headline -> support line -> dominant
//                 offer callout -> coupon ticket -> CTA
//   art column    the admin's uploaded image when there is one, otherwise a
//                 restrained CSS botanical layer (arcs + leaf + soft radial)
//
// Responsive modes, from ONE data shape (no schema field needed):
//   mobile  + image -> image-background, theme scrim keeps text readable
//   desktop + image -> image-right, ~38% column, scrim feathers the seam
//   no image        -> editorial text poster with the decorative layer
//
// Presentation only. `couponCode` is shown + copyable; it is not a checkout
// coupon and changes no totals. The offer callout is derived by reading the
// admin's own badge/title/subtitle back — never computed from a price.
// ============================================================
function PromoCta({ to, children }) {
  if (!to) return null;
  const isExternal = /^https:\/\//i.test(to);
  const cls = 'promo-poster__cta';
  return isExternal
    ? <a className={cls} href={to} target="_blank" rel="noopener noreferrer">{children} <Icon name="arrowRight" size={16} /></a>
    : <Link className={cls} to={to}>{children} <Icon name="arrowRight" size={16} /></Link>;
}

export default function PromoPoster({ promo }) {
  if (!promo) return null;
  const { title, subtitle, badgeText, couponCode, ctaText, ctaUrl, imageUrl, themeVariant, textAlign } = promo;
  const callout = offerCalloutFrom(promo);
// Uploaded artwork stands on its own — no scrim, no overlaid copy. The
// admin's CTA and coupon still function: PromoArtwork makes the image itself
// the click target and puts the code ticket below it, never over it.
if (imageUrl) {
  return (
    <PromoArtwork
      promo={promo}
      src={imageUrl}
      className="promo-poster promo-poster--image-only"
      imgClassName="promo-poster__fullimg"
    />
  );
}

  return (
    <article
      className={[
        'promo-poster',
        `promo-poster--${themeVariant}`,
        imageUrl ? 'has-image' : 'no-image',
        textAlign === 'center' ? 'is-center' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="promo-poster__art" aria-hidden="true">
        {imageUrl
          ? <img className="promo-poster__img" src={imageUrl} alt="" loading="lazy" decoding="async" />
          : (
            <span className="promo-poster__deco">
              <span className="promo-poster__leaf" />
            </span>
          )}
        <span className="promo-poster__scrim" />
      </div>

      <div className="promo-poster__body">
        {badgeText && <span className="promo-poster__badge">{badgeText}</span>}
        {title && <h3 className="promo-poster__title serif">{title}</h3>}
        {subtitle && <p className="promo-poster__sub">{subtitle}</p>}

        {callout && (
          <p className="promo-poster__callout">
            <span className="promo-poster__callout-rule" aria-hidden="true" />
            <span className="promo-poster__callout-val">{callout}</span>
          </p>
        )}

        {(couponCode || (ctaUrl && ctaText)) && (
          <div className="promo-poster__actions">
            {couponCode && <PromoCopyCode code={couponCode} label="Use code" />}
            {ctaUrl && ctaText && <PromoCta to={ctaUrl}>{ctaText}</PromoCta>}
          </div>
        )}
      </div>
    </article>
  );
}
