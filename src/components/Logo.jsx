import { useState } from 'react';
import { Link } from 'react-router-dom';

// Official logo asset (drop the uploaded PNG here — see assets/README).
// Served from the project web root at /assets/sora-life-logo.png.
const LOGO_SRC = '/assets/sora-life-logo.png';

// Fallback vector sparrow + berry (shown until the raster logo is present,
// and in light/dark contexts like the footer where the dark logo art would
// be invisible). Kept from the previous implementation.
export function SparrowMark({ size = 26, light = false }) {
  const green = light ? '#FBF8F1' : 'var(--forest-700)';
  const gold = 'var(--honey-500)';
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 44 32" fill="none" aria-hidden="true">
      <circle cx="4.4" cy="12.4" r="2.6" fill={gold} />
      <path d="M4.4 9.9c.9.6.9 1.9 0 2.5" stroke={green} strokeWidth="0.6" opacity="0.5" />
      <path d="M8.5 13.4 C10.6 11 14 10.2 17 12 C24 8 32 6 40.5 4 C34.5 10 30.5 13.8 26.6 16.6 C24.6 21.6 19.6 24.8 14.2 23 C11.4 22 9.4 20 9.2 17.2 L5 13.6 Z" fill={green} />
      <path d="M15.5 15.2 C19.5 16.4 23.4 15.4 27 13.2" stroke={light ? '#1E3A2F' : 'var(--honey-300)'} strokeWidth="1.1" strokeLinecap="round" opacity="0.75" fill="none" />
      <circle cx="11.4" cy="14" r="0.9" fill={light ? '#1E3A2F' : '#0F1F17'} />
    </svg>
  );
}

export default function Logo({ compact = false, light = false, tagline = true }) {
  const [imgOk, setImgOk] = useState(true);
  const fg = light ? '#FBF8F1' : 'var(--forest-700)';
  const sub = light ? 'rgba(251,248,241,0.72)' : 'var(--ink-500)';

  // Use the official raster logo in the header (non-light contexts).
  if (!light && imgOk) {
    return (
      <Link to="/" className={`logo logo--img ${compact ? 'logo--compact' : ''}`} aria-label="Sora Life — Health and Wellness">
        <img src={LOGO_SRC} alt="Sora Life — Health and Wellness" className="logo__img" onError={() => setImgOk(false)} />
      </Link>
    );
  }

  // Vector fallback (footer / dark surfaces / until the asset is added).
  return (
    <Link to="/" className="logo" aria-label="Sora Life home" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
      <span style={{ marginBottom: 4, display: 'inline-flex' }}><SparrowMark size={compact ? 24 : 30} light={light} /></span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: compact ? '1.15rem' : '1.4rem', letterSpacing: '0.12em', color: fg }}>
        SORA LIFE
      </span>
      {tagline && !compact && (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5rem', letterSpacing: '0.34em', color: sub, marginTop: 4, fontWeight: 600 }}>
          HEALTH &amp; WELLNESS
        </span>
      )}
    </Link>
  );
}
