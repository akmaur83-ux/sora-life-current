import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import PromoCopyCode from './PromoCopyCode.jsx';

// ============================================================
// COMPACT OFFER CARD — a mini campaign creative, not a system alert.
//
//   [icon]  badge label    (small, accent, uppercase)
//   BOLD OFFER TITLE
//   one-line explanation
//   ─────────────────────
//   code ticket / CTA      (anchored at the bottom of every card so a row
//                           of cards lines up)
//
// The dominant discount callout lives on the poster, not here, so a rail of
// cards stays scannable and never repeats the same number twice.
//
// Presentation only. A code is copyable, never auto-applied. No totals change.
// ============================================================
const BADGE_ICON = {
  'Free shipping': 'truck',
  'Free delivery': 'truck',
  'Limited time': 'clock',
  'Weekend offer': 'gift',
  'Special deal': 'tag',
  Cashback: 'card',
};

export default function PromoOfferCard({ promo }) {
  if (!promo) return null;
  const { title, subtitle, badgeText, couponCode, ctaText, ctaUrl, imageUrl, themeVariant } = promo;
  const icon = BADGE_ICON[badgeText] || 'tag';
  const isExternal = ctaUrl && /^https:\/\//i.test(ctaUrl);
  // "Copy code" is handled by the ticket; only render a link CTA when it
  // actually points somewhere and isn't just restating the copy action.
  const showLinkCta = ctaUrl && ctaText && !/copy/i.test(ctaText);

  return (
    <article className={`promo-offer promo-offer--${themeVariant}`}>
      <div className="promo-offer__top">
        <span className="promo-offer__ic" aria-hidden="true">
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy" decoding="async" /> : <Icon name={icon} size={18} />}
        </span>
        {badgeText && <span className="promo-offer__badge">{badgeText}</span>}
      </div>

      <div className="promo-offer__body">
        {title && <strong className="promo-offer__title">{title}</strong>}
        {subtitle && <p className="promo-offer__sub">{subtitle}</p>}
      </div>

      {(couponCode || showLinkCta) && (
        <div className="promo-offer__foot">
          {couponCode && <PromoCopyCode code={couponCode} />}
          {showLinkCta && (
            isExternal
              ? <a className="promo-offer__cta" href={ctaUrl} target="_blank" rel="noopener noreferrer">{ctaText} <Icon name="arrowRight" size={14} /></a>
              : <Link className="promo-offer__cta" to={ctaUrl}>{ctaText} <Icon name="arrowRight" size={14} /></Link>
          )}
        </div>
      )}
    </article>
  );
}
