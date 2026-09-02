import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sanitizeHeroCta, heroCtaStyle } from '../lib/heroCtaAppearance.js';

function CtaImage({ src, className }) {
  const [failed, setFailed] = useState(false);
  return !failed && <img src={src} className={className} alt="" aria-hidden="true" onError={() => setFailed(true)} />;
}

export default function HeroCta({ cta, appearance, placement = 'flow', artworkOnly = false, active = true, children }) {
  if (!cta?.to) return null;
  const a = sanitizeHeroCta(appearance);
  return <div className={`hero-cta hero-cta--${placement}`} style={heroCtaStyle(a)}
    data-desktop={a.desktopPosition} data-mobile="custom">
    <Link to={cta.to} className="v2-btn v2-btn--sm hero-cta__button" tabIndex={active ? undefined : -1}>
      {a.textureUrl && <CtaImage key={a.textureUrl} src={a.textureUrl} className="hero-cta__texture" />}
      {a.iconUrl && a.iconSide === 'left' && <CtaImage key={a.iconUrl} src={a.iconUrl} className="hero-cta__icon" />}
      <span className="hero-cta__label">{children || cta.label}</span>
      {a.iconUrl && a.iconSide === 'right' && <CtaImage key={a.iconUrl} src={a.iconUrl} className="hero-cta__icon" />}
    </Link>
  </div>;
}
