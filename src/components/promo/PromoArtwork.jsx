import { Link } from 'react-router-dom';
import PromoCopyCode from './PromoCopyCode.jsx';
import DeferredImage from '../DeferredImage.jsx';

// ============================================================
// UPLOADED PROMOTION ARTWORK — the shared image-first renderer.
//
// Both surfaces that show an admin-uploaded poster (PromoPoster's image
// branch and the homepage offers rail) render through here, so a promotion
// behaves identically wherever it appears.
//
// The visual contract is unchanged and deliberate: uploaded artwork is shown
// EDGE TO EDGE with nothing drawn on top of it. Title, subtitle, badge and
// CTA text stay off the image — the uploaded creative already carries its own
// designed typography, and overlaying ours on top of it looked wrong.
//
// What was missing is the FUNCTION behind that creative:
//
//   ctaUrl      -> the artwork itself becomes the click target. No visible
//                  CTA text is added; the poster is the button.
//   couponCode  -> the existing copy-code ticket renders BELOW the image,
//                  never over it, so a code the admin published is reachable.
//
// The coupon ticket contains a real <button>, so it is always a SIBLING of
// the link — never a descendant — to avoid nested interactive elements.
//
// `promo.ctaUrl` arrives already sanitized by safeCtaUrl() in
// src/lib/promotions.js (internal path or absolute https only). This
// component deliberately does NOT re-validate: there is exactly one URL
// policy and it lives there. The https test below is a ROUTING decision
// (router link vs. new-tab anchor), not a security check.
// ============================================================

/**
 * The accessible name for clickable artwork.
 *
 * An image poster's alt text describes the picture; the link needs to say
 * what activating it DOES. Preference order is the admin's own words:
 * CTA text, then the promotion title, then the badge. Never empty — a
 * renderable promotion always has a title (see isRenderablePromo), and an
 * empty aria-label would leave the link unnamed for a screen reader.
 */
export function artworkLinkLabel(promo) {
  const name = [promo?.ctaText, promo?.title, promo?.badgeText]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .find(Boolean);
  return name || null;
}

export default function PromoArtwork({
  promo,
  src,
  className = '',
  imgClassName = '',
  onError,
}) {
  if (!promo || !src) return null;
  const { ctaUrl, couponCode, title } = promo;
  const label = artworkLinkLabel(promo);
  // Routing shape only — the value is already policy-checked upstream.
  const isExternal = !!ctaUrl && /^https:\/\//i.test(ctaUrl);

  const image = (
    <DeferredImage
      className={imgClassName}
      src={src}
      alt={title || 'Promotion'}
      width={1500}
      height={1000}
      onError={onError}
    />
  );

  let artwork = image;
  if (ctaUrl) {
    artwork = isExternal
      ? (
        <a
          className="promo-artwork__link"
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          {...(label ? { 'aria-label': label } : {})}
        >
          {image}
        </a>
      )
      : (
        <Link
          className="promo-artwork__link"
          to={ctaUrl}
          {...(label ? { 'aria-label': label } : {})}
        >
          {image}
        </Link>
      );
  }

  return (
    <article className={`${className}${couponCode ? ' promo-artwork--has-code' : ''}`}>
      {artwork}
      {couponCode && <PromoCopyCode code={couponCode} className="promo-artwork__code" />}
    </article>
  );
}
